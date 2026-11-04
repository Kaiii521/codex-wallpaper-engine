import { createAppearance, panelCss } from './appearance.mjs';
import { renderWorkshop, workshopCss } from './workshop-panel.mjs';

const css = `
  body:has(> #cwe-backdrop) { isolation: isolate; }
  body:has(> #cwe-backdrop:not([data-kind="empty"])) #root { background: transparent !important; }
  body:has(> #cwe-backdrop:not([data-kind="empty"])) :is(.main-surface, [data-app-shell-main-surface="default"]) {
    background: transparent !important;
  }
  body:has(> #cwe-backdrop:not([data-kind="empty"]))
    [data-thread-scroll-footer="true"] > .bg-surface[aria-hidden="true"],
  body:has(> #cwe-backdrop:not([data-kind="empty"]))
    [data-app-action-timeline-scroll] .pointer-events-none.sticky.bottom-0 > .from-surface[aria-hidden="true"],
  body:has(> #cwe-backdrop:not([data-kind="empty"]))
    [aria-hidden="true"]:is([class^="MainContentTopFade-"], [class*=" MainContentTopFade-"]) {
    background: transparent !important;
  }
  #cwe-backdrop[data-kind="empty"] { visibility: hidden; }
  #cwe-backdrop {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    background: #101829;
  }
  #cwe-backdrop {
    --cwe-filter: brightness(var(--cwe-brightness, 100%)) contrast(var(--cwe-contrast, 100%))
      saturate(var(--cwe-saturation, 100%)) blur(var(--cwe-blur, 0px));
  }
  #cwe-backdrop > :is(video, img) {
    width: 100%; height: 100%; object-fit: var(--cwe-fit, cover);
    filter: var(--cwe-filter);
    scale: var(--cwe-scale, 1);
  }
  #cwe-backdrop[data-fit="contain"] > :is(video, img) { scale: 1; }
  #cwe-backdrop::after {
    position: absolute;
    inset: 0;
    content: "";
    background: color-mix(in srgb, var(--color-background-surface, Canvas) var(--cwe-dim), transparent);
  }
  #cwe-backdrop[data-kind="demo"]::before {
    position: absolute;
    inset: -24%;
    content: "";
    filter: var(--cwe-filter);
    background:
      radial-gradient(ellipse at 25% 55%, #74dbc3 0%, transparent 42%),
      radial-gradient(ellipse at 74% 30%, #7c6fdb 0%, transparent 50%),
      radial-gradient(ellipse at 66% 87%, #225993 0%, transparent 56%);
    animation: cwe-drift 15s ease-in-out infinite alternate;
  }
  #cwe-backdrop[data-paused]::before { animation-play-state: paused; }
  body:has(> #cwe-appearance[data-glass]) :is(
    .app-shell-left-panel:not(:has([data-sidebar-navigation-root])),
    .app-shell-left-panel [data-sidebar-navigation-root],
    .composer-surface-chrome,
    [data-composer-surface-variant]:has([data-codex-composer])
  ) {
    background: color-mix(in srgb, var(--cwe-glass-color, var(--cwe-surface, Canvas))
      var(--cwe-effective-glass-opacity, var(--cwe-glass-opacity)), transparent) !important;
    backdrop-filter: blur(var(--cwe-glass-blur)) !important;
    outline: 1px solid color-mix(in srgb, currentColor var(--cwe-glass-border), transparent);
    outline-offset: -1px;
  }
  html:has(body > #cwe-appearance[data-cinematic]) {
    color-scheme: dark !important;
    --cwe-surface: #1d161c;
    --color-surface: #1d161c !important;
    --color-surface-secondary: #211920 !important;
    --color-surface-elevated: #30242d !important;
    --color-surface-elevated-secondary: #281e27 !important;
    --color-background-surface: #120d12 !important;
    --color-background-panel: #211920 !important;
    --color-background-composer-surface: #251b23 !important;
    --color-background-composer-action-bar: #221921 !important;
    --color-background-composer-primary: #f6dbe8 !important;
    --color-background-segmented-form-selected: #473340 !important;
    --color-background-primary-ghost-hover: #ffffff18 !important;
    --color-token-bg-primary: #231a22 !important;
    --color-token-main-surface-primary: #1d161c !important;
    --color-token-side-bar-background: #161116 !important;
    --color-text: #fff3f7 !important;
    --color-text-primary: #fff3f7 !important;
    --color-text-foreground: #fff3f7 !important;
    --color-text-primary-ghost: #fff3f7 !important;
    --color-text-primary-ghost-hover: #fff3f7 !important;
    --color-text-primary-surface: #fff3f7 !important;
    --color-text-primary-outline: #fff3f7 !important;
    --color-text-primary-soft: #fff3f7 !important;
    --color-text-secondary: #e0cbd4 !important;
    --color-text-secondary-ghost-hover: #fff3f7 !important;
    --color-text-tertiary: #c5adb9 !important;
    --color-text-composer-primary: #24151e !important;
    --color-text-info: #ffb7d1 !important;
    --color-token-text-primary: #fff3f7 !important;
    --color-token-foreground: #fff3f7 !important;
    --color-token-text-secondary: #e0cbd4 !important;
    --color-token-text-tertiary: #c5adb9 !important;
    --color-token-input-border: #ffffff26 !important;
    --color-token-border-default: #ffffff22 !important;
    --color-border: #ffffff22 !important;
    color: #fff3f7;
  }
  body:has(> #cwe-appearance[data-cinematic]) #root {
    color: var(--color-text);
  }
  body:has(> #cwe-appearance[data-cinematic]) #root :is(.text-default, [class~="text-default!"]) {
    color: #fff3f7 !important;
  }
  body:has(> #cwe-appearance[data-cinematic]) [data-sidebar-navigation-root]
    :is([data-app-action-sidebar-project-row], [data-sidebar-cycle-item]) {
    --color-text: #fff3f7 !important;
    color: #fff3f7;
  }
  body:has(> #cwe-appearance[data-cinematic]:not([data-glass]))
    [data-composer-surface-variant]:has([data-codex-composer]) {
    background: #251b23 !important;
  }
  body:has(> #cwe-appearance[data-cinematic][data-glass]) :is(
    .composer-surface-chrome, [data-composer-surface-variant]:has([data-codex-composer])
  ) {
    --cwe-effective-glass-opacity: max(70%, var(--cwe-glass-opacity));
  }
  body:has(> #cwe-appearance[data-cinematic]) [data-codex-composer] {
    color: var(--color-text) !important;
  }
  body:has(> #cwe-appearance[data-cinematic]) [data-codex-composer] [data-placeholder]::before {
    color: #e0cbd4 !important;
  }
  body:has(> #cwe-appearance[data-cinematic]) #cwe-backdrop::after {
    background: color-mix(in srgb, #0e090f var(--cwe-dim), transparent);
  }
  body:has(> #cwe-appearance[data-cinematic])
    [data-app-action-timeline-scroll] [data-response-annotation-conversation] {
    color: var(--color-text-primary);
    background: #171017ce;
    border-radius: 16px;
    padding: 10px 14px;
  }
  body:has(> #cwe-appearance[data-cinematic]) #root [data-user-message-bubble].bg-user-message {
    background-color: #2b1823eb !important;
    color: var(--color-text-primary);
  }
  body:has(> #cwe-appearance[data-cinematic])
    .bg-surface-elevated-secondary[class~="group/summary-panel"] {
    background: #211920ed !important;
    color: var(--color-text-primary);
  }
  body:has(> #cwe-appearance[data-cinematic][data-glass])
    .app-shell-left-panel [data-sidebar-navigation-root] {
    background: color-mix(in srgb, var(--cwe-glass-color, var(--cwe-surface))
      min(100%, calc(var(--cwe-glass-opacity) + 24%)), transparent) !important;
  }
  @keyframes cwe-drift {
    to { transform: translate(7%, -8%) rotate(14deg) scale(1.14); }
  }
  @media (prefers-reduced-motion: reduce) {
    #cwe-backdrop[data-kind="demo"]::before { animation: none; }
  }
`;

