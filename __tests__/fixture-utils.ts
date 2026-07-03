import * as fs from 'node:fs';
import * as path from 'node:path';

export const SPEC_FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'xyflow-spec');

export function readCodeFence(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/```(?:[^\n]*)\n([\s\S]*?)```/);
  if (!match?.[1]) {
    throw new Error(`No code fence found in ${filePath}`);
  }
  return match[1].replace(/\n$/, '');
}

export function readJsonFence<T>(filePath: string): T {
  return JSON.parse(readCodeFence(filePath)) as T;
}

export function specFixturePath(...segments: string[]): string {
  return path.join(SPEC_FIXTURE_ROOT, ...segments);
}
