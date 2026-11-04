export const panelCss = `
  :host {
    position: fixed;
    right: 20px;
    bottom: 112px;
    z-index: 100;
    display: block;
    color: #f2f4fa;
    font: 13px/1.45 "Segoe UI", system-ui, sans-serif;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    border: 1px solid #50586d;
    border-radius: 8px;
    background: #282e40;
    padding: 5px 10px;
  }
  button:hover { background: #373f56; }
  :focus-visible { outline: 2px solid #addcff; outline-offset: 3px; }
  .launcher {
    display: block;
    margin-left: auto;
    min-height: 30px;
    background: #202638;
    box-shadow: 0 3px 15px #0003;
  }
  .panel {
    box-sizing: border-box;
    position: absolute;
    right: 0;
    bottom: 40px;
    width: min(344px, calc(100vw - 40px));
    max-height: max(60px, calc(100vh - 170px));
    overflow: auto;
    padding: 15px;
    border: 1px solid #50586d;
    border-top: 2px solid #addcff;
    border-radius: 13px;
    background: #1b2030f5;
    box-shadow: 0 12px 40px #0006;
    color-scheme: dark;
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { margin: 0; font-size: 15px; font-weight: 650; }
  p { color: #c2c9db; margin: 5px 0 12px; font-size: 12px; }
  .row {
    display: grid;
    grid-template-columns: 5.1em minmax(0, 1fr) 4em;
    gap: 8px;
    align-items: center;
    min-height: 31px;
  }
  input { width: 100%; margin: 0; accent-color: #addcff; }
  output { color: #dbe3f5; font: 12px ui-monospace, monospace; text-align: right; }
  nav, .actions { display: flex; gap: 6px; margin: 10px 0; }
  nav button { flex: 1; border-color: transparent; background: #252b3c; }
  nav button[aria-pressed="true"] { border-color: #addcff; color: #d8efff; }
  .heading { color: #addcff; margin: 12px 0 5px; font-size: 12px; font-weight: 650; }
  .control { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; }
  .control input[type="checkbox"] { width: auto; }
  select, input[type="color"] {
    font: inherit; color: inherit; background: #282e40; border: 1px solid #50586d;
    border-radius: 7px; padding: 4px;
  }
  input[type="color"] { width: 38px; padding: 2px; }
  .queue { width: 100%; margin: 4px 0; }
  .status { min-height: 1.4em; overflow-wrap: anywhere; }
  .presets { margin-top: 12px; padding-top: 9px; border-top: 1px solid #414a61; }
  .presets summary { color: #addcff; cursor: pointer; }
  .presets .actions { flex-wrap: wrap; }
  button:disabled, select:disabled, input:disabled { opacity: .45; cursor: default; }
`;

