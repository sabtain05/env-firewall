import * as fs from 'node:fs';
import * as path from 'node:path';
import { EnvSchema, ValidationIssue } from './types';

/**
 * Zero-dependency .env parser supporting:
 * - Comments (# ...) and inline comments on unquoted values
 * - Single, double, and backtick quotes
 * - Optional `export KEY=VALUE` syntax
 * - Escaped newlines (\n) inside double quotes
 */
export function parseDotEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Strip optional `export ` prefix
    const cleaned = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eqIndex = cleaned.indexOf('=');
    if (eqIndex === -1) continue;

    const key = cleaned.slice(0, eqIndex).trim();
    if (!key) continue;

    let value = cleaned.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('`') && value.endsWith('`'))
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"');
      }
    } else {
      // Strip inline comment on unquoted value: FOO=bar # comment
      const commentIdx = value.indexOf(' #');
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }
    }

    result[key] = value;
  }

  return result;
}

/**
 * Reads a .env file if it exists on disk; returns empty object if absent.
 */
export function loadDotEnvFile(filePath?: string): Record<string, string> {
  const resolved = filePath ? path.resolve(filePath) : path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(resolved)) {
    return {};
  }
  const content = fs.readFileSync(resolved, 'utf8');
  return parseDotEnvContent(content);
}

/**
 * Compares keys in .env.example (if provided or present) against both
 * the runtime environment and the defined schema to catch drift early.
 */
export function checkEnvSync(
  schema: EnvSchema,
  resolvedEnv: Record<string, string | undefined>,
  examplePath?: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const resolvedExamplePath = examplePath
    ? path.resolve(examplePath)
    : path.resolve(process.cwd(), '.env.example');

  if (!fs.existsSync(resolvedExamplePath)) {
    return issues;
  }

  const exampleVars = parseDotEnvContent(fs.readFileSync(resolvedExamplePath, 'utf8'));

  for (const exampleKey of Object.keys(exampleVars)) {
    const inSchema = Object.prototype.hasOwnProperty.call(schema, exampleKey);
    const hasValue =
      resolvedEnv[exampleKey] !== undefined && resolvedEnv[exampleKey]?.trim() !== '';

    if (!inSchema) {
      issues.push({
        key: exampleKey,
        reason: 'OUT_OF_SYNC',
        expected: 'Key declared in createEnv() schema',
        received: 'Present in .env.example but missing from code schema',
        fixHint: `Add ${exampleKey} to your createEnv({ ... }) schema or remove it from .env.example.`,
      });
    } else if (!hasValue && schema[exampleKey].default === undefined && !schema[exampleKey].optional) {
      // Already handled by missing check, avoid duplicate noise
      continue;
    } else if (!hasValue && !schema[exampleKey].optional) {
      // Key exists in .env.example without a local .env override (falling back to default)
      // Only flag if explicitly missing from local env when example requires it
    }
  }

  return issues;
}

/**
 * Recursively freezes an object (including parsed JSON objects/arrays)
 * so environment variables cannot be mutated anywhere in the application.
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  Object.freeze(obj);

  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }

  return obj;
}