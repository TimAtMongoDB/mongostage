import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createWriteStream, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';

const execFileAsync = promisify(execFile);

const ALLOWED_URLS = new Set([
  'https://get.docker.com/rootless',
  'https://get.docker.com',
]);

export async function downloadAndExecScript(
  url: string,
  opts: { sudo?: boolean } = {}
): Promise<void> {
  if (!ALLOWED_URLS.has(url)) {
    throw new Error(`Blocked: URL not in the install allowlist: ${url}`);
  }

  const scriptPath = join(tmpdir(), `docker-install-${process.pid}.sh`);

  await new Promise<void>((resolve, reject) => {
    const file = createWriteStream(scriptPath);
    https
      .get(url, res => {
        res.pipe(file);
        file.on('finish', () => {
          (file as import('node:fs').WriteStream).close(() => resolve());
        });
        file.on('error', err => {
          try { unlinkSync(scriptPath); } catch { /* best-effort */ }
          reject(err);
        });
      })
      .on('error', err => {
        reject(err);
      });
  });

  try {
    if (opts.sudo) {
      await execFileAsync('sudo', ['sh', scriptPath]);
    } else {
      await execFileAsync('sh', [scriptPath]);
    }
  } finally {
    try { unlinkSync(scriptPath); } catch { /* best-effort cleanup */ }
  }
}
