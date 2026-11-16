export type EnvPrimitiveType = 'string' | 'number' | 'boolean' | 'json';

export interface BaseRule<T> {
  default?: T;
  optional?: boolean;
  description?: string;
}

export interface StringRule extends BaseRule<string> {
  type: 'string';
  minLength?: number;
  pattern?: RegExp;
}

export interface NumberRule extends BaseRule<number> {
  type: 'number';
  min?: number;
  max?: number;
  int?: boolean;
}

export interface BooleanRule extends BaseRule<boolean> {
  type: 'boolean';
}

export interface JsonRule<T = unknown> extends BaseRule<T> {
  type: 'json';
}

export interface EnumRule<T extends readonly string[]> extends BaseRule<T[number]> {
  type: 'enum';
  values: T;
}

export type EnvRule =
  | StringRule
  | NumberRule
  | BooleanRule
  | JsonRule
  | EnumRule<readonly string[]>;

export type EnvSchema = Record<string, EnvRule>;

/**
 * Infers the exact TypeScript type for a single rule.
 * Adds `| undefined` only if `optional: true` is set without a `default`.
 */
export type InferRuleType<R extends EnvRule> = R extends StringRule
  ? string
  : R extends NumberRule
  ? number
  : R extends BooleanRule
  ? boolean
  : R extends EnumRule<infer V>
  ? V[number]
  : R extends JsonRule<infer J>
  ? J
  : never;

export type InferEnv<S extends EnvSchema> = {
  readonly [K in keyof S]: S[K]['optional'] extends true
    ? S[K]['default'] extends undefined
      ? InferRuleType<S[K]> | undefined
      : InferRuleType<S[K]>
    : InferRuleType<S[K]>;
};

export interface EnvGuardOptions {
  /** Path to .env file (defaults to process.cwd() + '/.env') */
  envPath?: string;
  /** Path to .env.example to warn/error on out-of-sync keys */
  examplePath?: string;
  /** Whether to load .env file from disk (default: true) */
  loadDotEnv?: boolean;
  source?: Record<string, string | undefined>;
  freeze?: boolean;
  exitOnError?: boolean;
}

export interface ValidationIssue {
  key: string;
  reason: 'MISSING' | 'INVALID_TYPE' | 'OUT_OF_RANGE' | 'OUT_OF_SYNC';
  expected: string;
  received: string | undefined;
  fixHint: string;
}