using ClinicsManagementService.Configuration;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Services.Interfaces;
using Microsoft.Playwright;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Threading;
using ClinicsManagementService.Services;

namespace ClinicsManagementService.Services.Application
{
    // Note: removed AsyncExecutionHelper; call sites use explicit try/catch now.

    public class WhatsAppMessageSender : IMessageSender
    {
        private readonly IWhatsAppService _whatsappService;
        private readonly Func<int, IBrowserSession> _browserSessionFactory;
        private readonly INotifier _notifier;
        private readonly IRetryService _retryService;
        private readonly IWhatsAppSessionManager _sessionManager;
        private readonly IWhatsAppUIService _whatsappUIService;
        private readonly IWhatsAppSessionSyncService _sessionSyncService;
        
        public WhatsAppMessageSender(
            IWhatsAppService whatsappService, 
            Func<int, IBrowserSession> browserSessionFactory, 
            INotifier notifier, 
            IRetryService retryService, 
            IWhatsAppSessionManager sessionManager, 
            IWhatsAppUIService whatsappUIService,
            IWhatsAppSessionSyncService sessionSyncService)
        {
            _whatsappService = whatsappService;
            _browserSessionFactory = browserSessionFactory;
            _notifier = notifier;
            _retryService = retryService;
            _sessionManager = sessionManager;
            _whatsappUIService = whatsappUIService;
            _sessionSyncService = sessionSyncService;
        }

