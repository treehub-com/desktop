# Treehub - Desktop
Electron based Desktop Application

## Startup

1. Ensure only 1 version of the app can run
1. Start Server
    1. Load treehub.json files
    1. If `app`, `package-manager`, `api`, and `what` are not installed, go get them
    1. Load package routes
1. Create BrowserWindow and point it at Server
