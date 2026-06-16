export interface ContainerState {
  id: string;
  name: string;
  imageTag: string;
  slug: string;
  status: 'running' | 'stopped' | 'exited';
  created: string;
  uptime?: string;
}

export interface RunContainerOpts {
  tag: string;
  name: string;
  slug: string;
  envFile?: string;
  mountHost?: string;
  mountTarget?: string;
  workdir?: string;
  ports?: string[];
  detach?: boolean;
}
