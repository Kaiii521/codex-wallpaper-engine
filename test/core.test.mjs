import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { findTargets, mainPage } from '../src/cdp.mjs';
import { projectAsset } from '../src/live-renderer.mjs';
import { activeWallpaperMedia, findWorkshop, loadMedia, savedWallpaperPath, workshopMedia } from '../src/media.mjs';

test('Steam library scan imports only the selected supported project media', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'codex-workshop-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const steam = join(base, 'Steam');
  const library = join(base, 'Other Drive');
  const workshop = join(library, 'steamapps', 'workshop', 'content', '431960');
  await mkdir(join(steam, 'steamapps'), { recursive: true });
  await writeFile(join(steam, 'steamapps', 'libraryfolders.vdf'),
    `"libraryfolders"\n{\n  "1"\n  {\n    "path" "${library.replaceAll('\\', '\\\\')}"\n  }\n}`);
  for (const id of ['12', '34', '56', '78']) await mkdir(join(workshop, id), { recursive: true });
  await writeFile(join(workshop, '12', 'project.json'), '\uFEFF' + JSON.stringify({
    type: 'video', title: 'A video', file: 'loop.MP4', preview: 'preview.jpg',
  }));
  await writeFile(join(workshop, '34', 'project.json'), JSON.stringify({
    type: 'scene', title: 'B scene', file: 'scene.pkg', preview: '../12/preview.jpg',
  }));
  await writeFile(join(workshop, '56', 'project.json'), '{"type":"application","file":"start.exe"}');
  await writeFile(join(workshop, '78', 'project.json'), JSON.stringify({
    type: 'Scene', title: 'C scene', file: 'scene.pkg', preview: 'preview.gif',
  }));
  await writeFile(join(workshop, '78', 'preview.gif'), 'dummy GIF');
  await writeFile(join(workshop, '12', 'loop.MP4'), 'dummy video');
  await writeFile(join(workshop, '12', 'preview.jpg'), 'dummy image');

  const items = await findWorkshop(steam);
  assert.deepEqual(items.map(({ id, type }) => [id, type]), [['12', 'video'], ['34', 'scene'], ['78', 'scene']]);
  assert.equal((await workshopMedia(items[0], false)).kind, 'video');
  assert.equal((await workshopMedia(items[0], true)).kind, 'image');
  await assert.rejects(workshopMedia(items[1], false), /Only Video/);
  await assert.rejects(workshopMedia(items[1], true), /outside/);
  await assert.rejects(loadMedia(join(workshop, '56', 'start.exe')), /Supported files/);
  const activeScene = await activeWallpaperMedia(join(workshop, '78', 'scene.pkg'));
  assert.equal(activeScene.preview, true);
  assert.equal(activeScene.media.mime, 'image/gif');
  const activeVideo = await activeWallpaperMedia(join(workshop, '12', 'loop.MP4'));
  assert.equal(activeVideo.preview, false);
  assert.equal(activeVideo.media.mime, 'video/mp4');
  const primary = join(workshop, '78', 'scene.pkg');
  const secondary = join(workshop, '12', 'loop.MP4');
  const config = { Alice: { general: { wallpaperconfig: { selectedwallpapers: {
    Monitor1: { file: secondary }, Monitor0: { file: primary },
  } } } } };
  assert.equal(savedWallpaperPath(config, 'alice'), primary);
  assert.equal(savedWallpaperPath(config, 'other'), null);
  assert.equal((await projectAsset(join(workshop, '12'), 'preview.jpg')).size, 11);
  assert.equal(await projectAsset(join(workshop, '34'), '../12/preview.jpg'), null);
});

test('CDP discovery accepts only the exact local Codex page and rejects redirects', async (t) => {
  let redirect = false;
  const server = createServer((request, response) => {
    assert.equal(request.url, '/json/list');
    if (redirect) {
      response.writeHead(302, { location: '/elsewhere' }).end();
      return;
    }
    const endpoint = `ws://127.0.0.1:${server.address().port}/devtools/page/ABC`;
    response.end(JSON.stringify([
      { id: 'ABC', type: 'page', url: mainPage, webSocketDebuggerUrl: endpoint },
      { id: 'ABC', type: 'page', url: 'https://example.com', webSocketDebuggerUrl: endpoint },
      { id: 'ABC', type: 'page', url: mainPage + '?initialRoute=/avatar-overlay', webSocketDebuggerUrl: endpoint },
      { id: 'ABC', type: 'page', url: mainPage, webSocketDebuggerUrl: endpoint.replace('127.0.0.1', 'example.com') },
      { id: '../ABC', type: 'page', url: mainPage, webSocketDebuggerUrl: endpoint },
    ]));
  });
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  assert.deepEqual(await findTargets(port), [`ws://127.0.0.1:${port}/devtools/page/ABC`]);
  redirect = true;
  await assert.rejects(findTargets(port), /Cannot reach/);
});
