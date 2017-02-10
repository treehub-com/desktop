const {app, BrowserWindow} = require('electron');
const path = require('path');
const server = require('./server.js');

app.commandLine.appendSwitch('js-flags', '--harmony-async-await');

process.env.TH_PATH = path.join(app.getPath('home'), '.treehub');
process.env.TH_PACKAGE_PATH = path.join(process.env.TH_PATH, 'packages');

const requiredPackages = ['app'];
let mainWindow = null;

// Ensure only 1 app runs
// We have to do this here to prevent 2 bootstraps executing at the same time
if (app.makeSingleInstance(focus)) {
  app.quit();
}

// TODO show loading screen and any starup errors
app.on('ready', async () => {
  try {
    await server.start();
    const installedPackages = server.packages();
    const promises = [];
    for (const pkg of requiredPackages) {
      if (installedPackages[pkg] === undefined) {
        promises.push(server.installPackage({name: pkg}));
      }
    }
    await Promise.all(promises);
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 720,
    });
    mainWindow.loadURL('http://localhost:8985/');
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
