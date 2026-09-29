import {rename, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root = process.cwd();
const apiDir = resolve(root, 'app/api');
const backupDir = resolve(root, '.priorityos-api-backup');
const outDir = resolve(root, 'out');

if (!existsSync(apiDir)) {
  throw new Error('Expected app/api to exist. Refusing to create a native build without verifying the hosted API tree.');
}
if (existsSync(backupDir)) {
  throw new Error('Found an existing .priorityos-api-backup directory. Remove it after confirming no previous native build is running.');
}

let moved = false;
try {
  console.log('Preparing standalone PriorityOS web bundle...');
  console.log('Temporarily excluding server-only app/api routes from the static native build.');
  await rename(apiDir, backupDir);
  moved = true;

  await rm(outDir, {recursive: true, force: true});

  const npmCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npmCommand, ['next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: {...process.env, CAPACITOR_BUILD: '1'}
  });

  if (!existsSync(resolve(outDir, 'index.html'))) {
    throw new Error('Native build completed without out/index.html.');
  }
  if (!existsSync(resolve(outDir, 'dashboard', 'index.html'))) {
    throw new Error('Native build completed without the dashboard route.');
  }

  console.log('Standalone PriorityOS web bundle created in out/.');
} finally {
  if (moved) {
    await rename(backupDir, apiDir);
    console.log('Restored app/api for the hosted Vercel build.');
  }
}
