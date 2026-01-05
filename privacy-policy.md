# Privacy Policy - AdGuard Home Central Manager

**Last Updated**: January 1, 2026  
**Extension Version**: 0.4.0

---

## Overview

AdGuard Home Central Manager is a browser extension that helps you manage multiple AdGuard Home servers from a single interface. We are committed to protecting your privacy and maintaining transparency about how your data is handled.

## Data Collection

**We DO NOT collect, transmit, or share any user data.**

This extension:
- ❌ Does NOT send data to external servers
- ❌ Does NOT use analytics or tracking tools
- ❌ Does NOT collect telemetry or usage statistics
- ❌ Does NOT share data with third parties
- ✅ ALL data stays on YOUR device

## Local Storage

All extension data is stored locally in your browser using `chrome.storage.local`:

### What We Store
- **Server Configurations**: Name, URL, username (encrypted password)
- **Group Definitions**: Group names and associated server IDs
- **User Settings**: UI preferences (theme, cache TTL, sync settings)
- **Rule Cache**: Temporary cache of filtering rules for performance
- **Device Secret**: Random 32-byte secret for encryption (auto-generated)

### How We Protect It
- **AES-256-GCM Encryption**: All passwords are encrypted before storage
- **PBKDF2 Key Derivation**: Encryption key derived using 100,000 iterations
- **Device-Specific Keys**: Each device has a unique encryption key
- **No Cloud Sync**: Data never leaves your local browser storage

## Permissions Explanation

This extension requests the following permissions:

### Required Permissions & Justifications

This section mirrors the justifications provided to the Chrome Web Store team to ensure full transparency about why specific permissions are requested.

#### 1. `activeTab`
*   **Purpose**: To identify the current website's domain name.
*   **Why Needed**: Used when you open the popup or context menu. It allows the extension to automatically pre-fill the "Add Rule" form with the domain you are currently visiting, saving you from typing it manually.

#### 2. `contextMenus`
*   **Purpose**: To add the "Block with AdGuard Home" option to your right-click menu.
*   **Why Needed**: Provides a quick, friction-free way to block domains or specific elements without leaving your current page or opening the full extension interface.

#### 3. Host Permission (`http://*/*`, `https://*/*`)
*   **Purpose**: To communicate with your self-hosted AdGuard Home server.
*   **Why Needed**: Since users host their servers on random private IPs (e.g., `192.168.1.50`) or custom public domains, the extension cannot know the target URL in advance. Broad host permissions are required to:
    1.  Send API requests (Add/Remove Rules) to YOUR specific server.
    2.  Inject the "Quick Block" modal into pages you explicitly choose to interact with.

#### 4. `scripting`
*   **Purpose**: To display the "Quick Block" modal dialog.
*   **Why Needed**: When you right-click to block a site, the extension must programmatically inject a small piece of UI (HTML/CSS) into the page so you can verify the rule details before submitting.

#### 5. `storage`
*   **Purpose**: To save your configuration locally.
*   **Why Needed**: Used to store your server URL, encrypted password, and extension preferences (like Dark Mode) directly in your browser.

**Important**: The extension only communicates with AdGuard Home servers YOU explicitly configure. It does not "phone home" to us or any third party.

## External Connections

This extension ONLY makes network requests to:
- **AdGuard Home servers YOU configure** - To fetch/update filtering rules
- **No other destinations** - Zero analytics, tracking, or third-party services

All API communications use **HTTP Basic Authentication** over your configured protocol (HTTPS recommended for public servers, HTTP acceptable for local networks).

## Data Security

### Encryption Details
```
Algorithm:      AES-GCM (Galois/Counter Mode)
Key Length:     256-bit
IV Length:      96-bit (randomly generated per encryption)
Key Derivation: PBKDF2 with SHA-256
Iterations:     100,000
Entropy:        Chrome runtime ID + 32-byte random device secret
```

### Security Best Practices
- ✅ Use HTTPS URLs for public AdGuard Home servers
- ✅ HTTP is acceptable for local/private networks (192.168.x.x, 10.x.x.x)
- ✅ Encryption keys are device-specific and non-extractable
- ✅ Passwords never logged to browser console
- ✅ Content Security Policy prevents inline script execution

## What We DON'T Do

- ❌ We don't sell your data (we don't have access to it)
- ❌ We don't use cookies or tracking pixels
- ❌ We don't inject ads or modify webpage content (except our modal)
- ❌ We don't access your browsing history
- ❌ We don't communicate with servers you didn't configure

## Your Rights

You have complete control over your data:

- **Export Data**: Use the Settings → Export feature to backup your configuration
- **Delete Data**: Uninstalling the extension deletes all local storage
- **Modify Data**: Edit or delete servers anytime via the extension UI
- **Revoke Permissions**: Chrome allows managing extension permissions at any time

## Data Retention

- **Local Storage**: Data persists until you uninstall the extension or clear browser data
- **Rule Cache**: We use a **Stale-While-Revalidate** strategy. Rules are temporarily cached locally to ensure instant UI loading. This cache is:
    - Strictly local (never shared)
    - Automatically refreshed in the background
    - Cleared based on your configured TTL (Time-To-Live)
- **Logs**: Console logs are session-only (cleared when browser closes)

## Children's Privacy

This extension is not directed at children under 13. We do not knowingly collect information from children.

## Open Source

This extension is open source. You can:
- Review the complete source code on GitHub
- Audit our security practices
- Contribute improvements
- Report security issues

**GitHub Repository**: https://github.com/iAmSaugata/AdGuardHomeManageFilter

## Changes to This Policy

We will update this privacy policy if our data handling practices change. Material changes will be communicated through:
- Updated "Last Updated" date at top of this document
- GitHub release notes (for significant changes)

We recommend checking this page periodically.

## Contact Information

For privacy questions or concerns:
- **GitHub Issues**: https://github.com/iAmSaugata/AdGuardHomeManageFilter/issues
- **GitHub Profile**: https://github.com/iAmSaugata
- **Security Issues**: Please report privately via GitHub Security Advisories

## Legal

This extension is provided "as is" without warranties. By using this extension, you agree to:
- Configure only AdGuard Home servers you own or have permission to manage
- Use the extension in compliance with applicable laws
- Not use the extension for malicious purposes

## Compliance

This extension complies with:
- ✅ Chrome Web Store Developer Program Policies
- ✅ Google API Services User Data Policy
- ✅ General Data Protection Regulation (GDPR) - EU
- ✅ California Consumer Privacy Act (CCPA) - USA

**No personal data is collected, so GDPR/CCPA data subject rights are not applicable** (there is no personal data to access, delete, or port).

---

**Summary**: Your privacy is paramount. This extension operates entirely locally with zero data collection or transmission to external parties. All data stays on your device, encrypted and secure.

If you have questions about this privacy policy, please open an issue on GitHub.
