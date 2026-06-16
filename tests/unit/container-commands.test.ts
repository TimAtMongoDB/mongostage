import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { ContainerState } from '../../src/types/container.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

const RUNNING: ContainerState = {
  id: 'abc1',
  name: 'mongo-docker-node-shell',
  imageTag: 'timatmongodb/mongo-docker:node-shell',
  slug: 'node-shell',
  status: 'running',
  created: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
};

const STOPPED: ContainerState = {
  id: 'def2',
  name: 'mongo-docker-base',
  imageTag: 'timatmongodb/mongo-docker:base',
  slug: 'base',
  status: 'exited',
  created: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
};

function makeInquirerMock(answer: Record<string, unknown>) {
  return {
    default: {
      prompt: vi.fn().mockResolvedValue(answer),
    },
  };
}

type ContainerMockOpts = {
  containers?: ContainerState[];
  dockerState?: 'running' | 'not-running' | 'not-installed';
  stopFails?: boolean;
  removeFails?: boolean;
  inquirerAnswer?: Record<string, unknown>;
};

async function buildStop(opts: ContainerMockOpts = {}) {
  const {
    containers = [RUNNING],
    dockerState = 'running',
    inquirerAnswer = { slug: 'node-shell' },
  } = opts;

  const mockStop = vi.fn().mockResolvedValue(undefined);
  const mockList = vi.fn().mockResolvedValue(containers);
  const mockFind = vi.fn().mockImplementation(async (slug: string) => containers.find(c => c.slug === slug));

  vi.doMock('../../src/lib/docker.js', () => ({
    detectDockerState: vi.fn().mockResolvedValue(dockerState),
    stopContainer: mockStop,
  }));
  vi.doMock('../../src/lib/containers.js', () => ({
    listManagedContainers: mockList,
    findContainerBySlug: mockFind,
  }));
  vi.doMock('inquirer', () => makeInquirerMock(inquirerAnswer));

  vi.resetModules();
  const { stopCommand } = await import('../../src/commands/stop.js');
  return { stopCommand, mocks: { stop: mockStop, list: mockList } };
}

async function buildStart(opts: ContainerMockOpts = {}) {
  const {
    containers = [STOPPED],
    dockerState = 'running',
    inquirerAnswer = { slug: 'base' },
  } = opts;

  const mockStart = vi.fn().mockResolvedValue(undefined);
  const mockList = vi.fn().mockResolvedValue(containers);
  const mockFind = vi.fn().mockImplementation(async (slug: string) => containers.find(c => c.slug === slug));
  const mockGetClient = vi.fn().mockReturnValue({
    getContainer: vi.fn().mockReturnValue({
      attach: vi.fn().mockResolvedValue({ pipe: vi.fn() }),
      wait: vi.fn().mockResolvedValue({}),
    }),
  });

  vi.doMock('../../src/lib/docker.js', () => ({
    detectDockerState: vi.fn().mockResolvedValue(dockerState),
    startContainer: mockStart,
    getDockerClient: mockGetClient,
  }));
  vi.doMock('../../src/lib/containers.js', () => ({
    listManagedContainers: mockList,
    findContainerBySlug: mockFind,
  }));
  vi.doMock('inquirer', () => makeInquirerMock(inquirerAnswer));

  vi.resetModules();
  const { startCommand } = await import('../../src/commands/start.js');
  return { startCommand, mocks: { start: mockStart } };
}

async function buildRemove(opts: ContainerMockOpts & { confirmAnswer?: boolean } = {}) {
  const {
    containers = [STOPPED],
    dockerState = 'running',
    confirmAnswer = true,
    inquirerAnswer,
  } = opts;

  const mockStop = vi.fn().mockResolvedValue(undefined);
  const mockRemove = vi.fn().mockResolvedValue(undefined);
  const mockList = vi.fn().mockResolvedValue(containers);
  const mockFind = vi.fn().mockImplementation(async (slug: string) => containers.find(c => c.slug === slug));

  const resolvedInquirerAnswer = inquirerAnswer ?? { ok: confirmAnswer, slug: containers[0]?.slug };

  vi.doMock('../../src/lib/docker.js', () => ({
    detectDockerState: vi.fn().mockResolvedValue(dockerState),
    stopContainer: mockStop,
    removeContainer: mockRemove,
  }));
  vi.doMock('../../src/lib/containers.js', () => ({
    listManagedContainers: mockList,
    findContainerBySlug: mockFind,
  }));
  vi.doMock('inquirer', () => makeInquirerMock(resolvedInquirerAnswer));

  vi.resetModules();
  const { removeCommand } = await import('../../src/commands/remove.js');
  return { removeCommand, mocks: { stop: mockStop, remove: mockRemove } };
}

