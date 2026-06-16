import chalk from 'chalk';
import ora from 'ora';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { existsSync, appendFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { detectPlatform } from '../lib/os.js';
import { detectDockerState, pollDockerReady, streamCommand } from '../lib/docker.js';
import { installColima, startColima } from '../lib/colima.js';
import { saveCliConfig } from '../lib/config.js';
import { downloadAndExecScript } from '../lib/install.js';
import { PreflightError } from '../lib/errors.js';
import type { Platform } from '../lib/os.js';

export { PreflightError };

const execFileAsync = promisify(execFile);

async function commandExists(cmd: string): Promise<boolean> {
  const { spawn } = await import('node:child_process');
  return new Promise(resolve => {
    const proc = spawn(cmd, ['--version'], { stdio: 'pipe' });
    proc.on('close', code => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function spawnBackground(cmd: string, args: string[]): Promise<void> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'ignore', detached: true });
    proc.on('error', err => reject(err));
    proc.unref();
    // give the daemon a moment to start before resolving
    setTimeout(resolve, 1000);
  });
}

function patchBashrcPath(pathEntry: string): void {
  const bashrc = join(homedir(), '.bashrc');
  let content = '';
  try {
    content = readFileSync(bashrc, 'utf8');
  } catch {
    // .bashrc may not exist yet
  }
  const exportLine = `export PATH="$PATH:${pathEntry}"`;
  if (!content.includes(pathEntry)) {
    appendFileSync(bashrc, `\n# Added by mongo-docker setup\n${exportLine}\n`);
  }
}

async function installLinuxRootless(): Promise<void> {
  await downloadAndExecScript('https://get.docker.com/rootless');
  patchBashrcPath(`${homedir()}/.local/bin`);
}

async function startRootlessDaemon(): Promise<void> {
  // Try systemctl --user first (systems with user-level systemd)
  try {
    await execFileAsync('systemctl', ['--user', 'start', 'docker']);
    return;
  } catch {
    // systemctl unavailable (WSL2 without systemd) — spawn dockerd directly
  }
  const dockerdPath = join(homedir(), '.local', 'share', 'docker', 'bin', 'dockerd');
  await spawnBackground(dockerdPath, []);
}

async function installLinuxSudo(): Promise<void> {
  await downloadAndExecScript('https://get.docker.com', { sudo: true });
}

async function handleLinux(state: 'not-running' | 'not-installed'): Promise<'engine'> {
  if (state === 'not-running') {
    const spinner = ora('Starting Docker daemon...').start();
    try {
      await execFileAsync('sudo', ['service', 'docker', 'start']);
      await pollDockerReady(2000, 30000);
      spinner.succeed('Docker daemon started');
    } catch (err) {
      spinner.fail('Failed to start Docker daemon');
      throw err;
    }
    return 'engine';
  }

  // not-installed: rootless first, sudo fallback
  const rootlessSpinner = ora('Installing Docker Engine (rootless)...').start();
  try {
    await installLinuxRootless();
    rootlessSpinner.succeed('Docker Engine installed (rootless)');

    const daemonSpinner = ora('Starting Docker daemon...').start();
    await startRootlessDaemon();
    await pollDockerReady(2000, 30000);
    daemonSpinner.succeed('Docker daemon started');
  } catch (rootlessErr) {
    const rootlessMsg = rootlessErr instanceof Error ? rootlessErr.message : String(rootlessErr);
    rootlessSpinner.fail(`Rootless install failed (${rootlessMsg}) — trying system-level install...`);

    const sudoSpinner = ora('Installing Docker Engine (system)...').start();
    try {
      await installLinuxSudo();
      sudoSpinner.succeed('Docker Engine installed');
    } catch (err) {
      sudoSpinner.fail('System install failed');
      throw err;
    }

    const serviceSpinner = ora('Starting Docker service...').start();
    try {
      await execFileAsync('sudo', ['service', 'docker', 'start']);
      serviceSpinner.succeed('Docker service started');
    } catch (err) {
      serviceSpinner.fail('Failed to start Docker service');
      throw err;
    }

    const groupSpinner = ora('Adding user to docker group...').start();
    const username = process.env.USER ?? process.env.LOGNAME ?? '';
    if (username) {
      try {
        await execFileAsync('sudo', ['usermod', '-aG', 'docker', username]);
        groupSpinner.succeed('User added to docker group');
      } catch {
        groupSpinner.warn('Could not add user to docker group — you may need sudo for docker commands');
      }
    } else {
      groupSpinner.warn('Could not determine username — add yourself to the docker group manually');
    }

    console.log(chalk.yellow('\n⚠  You need to log out and back in for group changes to take effect.'));
    await pollDockerReady(2000, 30000);
  }

  return 'engine';
}

