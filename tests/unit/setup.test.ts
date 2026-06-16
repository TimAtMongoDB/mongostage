import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

type SetupMocks = {
  platform?: string;
  dockerState?: 'running' | 'not-running' | 'not-installed';
  colimaInstallFails?: boolean;
  streamCommandFails?: boolean;
  pollFails?: boolean;
  wingetExists?: boolean;
  downloadAndExecScriptFails?: boolean;
  execFileFails?: boolean;
};

async function buildSetup(overrides: SetupMocks = {}) {
  const {
    platform = 'linux',
    dockerState = 'not-installed',
    colimaInstallFails = false,
    streamCommandFails = false,
    pollFails = false,
    wingetExists = true,
    downloadAndExecScriptFails = false,
    execFileFails = false,
  } = overrides;

  const mockSaveCliConfig = vi.fn();
  const mockDetectDockerState = vi.fn().mockResolvedValue(dockerState);
  const mockPollDockerReady = pollFails
    ? vi.fn().mockRejectedValue(new Error('Docker not ready'))
    : vi.fn().mockResolvedValue(undefined);
  const mockStreamCommand = streamCommandFails
    ? vi.fn().mockRejectedValue(new Error('command failed'))
    : vi.fn().mockResolvedValue(undefined);
  const mockInstallColima = colimaInstallFails
    ? vi.fn().mockImplementation(() => {
        const err = new Error('Homebrew not found. Install Homebrew first: https://brew.sh');
        err.name = 'PreflightError';
        return Promise.reject(err);
      })
    : vi.fn().mockResolvedValue(undefined);
  const mockStartColima = vi.fn().mockResolvedValue(undefined);
  const mockDownloadAndExecScript = downloadAndExecScriptFails
    ? vi.fn().mockRejectedValue(new Error('download failed'))
    : vi.fn().mockResolvedValue(undefined);

  const mockExecFile = execFileFails
    ? vi.fn().mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(new Error('execFile failed'));
          return {};
        }
      )
    : vi.fn().mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(null);
          return {};
        }
      );

  const mockSpawn = vi.fn().mockImplementation((cmd: string, _args: string[]) => {
    const proc = {
      on: vi.fn().mockImplementation(
        (event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'close') {
            const exitCode = cmd === 'winget' && !wingetExists ? 1 : 0;
            setImmediate(() => cb(exitCode));
          }
          return proc;
        }
      ),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      unref: vi.fn(),
    };
    return proc;
  });

  vi.doMock('../../src/lib/os.js', () => ({
    detectPlatform: vi.fn().mockReturnValue(platform),
  }));

  vi.doMock('../../src/lib/docker.js', () => ({
    detectDockerState: mockDetectDockerState,
    pollDockerReady: mockPollDockerReady,
    streamCommand: mockStreamCommand,
  }));

  vi.doMock('../../src/lib/colima.js', () => ({
    installColima: mockInstallColima,
    startColima: mockStartColima,
  }));

  vi.doMock('../../src/lib/config.js', () => ({
    saveCliConfig: mockSaveCliConfig,
    getCliConfig: vi.fn().mockReturnValue({
      setupComplete: false,
      os: 'linux',
      dockerMethod: 'engine',
      defaultOrg: 'timatmongodb',
      lastUpdated: '',
    }),
  }));

  vi.doMock('../../src/lib/install.js', () => ({
    downloadAndExecScript: mockDownloadAndExecScript,
  }));

  vi.doMock('node:child_process', () => ({
    execFile: mockExecFile,
    spawn: mockSpawn,
  }));

  vi.doMock('node:fs', () => ({
    existsSync: vi.fn().mockReturnValue(false),
    appendFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(''),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(),
    unlinkSync: vi.fn(),
  }));

  vi.resetModules();
  const { setupCommand } = await import('../../src/commands/setup.js');

  return {
    setupCommand,
    mocks: {
      saveCliConfig: mockSaveCliConfig,
      detectDockerState: mockDetectDockerState,
      pollDockerReady: mockPollDockerReady,
      streamCommand: mockStreamCommand,
      installColima: mockInstallColima,
      startColima: mockStartColima,
      downloadAndExecScript: mockDownloadAndExecScript,
    },
  };
}

