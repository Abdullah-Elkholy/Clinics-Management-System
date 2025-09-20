using Microsoft.Playwright;

public class WhatsAppService
{
    private const string SessionDir = "whatsapp-session";

    public async Task<bool> SendMessageAsync(string phoneNumber, string message)
    {
        using var playwright = await Playwright.CreateAsync();
        Directory.CreateDirectory(SessionDir);

        var browser = await playwright.Chromium.LaunchPersistentContextAsync(
            SessionDir,
            new BrowserTypeLaunchPersistentContextOptions
            {
                Headless = false,
                ViewportSize = null,
                Args = new[] { "--start-maximized" }
            }
        );

        var page = browser.Pages.Count > 0 ? browser.Pages[0] : await browser.NewPageAsync();

        try
        {
            await page.GotoAsync("https://web.whatsapp.com/");
            await page.WaitForSelectorAsync("div[role='grid']", new PageWaitForSelectorOptions { Timeout = 0 });
            await page.GotoAsync($"https://web.whatsapp.com/send?phone={phoneNumber}");

            // Check for error dialog before trying to send
            var errorDialog = await page.QuerySelectorAsync("div[data-animate-modal-popup='true']");
            if (errorDialog != null)
            {
                var ariaLabel = await errorDialog.GetAttributeAsync("aria-label");
                var dialogText = await errorDialog.InnerTextAsync();

                if (ariaLabel != null && ariaLabel.Contains("invalid"))
                {
                    Console.WriteLine("Invalid phone number format detected.");
                    await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Screenshots/whatsapp_invalid_number.png" });
                    return false;
                }
                else if (dialogText.Contains("Couldn't find this user") || dialogText.Contains("not on WhatsApp"))
                {
                    Console.WriteLine("Number is not registered on WhatsApp.");
                    await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Screenshots/whatsapp_not_registered.png" });
                    return false;
                }
                else
                {
                    Console.WriteLine("Unknown error dialog detected: " + dialogText);
                    await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Screenshots/whatsapp_unknown_error.png" });
                    return false;
                }
            }

            await page.WaitForSelectorAsync("header");
            await page.WaitForSelectorAsync("footer", new PageWaitForSelectorOptions { State = WaitForSelectorState.Visible, Timeout = 10000 });
            await page.WaitForSelectorAsync("footer div[contenteditable='true']", new PageWaitForSelectorOptions { State = WaitForSelectorState.Visible, Timeout = 10000 });

            // Check for WhatsApp Web reconnecting banner
            var reconnectingBanner = await page.QuerySelectorAsync("div[role='alert'], span:has-text('Reconnecting')");
            int reconnectAttempts = 3;
            int reconnectWaitMs = 5000;

            if (reconnectingBanner != null)
            {
                Console.WriteLine("WhatsApp Web is reconnecting or offline. Attempting to reconnect...");
                for (int i = 0; i < reconnectAttempts; i++)
                {
                    await Task.Delay(reconnectWaitMs);
                    reconnectingBanner = await page.QuerySelectorAsync("div[role='alert'], span:has-text('Reconnecting')");
                    if (reconnectingBanner == null)
                    {
                        Console.WriteLine("Reconnected successfully.");
                        break;
                    }
                    Console.WriteLine($"Reconnect attempt {i + 1} failed, retrying...");
                }
                if (reconnectingBanner != null)
                {
                    Console.WriteLine("Failed to reconnect after multiple attempts. Network instability detected.");
                    await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Screenshots/whatsapp_network_issue.png" });
                    return false;
                }
            }

            var input = await page.QuerySelectorAsync("footer div[contenteditable='true']");
            await input.FocusAsync();
            await input.FillAsync(message);

            var sendButton = await page.QuerySelectorAsync("footer button span[data-icon='send']");
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
            string iconType = null;
            bool sent = false;

            while (elapsed < maxWaitMs)
            {
                var statusIcon = await page.QuerySelectorAsync(lastMsgStatusSelector);
                if (statusIcon != null)
                {
                    iconType = await statusIcon.GetAttributeAsync("data-icon");
                    Console.WriteLine($"Polling: elapsed={elapsed}ms, iconType={iconType}");
                    if (iconType == "msg-check" || iconType == "msg-dblcheck")
                    {
                        Console.WriteLine("Message sent successfully.");
                        sent = true;
                        break;
                    }
                    else if (iconType == "msg-time")
                    {
                        // Still pending, wait and poll again
                    }
                    else
                    {
                        Console.WriteLine($"Unknown iconType: {iconType}, treating as failure.");
                        break;
                    }
                }
                else
                {
                    Console.WriteLine($"Polling: elapsed={elapsed}ms, statusIcon=null (selector may be incorrect or message not rendered yet)");
                }
                await Task.Delay(pollIntervalMs);
                elapsed += pollIntervalMs;
            }

            if (!sent && iconType == "msg-time")
            {
                Console.WriteLine("Message still pending, waiting extra 15 seconds before closing session...");
                await Task.Delay(15000);

                var statusIcon = await page.QuerySelectorAsync(lastMsgStatusSelector);
                if (statusIcon != null)
                {
                    iconType = await statusIcon.GetAttributeAsync("data-icon");
                    Console.WriteLine($"Final check after extra wait: iconType={iconType}");
                    if (iconType == "msg-check" || iconType == "msg-dblcheck")
                    {
                        Console.WriteLine("Message sent successfully after extra wait.");
                        sent = true;
                    }
                }
            }

            await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Screenshots/whatsapp_status.png" });

            if (!sent)
            {
                Console.WriteLine("Message failed to send (pending/clock icon or timeout).");
            }
            return sent;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WhatsAppService Error: {ex.Message}");
            throw;
        }
        finally
        {
            await browser.CloseAsync();
        }
    }

