import { EnvRule, ValidationIssue } from './types';

export type CastResult =
  | { ok: true; value: unknown }
  | { ok: false; issue: ValidationIssue };

export function castAndValidate(
  key: string,
  raw: string | undefined,
  rule: EnvRule
): CastResult {
  const trimmed = raw?.trim();

  // 1. Handle missing or empty values
  if (trimmed === undefined || trimmed === '') {
    if ('default' in rule && rule.default !== undefined) {
      return { ok: true, value: rule.default };
    }
    if (rule.optional) {
      return { ok: true, value: undefined };
    }
    return {
      ok: false,
      issue: {
        key,
        reason: 'MISSING',
        expected: formatExpected(rule),
        received: raw,
        fixHint: `Add ${key}=<${rule.type}> to your .env file${
          rule.description ? ` (${rule.description})` : ''
        }.`,
      },
    };
  }

  // 2. Boolean casting ("true"/"1" -> true, "false"/"0" -> false)
  if (rule.type === 'boolean') {
    const lower = trimmed.toLowerCase();
    if (lower === 'true' || lower === '1') {
      return { ok: true, value: true };
    }
    if (lower === 'false' || lower === '0') {
      return { ok: true, value: false };
    }
    return {
      ok: false,
      issue: {
        key,
        reason: 'INVALID_TYPE',
        expected: 'boolean ("true", "false", "1", or "0")',
        received: raw,
        fixHint: `Set ${key}=true or ${key}=false in your .env file.`,
      },
    };
  }

  if (rule.type === 'number') {
    const num = Number(trimmed);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      return {
        ok: false,
        issue: {
          key,
          reason: 'INVALID_TYPE',
          expected: 'valid number',
          received: raw,
          fixHint: `Replace ${key}="${raw}" with a numeric value (e.g., ${key}=8080).`,
        },
      };
    }
    if (rule.int && !Number.isInteger(num)) {
      return {
        ok: false,
        issue: {
          key,
          reason: 'INVALID_TYPE',
          expected: 'integer',
          received: raw,
          fixHint: `Provide a whole number for ${key} (e.g., ${key}=${Math.round(num)}).`,
        },
      };
    }
    if (rule.min !== undefined && num < rule.min) {
      return {
        ok: false,
        issue: {
          key,
          reason: 'OUT_OF_RANGE',
          expected: `number >= ${rule.min}`,
          received: raw,
          fixHint: `Increase ${key} to at least ${rule.min}.`,
        },
      };
    }
    if (rule.max !== undefined && num > rule.max) {
      return {
        ok: false,
        issue: {
          key,
          reason: 'OUT_OF_RANGE',
          expected: `number <= ${rule.max}`,
          received: raw,
          fixHint: `Decrease ${key} to at most ${rule.max}.`,
        },
      };
    }
    return { ok: true, value: num };
  }

  if (rule.type === 'enum') {
    if (!rule.values.includes(trimmed)) {
      return {
        ok: false,
        issue: {
          key,
          reason: 'INVALID_TYPE',
          expected: `one of [${rule.values.map((v) => `"${v}"`).join(', ')}]`,
          received: raw,
          fixHint: `Set ${key} to one of: ${rule.values.join(' | ')}.`,
        },
      };
    }
    return { ok: true, value: trimmed };
  }

  if (rule.type === 'json') {
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      return {
        ok: false,
        issue: {
          key,
          reason: 'INVALID_TYPE',
          expected: 'valid JSON string',
          received: raw,
          fixHint: `Ensure ${key} contains valid JSON (e.g., ${key}='{"key":"value"}').`,
        },
      };
    }
  }

  if (rule.minLength !== undefined && trimmed.length < rule.minLength) {
    return {
      ok: false,
      issue: {
        key,
        reason: 'OUT_OF_RANGE',
        expected: `string with length >= ${rule.minLength}`,
        received: raw,
        fixHint: `Provide a value for ${key} with at least ${rule.minLength} characters.`,
      },
    };
  }
  if (rule.pattern && !rule.pattern.test(trimmed)) {
    return {
      ok: false,
      issue: {
        key,
        reason: 'INVALID_TYPE',
        expected: `string matching ${rule.pattern}`,
        received: raw,
        fixHint: `Update ${key} to match pattern ${rule.pattern}.`,
      },
    };
  }

  return { ok: true, value: trimmed };
}

function formatExpected(rule: EnvRule): string {
  if (rule.type === 'enum') {
    return `one of [${rule.values.map((v) => `"${v}"`).join(', ')}]`;
  }
  return rule.type;
}