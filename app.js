const {app, BrowserWindow, dialog} = require('electron');
const fs = require('fs');
const path = require('path');
const server = require('./server.js');
const {autoUpdater} = require('electron-updater');

app.commandLine.appendSwitch('js-flags', '--harmony-async-await');

process.env.TH_PATH = path.join(app.getPath('home'), '.treehub');
if (!fs.existsSync(process.env.TH_PATH)) {
  fs.mkdirSync(process.env.TH_PATH);
}
process.env.TH_PACKAGE_PATH = path.join(process.env.TH_PATH, 'packages');
if (!fs.existsSync(process.env.TH_PACKAGE_PATH)) {
  fs.mkdirSync(process.env.TH_PACKAGE_PATH);
}


const requiredPackages = ['app', 'package-manager'];
let mainWindow = null;

// Ensure only 1 app runs
// We have to do this here to prevent 2 bootstraps executing at the same time
if (app.makeSingleInstance(focus)) {
  app.quit();
}

// Close when all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});

autoUpdater.on('update-downloaded', (event, info) => {
  // Ask user to update the app
  dialog.showMessageBox({
    type: 'question',
    buttons: ['Install and Relaunch', 'Later'],
    defaultId: 0,
    message: 'A new version of Treehub has been downloaded',
    detail: 'It will be installed the next time you restart the application',
  }, (response) => {
    if (response === 0) {
      setTimeout(() => autoUpdater.quitAndInstall(), 1);
    }
  });
});

// TODO show loading screen and any starup errors
app.on('ready', async () => {
  try {
    await server.start();
    const installedPackages = server.packages();
    const promises = [];
    for (const pkg of requiredPackages) {
      if (installedPackages[pkg] === undefined) {
        promises.push(server.installPackage({name: pkg}, true));
      }
    }
    await Promise.all(promises);
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 720,
    });
    mainWindow.loadURL('http://localhost:8985/');
    if (process.env.NODE_ENV !== 'development') {
      autoUpdater.checkForUpdates();
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});

function focus() {
  if (mainWindow !== null) {
    mainWindow.focus();
  }
}
