import assert from 'node:assert/strict';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createLiveRenderer } from '../src/live-renderer.mjs';

test('a live Web wallpaper receives spectrum data and releases capture while paused', {
  skip: process.env.CWE_TEST_LIVE !== '1' && 'Set CWE_TEST_LIVE=1 with Edge and the optional dependencies installed.',
  timeout: 25_000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cwe-audio-'));
  const files = ['project.json', 'index.html'];
  let capture = false;
  let released = false;
  const spectrum = Buffer.alloc(128, 200).toString('base64');
  const renderer = createLiveRenderer(() => ({
    enable(value) { capture = value; },
    close() { released = true; capture = false; },
    status: () => capture ? 'active' : 'off',
    spectrum: () => capture ? spectrum : null,
  }));
  t.after(async () => {
    await renderer.close();
    await Promise.allSettled(files.map((name) => unlink(join(root, name))));
    await rmdir(root);
  });
  await writeFile(join(root, 'project.json'), JSON.stringify({ type: 'web', file: 'index.html' }));
  await writeFile(join(root, 'index.html'), `<!doctype html><body style="background:#110022"><script>
    wallpaperRegisterAudioListener(bands => {
      document.body.style.background = Math.max(...bands) > 0.5 ? '#f1ab20' : '#110022';
    });
  </script>`);
  const player = await renderer.open({ root, type: 'web' });
  let baseline;
  let step = 0;
  await player.stream(async (frame, status) => {
    step++;
    if (step < 4) {
      baseline = frame;
      return 'playing';
    }
    if (step <= 7) return { status: 'playing', systemAudio: true };
    if (step === 8) {
      assert.equal(status, 'active');
      assert.notEqual(frame, baseline);
      return 'paused';
    }
    if (step === 9) {
      assert.equal(frame, null);
      assert.equal(status, 'off');
      return 'playing';
    }
    if (step >= 12) {
      assert.equal(frame, baseline);
      return 'stop';
    }
    return 'playing';
  }, t.signal);
  assert.ok(released);
});