describe('setupCommand()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as typeof process.exit);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Docker already running', () => {
    it('should print "Nothing to do" and return without installing', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'linux', dockerState: 'running' });
      await setupCommand();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Nothing to do'));
      expect(mocks.saveCliConfig).not.toHaveBeenCalled();
      expect(mocks.pollDockerReady).not.toHaveBeenCalled();
    });
  });

  describe('Linux/WSL2 — not-installed path', () => {
    it('should call downloadAndExecScript for rootless install', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'linux', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.downloadAndExecScript).toHaveBeenCalledWith(
        expect.stringContaining('get.docker.com/rootless')
      );
    });

    it('should poll Docker ready after rootless install', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'linux', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.pollDockerReady).toHaveBeenCalledWith(2000, 30000);
    });

    it('should save config with setupComplete:true after successful install', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'linux', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.saveCliConfig).toHaveBeenCalledWith(
        expect.objectContaining({ setupComplete: true })
      );
    });

    it('should save config with dockerMethod engine on Linux', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'linux', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.saveCliConfig).toHaveBeenCalledWith(
        expect.objectContaining({ dockerMethod: 'engine' })
      );
    });

    it('should print success message after install completes', async () => {
      const { setupCommand } = await buildSetup({ platform: 'linux', dockerState: 'not-installed' });
      await setupCommand();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Setup complete'));
    });

    it('should fall back to sudo install when rootless install fails', async () => {
      let callCount = 0;
      const mockDownload = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('rootless failed'));
        return Promise.resolve();
      });

      vi.doMock('../../src/lib/os.js', () => ({ detectPlatform: vi.fn().mockReturnValue('linux') }));
      vi.doMock('../../src/lib/docker.js', () => ({
        detectDockerState: vi.fn().mockResolvedValue('not-installed'),
        pollDockerReady: vi.fn().mockResolvedValue(undefined),
        streamCommand: vi.fn().mockResolvedValue(undefined),
      }));
      vi.doMock('../../src/lib/colima.js', () => ({
        installColima: vi.fn(),
        startColima: vi.fn(),
      }));
      vi.doMock('../../src/lib/config.js', () => ({
        saveCliConfig: vi.fn(),
        getCliConfig: vi.fn().mockReturnValue({}),
      }));
      vi.doMock('../../src/lib/install.js', () => ({ downloadAndExecScript: mockDownload }));
      vi.doMock('node:child_process', () => ({
        execFile: vi.fn().mockImplementation((_c: string, _a: string[], cb: (err: Error | null) => void) => { cb(null); return {}; }),
        spawn: vi.fn().mockImplementation(() => ({ on: vi.fn().mockImplementation((ev: string, cb: (n: number) => void) => { if (ev === 'close') setImmediate(() => cb(0)); return {}; }), stdout: { on: vi.fn() }, stderr: { on: vi.fn() }, unref: vi.fn() })),
      }));
      vi.doMock('node:fs', () => ({
        existsSync: vi.fn().mockReturnValue(false),
        appendFileSync: vi.fn(),
        readFileSync: vi.fn().mockReturnValue(''),
      }));
      vi.resetModules();

      const { setupCommand } = await import('../../src/commands/setup.js');
      await setupCommand();
      // Called twice: rootless fails, sudo fallback succeeds
      expect(mockDownload).toHaveBeenCalledTimes(2);
      expect(mockDownload).toHaveBeenNthCalledWith(1, expect.stringContaining('rootless'));
      expect(mockDownload).toHaveBeenNthCalledWith(2, expect.stringContaining('get.docker.com'), { sudo: true });
    });

    it('should print error and exit 1 when both installs fail', async () => {
      const { setupCommand } = await buildSetup({
        platform: 'linux',
        dockerState: 'not-installed',
        downloadAndExecScriptFails: true,
        execFileFails: true,
      });
      await expect(setupCommand()).rejects.toThrow('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Linux/WSL2 — not-running path', () => {
    it('should start the daemon and poll without reinstalling', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'linux', dockerState: 'not-running' });
      await setupCommand();
      expect(mocks.pollDockerReady).toHaveBeenCalledWith(2000, 30000);
      expect(mocks.downloadAndExecScript).not.toHaveBeenCalled();
    });

    it('should save config with setupComplete:true after daemon start', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'linux', dockerState: 'not-running' });
      await setupCommand();
      expect(mocks.saveCliConfig).toHaveBeenCalledWith(
        expect.objectContaining({ setupComplete: true })
      );
    });
  });

  describe('Mac — not-installed path', () => {
    it('should call installColima when Homebrew is present', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'mac', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.installColima).toHaveBeenCalled();
    });

    it('should call startColima after install', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'mac', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.startColima).toHaveBeenCalled();
    });

    it('should poll with Mac timeouts after Colima starts', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'mac', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.pollDockerReady).toHaveBeenCalledWith(3000, 90000);
    });

    it('should print Homebrew error and exit 1 when Homebrew is missing', async () => {
      const { setupCommand } = await buildSetup({
        platform: 'mac',
        dockerState: 'not-installed',
        colimaInstallFails: true,
      });
      await expect(setupCommand()).rejects.toThrow('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('brew.sh'));
    });

    it('should save config with dockerMethod colima on Mac', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'mac', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.saveCliConfig).toHaveBeenCalledWith(
        expect.objectContaining({ dockerMethod: 'colima', setupComplete: true })
      );
    });
  });

  describe('Mac — not-running path', () => {
    it('should call startColima without reinstalling when daemon is stopped', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'mac', dockerState: 'not-running' });
      await setupCommand();
      expect(mocks.startColima).toHaveBeenCalled();
      expect(mocks.installColima).not.toHaveBeenCalled();
    });
  });

  describe('Windows native path', () => {
    it('should print reboot message and exit 0 when winget install succeeds', async () => {
      const { setupCommand } = await buildSetup({
        platform: 'windows-native',
        dockerState: 'not-installed',
        wingetExists: true,
      });
      await expect(setupCommand()).rejects.toThrow('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('reboot'));
    });

    it('should print download URL and exit 1 when winget is not available', async () => {
      const { setupCommand } = await buildSetup({
        platform: 'windows-native',
        dockerState: 'not-installed',
        wingetExists: false,
      });
      await expect(setupCommand()).rejects.toThrow('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('docker.com'));
    });
  });

  describe('config persistence', () => {
    it('should save os:mac when installed on Mac', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'mac', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.saveCliConfig).toHaveBeenCalledWith(
        expect.objectContaining({ os: 'mac' })
      );
    });

    it('should save os:linux when installed on Linux', async () => {
      const { setupCommand, mocks } = await buildSetup({ platform: 'linux', dockerState: 'not-installed' });
      await setupCommand();
      expect(mocks.saveCliConfig).toHaveBeenCalledWith(
        expect.objectContaining({ os: 'linux' })
      );
    });
  });
});