// This function is serialized and runs in the Codex window.
export function createAppearance(current, panelCss, wallpaperCss, options, actions) {
  const { layer, media, style } = current;
  const storageKey = 'codex-wallpaper-engine.appearance.v1';
  const controls = [
    { key: 'brightness', label: '亮度', min: 30, max: 170, initial: 100, unit: '%' },
    { key: 'contrast', label: '对比度', min: 40, max: 180, initial: 100, unit: '%' },
    { key: 'saturation', label: '饱和度', min: 0, max: 200, initial: 100, unit: '%' },
    { key: 'blur', label: '模糊', min: 0, max: 20, initial: 0, unit: 'px' },
    { key: 'dim', label: '主题遮罩', min: 0, max: 100, initial: 68, unit: '%' },
  ];
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    // Use defaults when storage is unavailable or the previous value is invalid.
  }
  const host = document.createElement('div');
  host.id = 'cwe-appearance';
  const shadow = host.attachShadow({ mode: 'open' });
  function add(parent, tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }
  add(shadow, 'style', panelCss);
  const panel = add(shadow, 'section', '', 'panel');
  panel.hidden = true;
  panel.id = 'appearance-panel';
  panel.setAttribute('aria-labelledby', 'appearance-heading');
  const header = add(panel, 'header');
  const title = add(header, 'h2', '壁纸工作台');
  title.id = 'appearance-heading';
  const reset = add(header, 'button', '恢复默认');
  reset.type = 'button';
  const launcher = add(shadow, 'button', '壁纸外观', 'launcher');
  launcher.type = 'button';
  launcher.setAttribute('aria-controls', panel.id);
  const nav = add(panel, 'nav');
  nav.setAttribute('aria-label', '壁纸设置分类');
  const pages = new Map();
  let activeTab = 'appearance';
  function selectTab(key) {
    activeTab = key;
    for (const [name, { section, button }] of pages) {
      section.hidden = name !== key;
      button.setAttribute('aria-pressed', String(name === key));
    }
    reset.hidden = key === 'library';
  }
  for (const [key, label] of [['library', '壁纸'], ['appearance', '外观'], ['playback', '播放']]) {
    const button = add(nav, 'button', label);
    button.type = 'button';
    const section = document.createElement('section');
    section.id = 'cwe-section-' + key;
    button.setAttribute('aria-controls', section.id);
    button.addEventListener('click', () => selectTab(key));
    pages.set(key, { section, button });
  }
  for (const { section } of pages.values()) panel.append(section);
  const appearance = pages.get('appearance').section;
  const playback = pages.get('playback').section;
  const libraryPage = pages.get('library').section;
  const activeTitle = options.name ?? (layer.dataset.kind === 'empty' ? '当前没有壁纸' : '当前壁纸已加载');
  const activeLabel = add(libraryPage, 'p', activeTitle);
  const source = add(libraryPage, 'div', '', 'actions library-source');
  const workshopButton = add(source, 'button', 'Steam 工坊');
  const localButton = add(source, 'button', '轮播队列');
  const workshop = add(libraryPage, 'section');
  const library = add(libraryPage, 'section');
  function selectSource(showWorkshop) {
    workshop.hidden = !showWorkshop;
    library.hidden = showWorkshop;
    workshopButton.setAttribute('aria-pressed', String(showWorkshop));
    localButton.setAttribute('aria-pressed', String(!showWorkshop));
  }
  workshopButton.addEventListener('click', () => selectSource(true));
  localButton.addEventListener('click', () => selectSource(false));
  function setWorkshop(controller, showWorkshop = options.source ? options.source === 'workshop' : Boolean(controller)) {
    actions.renderWorkshop(workshop, controller, enqueueWorkshop);
    selectSource(showWorkshop);
  }
  const values = {};
  const defaults = { appearance: [], playback: [] };
  const presetFields = new Map();
  function slider(parent, group, { key, label, min, max, initial, unit, step = 1 }, onInput, override) {
    const row = add(parent, 'div', '', 'row');
    const name = add(row, 'label', label);
    name.htmlFor = key;
    const input = add(row, 'input');
    input.type = 'range';
    input.id = key;
    input.min = min;
    input.max = max;
    input.step = step;
    const output = add(row, 'output');
    // An output element has a live role by default. The slider already exposes its value.
    output.setAttribute('aria-hidden', 'true');
    function update(value) {
      input.value = Number.isFinite(value) ? value : initial;
      values[key] = input.valueAsNumber;
      output.textContent = input.value + unit;
      input.setAttribute('aria-valuetext', output.textContent);
      onInput?.(values[key], output.textContent);
    }
    update(override ?? saved?.[key]);
    input.addEventListener('input', () => update(input.valueAsNumber));
    input.addEventListener('change', save);
    defaults[group].push(() => update(initial));
    if (group === 'appearance') presetFields.set(key, {
      update, initial, valid: (value) => Number.isFinite(value) && value >= min && value <= max,
    });
    return input;
  }
  function setting(parent, group, key, label, initial, type, choices, onChange) {
    const row = add(parent, 'label', '', 'control');
    add(row, 'span', label);
    const input = add(row, type === 'select' ? 'select' : 'input');
    if (type === 'select') {
      for (const [value, text] of choices) add(input, 'option', text).value = value;
    } else {
      input.type = type;
    }
    function update(value) {
      if (type === 'checkbox') input.checked = typeof value === 'boolean' ? value : initial;
      else if (type === 'color') input.value = /^#[0-9a-f]{6}$/i.test(value) ? value : initial;
      else input.value = choices.some(([choice]) => choice === value) ? value : initial;
      values[key] = type === 'checkbox' ? input.checked : input.value;
      onChange?.();
    }
    update(saved?.[key]);
    input.addEventListener(type === 'color' ? 'input' : 'change', () => {
      update(type === 'checkbox' ? input.checked : input.value);
      save();
    });
    defaults[group].push(() => update(initial));
    if (group === 'appearance') presetFields.set(key, {
      update, initial,
      valid: (value) => type === 'checkbox' ? typeof value === 'boolean'
        : typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
    });
    return input;
  }
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      // The live adjustments still work without persistent storage.
    }
  }
  function open(show, tab) {
    if (tab) selectTab(tab);
    panel.hidden = !show;
    launcher.setAttribute('aria-expanded', String(show));
  }
  open(false);
  launcher.addEventListener('click', () => open(panel.hidden));
  shadow.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.stopPropagation();
    open(false);
    launcher.focus();
  });
  reset.addEventListener('click', () => {
    for (const resetControl of defaults[activeTab]) resetControl();
    save();
  });

  for (const control of controls) {
    slider(appearance, 'appearance', control, (value, display) => {
      layer.style.setProperty('--cwe-' + control.key, display);
      if (control.key === 'blur') layer.style.setProperty('--cwe-scale', 1 + value / 100);
    }, control.key === 'dim' && Number.isFinite(options.dim) ? options.dim : undefined);
  }
  add(appearance, 'h3', '侧栏与输入框', 'heading');
  function glass() {
    host.toggleAttribute('data-glass', Boolean(values.glass));
    style.textContent = wallpaperCss + 'body:has(> #cwe-appearance[data-glass]) {' +
      '--cwe-glass-color:' + (values.glassTheme ? 'var(--color-background-surface, Canvas)' : values.glassColor ?? '#262c3e') + ';' +
      '--cwe-glass-opacity:' + (values.glassOpacity ?? 86) + '%;' +
      '--cwe-glass-blur:' + (values.glassBlur ?? 8) + 'px;' +
      '--cwe-glass-border:' + (values.glassBorder ?? 15) + '%;}';
  }
  setting(appearance, 'appearance', 'glass', '启用玻璃外观', false, 'checkbox', null, glass);
  setting(appearance, 'appearance', 'glassTheme', '使用当前主题色', true, 'checkbox', null, glass);
  setting(appearance, 'appearance', 'glassColor', '自定义玻璃颜色', '#262c3e', 'color', null, glass);
  slider(appearance, 'appearance', { key: 'glassOpacity', label: '不透明度', min: 20, max: 100, initial: 86, unit: '%' }, glass);
  slider(appearance, 'appearance', { key: 'glassBlur', label: '玻璃模糊', min: 0, max: 16, initial: 8, unit: 'px' }, glass);
  slider(appearance, 'appearance', { key: 'glassBorder', label: '玻璃边框', min: 0, max: 50, initial: 15, unit: '%' }, glass);

  const presetFormat = 'codex-wallpaper-appearance';
  const presets = add(appearance, 'details', '', 'presets');
  add(presets, 'summary', '外观预设');
  const shortcuts = add(presets, 'div', '', 'actions');
  const transfer = add(presets, 'div', '', 'actions');
  const presetStatus = add(presets, 'p', '', 'status');
  presetStatus.setAttribute('role', 'status');
  function applyPreset(settings, resetMissing = false) {
    const changes = [...presetFields].flatMap(([key, field]) => {
      if (Object.hasOwn(settings, key)) return [[field, settings[key]]];
      return resetMissing ? [[field, field.initial]] : [];
    });
    if (!changes.length || changes.some(([field, value]) => !field.valid(value))) {
      throw new Error('预设中没有可用设置，或有数值超出范围。');
    }
    for (const [field, value] of changes) field.update(value);
    save();
  }
  for (const [name, settings] of [
    ['原色', { dim: 20 }],
    ['低光', { brightness: 70, contrast: 105, saturation: 85, dim: 55 }],
    ['透光玻璃', { dim: 38, glass: true, glassOpacity: 64, glassBlur: 12, glassBorder: 22 }],
  ]) {
    add(shortcuts, 'button', name).addEventListener('click', () => {
      applyPreset(settings, true);
      presetStatus.textContent = '已应用「' + name + '」。';
    });
  }
  const importFile = add(presets, 'input');
  importFile.type = 'file';
  importFile.accept = '.json,application/json';
  importFile.hidden = true;
  add(transfer, 'button', '导入 JSON').addEventListener('click', () => importFile.click());
  add(transfer, 'button', '导出 JSON').addEventListener('click', () => {
    const settings = Object.fromEntries([...presetFields.keys()].map((key) => [key, values[key]]));
    const blob = new Blob([JSON.stringify({ format: presetFormat, version: 1, settings }, null, 2) + '\n'],
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = add(presets, 'a');
    link.href = url;
    link.download = 'codex-wallpaper-appearance.json';
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  importFile.addEventListener('change', async () => {
    const file = importFile.files[0];
    importFile.value = '';
    if (!file) return;
    try {
      if (file.size > 64 * 1024) throw new Error('预设文件不能超过 64 KiB。');
      const preset = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      if (preset?.format !== presetFormat || preset.version !== 1 || !preset.settings
        || typeof preset.settings !== 'object' || Array.isArray(preset.settings)) {
        throw new Error('请选择由壁纸工作台导出的预设。');
      }
      applyPreset(preset.settings);
      presetStatus.textContent = '已导入外观预设。';
    } catch (error) {
      presetStatus.textContent = error instanceof SyntaxError ? '文件不是有效的 JSON。' : error.message;
    }
  });

  const status = add(library, 'p', '', 'status');
  status.setAttribute('role', 'status');
  const picker = add(library, 'input');
  picker.type = 'file';
  picker.accept = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm';
  picker.multiple = true;
  picker.hidden = true;
  const buttons = add(library, 'div', '', 'actions');
  const browse = add(buttons, 'button', '选取本地文件');
  const previous = add(buttons, 'button', '上一张');
  const next = add(buttons, 'button', '下一张');
  const choices = add(library, 'select', '', 'queue');
  choices.setAttribute('aria-label', '壁纸队列');
  const queue = options.queue ?? { files: [], index: -1 };
  const remove = add(buttons, 'button', '移除');
  const playSelected = add(buttons, 'button', '播放所选');
  add(library, 'p', '可选取本地文件，也可从 Steam 工坊加入。队列在本次窗口会话中有效。');
  const playButton = add(playback, 'button');
  let timer;
  let busy = false;
  let disposed = false;
  let rotationFailed = false;

  function syncPlayback() {
    playButton.textContent = current.paused ? '继续播放' : '暂停播放';
    clearTimeout(timer);
    if (disposed || busy || rotationFailed || current.paused || (values.pauseHidden && document.hidden)) return;
    if (values.rotate && values.interval && queue.files.length > 1) {
      timer = setTimeout(() => playIndex(queue.files, (queue.index + 1) % queue.files.length), values.interval * 1000);
    }
  }
  function resync() {
    Promise.resolve(actions.sync()).catch(() => {
      status.textContent = '视频暂时无法继续播放。';
    });
  }
  function queueControls() {
    browse.disabled = busy;
    choices.disabled = busy || queue.files.length === 0;
    previous.disabled = next.disabled = busy || queue.files.length === 0;
    remove.disabled = busy || queue.files.length === 0;
    playSelected.disabled = busy || queue.files.length === 0;
  }
  function renderQueue() {
    choices.replaceChildren();
    if (!queue.files.length) add(choices, 'option', '还没有加入队列的壁纸');
    queue.files.forEach((file, index) => { add(choices, 'option', file.name).value = index; });
    if (queue.index >= 0) choices.value = String(queue.index);
    queueControls();
  }
  function enqueueWorkshop(item) {
    if (queue.files.length >= 50 || queue.files.some((entry) => entry.workshopId === item.id)) return false;
    queue.files.push({ name: item.title, workshopId: item.id });
    renderQueue();
    syncPlayback();
    return true;
  }
  async function playIndex(files, index) {
    if (busy || disposed) return;
    const file = files[index];
    if (!file) return;
    busy = true;
    queueControls();
    syncPlayback();
    try {
      await actions.apply(file, { files, index }, file.name, !panel.hidden);
    } catch {
      rotationFailed = true;
      status.textContent = '无法加载「' + file.name + '」。已保留当前壁纸。';
      choices.value = String(queue.index);
    } finally {
      busy = false;
      queueControls();
    }
  }
  renderQueue();
  browse.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const files = Array.from(picker.files);
    picker.value = '';
    if (!files.length) return;
    if (files.length > 50 || files.some((file) => !/\.(jpe?g|png|webp|gif|mp4|webm)$/i.test(file.name)
      || file.size === 0 || file.size > 32 * 1024 * 1024)) {
      status.textContent = '请选择最多 50 个受支持的文件，单个文件不超过 32 MiB。';
      return;
    }
    playIndex(files, 0);
  });
  previous.addEventListener('click', () => playIndex(queue.files, queue.index < 0 ? queue.files.length - 1
    : (queue.index - 1 + queue.files.length) % queue.files.length));
  next.addEventListener('click', () => playIndex(queue.files, (queue.index + 1) % queue.files.length));
  choices.addEventListener('change', () => playIndex(queue.files, Number(choices.value)));
  playSelected.addEventListener('click', () => playIndex(queue.files, Number(choices.value)));
  remove.addEventListener('click', () => {
    const index = Number(choices.value);
    queue.files.splice(index, 1);
    if (queue.index >= index) queue.index--;
    renderQueue();
    syncPlayback();
  });

  playButton.addEventListener('click', () => {
    current.paused = !current.paused;
    resync();
  });
  setting(playback, 'playback', 'pauseHidden', '窗口隐藏时暂停', true, 'checkbox', null, () => {
    if (current.panel) resync();
  });
  const speed = slider(playback, 'playback', { key: 'speed', label: '视频速度', min: 0.5, max: 2, initial: 1, step: 0.25, unit: '×' }, (value) => {
    if (media?.tagName === 'VIDEO') media.playbackRate = value;
  });
  speed.disabled = media?.tagName !== 'VIDEO';
  setting(playback, 'playback', 'fit', '画面适配', 'cover', 'select', [['cover', '填满窗口'], ['contain', '完整显示']], () => {
    layer.style.setProperty('--cwe-fit', values.fit);
    layer.dataset.fit = values.fit;
  });
  let pointer = null;
  function movePointer(event) {
    if (!event.isTrusted || event.pointerType !== 'mouse' || event.composedPath().includes(host)) return;
    const width = media.naturalWidth || innerWidth;
    const height = media.naturalHeight || innerHeight;
    const fit = values.fit === 'contain' ? Math.min : Math.max;
    const scale = fit(innerWidth / width, innerHeight / height);
    const x = (event.clientX - (innerWidth - width * scale) / 2) / (width * scale);
    const y = (event.clientY - (innerHeight - height * scale) / 2) / (height * scale);
    pointer = x >= 0 && x <= 1 && y >= 0 && y <= 1 ? [x, y] : null;
  }
  function leavePointer(event) {
    if (event.relatedTarget === null) pointer = null;
  }
  function setPointerTracking() {
    window.removeEventListener('pointermove', movePointer, true);
    window.removeEventListener('pointerout', leavePointer, true);
    pointer = null;
    if (current.liveId && layer.dataset.liveState !== 'stopped' && values.pointerInteraction) {
      window.addEventListener('pointermove', movePointer, { capture: true, passive: true });
      window.addEventListener('pointerout', leavePointer, { capture: true, passive: true });
    }
  }
  const pointerControl = setting(playback, 'playback', 'pointerInteraction', '实时壁纸响应鼠标', false, 'checkbox', null, setPointerTracking);
  const audioControl = setting(playback, 'playback', 'systemAudio', '系统音频响应', false, 'checkbox');
  pointerControl.disabled = audioControl.disabled = !current.liveId || layer.dataset.liveState === 'stopped';
  const audioLabel = add(playback, 'p');
  audioLabel.setAttribute('role', 'status');
  function audioStatus(status) {
    const labels = {
      starting: '正在连接 Windows 默认播放设备…',
      active: '正在读取默认播放设备的频谱。',
      unavailable: '未能连接播放设备，稍后会重试。',
      unsupported: '系统音频响应目前只支持 Windows。',
    };
    const text = values.systemAudio ? labels[status] ?? '' : '';
    if (audioLabel.textContent !== text) audioLabel.textContent = text;
    audioLabel.hidden = !text;
  }
  audioStatus('off');
  add(playback, 'h3', '队列轮播', 'heading');
  setting(playback, 'playback', 'rotate', '自动切换下一张', false, 'checkbox', null, syncPlayback);
  slider(playback, 'playback', { key: 'interval', label: '切换间隔', min: 10, max: 300, initial: 30, unit: ' 秒' }, syncPlayback);
  selectTab('appearance');
  setWorkshop(options.workshop);
  return {
    host, open, syncPlayback, setWorkshop,
    pointer: () => values.pointerInteraction ? pointer : null,
    systemAudio: () => values.systemAudio,
    audioStatus,
    stopLive() {
      activeLabel.textContent = activeTitle + ' · 已停在最后一帧';
      pointerControl.disabled = audioControl.disabled = true;
      audioStatus('off');
      setPointerTracking();
    },
    pauseWhenHidden: () => values.pauseHidden,
    dispose() {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener('pointermove', movePointer, true);
      window.removeEventListener('pointerout', leavePointer, true);
      host.remove();
    },
  };
}
