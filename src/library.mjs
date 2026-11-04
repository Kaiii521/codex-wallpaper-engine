import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { connect, mainPage } from './cdp.mjs';
import { createLiveRenderer } from './live-renderer.mjs';
import { findWorkshop, workshopMedia } from './media.mjs';
import { liveFrameExpression, wallpaperExpression } from './wallpaper.mjs';

export async function serveWorkshop(target, steam, signal) {
  let catalog;
  async function scan() {
    const items = await findWorkshop(steam);
    catalog = new Map(items.map((item) => [item.id, item]));
    return items.map(({ id, type, title }) => ({ id, type, title: title.slice(0, 200) }));
  }
  const items = await scan();
  const session = await connect(target);
  const renderer = createLiveRenderer();
  const rendering = new AbortController();
  const binding = 'cweWorkshop_' + randomBytes(12).toString('hex');
  const { promise: stopped, resolve: stop } = Promise.withResolvers();
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop();
  let evaluate;
  let inFlight = 0;
  let openingLive = false;
  try {
    const { frameTree } = await session.send('Page.getFrameTree');
    if (frameTree.frame.url !== mainPage) throw new Error('The selected window is no longer Codex.');
    let context;
    const unlisten = session.listen(({ method, params }) => {
      if (method !== 'Runtime.executionContextCreated') return;
      const candidate = params.context;
      if (candidate.auxData?.frameId === frameTree.frame.id && candidate.auxData.isDefault) context = candidate;
    });
    await session.send('Runtime.enable');
    unlisten();
    if (!context?.uniqueId) throw new Error('Could not identify the Codex main window.');
    evaluate = (expression) => session.evaluate(expression, { uniqueContextId: context.uniqueId });
    if (await evaluate('location.href') !== mainPage) throw new Error('The selected window is no longer Codex.');
    await session.send('Runtime.addBinding', { name: binding, executionContextId: context.id });

    async function runFrames(player, id) {
      const frame = (data, audioStatus) => evaluate(liveFrameExpression(binding, id, data, false, audioStatus));
      try {
        for (let attempt = 0; attempt < 30; attempt++) {
          if (rendering.signal.aborted) return;
          if (await frame(null) !== 'stop') {
            await player.stream(frame, rendering.signal);
            return;
          }
          await delay(75);
        }
      } catch (error) {
        if (!rendering.signal.aborted) {
          console.error('Live wallpaper paused after a renderer error: ' + error.message);
          await evaluate(liveFrameExpression(binding, id, null, true)).catch(() => {});
        }
      } finally {
        await player.close();
      }
    }

    async function handle(payload) {
      let request;
      try {
        if (payload.length > 256) return;
        request = JSON.parse(payload);
      } catch {
        return;
      }
      if (!request || !Number.isSafeInteger(request.seq) || request.seq < 1) return;
      const reply = (result) => evaluate(wallpaperExpression(
        'workshop-response', { binding, seq: request.seq, ...result }, mainPage,
      ));
      if (inFlight >= 16) {
        await reply({ error: '请求过多，请稍后重试。' });
        return;
      }
      inFlight++;
      try {
        let data;
        if (request.kind === 'refresh') {
          data = await scan();
        } else {
          const item = catalog.get(request.id);
          if (!item || !['thumbnail', 'apply'].includes(request.kind)) throw new Error('Invalid workshop request.');
          const thumbnail = request.kind === 'thumbnail';
          if (!thumbnail && ['scene', 'web'].includes(item.type) && !openingLive) {
            openingLive = true;
            try {
              const player = await renderer.open(item);
              const liveId = randomBytes(12).toString('hex');
              try {
                await reply({ data: {
                  kind: 'live', first: player.first, liveId, binding,
                  name: item.title + '（实时渲染）',
                } });
              } catch (error) {
                await player.close();
                throw error;
              }
              void runFrames(player, liveId);
              return;
            } catch (error) {
              console.error(`Could not render "${item.title}" live; using its preview. ${error.message}`);
            } finally {
              openingLive = false;
            }
          }
          const preview = thumbnail || item.type !== 'video';
          const media = await workshopMedia(item, preview, thumbnail ? 2 * 1024 * 1024 : undefined);
          data = { ...media, name: preview ? item.title + '（工坊预览）' : item.title };
        }
        await reply({ data });
      } catch {
        await reply({ error: '无法读取这个工坊项目。请检查文件是否下载完整，或试试其他壁纸。' });
      } finally {
        inFlight--;
      }
    }
    session.listen(({ method, params }) => {
      if (method === 'Runtime.executionContextDestroyed' && params.executionContextId === context.id) stop();
      if (method === 'Runtime.executionContextsCleared') stop();
      if (method !== 'Runtime.bindingCalled' || params.name !== binding || params.executionContextId !== context.id) return;
      if (params.payload === 'disconnect') stop();
      else handle(params.payload).catch(() => stop());
    });
    await evaluate(wallpaperExpression('workshop-connect', { binding, items }, mainPage));
    console.log(`Workshop library connected: ${items.length} project(s). Press Ctrl+C to disconnect.`);
    await Promise.race([session.closed, stopped]);
  } finally {
    signal.removeEventListener('abort', stop);
    rendering.abort();
    if (evaluate) await evaluate(wallpaperExpression('workshop-disconnect', { binding }, mainPage)).catch(() => {});
    session.close();
    await renderer.close();
  }
}
