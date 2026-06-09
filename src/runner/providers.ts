import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

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
    const outputPath = path.join(os.tmpdir(), `anotherclaw-codex-${process.pid}-${Date.now()}.txt`);
    const args = ['exec', '--skip-git-repo-check', '--color', 'never', '--output-last-message', outputPath];
    if (input.model) args.push('--model', input.model);
    args.push('-');

    try {
      await runCodex(args, input.cwd, input.prompt);
      return fs.readFileSync(outputPath, 'utf8').trim();
    } finally {
      fs.rmSync(outputPath, { force: true });
    }
  },
});

function runCodex(args: string[], cwd: string, prompt: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      cwd,
      env: process.env,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 1500).unref();
      reject(new Error('Codex timed out after 120 seconds'));
    }, 120_000);

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Codex exited with ${code}: ${stderr.trim()}`));
      }
    });
    child.stdin.end(prompt);
  });
}

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
