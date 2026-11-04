export const workshopCss = `
  .library-source button { flex: 1; }
  .library-source button[aria-pressed="true"] { border-color: #addcff; }
  .workshop-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
  .workshop-tools input {
    box-sizing: border-box; font: inherit; color: inherit; background: #282e40;
    border: 1px solid #50586d; border-radius: 7px; padding: 6px 8px;
  }
  .workshop-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px; padding: 0; margin: 8px 0; list-style: none;
  }
  .workshop-grid li { position: relative; min-width: 0; }
  .workshop-card { width: 100%; padding: 0; overflow: hidden; text-align: left; }
  .workshop-cover {
    display: grid; place-items: center; aspect-ratio: 16 / 9;
    background: #161d2e; color: #a5b0ca; overflow: hidden;
  }
  .workshop-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .workshop-caption { display: grid; gap: 2px; padding: 5px 7px; min-width: 0; }
  .workshop-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .workshop-meta { color: #c2c9db; font-size: 11px; }
  .workshop-favorite {
    position: absolute; right: 4px; top: 4px; padding: 1px 5px;
    background: #1b2030ed; color: #ffe3a4; font-size: 15px;
  }
  .workshop-enqueue { right: 32px; }
  .workshop-pages { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
`;

// This function is serialized and runs in the Codex window.
export function renderWorkshop(root, controller, apply, enqueue) {
  root.replaceChildren();
  function add(parent, tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    parent.append(node);
    return node;
  }
  if (!controller) {
    add(root, 'p', '在终端运行 node src/cli.mjs library，即可连接已下载的 Steam 工坊壁纸。');
    return;
  }
  const storageKey = 'codex-wallpaper-engine.workshop-favorites.v1';
  let favorites = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) favorites = new Set(saved.filter((id) => typeof id === 'string'));
  } catch {
    // Favorites remain usable for this window.
  }
  const tools = add(root, 'div', '', 'workshop-tools');
  const search = add(tools, 'input');
  search.type = 'search';
  search.placeholder = '搜索名称或工坊 ID';
  search.setAttribute('aria-label', '搜索工坊壁纸');
  const filter = add(tools, 'select');
  filter.setAttribute('aria-label', '工坊类型');
  for (const [value, label] of [
    ['all', '全部'], ['favorite', '收藏'], ['video', '视频'], ['scene', '场景'], ['web', '网页'], ['picture', '图片'],
  ]) add(filter, 'option', label).value = value;
  const actions = add(root, 'div', '', 'actions');
  const refresh = add(actions, 'button', '刷新工坊');
  const disconnect = add(actions, 'button', '断开');
  const status = add(root, 'p', '', 'status');
  status.setAttribute('role', 'status');
  const grid = add(root, 'ul', '', 'workshop-grid');
  const nav = add(root, 'div', '', 'workshop-pages');
  const previous = add(nav, 'button', '上一页');
  const count = add(nav, 'span', '', 'workshop-meta');
  const next = add(nav, 'button', '下一页');
  const typeNames = { video: '视频', scene: '场景', web: '网页', picture: '图片预览', preset: '图片预览' };
  let page = 0;
  let busy = false;
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const filtered = controller.items.filter((item) => {
      const matches = filter.value === 'all' || filter.value === item.type
        || (filter.value === 'favorite' && favorites.has(item.id))
        || (filter.value === 'picture' && item.type === 'preset');
      return matches && (item.title.toLocaleLowerCase().includes(query) || item.id.includes(query));
    });
    const size = 6;
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    page = Math.min(page, pages - 1);
    previous.disabled = page === 0;
    next.disabled = page + 1 === pages;
    count.textContent = filtered.length + ' 项 · ' + (page + 1) + ' / ' + pages;
    grid.replaceChildren();
    if (!filtered.length) add(grid, 'li', '没有匹配的壁纸。');
    for (const item of filtered.slice(page * size, (page + 1) * size)) {
      const tile = add(grid, 'li');
      const card = add(tile, 'button', '', 'workshop-card');
      card.title = item.title;
      card.setAttribute('aria-label', '应用 ' + item.title);
      const cover = add(card, 'span', typeNames[item.type], 'workshop-cover');
      const caption = add(card, 'span', '', 'workshop-caption');
      add(caption, 'span', item.title, 'workshop-title');
      add(caption, 'span', typeNames[item.type], 'workshop-meta');
      const star = add(tile, 'button', '', 'workshop-favorite');
      function updateStar() {
        const marked = favorites.has(item.id);
        star.textContent = marked ? '★' : '☆';
        star.setAttribute('aria-label', (marked ? '取消收藏 ' : '收藏 ') + item.title);
        star.setAttribute('aria-pressed', String(marked));
      }
      updateStar();
      const addToQueue = add(tile, 'button', '+', 'workshop-favorite workshop-enqueue');
      addToQueue.setAttribute('aria-label', '加入队列 ' + item.title);
      addToQueue.addEventListener('click', () => {
        status.textContent = enqueue(item) ? '已加入队列：' + item.title : '已在队列中，或队列已满。';
      });
      star.addEventListener('click', () => {
        if (!favorites.delete(item.id)) favorites.add(item.id);
        try {
          localStorage.setItem(storageKey, JSON.stringify([...favorites]));
        } catch {
          // Keep the in-memory preference if storage is unavailable.
        }
        if (filter.value === 'favorite') render();
        else updateStar();
      });
      controller.thumbnail(item.id).then((url) => {
        if (!tile.isConnected) return;
        const image = document.createElement('img');
        image.alt = '';
        image.src = url;
        image.addEventListener('error', () => cover.textContent = typeNames[item.type], { once: true });
        cover.replaceChildren(image);
      }).catch(() => {});
      card.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        card.disabled = true;
        status.textContent = '正在加载「' + item.title + '」…';
        try {
          if (root.isConnected) await apply(item);
        } catch (error) {
          status.textContent = error.message + ' 已保留当前壁纸。';
        } finally {
          busy = false;
          card.disabled = false;
        }
      });
    }
  }
  search.addEventListener('input', () => { page = 0; render(); });
  filter.addEventListener('change', () => { page = 0; render(); });
  previous.addEventListener('click', () => { page--; render(); });
  next.addEventListener('click', () => { page++; render(); });
  refresh.addEventListener('click', async () => {
    refresh.disabled = true;
    try {
      controller.items = await controller.request('refresh');
      status.textContent = '工坊列表已刷新。';
      render();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      refresh.disabled = false;
    }
  });
  disconnect.addEventListener('click', () => controller.disconnect());
  render();
}
