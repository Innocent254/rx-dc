import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputDir = join(root, 'build', 'backend');
const goos = process.env.GOOS || ({ win32: 'windows', darwin: 'darwin' }[process.platform] ?? 'linux');
const goarch = process.env.GOARCH || ({ arm64: 'arm64', x64: 'amd64' }[process.arch] ?? process.arch);
const filename = goos === 'windows' ? 'rxdc-backend.exe' : 'rxdc-backend';

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const version = process.env.npm_package_version || 'dev';
execFileSync('go', [
  'build',
  '-trimpath',
  '-ldflags', `-s -w -X main.version=${version}`,
  '-o', join(outputDir, filename),
  './cmd/rxdc-backend'
], {
  cwd: join(root, 'backend'),
  stdio: 'inherit',
  env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: '0' }
});

console.log(`Built backend for ${goos}/${goarch}: build/backend/${filename}`);
