# Contributing to R|X DC

Thank you for improving R|X DC.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install Node.js 22.12+, Go 1.23+, ADB, and optionally scrcpy.
3. Run `npm install`.
4. Make the smallest coherent change that solves the issue.
5. Run `npm test` and `npm run build`.
6. Open a pull request describing the behavior, test evidence, and affected platforms.

## Engineering rules

- Keep the backend local-first and bound to loopback.
- Do not expose the bearer token to the renderer.
- Do not add telemetry, analytics, remote APIs, or automatic uploads without an explicit design proposal and opt-in user controls.
- Do not add security bypasses, undocumented privilege escalation, unauthorized firmware modification, or code intended to evade Android/Xiaomi protections.
- Validate paths and external command arguments.
- Prefer the Go standard library and small auditable dependencies.
- Keep platform-specific code behind clear build tags or adapters.
- Add tests for parsers, protocol changes, and regressions.

## Commit style

Use clear imperative commit messages, for example:

```text
Add wireless debugging service discovery
Fix screenshot scaling on portrait devices
Document unsigned Windows installer warning
```

## Pull request checklist

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] No secrets, certificates, serial numbers, IP addresses, or personal log data are committed.
- [ ] UI changes work at 1120×720 and larger.
- [ ] Documentation is updated when behavior changes.
