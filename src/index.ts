import { castAndValidate } from './caster';
import { EnvFirewallError } from './formatter';
import { checkEnvSync, deepFreeze, loadDotEnvFile } from './parser';
import { EnvGuardOptions, EnvSchema, InferEnv, ValidationIssue } from './types';

export { EnvFirewallError } from './formatter';
export type {
  BooleanRule,
  EnumRule,
  EnvGuardOptions,
  EnvRule,
  EnvSchema,
  InferEnv,
  InferRuleType,
  JsonRule,
  NumberRule,
  StringRule,
  ValidationIssue,
} from './types';

/**
 * Parses, type-casts, validates, sync-checks, and freezes environment variables at boot time.
 */
export function createEnv<S extends EnvSchema>(
  schema: S,
  options: EnvGuardOptions = {}
): InferEnv<S> {
  const {
    envPath,
    examplePath,
    loadDotEnv = true,
    source,
    freeze = true,
    exitOnError = false,
  } = options;

  // 1. Merge .env file values with runtime environment (runtime process.env takes precedence)
  const fileVars = !source && loadDotEnv ? loadDotEnvFile(envPath) : {};
  const rawEnv: Record<string, string | undefined> = source
    ? { ...source }
    : { ...fileVars, ...process.env };

  const issues: ValidationIssue[] = [];
  const parsed: Record<string, unknown> = {};

  // 2. Validate and cast every declared schema key
  for (const key of Object.keys(schema)) {
    const rule = schema[key];
    const result = castAndValidate(key, rawEnv[key], rule);

    if (result.ok) {
      parsed[key] = result.value;
    } else {
      issues.push(result.issue);
    }
  }

  // 3. Check .env.example sync drift (if .env.example exists or examplePath is passed)
  if (!source || examplePath) {
    const syncIssues = checkEnvSync(schema, rawEnv, examplePath);
    issues.push(...syncIssues);
  }

  // 4. Block boot if any validation or sync issue was found
  if (issues.length > 0) {
    const error = new EnvFirewallError(issues);
    if (exitOnError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  // 5. Freeze the resulting object to prevent runtime tampering
  const typedEnv = parsed as InferEnv<S>;
  return freeze ? deepFreeze(typedEnv) : typedEnv;
}