// Runs inside the renderer. Keep all of its dependencies in the arguments or function body.
export async function updateWallpaper(command, options, css, expectedPage, createPanel, panelCss, renderWorkshop) {
  if (location.href !== expectedPage || !document.getElementById('root')) {
    throw new Error('The selected page is no longer a Codex main window.');
  }
  const key = Symbol.for('codex-wallpaper-engine');
  const state = globalThis[key] ??= { revision: 0, current: null };

  function update(command, options) {
    return updateWallpaper(command, options, css, expectedPage, createPanel, panelCss, renderWorkshop);
  }

  function sync(current) {
    const paused = current.paused || (current.panel?.pauseWhenHidden() !== false && document.hidden);
    current.layer.toggleAttribute('data-paused', paused);
    current.panel?.syncPlayback();
    if (current.media?.tagName !== 'VIDEO') return;
    if (paused) current.media.pause();
    else return current.media.play();
  }

  function dispose(current) {
    if (!current) return;
    document.removeEventListener('visibilitychange', current.onVisibility);
    current.layer.remove();
    current.style.remove();
    current.panel?.dispose();
    current.appearance?.host.remove(); // Upgrade an existing window without restarting it.
    if (current.media?.tagName === 'VIDEO') current.media.pause();
    if (current.url) URL.revokeObjectURL(current.url);
  }

  function mountPanel(current, panelOptions) {
    const { dim, queue = { files: [], index: -1 }, name, source } = panelOptions;
    current.panelOptions = { dim, queue, name, source };
    current.panelVersion = createPanel.toString() + panelCss + css;
    const currentDim = () => Number.parseInt(current.layer.style.getPropertyValue('--cwe-dim'), 10);
    async function applyWorkshop(itemId, nextQueue, source, reopen) {
      if (!state.workshop) throw new Error('工坊尚未连接，请重新运行 library。');
      const media = await state.workshop.request('apply', itemId);
      if (state.current !== current) throw new Error('壁纸已切换。');
      await update('apply', { ...media, reopen, source, queue: nextQueue, dim: currentDim() });
    }
    current.panel = createPanel(current, panelCss, css, { ...current.panelOptions, workshop: state.workshop }, {
      sync: () => sync(current),
      apply: (file, nextQueue, name, reopen) => file.workshopId
        ? applyWorkshop(file.workshopId, nextQueue, 'local', reopen)
        : update('apply', {
        file, queue: nextQueue, name, reopen, source: 'local', dim: currentDim(),
        kind: /\.(mp4|webm)$/i.test(file.name) ? 'video' : 'image',
      }),
      renderWorkshop: (root, controller, enqueue) => renderWorkshop(root, controller,
        (item) => applyWorkshop(item.id, queue, 'workshop', true), enqueue),
    });
    document.body.append(current.panel.host);
  }

  if (command === 'workshop-response') {
    if (state.workshop?.binding === options.binding) state.workshop.respond(options);
    return;
  }
  if (command === 'workshop-disconnect') {
    if (state.workshop?.binding !== options.binding) return;
    state.workshop.close();
    delete state.workshop;
    if (state.current?.liveId) {
      state.current.layer.dataset.liveState = 'stopped';
      state.current.panel?.stopLive();
    }
    state.current?.panel?.setWorkshop(undefined, false);
    return;
  }
  if (command === 'workshop-connect') {
    const send = globalThis[options.binding];
    if (typeof send !== 'function') throw new Error('The local Workshop connection is unavailable.');
    if (state.workshop) {
      state.workshop.disconnect();
      if (state.current?.liveId) {
        state.current.layer.dataset.liveState = 'stopped';
        state.current.panel?.stopLive();
      }
    }
    const pending = new Map();
    const thumbnails = new Map();
    let sequence = 0;
    function request(kind, id) {
      return new Promise((resolve, reject) => {
        const seq = ++sequence;
        const timeout = setTimeout(() => {
          pending.delete(seq);
          reject(new Error('工坊连接无响应，请重新运行 library。'));
        }, 22_000);
        pending.set(seq, ({ data, error }) => {
          clearTimeout(timeout);
          pending.delete(seq);
          if (error) reject(new Error(error));
          else resolve(data);
        });
        try {
          send(JSON.stringify({ kind, id, seq }));
        } catch {
          pending.get(seq)({ error: '工坊连接已断开。' });
        }
      });
    }
    state.workshop = {
      binding: options.binding,
      items: options.items,
      request(kind, id) {
        if (kind === 'refresh') thumbnails.clear();
        return request(kind, id);
      },
      thumbnail(id) {
        if (!thumbnails.has(id)) {
          if (thumbnails.size >= 24) thumbnails.delete(thumbnails.keys().next().value);
          const thumbnail = request('thumbnail', id)
            .then((media) => `data:${media.mime};base64,${media.base64}`)
            .catch((error) => {
              if (thumbnails.get(id) === thumbnail) thumbnails.delete(id);
              throw error;
            });
          thumbnails.set(id, thumbnail);
        }
        return thumbnails.get(id);
      },
      respond: (result) => pending.get(result.seq)?.(result),
      close() {
        for (const complete of pending.values()) complete({ error: '工坊连接已断开。' });
        thumbnails.clear();
      },
      disconnect() {
        this.close();
        send('disconnect');
      },
    };
    if (state.current) {
      await update('appearance', {});
      state.current.panel.setWorkshop(state.workshop, true);
      state.current.panel.open(true, 'library');
    } else {
      await update('apply', { kind: 'empty', reopen: true, source: 'workshop' });
    }
    return 'workshop connected';
  }

  if (command === 'clear') {
    state.revision++;
    dispose(state.current);
    state.current = null;
    return 'cleared';
  }
  if (command === 'pause' || command === 'resume') {
    if (!state.current) return 'empty';
    state.current.paused = command === 'pause';
    await sync(state.current);
    return command === 'pause' ? 'paused' : 'resumed';
  }
  if (command === 'appearance') {
    const current = state.current;
    if (!current) return 'empty';
    if (current.panelVersion !== createPanel.toString() + panelCss + css) {
      current.panel?.dispose();
      current.appearance?.host.remove();
      const dim = Number.parseInt(current.layer.style.getPropertyValue('--cwe-dim'), 10);
      mountPanel(current, { ...current.panelOptions, dim });
      current.onVisibility && document.removeEventListener('visibilitychange', current.onVisibility);
      current.onVisibility = () => sync(current)?.catch(() => {});
      document.addEventListener('visibilitychange', current.onVisibility);
      await sync(current);
    }
    current.panel.open(true, 'appearance');
    return 'wallpaper panel opened';
  }

  const revision = ++state.revision;
  const layer = document.createElement('div');
  layer.id = 'cwe-backdrop';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  layer.dataset.kind = options.kind;
  const style = document.createElement('style');
  style.textContent = css;
  const next = { layer, style, paused: state.current?.paused ?? false, liveId: options.liveId };
  next.onVisibility = () => sync(next)?.catch(() => {});
  try {
    if (options.kind === 'image' || options.kind === 'live') {
      next.media = document.createElement('img');
      next.media.alt = '';
      if (options.kind === 'live') {
        next.media.src = 'data:image/jpeg;base64,' + options.first;
        layer.dataset.liveState = 'ready';
      } else if (options.file) {
        const reader = new FileReader();
        next.media.src = await new Promise((resolve, reject) => {
          reader.addEventListener('load', () => resolve(reader.result), { once: true });
          reader.addEventListener('error', () => reject(new Error('无法读取所选图片。')), { once: true });
          reader.readAsDataURL(options.file);
        });
      } else {
        next.media.src = `data:${options.mime};base64,${options.base64}`;
      }
      await next.media.decode();
    } else if (options.kind === 'video') {
      if (options.file) {
        next.url = URL.createObjectURL(options.file);
      } else {
        const bytes = typeof Uint8Array.fromBase64 === 'function'
          ? Uint8Array.fromBase64(options.base64)
          : Uint8Array.from(atob(options.base64), (character) => character.charCodeAt(0));
        next.url = URL.createObjectURL(new Blob([bytes], { type: options.mime }));
      }
      next.media = document.createElement('video');
      next.media.loop = true;
      next.media.muted = true;
      next.media.playsInline = true;
      next.media.preload = 'auto';
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out loading the video.')), 8000);
        next.media.addEventListener('loadeddata', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
        next.media.addEventListener('error', () => {
          clearTimeout(timer);
          const detail = next.media.error?.message;
          reject(new Error(`Codex could not load the video. Try WebM or H.264 MP4.${detail ? ` (${detail})` : ''}`));
        }, { once: true });
        next.media.src = next.url;
      });
    }
    if (next.media) layer.append(next.media);
    if (revision !== state.revision || location.href !== expectedPage) {
      throw new Error('The wallpaper request was superseded.');
    }
    document.head.append(style);
    document.body.prepend(layer);
    if (getComputedStyle(layer).position !== 'fixed') {
      throw new Error('This Codex build blocked the wallpaper stylesheet.');
    }
    mountPanel(next, options);
    await sync(next);
    if (revision !== state.revision) throw new Error('The wallpaper request was superseded.');
    dispose(state.current);
    state.current = next;
    document.addEventListener('visibilitychange', next.onVisibility);
    if (options.reopen) next.panel.open(true, 'library');
    return 'applied';
  } catch (error) {
    dispose(next);
    throw error;
  }
}