    public async Task<bool> SendMessagesAsync(string phoneNumber, IEnumerable<string> messages)
    {
        using var playwright = await Playwright.CreateAsync();
        Directory.CreateDirectory(SessionDir);

        var browser = await playwright.Chromium.LaunchPersistentContextAsync(
            SessionDir,
            new BrowserTypeLaunchPersistentContextOptions
            {
                Headless = false,
                ViewportSize = null,
                Args = new[] { "--start-maximized" }
            }
        );

        var page = browser.Pages.Count > 0 ? browser.Pages[0] : await browser.NewPageAsync();
        bool allSent = true;

        try
        {
            await page.GotoAsync("https://web.whatsapp.com/");
            await page.WaitForSelectorAsync("div[role='grid']", new PageWaitForSelectorOptions { Timeout = 0 });
            await page.GotoAsync($"https://web.whatsapp.com/send?phone={phoneNumber}");

            // Error dialog check before sending any messages
            var errorDialog = await page.QuerySelectorAsync("div[data-animate-modal-popup='true']");
            if (errorDialog != null)
            {
                var ariaLabel = await errorDialog.GetAttributeAsync("aria-label");
                var dialogText = await errorDialog.InnerTextAsync();

                if (ariaLabel != null && ariaLabel.Contains("invalid"))
                {
                    Console.WriteLine("Invalid phone number format detected.");
                    await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Screenshots/whatsapp_invalid_number.png" });
                    return false;
                }
                else if (dialogText.Contains("Couldn't find this user") || dialogText.Contains("not on WhatsApp"))
                {
                    Console.WriteLine("Number is not registered on WhatsApp.");
                    await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Screenshots/whatsapp_not_registered.png" });
                    return false;
                }
                else
                {
                    Console.WriteLine("Unknown error dialog detected: " + dialogText);
                    await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Screenshots/whatsapp_unknown_error.png" });
                    return false;
                }
            }

            await page.WaitForSelectorAsync("header");
            await page.WaitForSelectorAsync("footer", new PageWaitForSelectorOptions { State = WaitForSelectorState.Visible, Timeout = 10000 });
            await page.WaitForSelectorAsync("footer div[contenteditable='true']", new PageWaitForSelectorOptions { State = WaitForSelectorState.Visible, Timeout = 10000 });

            foreach (var message in messages)
            {
                // Reconnection logic for each message
                var reconnectingBanner = await page.QuerySelectorAsync("div[role='alert'], span:has-text('Reconnecting')");
                int reconnectAttempts = 3;
                int reconnectWaitMs = 5000;

                if (reconnectingBanner != null)
                {
                    Console.WriteLine("WhatsApp Web is reconnecting or offline. Attempting to reconnect...");
                    for (int i = 0; i < reconnectAttempts; i++)
                    {
                        await Task.Delay(reconnectWaitMs);
                        reconnectingBanner = await page.QuerySelectorAsync("div[role='alert'], span:has-text('Reconnecting')");
                        if (reconnectingBanner == null)
                        {
                            Console.WriteLine("Reconnected successfully.");
                            break;
                        }
                        Console.WriteLine($"Reconnect attempt {i + 1} failed, retrying...");
                    }
                    if (reconnectingBanner != null)
                    {
                        Console.WriteLine("Failed to reconnect after multiple attempts. Network instability detected.");
                        await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Screenshots/whatsapp_network_issue.png" });
                        allSent = false;
                        break;
                    }
                }

                var input = await page.QuerySelectorAsync("footer div[contenteditable='true']");
                await input.FocusAsync();
                await input.FillAsync(message);

                var sendButton = await page.QuerySelectorAsync("footer button span[data-icon='send']");
                if (sendButton != null)
                    await sendButton.ClickAsync();
                else
                    await input.PressAsync("Enter");

                // Poll for status as before
                var lastMsgStatusSelector = "(//span[@data-icon='msg-check' or @data-icon='msg-dblcheck' or @data-icon='msg-time'])[last()]";
                var maxWaitMs = 60000;
                var pollIntervalMs = 1000;
                var elapsed = 0;
                string iconType = null;
                bool sent = false;

                while (elapsed < maxWaitMs)
                {
                    var statusIcon = await page.QuerySelectorAsync(lastMsgStatusSelector);
                    if (statusIcon != null)
                    {
                        iconType = await statusIcon.GetAttributeAsync("data-icon");
                        Console.WriteLine($"Polling: elapsed={elapsed}ms, iconType={iconType}");
                        if (iconType == "msg-check" || iconType == "msg-dblcheck")
                        {
                            Console.WriteLine("Message sent successfully.");
                            sent = true;
                            break;
                        }
                        else if (iconType == "msg-time")
                        {
                            // Still pending, wait and poll again
                        }
                        else
                        {
                            Console.WriteLine($"Unknown iconType: {iconType}, treating as failure.");
                            break;
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Polling: elapsed={elapsed}ms, statusIcon=null (selector may be incorrect or message not rendered yet)");
                    }
                    await Task.Delay(pollIntervalMs);
                    elapsed += pollIntervalMs;
                }

                if (!sent && iconType == "msg-time")
                {
                    Console.WriteLine("Message still pending, waiting extra 15 seconds before closing session...");
                    await Task.Delay(15000);

                    var statusIcon = await page.QuerySelectorAsync(lastMsgStatusSelector);
                    if (statusIcon != null)
                    {
                        iconType = await statusIcon.GetAttributeAsync("data-icon");
                        Console.WriteLine($"Final check after extra wait: iconType={iconType}");
                        if (iconType == "msg-check" || iconType == "msg-dblcheck")
                        {
                            Console.WriteLine("Message sent successfully after extra wait.");
                            sent = true;
                        }
                    }
                }
                // for debugging and checking whether the whatsapp message is actually sent or not by a live screenshot
                await page.ScreenshotAsync(new PageScreenshotOptions { Path = $"Screenshots/whatsapp_status_{message.GetHashCode()}.png" });

                if (!sent)
                {
                    Console.WriteLine("Message failed to send (pending/clock icon or timeout).");
                    allSent = false;
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WhatsAppService Error: {ex.Message}");
            allSent = false;
        }
        finally
        {
            await browser.CloseAsync();
        }
        return allSent;
    }
}