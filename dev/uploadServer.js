/**
 * dev/uploadServer.js
 * ----------------------------------------------------------------------------
 * The local server the fileUpload demo needs for its upload examples, and
 * nothing more than that. Two jobs:
 *
 *   1. serve the project statically, the way any demo page here expects
 *      (root-relative paths into /dist and /src);
 *   2. answer POST /dev/upload, which no static server does — and without an
 *      endpoint that accepts a file there is no progress to show, so the one
 *      lane whose whole point is a progress bar could not be demonstrated at
 *      all.
 *
 * It is a DEMO endpoint and it is deliberately not a small upload backend:
 * **the bytes are counted and thrown away**. Nothing is written to disk, so
 * nothing has to be cleaned up, and no one can mistake this for something to
 * copy into a project.
 *
 * The bytes are read SLOWLY on purpose. A localhost upload of 2 MB is over in
 * a few milliseconds, and a bar that jumps straight to 100 % demonstrates
 * nothing. Reading a chunk and then pausing lets TCP backpressure do the rest:
 * the browser's own upload progress slows to the speed this server reads at,
 * which is a real transfer at a realistic pace rather than an animation.
 *
 *   node dev/uploadServer.js            # port 8123
 *   PORT=9000 node dev/uploadServer.js
 *
 * Query parameters on the upload URL, so a demo page can ask for a specific
 * outcome instead of waiting for one:
 *
 *   ?slow=<ms>        pause per chunk while reading (default 40, 0 = full speed)
 *   ?processing=<ms>  wait before answering, once every byte has arrived
 *                     (default 600) — this is the stretch where the bar is
 *                     indeterminate and the row says "processing"
 *   ?fail=1           answer 500 with a JSON error, for the retry path
 *
 * DELETE /dev/upload?id=<handle> answers 204, which is what the component's
 * optional data-fileupload-delete-url expects.
 * ----------------------------------------------------------------------------
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 8123;
const uploadPath = '/dev/upload';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

// A handle per accepted upload. A counter is all a demo needs; a real endpoint
// returns whatever its storage calls the thing it just stored.
let counter = 0;

const json = (res, status, body) => {
  const payload = JSON.stringify(body);

  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),

    // Nothing here may be cached: the next run of the demo has to see the
    // next handle.
    'cache-control': 'no-store',
  });

  res.end(payload);
};

// Read the request body at the pace the query asks for and count what arrives.
// The bytes go nowhere: this is what makes the endpoint safe to ship in a repo.
const consume = (req, perChunk) => new Promise((resolve, reject) => {
  let bytes = 0;

  req.on('data', (chunk) => {
    bytes += chunk.length;

    if (!perChunk) return;

    req.pause();
    setTimeout(() => req.resume(), perChunk);
  });

  req.on('end', () => resolve(bytes));
  req.on('aborted', () => reject(new Error('aborted by the client')));
  req.on('error', reject);
});

const handleUpload = async (req, res, query) => {
  const perChunk = Number(query.get('slow') ?? 40);
  const processing = Number(query.get('processing') ?? 600);
  const shouldFail = query.get('fail') === '1';

  let bytes = 0;

  try {
    bytes = await consume(req, Number.isFinite(perChunk) ? perChunk : 40);
  } catch (error) {

    // A cancelled transfer ends here, which is the correct outcome of
    // xhr.abort() and nothing to answer.
    console.log(`  upload aborted after ${bytes} bytes (${error.message})`);
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, Number.isFinite(processing) ? processing : 600);
  });

  if (shouldFail) {
    console.log(`  upload refused on purpose (${bytes} bytes)`);

    // The component shows an "error" string from the body as it stands, so
    // this is what the reader will be told.
    json(res, 500, { error: 'the demo endpoint was asked to fail' });
    return;
  }

  counter += 1;
  const id = `demo-${counter}`;

  console.log(`  upload ok: ${bytes} bytes -> ${id}`);
  json(res, 201, { id });
};

const handleDelete = (res, query) => {
  console.log(`  delete ${query.get('id') || '(no id)'}`);

  res.writeHead(204).end();
};

const serveStatic = (req, res, pathname) => {
  const decoded = decodeURIComponent(pathname);
  const target = path.join(root, decoded === '/' ? 'index.html' : decoded);

  // Path traversal: everything served has to be inside the project, whatever
  // the URL claims.
  if (!target.startsWith(root)) {
    res.writeHead(403).end('403 forbidden');
    return;
  }

  fs.stat(target, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        .end(`404 not found: ${decoded}`);
      return;
    }

    res.writeHead(200, {
      'content-type': mimeTypes[path.extname(target).toLowerCase()]
        || 'application/octet-stream',
      'content-length': stats.size,

      // A demo is read while it is being edited, so nothing is cached.
      'cache-control': 'no-store',
    });

    fs.createReadStream(target).pipe(res);
  });
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  console.log(`${req.method} ${req.url}`);

  if (url.pathname === uploadPath) {

    if (req.method === 'POST') {
      handleUpload(req, res, url.searchParams);
      return;
    }

    if (req.method === 'DELETE') {
      handleDelete(res, url.searchParams);
      return;
    }

    res.writeHead(405, { allow: 'POST, DELETE' }).end('405 method not allowed');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('405 method not allowed');
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`uploadServer: http://127.0.0.1:${port}`);
  console.log(`  static      ${root}`);
  console.log(`  upload      POST/DELETE http://127.0.0.1:${port}${uploadPath}`);
  console.log('  demo        '
    + `http://127.0.0.1:${port}/src/components/fileUpload/demo.html`);
});
