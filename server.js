const bodyParser = require('koa-bodyparser');
const Koa = require('koa');
const fs = require('fs');
const path = require('path');
const Router = require('koa-router');

const packages = {};
const routes = {};

const app = new Koa();
const router = new Router();

// TH.json
router.get('/TH.json', async (ctx) => {
  ctx.body = `window.TH = ${JSON.stringify(packages)};`;
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
      path: `/${ctx.params.route}`,
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
      app.listen(8985, resolve);
    });
  },
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
  for (const dir of getDirectories(process.env.TH_PACKAGE_PATH)) {
    try {
      const json = require(path.join(
        process.env.TH_PACKAGE_PATH, dir, 'treehub.json'));
      if (json.name !== dir) {
        console.error(`invalid package: ${json.name} is in the folder ${dir}`);
        continue;
      }
      packages[json.name] = json;
    } catch(error) {
      console.error(error);
    }
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
