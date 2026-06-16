declare module 'inquirer' {
  interface PromptQuestion {
    type: string;
    name: string;
    message: string;
    choices?: Array<{ name: string; value: unknown }>;
    default?: unknown;
  }

  interface Inquirer {
    prompt<T = Record<string, unknown>>(questions: PromptQuestion[]): Promise<T>;
  }

  const inquirer: Inquirer;
  export default inquirer;
}
