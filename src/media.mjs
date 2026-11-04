import { execFile } from 'node:child_process';
import { access, open, readdir, readFile, realpath } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const formats = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const maxBytes = 32 * 1024 * 1024;

export async function loadMedia(path, limit = maxBytes) {
  const mime = formats[extname(path).toLowerCase()];
  if (!mime) throw new Error('Supported files: JPG, PNG, WebP, GIF, MP4, WebM.');
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error('Choose a regular media file.');
    const { size } = stat;
    if (!size || size > limit) throw new Error(`Media must be between 1 byte and ${limit / 1024 / 1024} MiB.`);
    const bytes = Buffer.alloc(size);
    const { bytesRead } = await file.read(bytes, 0, size, 0);
    if (bytesRead !== size) throw new Error('The media changed while it was being read.');
    return { kind: mime.split('/')[0], mime, base64: bytes.toString('base64') };
  } finally {
    await file.close();
  }
}

async function optionalText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return '';
    throw error;
  }
}

async function defaultSteamRoots() {
  if (process.platform === 'win32') {
    const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles]
      .filter(Boolean).map((path) => join(path, 'Steam'));
    const reg = join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'reg.exe');
    const keys = [
      ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
      ['HKLM\\Software\\Valve\\Steam', 'InstallPath', '/reg:32'],
    ];
    const registered = await Promise.all(keys.map(async ([key, name, ...flags]) => {
      const { stdout } = await run(reg, ['query', key, '/v', name, ...flags], {
        windowsHide: true,
        timeout: 3000,
      }).catch(() => ({ stdout: '' }));
      return stdout.match(/^\s*(?:SteamPath|InstallPath)\s+REG_SZ\s+(.+)$/im)?.[1].trim();
    }));
    return [...registered.filter((path) => path && isAbsolute(path)), ...roots];
  }
  if (process.platform === 'darwin') return [join(homedir(), 'Library/Application Support/Steam')];
  return [join(homedir(), '.steam/steam'), join(homedir(), '.local/share/Steam')];
}

async function steamLibraries(steam) {
  const libraries = new Set();
  for (const root of steam ? [resolve(steam)] : await defaultSteamRoots()) {
    libraries.add(resolve(root));
    const vdf = await optionalText(join(root, 'steamapps', 'libraryfolders.vdf'));
    for (const [, path] of vdf.matchAll(/^\s*"path"\s*"((?:[^"\\]|\\.)*)"/gm)) {
      const library = path.replace(/\\([\\"])/g, '$1');
      if (isAbsolute(library)) libraries.add(resolve(library));
    }
  }
  return libraries;
}

async function readProject(root, id) {
  const text = await optionalText(join(root, 'project.json'));
  if (!text) return null;
  let project;
  try {
    project = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
  if (!project || typeof project.type !== 'string') return null;
  return {
    id, root, type: project.type.toLowerCase(), file: project.file, preview: project.preview,
    title: typeof project.title === 'string' ? project.title : id,
  };
}

export async function findWorkshop(steam) {
  const items = new Map();
  for (const library of await steamLibraries(steam)) {
    const workshop = join(library, 'steamapps', 'workshop', 'content', '431960');
    let directories;
    try {
      directories = await readdir(workshop, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
      throw error;
    }
    for (const directory of directories) {
      const id = directory.name;
      if (!directory.isDirectory() || !/^\d+$/.test(id) || items.has(id)) continue;
      const project = await readProject(join(workshop, id), id);
      if (project && ['video', 'scene', 'web', 'picture', 'preset'].includes(project.type)) {
        items.set(id, project);
      }
    }
  }
  return [...items.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export async function workshopMedia(item, preview, limit) {
  if (item.type !== 'video' && !preview) {
    throw new Error('Only Video projects can play directly. Use --preview for the project thumbnail.');
  }
  const name = preview ? item.preview : item.file;
  if (typeof name !== 'string' || !name || isAbsolute(name)) {
    throw new Error('The project does not declare a relative media path.');
  }
  const root = await realpath(item.root);
  const path = await realpath(resolve(root, name));
  const child = relative(root, path);
  if (!child || isAbsolute(child) || child === '..' || child.startsWith('..' + sep)) {
    throw new Error('The project media points outside its Workshop folder.');
  }
  const media = await loadMedia(path, limit);
  if (preview && media.kind !== 'image') throw new Error('Expected a JPG, PNG, WebP or GIF preview.');
  if (!preview && media.kind !== 'video') throw new Error('Expected an MP4 or WebM video.');
  return media;
}

export async function activeWallpaperMedia(path) {
  const extension = extname(path).toLowerCase();
  if (formats[extension]) return { media: await loadMedia(path), preview: false };
  const project = await readProject(dirname(path), 'Current wallpaper');
  if (!project || !['video', 'scene', 'web', 'picture', 'preset'].includes(project.type)) {
    throw new Error('Wallpaper Engine returned a wallpaper without a supported media file or project.');
  }
  const preview = project.type !== 'video';
  return { media: await workshopMedia(project, preview), preview, title: project.title };
}

export function savedWallpaperPath(config, username) {
  const user = Object.keys(config ?? {}).find((key) => key.toLowerCase() === username.toLowerCase());
  const monitors = config?.[user]?.general?.wallpaperconfig?.selectedwallpapers;
  const primary = monitors?.Monitor0?.file;
  if (typeof primary === 'string' && isAbsolute(primary)) return primary;
  const paths = new Set(Object.values(monitors ?? {}).map((monitor) => monitor?.file)
    .filter((path) => typeof path === 'string' && isAbsolute(path)));
  if (paths.size === 1) return paths.values().next().value;
  return null;
}

export async function currentWallpaper(steam) {
  if (process.platform !== 'win32') throw new Error('The Wallpaper Engine current command requires Windows.');
  for (const library of await steamLibraries(steam)) {
    const install = join(library, 'steamapps', 'common', 'wallpaper_engine');
    for (const exe of ['wallpaper64.exe', 'wallpaper32.exe']) {
      const path = join(install, exe);
      const exists = await access(path).then(() => true, () => false);
      if (!exists) continue;
      const { stdout } = await run(path, ['-control', 'getWallpaper'], {
        windowsHide: true,
        timeout: 6000,
        maxBuffer: 64 * 1024,
      }).catch(() => ({ stdout: '' }));
      const activePath = stdout.trim().replace(/^"(.*)"$/, '$1');
      if (activePath && !/[\r\n\0]/.test(activePath) && isAbsolute(activePath)) return activeWallpaperMedia(activePath);

      // Some Windows installs return empty stdout even while Wallpaper Engine is running.
      const config = await optionalText(join(install, 'config.json'));
      const saved = config && savedWallpaperPath(JSON.parse(config.replace(/^\uFEFF/, '')), userInfo().username);
      if (saved) return { ...await activeWallpaperMedia(saved), saved: true };
      throw new Error('No primary wallpaper was found. Open Wallpaper Engine and select a wallpaper first.');
    }
  }
  throw new Error('Wallpaper Engine was not found. Use --steam <Steam directory> if needed.');
}
