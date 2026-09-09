import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

export function parseYaml(content: string): unknown {
  return yamlParse(content);
}

export function stringifyYaml(data: unknown): string {
  return yamlStringify(data, { sortMapEntries: true, lineWidth: 0 });
}
