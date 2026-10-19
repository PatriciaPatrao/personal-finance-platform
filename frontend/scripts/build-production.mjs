/**
 * Production build: require NG_APP_API_BASE_URL and inject it via ng build --define.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PLACEHOLDER = 'REPLACE_WITH_API_BASE_URL';

function fail(message) {
  console.error(message);
  process.exit(1);
}

const rawUrl = process.env.NG_APP_API_BASE_URL?.trim();
if (!rawUrl) {
  fail(
    'NG_APP_API_BASE_URL is required for production builds.\n'
      + 'Example (PowerShell): $env:NG_APP_API_BASE_URL="https://api.example.com"; npm run build\n'
      + 'Example (Unix): NG_APP_API_BASE_URL=https://api.example.com npm run build',
  );
}

if (rawUrl === PLACEHOLDER || rawUrl.includes('REPLACE_WITH')) {
  fail(
    'NG_APP_API_BASE_URL must be a real API URL, not the documentation placeholder.',
  );
}

let parsed;
try {
  parsed = new URL(rawUrl);
} catch {
  fail(`NG_APP_API_BASE_URL is not a valid URL: ${rawUrl}`);
}

if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
  fail('NG_APP_API_BASE_URL must use http or https.');
}

const normalized = rawUrl.replace(/\/+$/, '');
const frontendDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const defineArg = `--define=NG_APP_API_BASE_URL=${JSON.stringify(normalized)}`;
const result = spawnSync('npx', ['ng', 'build', defineArg], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
