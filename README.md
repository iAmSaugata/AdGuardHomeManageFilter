# AdGuard Home Central Manager

A Chrome extension for centrally managing AdGuard Home servers and filtering rules.

## Features

### Core Features
- **Server Management**: Add, edit, and delete AdGuard Home servers
- **Group Management**: Organize servers into groups with merged rule lists
- **Rule Management**: Add, edit, and classify filtering rules (block/allow)
- **Connection Testing**: Validate server credentials before saving
- **Live Rule Preview**: Real-time preview of generated AdGuard rules

### Security Features (v0.2.0)
- **🔐 Encrypted Credentials**: Passwords encrypted using AES-GCM (256-bit)
- **🛡️ XSS Protection**: Comprehensive HTML escaping across all views
- **🔒 Privacy-First Permissions**: Optional host permissions requested on-demand
- **🔄 Automatic Migration**: Seamless upgrade from plaintext to encrypted passwords

### UI/UX
- **Modern Dark Theme**: Premium Bitwarden-like design system
- **Responsive Layout**: Optimized 350×600px popup interface
- **Toast Notifications**: User-friendly feedback system
- **Smart Caching**: TTL-based caching with network fallback

## Installation (Development)

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the extension directory (`AdGuardHomeManageFilter`)
6. The extension icon should appear in your toolbar

## Usage

### Adding a Server

1. Click the extension icon to open the popup
2. Click "Add Server" or "Add Your First Server"
3. Fill in the server details:
   - **Server Name**: A friendly name for your server (e.g., "Home Server")
   - **Server URL**: The full URL including protocol (e.g., `https://192.168.1.1`)
   - **Username**: Your AdGuard Home admin username
   - **Password**: Your AdGuard Home admin password
4. Click "Test Connection" to verify the credentials
5. Click "Add Server" to save

### Editing a Server

1. Click the extension icon to open the popup
2. Click "Edit" on the server you want to modify
3. Update the fields as needed
4. Click "Test Connection" to verify changes (optional)
5. Click "Save Changes"

### Deleting a Server

1. Click the extension icon to open the popup
2. Click "Edit" on the server you want to delete
3. Scroll down and click "Delete Server"
4. Confirm the deletion

## Architecture

### Background Service Worker
- **service-worker.js**: Main background script, message passing coordinator
- **storage.js**: Chrome storage wrapper with schema management
- **api-client.js**: AdGuard Home API client with Basic Auth
- **sync-engine.js**: Rule synchronization and caching logic
- **helpers.js**: Utility functions for rule processing and validation

### Popup Application
- **popup.html/css/js**: Main popup application with view routing
- **views/server-list.js**: Server list view
- **views/server-form.js**: Server add/edit form

## API Endpoints Used

Based on AdGuard Home OpenAPI specification:

- `GET /control/filtering/status` - Get filtering status and user rules
- `POST /control/filtering/set_rules` - Set user-defined filtering rules

## Security

### Credential Protection (v0.2.0+)
- **AES-GCM Encryption**: All passwords encrypted using 256-bit AES-GCM before storage
- **PBKDF2 Key Derivation**: Encryption key derived from Chrome runtime ID (100,000 iterations)
- **Automatic Migration**: Existing plaintext passwords automatically encrypted on first access
- **No Plaintext Storage**: Zero plaintext passwords stored in chrome.storage.local

### Privacy
- **Optional Permissions**: Extension only requests access to specific server hosts
- **User Control**: Explicit permission prompts before accessing any server
- **No Tracking**: Zero analytics, telemetry, or external requests

### Best Practices
- **Secure Logging**: No secrets ever logged to console (sanitized logging only)
- **URL Safety**: Basic Auth credentials never exposed in URLs
- **HTTPS Recommended**: Use HTTPS for all AdGuard Home servers
- **XSS Protection**: All user input properly escaped in UI

### Encryption Details
```
Algorithm: AES-GCM
Key Length: 256-bit
IV Length: 96-bit (12 bytes, randomly generated per encryption)
Key Derivation: PBKDF2 with SHA-256 (100,000 iterations)
Base Material: chrome.runtime.id (unique per extension install)
```

## Future Phases

- **Phase 1**: Group management and bulk operations
- **Phase 2**: Rule management UI (add, edit, delete rules)
- **Phase 3**: Rule synchronization across servers
- **Phase 4**: Advanced features (search, filters, analytics)

## Development

### File Structure

```
AdGuardHomeManageFilter/
├── manifest.json
├── background/
│   ├── service-worker.js
│   ├── storage.js
│   ├── api-client.js
│   ├── sync-engine.js
│   └── helpers.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── views/
│       ├── server-list.js
│       └── server-form.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Technologies

- **Manifest V3**: Latest Chrome extension standard
- **ES6 Modules**: Modern JavaScript with import/export
- **Chrome Storage API**: Persistent local storage
- **Fetch API**: HTTP requests with timeout and retry logic

## Troubleshooting

### Extension won't load
- Check Chrome console for errors
- Ensure all files are present
- Verify manifest.json is valid JSON

### Connection test fails
- Verify server URL includes protocol (http:// or https://)
- Check username and password are correct
- Ensure server is accessible from your network
- Check for CORS issues (AdGuard Home should allow extension origin)

### Servers not persisting
- Check Chrome storage quota
- Verify extension has storage permission
- Check browser console for storage errors

## License

MIT License - See LICENSE file for details

## Contributing

This is a personal project. Contributions are welcome via pull requests.

## Support

For issues or questions, please open an issue on the GitHub repository.