async function buildClean(opts: ContainerMockOpts & { confirmAnswer?: boolean } = {}) {
  const {
    containers = [STOPPED],
    dockerState = 'running',
    confirmAnswer = true,
  } = opts;

  const mockStop = vi.fn().mockResolvedValue(undefined);
  const mockRemove = vi.fn().mockResolvedValue(undefined);
  const mockList = vi.fn().mockResolvedValue(containers);
  const mockGetClient = vi.fn().mockReturnValue({
    listImages: vi.fn().mockResolvedValue([]),
    getImage: vi.fn().mockReturnValue({ remove: vi.fn().mockResolvedValue(undefined) }),
  });

  vi.doMock('../../src/lib/docker.js', () => ({
    detectDockerState: vi.fn().mockResolvedValue(dockerState),
    stopContainer: mockStop,
    removeContainer: mockRemove,
    getDockerClient: mockGetClient,
  }));
  vi.doMock('../../src/lib/containers.js', () => ({
    listManagedContainers: mockList,
  }));
  vi.doMock('inquirer', () => makeInquirerMock({ ok: confirmAnswer }));

  vi.resetModules();
  const { cleanCommand } = await import('../../src/commands/clean.js');
  return { cleanCommand, mocks: { stop: mockStop, remove: mockRemove, list: mockList } };
}

async function buildStatus(opts: { containers?: ContainerState[]; dockerState?: string } = {}) {
  const {
    containers = [RUNNING, STOPPED],
    dockerState = 'running',
  } = opts;

  vi.doMock('../../src/lib/docker.js', () => ({
    detectDockerState: vi.fn().mockResolvedValue(dockerState),
    getDockerClient: vi.fn().mockReturnValue({
      listImages: vi.fn().mockResolvedValue([]),
    }),
  }));
  vi.doMock('../../src/lib/containers.js', () => ({
    listManagedContainers: vi.fn().mockResolvedValue(containers),
  }));
  vi.doMock('../../src/lib/config.js', () => ({
    getCliConfig: vi.fn().mockReturnValue({ dockerMethod: 'engine' }),
  }));

  vi.resetModules();
  const { statusCommand } = await import('../../src/commands/status.js');
  return { statusCommand };
}

// ─── stop command ────────────────────────────────────────────────────────────