export function wallpaperExpression(command, options, expectedPage) {
  return `(${updateWallpaper})(${JSON.stringify(command)}, ${JSON.stringify(options)}, ${JSON.stringify(css)}, ${JSON.stringify(expectedPage)}, ${createAppearance}, ${JSON.stringify(panelCss + workshopCss)}, ${renderWorkshop})`;
}

export function liveFrameExpression(binding, id, data, failed = false, audioStatus) {
  return `(async (binding, id, data, failed, audioStatus) => {
    if (location.href !== 'app://-/index.html') return 'stop';
    const state = globalThis[Symbol.for('codex-wallpaper-engine')];
    const current = state?.current;
    if (state?.workshop?.binding !== binding || current?.liveId !== id) return 'stop';
    if (failed) {
      current.layer.dataset.liveState = 'stopped';
      current.panel?.stopLive();
      return 'stop';
    }
    if (audioStatus) current.panel?.audioStatus?.(audioStatus);
    if (current.layer.hasAttribute('data-paused')) return 'paused';
    if (data) {
      const frame = new Image();
      frame.src = 'data:image/jpeg;base64,' + data;
      await frame.decode();
      if (state.current !== current) return 'stop';
      current.media.src = frame.src;
      current.layer.dataset.liveState = 'playing';
    }
    const pointer = current.panel?.pointer?.();
    const systemAudio = Boolean(current.panel?.systemAudio?.());
    return pointer || systemAudio ? { status: 'playing', pointer, systemAudio } : 'playing';
  })(${JSON.stringify(binding)}, ${JSON.stringify(id)}, ${JSON.stringify(data)}, ${JSON.stringify(failed)}, ${JSON.stringify(audioStatus)})`;
}
