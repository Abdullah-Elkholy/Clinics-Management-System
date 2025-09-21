public class WhatsAppService : IMessageSender
{
    private readonly Func<IBrowserSession> _browserSessionFactory;
    private readonly INotifier _notifier;

    public WhatsAppService(Func<IBrowserSession> browserSessionFactory, INotifier notifier)
    {
        _browserSessionFactory = browserSessionFactory;
        _notifier = notifier;
    }

    public async Task<bool> SendMessageAsync(string phoneNumber, string message)
    {
        await using var browserSession = _browserSessionFactory();
        await browserSession.InitializeAsync();

        await browserSession.NavigateToAsync("https://web.whatsapp.com/");

        // Detect loading chats
        var loadingElement = await browserSession.QuerySelectorAsync("span[aria-label^='Loading your chats']");
        if (loadingElement != null)
        {
            _notifier.Notify("WhatsApp Web is loading chats. This may take a while if you haven't opened WhatsApp recently.");
            // Wait for the loading element to disappear (not visible)
            await browserSession.WaitForSelectorAsync("span[aria-label^='Loading your chats']", 0, false);
            _notifier.Notify("WhatsApp chats finished loading.");
        }

        await browserSession.NavigateToAsync($"https://web.whatsapp.com/send?phone={phoneNumber}");

        // Check for error dialog before trying to send
        var errorDialog = await browserSession.QuerySelectorAsync("div[data-animate-modal-popup='true']");
        if (errorDialog != null)
        {
            var ariaLabel = await errorDialog.GetAttributeAsync("aria-label");
            var dialogText = await errorDialog.InnerTextAsync();

            if (ariaLabel != null && ariaLabel.Contains("invalid"))
            {
                _notifier.Notify("Invalid phone number format detected.");
                return false;
            }
            else if (dialogText.Contains("Couldn't find this user") || dialogText.Contains("not on WhatsApp"))
            {
                _notifier.Notify("Number is not registered on WhatsApp.");
                return false;
            }
            else
            {
                _notifier.Notify($"Unknown error dialog detected: {dialogText}");
                return false;
            }
        }

    await browserSession.WaitForSelectorAsync("header");
    await browserSession.WaitForSelectorAsync("footer", 10000, true);
    await browserSession.WaitForSelectorAsync("footer div[contenteditable='true']", 10000, true);

        var input = await browserSession.QuerySelectorAsync("footer div[contenteditable='true']");
        if (input is null)
        {
            _notifier.Notify("Message input box not found.");
            return false;
        }
        await input.FocusAsync();
        await input.FillAsync(message);

        var sendButton = await browserSession.QuerySelectorAsync("footer button span[data-icon='send']");
        if (sendButton != null)
        {
            await sendButton.ClickAsync();
        }
        else
        {
            await input.PressAsync("Enter");
        }

        // Poll for the last message status icon
        var lastMsgStatusSelector = "(//span[@data-icon='msg-check' or @data-icon='msg-dblcheck' or @data-icon='msg-time'])[last()]";
        var maxWaitMs = 60000;
        var pollIntervalMs = 1000;
        var elapsed = 0;
        string? iconType = null;
        bool sent = false;

        while (elapsed < maxWaitMs)
        {
            var statusIcon = await browserSession.QuerySelectorAsync(lastMsgStatusSelector);
            if (statusIcon != null)
            {
                var attr = await statusIcon.GetAttributeAsync("data-icon");
                iconType = attr ?? string.Empty;
                _notifier.Notify($"Polling: elapsed={elapsed}ms, iconType={iconType}");
                if (iconType == "msg-check" || iconType == "msg-dblcheck")
                {
                    _notifier.Notify("Message sent successfully.");
                    sent = true;
                    break;
                }
                else if (iconType == "msg-time")
                {
                    // Still pending, wait and poll again
                }
                else
                {
                    _notifier.Notify($"Unknown iconType: {iconType}, treating as failure.");
                    break;
                }
            }
            else
            {
                _notifier.Notify($"Polling: elapsed={elapsed}ms, statusIcon=null (selector may be incorrect or message not rendered yet)");
            }
            await Task.Delay(pollIntervalMs);
            elapsed += pollIntervalMs;
        }

        if (!sent && iconType == "msg-time")
        {
            _notifier.Notify("Message still pending, waiting extra 15 seconds before closing session...");
            await Task.Delay(15000);

            var statusIcon = await browserSession.QuerySelectorAsync(lastMsgStatusSelector);
            if (statusIcon != null)
            {
                var attr = await statusIcon.GetAttributeAsync("data-icon");
                iconType = attr ?? string.Empty;
                _notifier.Notify($"Final check after extra wait: iconType={iconType}");
                if (iconType == "msg-check" || iconType == "msg-dblcheck")
                {
                    _notifier.Notify("Message sent successfully after extra wait.");
                    sent = true;
                }
            }
        }

        if (!sent)
        {
            _notifier.Notify("Message failed to send (pending/clock icon or timeout).");
        }
        return sent;
    }

    public async Task<bool> SendMessagesAsync(string phoneNumber, IEnumerable<string> messages)
    {
        bool allSent = true;
        foreach (var message in messages)
        {
            var sent = await SendMessageAsync(phoneNumber, message);
            if (!sent)
            {
                allSent = false;
            }
        }
        return allSent;
    }
}