describe('stopCommand()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as typeof process.exit);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should stop the specified container by slug', async () => {
    const { stopCommand, mocks } = await buildStop({ containers: [RUNNING] });
    await stopCommand('node-shell', {});
    expect(mocks.stop).toHaveBeenCalledWith(RUNNING.id);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Stopped'));
  });

  it('should stop all running containers when --all is given', async () => {
    const second: ContainerState = { ...RUNNING, id: 'xyz', name: 'mongo-docker-base2', slug: 'base2' };
    const { stopCommand, mocks } = await buildStop({ containers: [RUNNING, second] });
    await stopCommand(undefined, { all: true });
    expect(mocks.stop).toHaveBeenCalledTimes(2);
  });

  it('should print "No running containers" and exit cleanly when --all given but none running', async () => {
    const { stopCommand, mocks } = await buildStop({ containers: [STOPPED] });
    await stopCommand(undefined, { all: true });
    expect(mocks.stop).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No running'));
  });

  it('should exit 1 if Docker is not running', async () => {
    const { stopCommand } = await buildStop({ dockerState: 'not-running' });
    await expect(stopCommand('node-shell', {})).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

// ─── start command ────────────────────────────────────────────────────────────

describe('startCommand()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as typeof process.exit);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should start the specified stopped container', async () => {
    const { startCommand, mocks } = await buildStart({ containers: [STOPPED] });
    await startCommand('base', {});
    expect(mocks.start).toHaveBeenCalledWith(STOPPED.id);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Started'));
  });

  it('should print error and exit 1 when no container found for slug', async () => {
    const { startCommand } = await buildStart({ containers: [] });
    await expect(startCommand('unknown-slug', {})).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit 1 if Docker is not running', async () => {
    const { startCommand } = await buildStart({ dockerState: 'not-running' });
    await expect(startCommand('base', {})).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

// ─── remove command ───────────────────────────────────────────────────────────

describe('removeCommand()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as typeof process.exit);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should remove the specified stopped container after confirmation', async () => {
    const { removeCommand, mocks } = await buildRemove({
      containers: [STOPPED],
      confirmAnswer: true,
    });
    await removeCommand('base', {});
    expect(mocks.remove).toHaveBeenCalledWith(STOPPED.id, false);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed'));
  });

  it('should refuse to remove a running container without --force', async () => {
    const { removeCommand } = await buildRemove({ containers: [RUNNING] });
    await expect(removeCommand('node-shell', { force: false })).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should stop and remove a running container when --force is given', async () => {
    const { removeCommand, mocks } = await buildRemove({
      containers: [RUNNING],
      confirmAnswer: true,
    });
    await removeCommand('node-shell', { force: true });
    expect(mocks.stop).toHaveBeenCalledWith(RUNNING.id);
    expect(mocks.remove).toHaveBeenCalledWith(RUNNING.id, true);
  });

  it('should not remove when confirmation is declined', async () => {
    const { removeCommand, mocks } = await buildRemove({
      containers: [STOPPED],
      confirmAnswer: false,
    });
    await removeCommand('base', {});
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Aborted'));
  });

  it('should exit 1 if Docker is not running', async () => {
    const { removeCommand } = await buildRemove({ dockerState: 'not-running' });
    await expect(removeCommand('base', {})).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

// ─── clean command ────────────────────────────────────────────────────────────

describe('cleanCommand()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as typeof process.exit);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should remove all stopped managed containers after confirmation', async () => {
    const { cleanCommand, mocks } = await buildClean({ containers: [STOPPED], confirmAnswer: true });
    await cleanCommand({});
    expect(mocks.remove).toHaveBeenCalledWith(STOPPED.id, true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed 1'));
  });

  it('should print "No stopped containers" and return when none stopped', async () => {
    const { cleanCommand, mocks } = await buildClean({ containers: [RUNNING], confirmAnswer: true });
    await cleanCommand({});
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No stopped'));
  });

  it('should not remove when confirmation is declined', async () => {
    const { cleanCommand, mocks } = await buildClean({ containers: [STOPPED], confirmAnswer: false });
    await cleanCommand({});
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Aborted'));
  });

  it('should stop and remove running containers when --force is given', async () => {
    const { cleanCommand, mocks } = await buildClean({ containers: [RUNNING], confirmAnswer: true });
    await cleanCommand({ force: true });
    expect(mocks.stop).toHaveBeenCalledWith(RUNNING.id);
    expect(mocks.remove).toHaveBeenCalledWith(RUNNING.id, true);
  });

  it('should print removal summary after completion', async () => {
    const { cleanCommand } = await buildClean({ containers: [STOPPED, STOPPED], confirmAnswer: true });
    await cleanCommand({});
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed'));
  });

  it('should exit 1 if Docker is not running', async () => {
    const { cleanCommand } = await buildClean({ dockerState: 'not-running' });
    await expect(cleanCommand({})).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

// ─── status command ───────────────────────────────────────────────────────────

describe('statusCommand()', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as typeof process.exit);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should display Docker daemon status', async () => {
    const { statusCommand } = await buildStatus({ dockerState: 'running' });
    await statusCommand();
    const allOutput = logSpy.mock.calls.flat().join(' ');
    expect(allOutput).toMatch(/Docker/i);
  });

  it('should list all managed containers', async () => {
    const { statusCommand } = await buildStatus({ containers: [RUNNING, STOPPED] });
    await statusCommand();
    const allOutput = logSpy.mock.calls.flat().join(' ');
    expect(allOutput).toContain('mongo-docker-node-shell');
    expect(allOutput).toContain('mongo-docker-base');
  });

  it('should show "no containers" message when none exist', async () => {
    const { statusCommand } = await buildStatus({ containers: [] });
    await statusCommand();
    const allOutput = logSpy.mock.calls.flat().join(' ');
    expect(allOutput).toMatch(/[Nn]o mongo-docker containers/);
  });
});
