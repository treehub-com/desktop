const bodyParser = require('koa-bodyparser');
const Koa = require('koa');
const fetch = require('node-fetch');
const fs = require('fs');
const jszip = require('jszip');
const path = require('path');
const Router = require('koa-router');

const packages = {};
const routes = {
  _: coreRoute,
};

const app = new Koa();
const router = new Router();
let server = null;

// packages.json
router.get('/packages.json', async (ctx) => {
  ctx.body = JSON.stringify(packages);
});

// Components
router.get('/:package/:file(.+\.js)', async (ctx) => {
  ctx.body = await getFile(path.join(
    process.env.TH_PACKAGE_PATH,
    ctx.params.package,
    ctx.params.file));
});

// Routes
router.post('/:pkg/:route(.*)', async (ctx) => {
  if (routes[ctx.params.pkg] === undefined) {
    ctx.body = {message: 'Route Not Found'};
    ctx.status = 404;
    return;
  }

  try {
    ctx.body = await routes[ctx.params.pkg]({
      route: `/${ctx.params.route}`,
      body: ctx.request.body,
    });
  } catch (error) {
    ctx.body = {message: error.message};
    ctx.status = error.status || 500;
  }
});

// SPA fallthrough
router.get('*', async (ctx) => {
  ctx.body = await getFile(path.join(__dirname, 'index.html'));
});

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

module.exports = {
  start: () => {
    return new Promise((resolve) => {
      readPackages();
      loadRoutes();
      server = app.listen(8985, resolve);
    });
  },
  stop: () => {
    server.stop();
  },
  packages: () => {
    return packages;
  },
  installPackage,
  uninstallPackage,
};

function getFile(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

function readPackages() {
  for (const pkg of getDirectories(process.env.TH_PACKAGE_PATH)) {
    readPackage(pkg);
  }
}

function readPackage(pkg) {
  try {
    const json = require(path.join(
      process.env.TH_PACKAGE_PATH, pkg, 'treehub.json'));
    if (json.name !== pkg) {
      console.error(`invalid package: ${json.name} is in the folder ${dir}`);
      return;
    }
    packages[json.name] = json;
  } catch(error) {
    console.error(error);
  }
}

function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}

function loadRoutes() {
  for (const pkg of Object.keys(packages)) {
    if (packages[pkg].route !== undefined) {
      try {
        routes[pkg] = require(path.join(
          process.env.TH_PACKAGE_PATH, pkg, packages[pkg].route));
      } catch(error) {
        console.error(error);
      }
    }
  }
}

async function coreRoute({route, body}) {
  switch(route) {
    case '/package/install':
      return installPackage(body);
    case '/package/uninstall':
      return uninstallPackage(body);
    default:
      const error = new Error('Unknown Route');
      error.status = 404;
      throw error;
  }
}

async function installPackage({name, version = 'latest'}, update = false) {
  console.log(`installing package ${name}:${version}`);
  // TODO check/sanitize name/version

  // Get the package
  const response = await fetch(`https://packages.treehub.com/${name}/${version}.zip`);
  if (response.status !== 200) {
    const error = new Error('Package Not Found');
    error.status = 500;
    throw error;
  }
  const body = await response.arrayBuffer();

  // Load the zip file
  const contents = await jszip.loadAsync(body);

  // Create the package directory
  await ensurePackageDirectory(name);
  const promises = [];
  contents.forEach((fileName, file) => {
    promises.push(writePackageFile(name, fileName, file));
  });
  await Promise.all(promises);
  if (update) {
    readPackage(name);
  }
  return true;
};

async function uninstallPackage({name}) {
  console.log(`uninstalling package ${name}`);
  return 'uninstalling package';
};

function ensurePackageDirectory(name) {
  return new Promise((resolve, reject) => {
    fs.mkdir(path.join(process.env.TH_PACKAGE_PATH, name), (error) => {
      if (error && error.code !== 'EEXIST') {
        console.log(error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function writePackageFile(pkg, fileName, file) {
  return new Promise((resolve, reject) => {
    let error;
    file.nodeStream()
      .pipe(fs.createWriteStream(
        path.join(process.env.TH_PACKAGE_PATH, pkg, fileName)))
      .on('error', (err) => {
        error = err;
      })
      .on('finish', () => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
    });
  });
}
