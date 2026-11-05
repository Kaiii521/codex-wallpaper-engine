import { parseArgs } from 'node:util';
import { basename } from 'node:path';
import { evaluate, findTargets, mainPage } from './cdp.mjs';
import { serveWorkshop } from './library.mjs';
import { currentWallpaper, findWorkshop, loadMedia, workshopMedia } from './media.mjs';
import { wallpaperExpression } from './wallpaper.mjs';

const help = `Codex Wallpaper Engine

  node src/cli.mjs doctor   [--port 9341]
  node src/cli.mjs list     [--steam <Steam directory>]
  node src/cli.mjs library  [--steam <Steam directory>] [--restore]
  node src/cli.mjs demo     [--dim 68]
  node src/cli.mjs apply    <image or video> [--dim 68]
  node src/cli.mjs workshop <Workshop ID> [--steam <Steam directory>] [--preview] [--dim 68]
  node src/cli.mjs current  [--steam <Steam directory>] [--dim 68]
  node src/cli.mjs appearance
  node src/cli.mjs pause | resume | clear

Wallpaper commands use the local debug port (override with --port).
See README.md for instructions on opening the desktop app in wallpaper mode.`;

async function run() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      port: { type: 'string', default: '9341' },
      dim: { type: 'string' },
      steam: { type: 'string' },
      preview: { type: 'boolean' },
      restore: { type: 'boolean' },
    },
  });
  const [command, input, extra] = positionals;
  if (values.help || !command) {
    console.log(help);
    return;
  }
  const needsInput = command === 'apply' || command === 'workshop';
  if (extra !== undefined || Boolean(input) !== needsInput) throw new Error('See --help for command usage.');
  if (values.preview && command !== 'workshop') throw new Error('--preview is only used with workshop.');
  if (values.restore && command !== 'library') throw new Error('--restore is only used with library.');
  if (values.steam !== undefined && (!values.steam || !['list', 'library', 'workshop', 'current'].includes(command))) {
    throw new Error('--steam requires a Steam directory and a list, library, workshop or current command.');
  }
  const port = Number(values.port);
  if (!/^\d+$/.test(values.port) || port < 1 || port > 65535) {
    throw new Error('--port must be an integer from 1 to 65535.');
  }
  const dim = values.dim === undefined ? undefined : Number(values.dim);
  if (dim !== undefined && (!/^\d+$/.test(values.dim) || dim > 100)) {
    throw new Error('--dim must be an integer from 0 to 100.');
  }

  if (command === 'list') {
    const items = await findWorkshop(values.steam);
    if (!items.length) console.log('No subscribed Wallpaper Engine projects found. Try --steam <Steam directory>.');
    for (const { id, title, type } of items) {
      console.log(`${id}\t${type}\t${title.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')}`);
    }
    return;
  }
  if (!['doctor', 'demo', 'apply', 'library', 'workshop', 'current', 'appearance', 'pause', 'resume', 'clear'].includes(command)) {
    throw new Error(`Unknown command: ${command}. See --help.`);
  }
  const targets = await findTargets(port);
  if (!targets.length) throw new Error('No recognized Codex main window was found on this port.');
  if (command === 'doctor') {
    console.log(`Found ${targets.length} Codex main window(s) on 127.0.0.1:${port}.`);
    return;
  }
  if (command === 'library') {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once('SIGINT', stop);
    try {
      await Promise.all(targets.map((target) => serveWorkshop(target, values.steam, controller.signal, values.restore)));
    } finally {
      stop();
      process.removeListener('SIGINT', stop);
    }
    return;
  }
  let media = { kind: 'demo' };
  let name;
  if (command === 'apply') {
    media = await loadMedia(input);
    name = basename(input);
  }
  if (command === 'workshop') {
    if (!/^\d+$/.test(input)) throw new Error('Expected a numeric Workshop ID.');
    const item = (await findWorkshop(values.steam)).find(({ id }) => id === input);
    if (!item) throw new Error('Workshop project not found. Run list with the same --steam option.');
    media = await workshopMedia(item, values.preview);
    name = values.preview ? `${item.title}（工坊预览）` : item.title;
  }
  if (command === 'current') {
    const active = await currentWallpaper(values.steam);
    if (active.saved) console.log('Wallpaper Engine did not report a live path; using its saved selection.');
    if (active.preview) console.log('Using the active Wallpaper Engine project’s preview.');
    media = active.media;
    name = active.title;
  }
  const expression = wallpaperExpression(command, { ...media, dim, name }, mainPage);
  const results = await Promise.allSettled(targets.map((target) => evaluate(target, expression)));
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error(`Window ${index + 1}: ${result.reason.message}`);
      process.exitCode = 1;
    } else {
      console.log(`Window ${index + 1}: ${result.value === 'empty' ? 'no wallpaper to control' : result.value}`);
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
