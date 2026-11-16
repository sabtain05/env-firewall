# env-firewall

Zero-dependency runtime environment variable parser, type-caster, `.env.example` sync checker, and boot-time firewall for Node.js & TypeScript.

## Why?

- **No truthy `"false"` bugs:** Automatically casts `"false"` / `"0"` to `false` and `"8080"` to `8080`.
- **Zero dependencies:** Parses `.env` files natively with no `dotenv`, `zod`, or `joi` bloat.
- **Full TypeScript inference:** Define your schema once—types are inferred automatically.
- **Immutable at runtime:** Deep-freezes your config object (`Object.freeze`) so nothing can mutate `env` after boot.
- **Sync drift protection:** Detects variables declared in `.env.example` that are missing from your schema.
- **Actionable terminal diagnostics:** Blocks boot with color-coded error reports showing expected vs. received values and exact fixes.

## Installation

```bash
npm install env-firewall

```

## Quick Start

```ts
import { createEnv } from 'env-firewall';

export const env = createEnv({
  PORT: { type: 'number', default: 3000, int: true, min: 1, max: 65535 },
  ENABLE_FEATURE: { type: 'boolean', default: false },
  DATABASE_URL: { type: 'string', description: 'Primary PostgreSQL connection string' },
  NODE_ENV: {
    type: 'enum',
    values: ['development', 'production', 'test'] as const,
    default: 'development',
  },
  CORS_ORIGINS: { type: 'json', default: ['http://localhost:3000'] },
});

// Fully typed and frozen:
// env.PORT -> number
// env.ENABLE_FEATURE -> boolean
// env.DATABASE_URL -> string
// env.NODE_ENV -> "development" | "production" | "test"

```

## Supported Rule Types

| Type | Options | Example |
| --- | --- | --- |
| `string` | `default`, `optional`, `minLength`, `pattern`, `description` | `{ type: 'string', minLength: 10 }` |
| `number` | `default`, `optional`, `int`, `min`, `max`, `description` | `{ type: 'number', int: true, min: 1 }` |
| `boolean` | `default`, `optional`, `description` | `{ type: 'boolean', default: false }` |
| `enum` | `values` (`as const`), `default`, `optional`, `description` | `{ type: 'enum', values: ['dev', 'prod'] as const }` |
| `json` | `default`, `optional`, `description` | `{ type: 'json', default: {} }` |

## Options (`createEnv(schema, options)`)

* `envPath`: Custom path to `.env` file (defaults to `./.env`).
* `examplePath`: Custom path to `.env.example` file (defaults to `./.env.example` if present).
* `loadDotEnv`: Load `.env` from disk (default: `true`).
* `source`: Pass a custom `Record<string, string | undefined>` instead of `process.env`.
* `freeze`: Deep-freeze the returned object (default: `true`).
* `exitOnError`: Log formatted error and call `process.exit(1)` instead of throwing `EnvFirewallError` (default: `false`).

## License

MIT

---
