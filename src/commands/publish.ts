import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';

const execFileAsync = promisify(execFile);

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_ROOT = join(__dirname, '../../');
const PACKAGE_JSON_PATH = join(PACKAGE_ROOT, 'package.json');
const REGISTRY_URL = 'https://npm.pkg.github.com';

type VersionBumpType = 'patch' | 'minor' | 'major' | 'custom';

class PreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreflightError';
  }
}

function bumpVersion(version: string, type: 'patch' | 'minor' | 'major'): string {
  const parts = version.split('.').map(Number);
  if (type === 'patch') { parts[2]++; }
  else if (type === 'minor') { parts[1]++; parts[2] = 0; }
  else { parts[0]++; parts[1] = 0; parts[2] = 0; }
  return parts.join('.');
}

function isValidSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function readPackageJson(): { name: string; version: string; [key: string]: unknown } {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
    name: string;
    version: string;
    [key: string]: unknown;
  };
}

function writeVersion(newVersion: string): void {
  const pkg = readPackageJson();
  pkg['version'] = newVersion;
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

async function spawnStream(
  cmd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
  cwd?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      env: env ?? process.env,
      cwd: cwd ?? PACKAGE_ROOT,
    });
    proc.on('error', err => reject(new Error(`Failed to run ${cmd}: ${err.message}`)));
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function preflight(newVersion: string, packageName: string): Promise<void> {
  // 1. GITHUB_TOKEN must be set
  if (!process.env['GITHUB_TOKEN']) {
    throw new PreflightError(
      'GITHUB_TOKEN is not set. Export a GitHub token with write:packages scope.'
    );
  }

  // 2. images.json must be clean in git
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain', 'images.json'], {
      cwd: PACKAGE_ROOT,
    });
    if (stdout.trim()) {
      throw new PreflightError(
        'images.json has uncommitted changes. Commit your image updates before publishing.'
      );
    }
  } catch (err) {
    if (err instanceof PreflightError) throw err;
    // git not available or not a repo — skip this check
  }

  // 3. Version must not already exist on GitHub Packages
  try {
    const { stdout } = await execFileAsync(
      'npm',
      ['view', `${packageName}@${newVersion}`, 'version', '--registry', REGISTRY_URL],
      { env: { ...process.env, NODE_AUTH_TOKEN: process.env['GITHUB_TOKEN'] } }
    );
    if (stdout.trim()) {
      throw new PreflightError(
        `Version ${newVersion} already exists on GitHub Packages. Choose a higher version.`
      );
    }
  } catch (err) {
    if (err instanceof PreflightError) throw err;
    // npm view failing means version does not exist — that's the expected case
  }
}

async function selectVersionInteractive(current: string): Promise<string> {
  const { default: inquirer } = await import('inquirer');

  interface BumpAnswer { bumpType: VersionBumpType }
  const { bumpType } = await inquirer.prompt<BumpAnswer>([
    {
      type: 'list',
      name: 'bumpType',
      message: `Current version is ${current}. How would you like to bump?`,
      choices: [
        { name: `patch   ${current} → ${bumpVersion(current, 'patch')}`, value: 'patch' },
        { name: `minor   ${current} → ${bumpVersion(current, 'minor')}`, value: 'minor' },
        { name: `major   ${current} → ${bumpVersion(current, 'major')}`, value: 'major' },
        { name: 'custom  (enter a specific version)', value: 'custom' },
      ],
    },
  ]);

  if (bumpType === 'custom') {
    interface CustomAnswer { customVersion: string }
    const { customVersion } = await inquirer.prompt<CustomAnswer>([
      {
        type: 'input',
        name: 'customVersion',
        message: 'Enter the exact version (semver, e.g. 1.2.3):',
      },
    ]);
    if (!isValidSemver(customVersion)) {
      console.error('Invalid semver. Must match X.Y.Z format (e.g. 1.2.3).');
      process.exit(1);
    }
    return customVersion;
  }

  return bumpVersion(current, bumpType);
}

export async function publishCommand(opts: {
  bump?: string;
  dryRun?: boolean;
} = {}): Promise<void> {
  const pkg = readPackageJson();
  const currentVersion = pkg['version'];
  const packageName = pkg['name'];

  console.log(`Preparing to publish ${packageName}\n`);
  console.log(`Current version:  ${currentVersion}`);

  // Determine new version
  let newVersion: string;
  if (opts.bump) {
    const validBumps = ['patch', 'minor', 'major'];
    if (validBumps.includes(opts.bump)) {
      newVersion = bumpVersion(currentVersion, opts.bump as 'patch' | 'minor' | 'major');
      console.log(`New version:      ${opts.bump} → ${newVersion}\n`);
    } else if (isValidSemver(opts.bump)) {
      newVersion = opts.bump;
      console.log(`New version:      custom → ${newVersion}\n`);
    } else {
      console.error(`Invalid --bump value: "${opts.bump}". Use patch, minor, major, or a semver string.`);
      process.exit(1);
    }
  } else {
    newVersion = await selectVersionInteractive(currentVersion);
    console.log('');
  }

  // Pre-flight checks
  try {
    await preflight(newVersion, packageName);
  } catch (err) {
    if (err instanceof PreflightError) {
      console.error(`\n✗  ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  console.log('✓  GITHUB_TOKEN is set');
  console.log('✓  images.json is clean');
  console.log(`✓  Version ${newVersion} is available on GitHub Packages\n`);

  if (opts.dryRun) {
    console.log(`[dry-run] Would publish ${packageName}@${newVersion} to ${REGISTRY_URL}`);
    console.log('[dry-run] No files written, no publish performed.');
    return;
  }

  // Write new version to package.json
  writeVersion(newVersion);

  // Build TypeScript
  console.log('Building TypeScript...');
  try {
    await spawnStream('npm', ['run', 'build']);
  } catch {
    console.error('\n✗  TypeScript compilation failed. Fix errors before publishing.');
    console.error(`   package.json version is now ${newVersion} — fix errors and re-run.`);
    process.exit(1);
  }
  console.log('✓  TypeScript compiled\n');

  // Publish to GitHub Packages
  console.log(`Publishing ${packageName}@${newVersion} ...`);
  await spawnStream('npm', ['publish', '--access', 'restricted'], {
    ...process.env,
    NODE_AUTH_TOKEN: process.env['GITHUB_TOKEN'],
  });

  console.log(`\n✓  Published ${packageName}@${newVersion} to GitHub Packages`);
  console.log('\nDon\'t forget:');
  console.log(`  git tag v${newVersion}`);
  console.log(`  git push origin v${newVersion}`);
  console.log('  git push origin main');
}
