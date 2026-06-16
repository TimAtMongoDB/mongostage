import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs and node:os so tests don't touch the real filesystem
vi.mock('node:fs');
vi.mock('node:os', () => ({ homedir: () => '/fake-home' }));

describe('envSetCommand()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should write KEY=VALUE to the env file', async () => {
    const { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(chmodSync).mockImplementation(() => undefined);
    vi.mocked(mkdirSync).mockImplementation(() => undefined);

    const { envSetCommand } = await import('../../src/commands/env.js');
    await envSetCommand('ANTHROPIC_API_KEY=sk-test');

    expect(writeFileSync).toHaveBeenCalled();
    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('ANTHROPIC_API_KEY=sk-test');
  });

  it('should exit 1 when entry has no equals sign', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    const { envSetCommand } = await import('../../src/commands/env.js');

    await expect(envSetCommand('BADFORMAT')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should overwrite an existing key', async () => {
    const { existsSync, readFileSync, writeFileSync, chmodSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('ANTHROPIC_API_KEY=old-value\n');
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(chmodSync).mockImplementation(() => undefined);

    const { envSetCommand } = await import('../../src/commands/env.js');
    await envSetCommand('ANTHROPIC_API_KEY=new-value');

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('ANTHROPIC_API_KEY=new-value');
    expect(written).not.toContain('old-value');
  });

  it('should chmod 600 after writing', async () => {
    const { existsSync, readFileSync, writeFileSync, chmodSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(chmodSync).mockImplementation(() => undefined);

    const { envSetCommand } = await import('../../src/commands/env.js');
    await envSetCommand('KEY=value');

    expect(chmodSync).toHaveBeenCalledWith(expect.stringContaining('.env'), 0o600);
  });
});

describe('envListCommand()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it('should mask values with ****', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('ANTHROPIC_API_KEY=sk-real-secret\nMONGO_URI=mongodb://real\n');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { envListCommand } = await import('../../src/commands/env.js');
    await envListCommand();

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('ANTHROPIC_API_KEY=****');
    expect(output).not.toContain('sk-real-secret');
    expect(output).toContain('MONGO_URI=****');
    expect(output).not.toContain('mongodb://real');
  });

  it('should show "no variables set" message when file does not exist', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { envListCommand } = await import('../../src/commands/env.js');
    await envListCommand();

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No variables set');
  });
});

describe('envRemoveCommand()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it('should remove the specified key from the env file', async () => {
    const { existsSync, readFileSync, writeFileSync, chmodSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('ANTHROPIC_API_KEY=sk-test\nMONGO_URI=mongodb://x\n');
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(chmodSync).mockImplementation(() => undefined);

    const { envRemoveCommand } = await import('../../src/commands/env.js');
    await envRemoveCommand('ANTHROPIC_API_KEY');

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).not.toContain('ANTHROPIC_API_KEY');
    expect(written).toContain('MONGO_URI=mongodb://x');
  });

  it('should exit 1 when key does not exist', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('OTHER_KEY=value\n');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    const { envRemoveCommand } = await import('../../src/commands/env.js');

    await expect(envRemoveCommand('MISSING_KEY')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
