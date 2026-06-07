import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ProviderInput {
  prompt: string;
  cwd: string;
  model?: string;
  effort?: string;
}

export interface AgentProvider {
  name: string;
  run(input: ProviderInput): Promise<string>;
}

const providers = new Map<string, AgentProvider>();

export function registerProvider(provider: AgentProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): AgentProvider {
  const provider = providers.get(name);
  if (!provider) throw new Error(`Unsupported provider: ${name}`);
  return provider;
}

registerProvider({
  name: 'codex',
  async run(input) {
    const args = ['exec', '--skip-git-repo-check'];
    if (input.model) args.push('--model', input.model);
    args.push(input.prompt);
    const { stdout } = await execFileAsync('codex', args, {
      cwd: input.cwd,
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
      encoding: 'utf8',
    });
    return String(stdout).trim();
  },
});

registerProvider({
  name: 'gpt',
  async run(input) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for provider=gpt');

    const response = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model || 'gpt-5',
        input: input.prompt,
        reasoning: input.effort ? { effort: input.effort } : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI response failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    return (
      body.output_text ||
      body.output
        ?.flatMap((item) => item.content ?? [])
        .map((c) => c.text ?? '')
        .join('') ||
      ''
    );
  },
});
