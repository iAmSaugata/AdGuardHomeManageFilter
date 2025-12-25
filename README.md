# AdGuard Home Central Manager

A Chrome extension for centrally managing AdGuard Home servers and filtering rules.

## Features (Phase 0)

- **Server Management**: Add, edit, and delete AdGuard Home servers
- **Connection Testing**: Validate server credentials before saving
- **Secure Storage**: Credentials stored securely in Chrome's local storage
- **Modern UI**: Bitwarden-like dark theme with 350×600px popup
- **Production-Ready**: MV3 architecture with proper error handling and retry logic

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

- Passwords are stored in Chrome's local storage (not encrypted at rest by Chrome)
- No secrets are logged to console
- Basic Auth credentials are never exposed in URLs
- All API calls use HTTPS (recommended)

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
