import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('./WindowsSpectrum.cs', import.meta.url));
const command = '$ErrorActionPreference = "Stop"; Add-Type -Path $env:CWE_AUDIO_SOURCE; [WindowsSpectrum]::Run()';

export function createSystemAudio() {
  let child;
  let startup;
  let retryAfter = 0;
  let status = 'off';
  let spectrum = null;
  function stop() {
    const process = child;
    child = undefined;
    clearTimeout(startup);
    spectrum = null;
    process?.kill();
  }
  return {
    status: () => status,
    spectrum: () => spectrum,
    enable(enabled) {
      if (!enabled) {
        stop();
        status = 'off';
        retryAfter = 0;
        return;
      }
      if (process.platform !== 'win32') {
        status = 'unsupported';
        return;
      }
      if (child || Date.now() < retryAfter) return;
      status = 'starting';
      const powershell = join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const capture = spawn(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
        env: { ...process.env, CWE_AUDIO_SOURCE: source },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      child = capture;
      function failed() {
        if (child !== capture) return;
        stop();
        status = 'unavailable';
        retryAfter = Date.now() + 5000;
      }
      startup = setTimeout(failed, 7000);
      capture.once('error', failed);
      capture.once('close', failed);
      const lines = createInterface({ input: capture.stdout, crlfDelay: Infinity });
      lines.on('line', (line) => {
        if (child !== capture) return;
        if (line === 'READY') {
          clearTimeout(startup);
          status = 'active';
        } else if (status === 'active' && /^[A-Za-z0-9+/]{171}=$/.test(line)) {
          spectrum = line;
        }
      });
    },
    close: stop,
  };
}
