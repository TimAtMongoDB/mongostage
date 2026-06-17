import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs');
vi.mock('node:os', () => ({ homedir: () => '/fake-home' }));
vi.mock('../../src/lib/containers.js');

describe('timezoneSetCommand()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should write TZ=<timezone> to the env file for a valid IANA timezone', async () => {
    const { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(chmodSync).mockImplementation(() => undefined);
    vi.mocked(mkdirSync).mockImplementation(() => undefined);

    const { timezoneSetCommand } = await import('../../src/commands/timezone.js');
    await timezoneSetCommand('America/New_York');

    expect(writeFileSync).toHaveBeenCalled();
    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('TZ=America/New_York');
  });

  it('should exit 1 for an invalid IANA timezone', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    const { timezoneSetCommand } = await import('../../src/commands/timezone.js');

    await expect(timezoneSetCommand('NotA/Timezone')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should overwrite an existing TZ value', async () => {
    const { existsSync, readFileSync, writeFileSync, chmodSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('TZ=UTC\n');
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(chmodSync).mockImplementation(() => undefined);

    const { timezoneSetCommand } = await import('../../src/commands/timezone.js');
    await timezoneSetCommand('Europe/London');

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('TZ=Europe/London');
    expect(written).not.toContain('TZ=UTC');
  });

  it('should warn about existing containers needing rebuild', async () => {
    const { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('');
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(chmodSync).mockImplementation(() => undefined);
    vi.mocked(mkdirSync).mockImplementation(() => undefined);

    const { listManagedContainers } = await import('../../src/lib/containers.js');
    vi.mocked(listManagedContainers).mockResolvedValue([
      { name: 'mongostage-base', id: 'abc123', imageTag: 'timatmongodb/mongostage:base', slug: 'base', status: 'running', created: '' },
    ]);

    const logSpy = vi.spyOn(console, 'log');
    const { timezoneSetCommand } = await import('../../src/commands/timezone.js');
    await timezoneSetCommand('Asia/Tokyo');

    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).toMatch(/existing containers must be recreated/i);
  });
});

describe('timezoneShowCommand()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should display the current TZ value when set', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('TZ=America/Chicago\n');

    const logSpy = vi.spyOn(console, 'log');
    const { timezoneShowCommand } = await import('../../src/commands/timezone.js');
    await timezoneShowCommand();

    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).toContain('America/Chicago');
  });

  it('should show a not-configured message when TZ is not set', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('MONGO_USERNAME=foo\n');

    const logSpy = vi.spyOn(console, 'log');
    const { timezoneShowCommand } = await import('../../src/commands/timezone.js');
    await timezoneShowCommand();

    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).toMatch(/not configured|not set/i);
  });

  it('should show a not-configured message when env file does not exist', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);

    const logSpy = vi.spyOn(console, 'log');
    const { timezoneShowCommand } = await import('../../src/commands/timezone.js');
    await timezoneShowCommand();

    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(output).toMatch(/not configured|not set/i);
  });
});
