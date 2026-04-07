import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseYaml, stringifyYaml } from './yaml-utils';

export function readYamlFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseYaml(content) as T;
}

export function writeYamlFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, stringifyYaml(data), 'utf-8');
}

export function listYamlFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listYamlFiles(full));
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      files.push(full);
    }
  }
  return files.sort();
}

export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
