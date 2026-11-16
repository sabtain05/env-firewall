import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { createEnv, EnvFirewallError } from '../src/index';

describe('env-firewall', () => {
  it('casts booleans, numbers, strings, enums, and JSON accurately', () => {
    const env = createEnv(
      {
        ENABLE_FEATURE: { type: 'boolean' },
        DISABLE_CACHE: { type: 'boolean' },
        PORT: { type: 'number', int: true, min: 1, max: 65535 },
        API_KEY: { type: 'string', minLength: 5 },
        NODE_ENV: { type: 'enum', values: ['development', 'production', 'test'] as const },
        FEATURE_FLAGS: { type: 'json' },
      },
      {
        source: {
          ENABLE_FEATURE: 'false',
          DISABLE_CACHE: '1',
          PORT: '8080',
          API_KEY: 'sk_test_12345',
          NODE_ENV: 'production',
          FEATURE_FLAGS: '{"beta":true}',
        },
      }
    );

    assert.strictEqual(env.ENABLE_FEATURE, false);
    assert.strictEqual(env.DISABLE_CACHE, true);
    assert.strictEqual(env.PORT, 8080);
    assert.strictEqual(env.API_KEY, 'sk_test_12345');
    assert.strictEqual(env.NODE_ENV, 'production');
    assert.deepEqual(env.FEATURE_FLAGS, { beta: true });
  });

  it('applies defaults and allows optional variables without defaults', () => {
    const env = createEnv(
      {
        PORT: { type: 'number', default: 3000 },
        DEBUG: { type: 'boolean', default: false },
        OPTIONAL_WEBHOOK: { type: 'string', optional: true },
      },
      { source: {} }
    );

    assert.strictEqual(env.PORT, 3000);
    assert.strictEqual(env.DEBUG, false);
    assert.strictEqual(env.OPTIONAL_WEBHOOK, undefined);
  });

  it('deep-freezes the returned config object at runtime', () => {
    const env = createEnv(
      {
        PORT: { type: 'number', default: 3000 },
        META: { type: 'json', default: { nested: { flag: true } } },
      },
      { source: {} }
    );

    assert.strictEqual(Object.isFrozen(env), true);
    assert.throws(() => {
      (env as { PORT: number }).PORT = 9999;
    }, TypeError);

    assert.throws(() => {
      (env.META as { nested: { flag: boolean } }).nested.flag = false;
    }, TypeError);
  });

  it('throws EnvFirewallError with actionable details on missing or malformed values', () => {
    assert.throws(
      () =>
        createEnv(
          {
            DATABASE_URL: { type: 'string', description: 'Postgres connection string' },
            ENABLE_FEATURE: { type: 'boolean' },
            PORT: { type: 'number' },
          },
          {
            source: {
              ENABLE_FEATURE: 'not-a-bool',
              PORT: 'abc',
            },
          }
        ),
      (err: unknown) => {
        assert.ok(err instanceof EnvFirewallError);
        assert.strictEqual(err.issues.length, 3);
        assert.strictEqual(err.issues[0].reason, 'MISSING');
        assert.strictEqual(err.issues[1].reason, 'INVALID_TYPE');
        assert.strictEqual(err.issues[2].reason, 'INVALID_TYPE');
        assert.match(err.message, /ENV FIREWALL BLOCKED BOOT/);
        assert.match(err.message, /DATABASE_URL/);
        return true;
      }
    );
  });

  it('parses .env files and catches .env.example sync drift', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-firewall-'));
    const envFile = path.join(tmpDir, '.env');
    const exampleFile = path.join(tmpDir, '.env.example');

    fs.writeFileSync(
      envFile,
      [
        '# Comment line',
        'export PORT=4000 # inline comment',
        'ENABLE_FEATURE="false"',
        'GREETING="Hello\\nWorld"',
      ].join('\n')
    );

    fs.writeFileSync(
      exampleFile,
      ['PORT=3000', 'ENABLE_FEATURE=false', 'UNDECLARED_KEY=123'].join('\n')
    );

    try {
      assert.throws(
        () =>
          createEnv(
            {
              PORT: { type: 'number' },
              ENABLE_FEATURE: { type: 'boolean' },
              GREETING: { type: 'string' },
            },
            { envPath: envFile, examplePath: exampleFile }
          ),
        (err: unknown) => {
          assert.ok(err instanceof EnvFirewallError);
          assert.strictEqual(err.issues.length, 1);
          assert.strictEqual(err.issues[0].key, 'UNDECLARED_KEY');
          assert.strictEqual(err.issues[0].reason, 'OUT_OF_SYNC');
          return true;
        }
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});