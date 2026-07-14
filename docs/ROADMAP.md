# Roadmap

This roadmap separates deliverable engineering work from features that require Android/OEM cooperation.

## 0.1 — Desktop MVP

- [x] Electron/React interface.
- [x] Local Go backend.
- [x] ADB USB and Wireless debugging support.
- [x] Device properties and activity feed.
- [x] Interactive screenshot preview.
- [x] Input actions, app launching, and file transfer.
- [x] Optional scrcpy desktop window.
- [x] Multi-platform GitHub builds and tag releases.

## 0.2 — Reliability

- [ ] Structured backend log rotation.
- [ ] Cancellation and progress reporting for large transfers.
- [ ] Better package labels and Android app icons.
- [ ] Connection-state event stream instead of polling.
- [ ] Persist only non-sensitive preferences.
- [ ] Signed checksums and SBOM generation.
- [ ] Integration tests with a fake ADB executable.

## 0.3 — Desktop experience

- [ ] Configurable keyboard shortcuts.
- [ ] Drag-and-drop file transfer.
- [ ] Multi-device sessions.
- [ ] Window layout profiles.
- [ ] Audio forwarding through a supported local transport.
- [ ] Clipboard synchronization using an explicit Android companion permission flow.

## Android companion research

A true desktop shell needs an Android component. Any implementation must use documented or user-granted mechanisms, for example:

- a launcher-style desktop activity;
- MediaProjection with explicit user consent;
- Accessibility Service with clear disclosure and opt-in;
- Android companion-device APIs;
- supported external-display/virtual-display APIs;
- OEM-approved interfaces where available.

## Blocked without OEM/platform support

- Running arbitrary existing apps in resizable desktop windows with full system integration on every Xiaomi/Redmi model.
- Privileged task/window management normally reserved for system apps.
- Bypassing Android secure surfaces, DRM, lock screen, or debugging authorization.
- Samsung DeX feature parity solely from a desktop-side application.