async function handleMac(state: 'not-running' | 'not-installed'): Promise<'colima'> {
  if (state === 'not-running') {
    const spinner = ora('Starting Colima...').start();
    try {
      await startColima();
      await pollDockerReady(3000, 90000);
      spinner.succeed('Colima started');
    } catch (err) {
      spinner.fail('Failed to start Colima');
      throw err;
    }
    return 'colima';
  }

  // not-installed
  const installSpinner = ora('Installing Colima and Docker via Homebrew...').start();
  try {
    await installColima(msg => {
      installSpinner.text = msg;
    });
    installSpinner.succeed('Colima and Docker installed');
  } catch (err) {
    installSpinner.fail();
    if (err instanceof PreflightError) {
      console.error(
        chalk.red('✗') +
          '  Homebrew is required but not installed.\n' +
          '   Visit https://brew.sh to install it, then run mongo-docker setup again.'
      );
      process.exit(1);
    }
    throw err;
  }

  const colimaSpinner = ora('Starting Colima...').start();
  try {
    await startColima();
    colimaSpinner.succeed('Colima started');
  } catch (err) {
    colimaSpinner.fail('Failed to start Colima');
    throw err;
  }

  const readySpinner = ora('Waiting for Docker to be ready...').start();
  try {
    await pollDockerReady(3000, 90000);
    readySpinner.succeed('Docker ready');
  } catch (err) {
    readySpinner.fail('Docker did not become ready in time');
    throw err;
  }

  return 'colima';
}

async function handleWindows(): Promise<never> {
  const wingetAvailable = await commandExists('winget');

  if (!wingetAvailable) {
    console.error(
      chalk.red('✗') +
        '  winget is not available on this system.\n' +
        '   Download Docker Desktop from https://www.docker.com/products/docker-desktop/ and install it, then reboot.'
    );
    process.exit(1);
  }

  const spinner = ora('Installing Docker Desktop via winget...').start();
  try {
    await streamCommand('winget', ['install', '-e', '--id', 'Docker.DockerDesktop', '--silent']);
    spinner.succeed('Docker Desktop installed');
  } catch (err) {
    spinner.fail('Docker Desktop installation failed');
    throw err;
  }

  console.log(
    '\n' +
      chalk.green('✓') +
      '  Please reboot your machine to complete the Docker Desktop setup,\n' +
      '   then run mongo-docker setup again to verify.'
  );
  process.exit(0);
}

export async function setupCommand(): Promise<void> {
  const platform: Platform = detectPlatform();
  const state = await detectDockerState();

  if (state === 'running') {
    console.log(chalk.green('✓') + '  Docker is ready. Nothing to do.');
    return;
  }

  if (state !== 'not-running' && state !== 'not-installed') {
    console.error(chalk.red('✗') + '  Unknown Docker state. Run `docker --version` to diagnose.');
    process.exit(1);
  }

  let dockerMethod: 'engine' | 'colima' = 'engine';

  try {
    if (platform === 'mac') {
      dockerMethod = await handleMac(state);
    } else if (platform === 'windows-native') {
      await handleWindows(); // always exits
    } else {
      // linux or wsl2
      dockerMethod = await handleLinux(state);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red('\n✗  Setup failed:'), msg);
    console.error('   If the problem persists, try installing Docker manually.');
    process.exit(1);
  }

  saveCliConfig({
    setupComplete: true,
    os: platform === 'mac' ? 'mac' : platform === 'windows-native' ? 'windows' : 'linux',
    dockerMethod,
  });

  console.log(chalk.green('\nSetup complete.'));

  if (
    platform !== 'mac' &&
    platform !== 'windows-native' &&
    existsSync(join(homedir(), '.local', 'share', 'docker'))
  ) {
    // rootless install — remind about PATH
    console.log(chalk.dim('   Note: ~/.local/bin was added to PATH in ~/.bashrc. Restart your shell to apply.'));
  }
}
