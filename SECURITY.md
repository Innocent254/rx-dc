# Security policy

## Supported versions

Security fixes are applied to the latest release and the default branch.

## Reporting a vulnerability

Do not open a public issue for an unpatched vulnerability. Use GitHub's private vulnerability reporting feature in the repository Security tab. Include:

- affected version and platform;
- reproduction steps;
- impact and prerequisites;
- proof-of-concept material that does not expose third-party data;
- suggested mitigation, when known.

Do not test against devices or networks you do not own or have explicit permission to assess.

## Scope

Relevant examples include:

- renderer-to-main privilege escalation;
- bearer-token disclosure;
- backend exposure beyond loopback;
- command or path injection;
- malicious device data causing code execution;
- unsafe update or packaging behavior.

Missing ADB/scrcpy, unsigned installer warnings, and expected Android authorization prompts are normally support issues rather than vulnerabilities.