        // Send multiple phone/message pairs with random throttling between each send, returning MessageSendResult for each.
        public async Task<List<MessageSendResult>> SendBulkWithThrottlingAsync(int moderatorUserId, IEnumerable<(string Phone, string Message)> items, int minDelayMs, int maxDelayMs)
        {
            _notifier.Notify("Starting bulk send process...");
            var results = new List<MessageSendResult>();
            bool networkErrorOccurred = false;
            string? networkErrorMessage = null;
            int total = items.Count();
            int counter = 1;

            foreach (var item in items)
            {
                _notifier.Notify($"[PROGRESS] [{counter}/{total}] Phone: {item.Phone}, Message: {item.Message}");
                _notifier.Notify($"[{counter}/{total}] Preparing to send to {item.Phone}: {item.Message}");
                if (networkErrorOccurred)
                {
                    _notifier.Notify($"[{counter}/{total}] Skipping {item.Phone} due to previous network error: {networkErrorMessage}");
                    results.Add(new MessageSendResult
                    {
                        Phone = item.Phone,
                        Message = item.Message,
                        Sent = false,
                        Error = networkErrorMessage ?? "PendingNET: Internet connection unavailable",
                        IconType = null,
                        Status = MessageOperationStatus.PendingNET
                    });
                    counter++;
                    continue;
                }
                _notifier.Notify($"[{counter}/{total}] Sending message to {item.Phone}...");
                MessageSendResult result;
                var session = _browserSessionFactory(moderatorUserId);
                session = await _sessionManager.GetOrCreateSessionAsync(moderatorUserId);
                try
                {
                    // Mark operation as in progress - if browser closes now, it's manual
                    if (session is PlaywrightBrowserSession pbs)
                    {
                        pbs.IsOperationInProgress = true;
                    }
                    
                    var deliveryResult = await _whatsappService.SendMessageWithIconTypeAsync(item.Phone, item.Message, session);
                    
                    // Mark operation as complete
                    if (session is PlaywrightBrowserSession pbs2)
                    {
                        pbs2.IsOperationInProgress = false;
                    }
                    
                    result = new MessageSendResult
                    {
                        Phone = item.Phone,
                        Message = item.Message,
                        Sent = deliveryResult.IsSuccess == true,
                        Error = deliveryResult.ResultMessage,
                        IconType = deliveryResult.Data,
                        Status = DetermineStatus(deliveryResult.IsSuccess == true, deliveryResult.ResultMessage)
                    };
                }
                catch (Exception ex)
                {
                    // Check if browser was closed DURING active operation (manual closure)
                    if (_retryService.IsBrowserClosedException(ex))
                    {
                        bool wasOperationInProgress = (session is PlaywrightBrowserSession pbs) && pbs.IsOperationInProgress;
                        
                        if (wasOperationInProgress)
                        {
                            // Manual browser closure during active operation - trigger BrowserClosure pause
                            _notifier.Notify($"⏸️ [Moderator {moderatorUserId}] Manual browser closure detected for {item.Phone} - pausing session");
                            result = new MessageSendResult
                            {
                                Phone = item.Phone,
                                Message = item.Message,
                                Sent = false,
                                Error = "BrowserClosure: تم إغلاق المتصفح أثناء المهمة",
                                IconType = null,
                                Status = MessageOperationStatus.BrowserClosure
                            };
                            // Trigger global pause - user can resume when ready
                            try
                            {
                                await _sessionSyncService.PauseSessionDueToPendingQRAsync(moderatorUserId, pausedBy: null, pauseReason: "BrowserClosure");
                            }
                            catch (Exception pauseEx)
                            {
                                _notifier.Notify($"⚠️ [Moderator {moderatorUserId}] Failed to pause session: {pauseEx.Message}");
                            }
                        }
                        else
                        {
                            // Browser crashed outside active operation - treat as failure
                            _notifier.Notify($"❌ [Moderator {moderatorUserId}] Browser crash/failure for {item.Phone}: {ex.Message}");
                            result = new MessageSendResult
                            {
                                Phone = item.Phone,
                                Message = item.Message,
                                Sent = false,
                                Error = $"Browser failure: {ex.Message}",
                                IconType = null,
                                Status = MessageOperationStatus.Failure
                            };
                        }
                        
                        // Reset flag
                        if (session is PlaywrightBrowserSession pbs3)
                        {
                            pbs3.IsOperationInProgress = false;
                        }
                    }
                    else
                    {
                        // Other errors: Preserve actual error reason
                        _notifier.Notify($"⚠️ ❌ [Moderator {moderatorUserId}] Error sending to {item.Phone}: {ex.Message}");
                        result = new MessageSendResult
                        {
                            Phone = item.Phone,
                            Message = item.Message,
                            Sent = false,
                            Error = ex.Message,  // Preserve actual error reason
                            IconType = null,
                            Status = MessageOperationStatus.Failure
                        };
                    }
                }
                finally
                {
                    // Normal disposal: Don't manipulate flag here
                    await _whatsappService.DisposeBrowserSessionAsync(session);
                }
                _notifier.Notify($"[{counter}/{total}] Result for {item.Phone}: Sent={result.Sent}, Error={result.Error}, IconType={result.IconType}");
                results.Add(new MessageSendResult
                {
                    Phone = item.Phone,
                    Message = item.Message,
                    Sent = result.Sent,
                    Error = result.Error,
                    IconType = result.IconType,
                    Status = DetermineStatus(result.Sent, result.Error)
                });
                if (!result.Sent && result.Error != null &&
                    (result.Error.Contains("net::ERR_NAME_NOT_RESOLVED") || result.Error.Contains("net::ERR_INTERNET_DISCONNECTED") || result.Error.Contains("Navigation failed")))
                {
                    networkErrorOccurred = true;
                    networkErrorMessage = "PendingNET: Internet connection unavailable. " + result.Error;
                    _notifier.Notify($"[{counter + 1}/{total}] Network error detected: {networkErrorMessage}");
                }
                if (counter < total)
                {
                    int delay = Random.Shared.Next(minDelayMs, maxDelayMs + 1);
                    _notifier.Notify($"[{counter + 1}/{total}] Throttling for {delay}ms before next send...");
                    OperationResult<bool>? monitoringResult = null;
                    try
                    {
                        monitoringResult = await _whatsappUIService.ContinuousMonitoringAsync(session, delay);
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error during ContinuousMonitoringAsync for {item.Phone}: {ex.Message}");
                        monitoringResult = null;
                    }
                    if (monitoringResult != null)
                    {
                        _notifier.Notify($"[{counter + 1}/{total}] Throttling interrupted: {monitoringResult.ResultMessage}");
                        for (int i = counter; i < total; i++)
                        {
                            var remainingItem = items.Skip(i).First();
                            results.Add(new MessageSendResult
                            {
                                Phone = remainingItem.Phone,
                                Message = remainingItem.Message,
                                Sent = false,
                                Error = monitoringResult.ResultMessage,
                                IconType = null,
                                Status = MessageOperationStatus.PendingQR
                            });
                        }
                        break;
                    }
                }
                counter++;
            }
            _notifier.Notify("Bulk send process completed.");
            return results;
        }

