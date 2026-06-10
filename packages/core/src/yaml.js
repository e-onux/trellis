// Isolates the single runtime dependency (`yaml`) so the rest of core depends only on this module.
import YAML from 'yaml';
import fs from 'node:fs';

export function parseYaml(text) {
  return YAML.parse(text);
}

export function stringifyYaml(value) {
  return YAML.stringify(value);
}

export function readYaml(file) {
  return YAML.parse(fs.readFileSync(file, 'utf8'));
}

/** Extract the first fenced ```yaml block from a markdown string (used for ADR front matter). */
export function extractYamlBlock(markdown) {
  const m = markdown.match(/```ya?ml\s*\n([\s\S]*?)```/);
  return m ? YAML.parse(m[1]) : null;
}
