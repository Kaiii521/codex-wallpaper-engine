import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createSystemAudio } from './system-audio.mjs';

const require = createRequire(import.meta.url);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

const pageHtml = `<!doctype html><meta charset="utf-8"><style>
html,body,#player{width:100%;height:100%;margin:0;overflow:hidden;background:#000}
</style><div id="player"></div><script src="./engine.js"></script><script>
window.cweReady = false;
(async () => {
  try {
    const instance = await WebWallGL.mount(document.querySelector('#player'), {
      source: WebWallGL.httpSource(new URL('./project', location.href).href),
      fps: 24, renderDpr: 1, volume: 0, audio: null, media: null,
    });
    window.cweInstance = instance;
    window.cweReady = true;
    instance.on('error', error => { window.cweError = String(error); });
  } catch (error) {
    window.cweError = String(error);
  }
})();
</script>`;

export async function projectAsset(root, name) {
  if (!name || name.includes('\\') || isAbsolute(name)) return null;
  try {
    const base = await realpath(root);
    const file = await realpath(resolve(base, name));
    const path = relative(base, file);
    if (!path || isAbsolute(path) || path === '..' || path.startsWith('..' + sep)) return null;
    const info = await stat(file);
    if (info.isFile() && info.size <= 256 * 1024 * 1024) return { file, size: info.size };
  } catch {
    // The engine can continue when an optional asset is missing.
  }
  return null;
}

