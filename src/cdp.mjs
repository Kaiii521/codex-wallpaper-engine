export const mainPage = 'app://-/index.html';

export async function findTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    redirect: 'error',
    signal: AbortSignal.timeout(3000),
  }).catch(() => {
    throw new Error(`Cannot reach the local debug port ${port}. See “Start a wallpaper session” in README.md.`);
  });
  if (!response.ok) throw new Error(`Debug endpoint returned HTTP ${response.status}.`);
  const pages = await response.json();
  if (!Array.isArray(pages)) throw new Error('Unexpected debug endpoint response.');
  return pages.flatMap((page) => {
    if (page?.type !== 'page' || page.url !== mainPage || typeof page.id !== 'string') return [];
    const expected = `ws://127.0.0.1:${port}/devtools/page/${page.id}`;
    if (!/^[a-z0-9_-]+$/i.test(page.id) || page.webSocketDebuggerUrl !== expected) return [];
    return [expected];
  });
}

export async function connect(target) {
  const socket = new WebSocket(target);
  const pending = new Map();
  const listeners = new Set();
  let nextId = 0;
  const closed = new Promise((resolve) => {
    socket.addEventListener('close', () => {
      for (const call of pending.values()) call(new Error('Lost the local debug connection.'));
      resolve();
    }, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    let message;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (message.id !== undefined) pending.get(message.id)?.(null, message);
    else for (const listener of listeners) listener(message);
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('The local debug connection timed out.')), 5000);
      function finish(callback, value) {
        clearTimeout(timeout);
        callback(value);
      }
      socket.addEventListener('open', () => finish(resolve), { once: true });
      socket.addEventListener('error', () => finish(reject, new Error('Could not open the local debug connection.')), { once: true });
    });
  } catch (error) {
    socket.close();
    throw error;
  }
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (socket.readyState !== WebSocket.OPEN) {
        reject(new Error('The local debug connection is closed.'));
        return;
      }
      const id = ++nextId;
      const timeout = setTimeout(() => finish(new Error('Codex did not respond in 20 seconds.')), 20_000);
      function finish(error, message) {
        clearTimeout(timeout);
        pending.delete(id);
        if (error || message.error) reject(error ?? new Error(message.error.message));
        else resolve(message.result);
      }
      pending.set(id, finish);
      try {
        socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        finish(error);
      }
    });
  }
  return {
    send, closed, close: () => socket.close(),
    listen(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async evaluate(expression, context) {
      const result = await send('Runtime.evaluate', {
        expression, ...context, awaitPromise: true, returnByValue: true,
      });
      const details = result.exceptionDetails;
      if (details) throw new Error(details.exception?.description ?? details.text ?? 'Codex rejected the command.');
      return result.result?.value;
    },
  };
}

export async function evaluate(target, expression) {
  const session = await connect(target);
  try {
    return await session.evaluate(expression);
  } finally {
    session.close();
  }
}