        public async Task<bool> SendMessageAsync(int moderatorUserId, string phoneNumber, string message, CancellationToken cancellationToken = default)
        {
            // Check cancellation before starting
            cancellationToken.ThrowIfCancellationRequested();

            var browserSession = _browserSessionFactory(moderatorUserId);
            MessageSendResult result;
            try
            {
                // Check cancellation before getting session
                cancellationToken.ThrowIfCancellationRequested();

                browserSession = await _sessionManager.GetOrCreateSessionAsync(moderatorUserId);
                OperationResult<string?> deliveryResult;
                try
                {
                    // Check cancellation before sending
                    cancellationToken.ThrowIfCancellationRequested();

                    // Mark operation as in progress
                    if (browserSession is PlaywrightBrowserSession pbs)
                    {
                        pbs.IsOperationInProgress = true;
                    }

                    deliveryResult = await _whatsappService.SendMessageWithIconTypeAsync(phoneNumber, message, browserSession, cancellationToken);
                    
                    // Mark operation as complete
                    if (browserSession is PlaywrightBrowserSession pbs2)
                    {
                        pbs2.IsOperationInProgress = false;
                    }
                }
                finally
                {
                    // Check cancellation before disposing
                    if (!cancellationToken.IsCancellationRequested)
                    {
                        // Normal disposal: Don't manipulate flag here
                        await _whatsappService.DisposeBrowserSessionAsync(browserSession);
                    }
                }

                result = new MessageSendResult
                {
                    Phone = phoneNumber,
                    Message = message,
                    Sent = deliveryResult.IsSuccess == true,
                    Error = deliveryResult.ResultMessage,
                    IconType = deliveryResult.Data,
                    Status = DetermineStatus(deliveryResult.IsSuccess == true, deliveryResult.ResultMessage)
                };
            }
            catch (OperationCanceledException)
            {
                _notifier.Notify($"⚠️ ❌ [Moderator {moderatorUserId}] Operation cancelled while sending message to {phoneNumber}");
                result = new MessageSendResult 
                { 
                    Phone = phoneNumber, 
                    Message = message, 
                    Sent = false, 
                    Error = "❌ العملية ملغاة: تم إلغاء عملية الإرسال", 
                    IconType = null, 
                    Status = MessageOperationStatus.Failure 
                };
            }
            catch (Exception ex)
            {
                // Check if browser was closed DURING active operation (manual closure)
                if (_retryService.IsBrowserClosedException(ex))
                {
                    bool wasOperationInProgress = (browserSession is PlaywrightBrowserSession pbs) && pbs.IsOperationInProgress;
                    
                    if (wasOperationInProgress)
                    {
                        // Manual browser closure during active operation - trigger BrowserClosure pause
                        _notifier.Notify($"⏸️ [Moderator {moderatorUserId}] Manual browser closure detected for {phoneNumber} - pausing session");
                        result = new MessageSendResult 
                        { 
                            Phone = phoneNumber, 
                            Message = message, 
                            Sent = false, 
                            Error = "BrowserClosure: تم إغلاق المتصفح أثناء المهمة", 
                            IconType = null, 
                            Status = MessageOperationStatus.BrowserClosure 
                        };
                        // Trigger global pause - user can resume when ready
                        try
                        {
                            await _sessionSyncService.PauseSessionDueToPendingQRAsync(moderatorUserId, pausedBy: null, pauseReason: "BrowserClosure");
                        }
                        catch (Exception pauseEx)
                        {
                            _notifier.Notify($"⚠️ [Moderator {moderatorUserId}] Failed to pause session: {pauseEx.Message}");
                        }
                    }
                    else
                    {
                        // Browser crashed outside active operation - treat as failure
                        _notifier.Notify($"❌ [Moderator {moderatorUserId}] Browser crash/failure for {phoneNumber}: {ex.Message}");
                        result = new MessageSendResult 
                        { 
                            Phone = phoneNumber, 
                            Message = message, 
                            Sent = false, 
                            Error = $"Browser failure: {ex.Message}", 
                            IconType = null, 
                            Status = MessageOperationStatus.Failure 
                        };
                    }
                    
                    // Reset flag
                    if (browserSession is PlaywrightBrowserSession pbs3)
                    {
                        pbs3.IsOperationInProgress = false;
                    }
                }
                else
                {
                    // Other errors: Preserve actual error reason
                    _notifier.Notify($"⚠️ ❌ [Moderator {moderatorUserId}] Error for {phoneNumber}: {ex.Message}");
                    result = new MessageSendResult 
                    { 
                        Phone = phoneNumber, 
                        Message = message, 
                        Sent = false, 
                        Error = ex.Message,  // Preserve actual error reason
                        IconType = null, 
                        Status = MessageOperationStatus.Failure 
                    };
                }
            }
            if (!result.Sent && !string.IsNullOrEmpty(result.Error))
            {
                _notifier.Notify(result.Error);
            }
            return result.Sent;
        }