async function renderSite(root, engine) {
  const token = '/' + randomBytes(20).toString('hex') + '/';
  let origin;
  const server = createServer(async (request, response) => {
    const fail = (status) => response.writeHead(status).end();
    if (request.headers.host !== new URL(origin).host || !['GET', 'HEAD'].includes(request.method)) return fail(404);
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, origin).pathname);
    } catch {
      return fail(404);
    }
    if (!pathname.startsWith(token)) return fail(404);
    const path = pathname.slice(token.length);
    const security = {
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; frame-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
    };
    if (path === '') {
      response.writeHead(200, { ...security, 'Content-Type': mime['.html'] }).end(pageHtml);
      return;
    }
    const asset = path === 'engine.js'
      ? await projectAsset(dirname(engine), 'webwallgl.global.min.js')
      : path.startsWith('project/') && await projectAsset(root, path.slice(8));
    if (!asset) return fail(404);
    const headers = {
      ...security, 'Content-Type': mime[extname(asset.file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': asset.size,
    };
    response.writeHead(200, headers);
    if (request.method === 'HEAD') return response.end();
    const stream = createReadStream(asset.file);
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  origin = 'http://127.0.0.1:' + server.address().port;
  return {
    url: origin + token,
    close() {
      server.close();
      server.closeAllConnections();
    },
  };
}

export function createLiveRenderer(createAudio = createSystemAudio) {
  let browserPromise;
  let disposed = false;
  const players = new Set();
  async function browser() {
    if (!browserPromise) {
      browserPromise = Promise.resolve().then(() => {
        const { chromium } = require(process.env.CWE_PLAYWRIGHT_PATH || 'playwright-core');
        return chromium.launch({
          channel: process.env.CWE_BROWSER_CHANNEL || 'msedge',
          chromiumSandbox: true,
          headless: true,
          args: ['--mute-audio'],
          timeout: 8000,
        });
      }).catch((error) => {
        browserPromise = undefined;
        throw error;
      });
    }
    return browserPromise;
  }
  return {
    async open(item) {
      if (disposed) throw new Error('Renderer is closed.');
      const engine = process.env.CWE_WEBWALLGL_PATH || require.resolve('webwallgl');
      const app = await browser();
      if (disposed) throw new Error('Renderer is closed.');
      const context = await app.newContext({
        viewport: { width: 1600, height: 900 }, serviceWorkers: 'block', acceptDownloads: false,
      });
      const site = await renderSite(item.root, engine).catch(async (error) => {
        await context.close();
        throw error;
      });
      const player = {
        async close() {
          players.delete(player);
          site.close();
          await context.close().catch(() => {});
        },
      };
      players.add(player);
      try {
        await context.route('**/*', (route) => {
          if (route.request().url().startsWith(site.url)) return route.continue();
          return route.abort('blockedbyclient');
        });
        await context.routeWebSocket('**/*', (socket) => socket.close());
        if (item.type === 'web') {
          await context.addInitScript(() => {
            if (window === window.parent) return;
            const callbacks = new Set();
            window.wallpaperRegisterAudioListener = (listener) => {
              if (typeof listener === 'function') callbacks.add(listener);
            };
            window.addEventListener('message', (event) => {
              const data = event.data;
              if (event.source !== window.parent || data?.kind !== 'cwe-spectrum'
                || !Array.isArray(data.bands) || data.bands.length !== 128) return;
              for (const callback of callbacks) {
                try { callback(data.bands.slice()); } catch { /* Keep other listeners running. */ }
              }
            });
          });
        }
        const page = await context.newPage();
        await page.goto(site.url, { timeout: 8000 });
        await page.waitForFunction(() => window.cweReady || window.cweError, undefined, { timeout: 10_000 });
        const error = await page.evaluate(() => window.cweError);
        if (error) throw new Error(error);
        const capture = () => page.screenshot({ type: 'jpeg', quality: 82, timeout: 4000 });
        const first = await capture();
        async function updateSpectrum(spectrum) {
          const bands = spectrum ? Array.from(Buffer.from(spectrum, 'base64'), (level) => level / 255) : null;
          await page.evaluate(({ bands, web }) => {
            if (web) {
              document.querySelector('#player iframe')?.contentWindow?.postMessage({
                kind: 'cwe-spectrum', bands: bands ?? Array(128).fill(0),
              }, '*');
            } else if (bands) {
              window.cweSpectrum = { left: bands.slice(0, 64), right: bands.slice(64) };
              if (!window.cweAudioSource) {
                window.cweAudioSource = { snapshot: () => window.cweSpectrum };
                window.cweInstance.setAudio(window.cweAudioSource);
              }
            } else {
              window.cweInstance.setAudio(null);
              window.cweAudioSource = null;
              window.cweSpectrum = null;
            }
          }, { bands, web: item.type === 'web' });
        }
        return {
          first: first.toString('base64'),
          close: player.close,
          async stream(emit, signal) {
            let paused = false;
            let lastPointer;
            let lastSpectrum = null;
            const audio = createAudio();
            try {
              while (!signal.aborted) {
                const result = await emit(paused ? null : (await capture()).toString('base64'), audio.status());
                const status = result?.status ?? result;
                if (status === 'stop') break;
                if (paused !== (status === 'paused')) {
                  paused = status === 'paused';
                  await page.evaluate((paused) => {
                    if (paused) window.cweInstance.pause();
                    else window.cweInstance.resume();
                  }, paused);
                }
                const pointer = result?.pointer;
                if (!paused && (pointer?.[0] !== lastPointer?.[0] || pointer?.[1] !== lastPointer?.[1])) {
                  if (item.type === 'web') {
                    // The isolated page receives a native hover even without a Wallpaper Engine shim.
                    const viewport = page.viewportSize();
                    await page.mouse.move(pointer ? pointer[0] * (viewport.width - 1) : -1,
                      pointer ? pointer[1] * (viewport.height - 1) : -1);
                  } else {
                    await page.evaluate((coordinates) => {
                      if (coordinates) window.cweInstance.pushPointer(...coordinates, 0);
                      else window.cweInstance.pointerLeave();
                    }, pointer);
                  }
                  lastPointer = pointer;
                }
                audio.enable(Boolean(!paused && result?.systemAudio));
                const spectrum = audio.spectrum();
                if (lastSpectrum !== spectrum) {
                  await updateSpectrum(spectrum);
                  lastSpectrum = spectrum;
                }
                await delay(paused ? 350 : 83, undefined, { signal }).catch(() => {});
              }
            } finally {
              audio.close();
            }
          },
        };
      } catch (error) {
        await player.close();
        throw error;
      }
    },
    async close() {
      disposed = true;
      await Promise.allSettled([...players].map((player) => player.close()));
      const app = await browserPromise?.catch(() => {});
      await app?.close();
    },
  };
}
