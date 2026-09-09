import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseYaml, stringifyYaml } from '../src/fs-model/yaml-utils';
import { readYamlFile, writeYamlFile, listYamlFiles } from '../src/fs-model/storage';

describe('yaml-utils', () => {
  test('parse and stringify roundtrip', () => {
    const data = { name: 'test', items: ['a', 'b'], nested: { key: 'val' } };
    const str = stringifyYaml(data);
    const parsed = parseYaml(str);
    expect(parsed).toEqual(data);
  });
});

describe('storage', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'em-storage-test-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writeYamlFile creates dirs and writes', () => {
    const filePath = path.join(tmpDir, 'sub', 'dir', 'test.yaml');
    writeYamlFile(filePath, { hello: 'world' });
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('readYamlFile reads existing', () => {
    const filePath = path.join(tmpDir, 'exists.yaml');
    writeYamlFile(filePath, { x: 1 });
    const data = readYamlFile<{ x: number }>(filePath);
    expect(data).toEqual({ x: 1 });
  });

  test('readYamlFile returns null for missing', () => {
    expect(readYamlFile('/nonexistent.yaml')).toBeNull();
  });

  test('listYamlFiles lists recursively', () => {
    const dir = path.join(tmpDir, 'list-test');
    fs.mkdirSync(path.join(dir, 'a'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'a', '1.yaml'), 'x: 1');
    fs.writeFileSync(path.join(dir, 'b.yaml'), 'y: 2');
    const files = listYamlFiles(dir);
    expect(files.length).toBe(2);
  });
});
