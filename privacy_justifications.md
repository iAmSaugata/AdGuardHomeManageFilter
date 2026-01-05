# Chrome Web Store - Privacy Practices Justifications

Copy and paste the following responses into the "Privacy practices" tab of your item's edit page.

## 1. Justification for `activeTab`
**Question:** Why do you need `activeTab` permission?
**Answer:**
> This permission is required to automatically identify the domain name of the current website when the user opens the extension popup or context menu. This allows the user to quickly add "Block" or "Allow" rules for the specific site they are currently visiting without manually typing the URL.

## 2. Justification for `contextMenus`
**Question:** Why do you need `contextMenus` permission?
**Answer:**
> This permission is used to add a "Block with AdGuard Home" option to the browser's right-click menu. This provides users with a frictionless way to block domains or elements directly from the page they are browsing, without needing to navigate away or open the full extension interface.

## 3. Justification for Host Permission (`http://*/*`, `https://*/*`)
**Question:** Why do you need access to all hosts?
**Answer:**
> This extension connects to the user's *self-hosted* AdGuard Home instances. Since users host these servers on their own private networks (e.g., `192.168.x.x`) or custom public domains, the extension cannot know the specific URL in advance. Broad host permissions are legally required to:
> 1.  Allow the extension to send API requests (Add/Remove Rules, Sync Status) to the user's specific AdGuard Home server IP/URL.
> 2.  Content scripts injection: To display the "Quick Block" modal on *any* website the user chooses to right-click on for filtering.

## 4. Justification for `scripting`
**Question:** Why do you need `scripting` permission?
**Answer:**
> The scripting permission is essential for the Context Menu functionality. When a user right-clicks to "Block with AdGuard Home", the extension needs to programmatically inject a small UI modal (HTML/CSS/JS) into the current webpage. This modal allows verify the rule details (e.g., `$important`, `$client`) before submitting it to their server.

## 5. Justification for `storage`
**Question:** Why do you need `storage` permission?
**Answer:**
> Storage is used strictly to save the user's configurations locally on their device. This includes:
> 1.  AdGuard Home Server Connection Details (URL, Authentication). Note: Sensitive data like passwords are encrypted using AES-GCM before being saved to local storage.
> 2.  Extension preferences (e.g., "Dark Mode", "Show Context Menu").
> No data is ever sent to external cloud servers or third parties.

## 6. Justification for Remote Code
**Question:** Do you use remote code?
**Answer:**
> **No.** The extension does not load or execute any remote code. All logic is bundled within the extension package (Manifest V3 compliant). It only fetches JSON data (filtering rules/status) from the user's own defined AdGuard Home API endpoints.

## 7. Single Purpose Description
**Question:** Describe the single purpose of your extension.
**Answer:**
> This extension is a dedicated management tool for AdGuard Home servers. It allows users to monitor server status, toggle protection, and manage network filtering rules directly from the browser, effectively acting as a remote control for their self-hosted ad-blocking infrastructure.

## 8. Data Usage Certification
**Action:**
> Check the box: **"I certify that my data usage complies with the Developer Program Policies."**
>
> *Note: Since your extension only communicates with the user's OWN server and stores config locally, you are compliant.*