        public async Task<List<MessageSendResult>> SendMessagesAsync(int moderatorUserId, string phoneNumber, IEnumerable<string> messages)
        {
            var browserSession = _browserSessionFactory(moderatorUserId);
            // browserSession = await _sessionManager.GetOrCreateSessionAsync();
            var results = new List<MessageSendResult>();
            foreach (var message in messages)
            {
                MessageSendResult result;
                try
                {
                    browserSession = await _sessionManager.GetOrCreateSessionAsync(moderatorUserId);
                    OperationResult<string?> deliveryResult;
                    try
                    {
                        // Mark operation as in progress
                        if (browserSession is PlaywrightBrowserSession pbs)
                        {
                            pbs.IsOperationInProgress = true;
                        }
                        
                        deliveryResult = await _whatsappService.SendMessageWithIconTypeAsync(phoneNumber, message, browserSession);
                        
                        // Mark operation as complete
                        if (browserSession is PlaywrightBrowserSession pbs2)
                        {
                            pbs2.IsOperationInProgress = false;
                        }
                    }
                    finally
                    {
                        await _whatsappService.DisposeBrowserSessionAsync(browserSession);
                    }

                    result = new MessageSendResult
                    {
                        Phone = phoneNumber,
                        Message = message,
                        Sent = deliveryResult.IsSuccess == true,
                        Error = deliveryResult.ResultMessage,
                        IconType = deliveryResult.Data,
                        Status = DetermineStatus(deliveryResult.IsSuccess == true, deliveryResult.ResultMessage)
                    };
                }
                catch (Exception ex)
                {
                    // Check if browser was closed DURING active operation (manual closure)
                    if (_retryService.IsBrowserClosedException(ex))
                    {
                        bool wasOperationInProgress = (browserSession is PlaywrightBrowserSession pbs) && pbs.IsOperationInProgress;
                        
                        if (wasOperationInProgress)
                        {
                            // Manual browser closure during active operation - trigger BrowserClosure pause
                            _notifier.Notify($"⏸️ [Moderator {moderatorUserId}] Manual browser closure detected for {phoneNumber} - pausing session");
                            result = new MessageSendResult 
                            { 
                                Phone = phoneNumber, 
                                Message = message, 
                                Sent = false, 
                                Error = "BrowserClosure: تم إغلاق المتصفح أثناء المهمة", 
                                IconType = null, 
                                Status = MessageOperationStatus.BrowserClosure 
                            };
                            // Trigger global pause - user can resume when ready
                            try
                            {
                                await _sessionSyncService.PauseSessionDueToPendingQRAsync(moderatorUserId, pausedBy: null, pauseReason: "BrowserClosure");
                            }
                            catch (Exception pauseEx)
                            {
                                _notifier.Notify($"⚠️ [Moderator {moderatorUserId}] Failed to pause session: {pauseEx.Message}");
                            }
                        }
                        else
                        {
                            // Browser crashed outside active operation - treat as failure
                            _notifier.Notify($"❌ [Moderator {moderatorUserId}] Browser crash/failure for {phoneNumber}: {ex.Message}");
                            result = new MessageSendResult 
                            { 
                                Phone = phoneNumber, 
                                Message = message, 
                                Sent = false, 
                                Error = $"Browser failure: {ex.Message}", 
                                IconType = null, 
                                Status = MessageOperationStatus.Failure 
                            };
                        }
                        
                        // Reset flag
                        if (browserSession is PlaywrightBrowserSession pbs3)
                        {
                            pbs3.IsOperationInProgress = false;
                        }
                    }
                    else
                    {
                        // Other errors: Preserve actual error reason
                        _notifier.Notify($"⚠️ ❌ [Moderator {moderatorUserId}] Error for {phoneNumber}: {ex.Message}");
                        result = new MessageSendResult 
                        { 
                            Phone = phoneNumber, 
                            Message = message, 
                            Sent = false, 
                            Error = ex.Message,  // Preserve actual error reason
                            IconType = null, 
                            Status = MessageOperationStatus.Failure 
                        };
                    }
                }
                if (!result.Sent && !string.IsNullOrEmpty(result.Error))
                {
                    _notifier.Notify(result.Error);
                }
                else
                {
                    _notifier.Notify($"Message sent to {phoneNumber}: {message}");
                }
                results.Add(new MessageSendResult
                {
                    Phone = phoneNumber,
                    Message = message,
                    Sent = result.Sent,
                    Error = result.Error,
                    IconType = result.IconType
                });
            }
            return results;
        }

        private MessageOperationStatus DetermineStatus(bool sent, string? error)
        {
            if (sent)
            {
                return MessageOperationStatus.Success;
            }

            if (error?.Contains("PendingQR:") == true || error?.Contains("WhatsApp authentication required") == true)
            {
                return MessageOperationStatus.PendingQR;
            }

            if (error?.Contains("PendingNET:") == true || error?.Contains("Internet connection unavailable") == true)
            {
                return MessageOperationStatus.PendingNET;
            }

            if (error?.Contains("Waiting:") == true)
            {
                return MessageOperationStatus.Waiting;
            }

            return MessageOperationStatus.Failure;
        }
    }
}