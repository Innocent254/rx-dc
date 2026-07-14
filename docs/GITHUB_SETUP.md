# GitHub setup and automatic builds

This repository already contains the workflow files required to build on every push.

## Create the repository

1. On GitHub, create a new repository named `rx-dc` or `r-x-dc`.
2. Do not generate a second README, license, or `.gitignore` because they are already included here.
3. Extract the repository archive on your computer.
4. Open a terminal in the extracted folder.
5. Run:

```bash
git init
git add .
git commit -m "Initial R|X DC application"
git branch -M main
git remote add origin https://github.com/Innocent254/rxdc.git
git push -u origin main
```

## What happens after every push

GitHub detects the files under `.github/workflows/` automatically.

- `ci.yml` validates Go, TypeScript, and the production source build.
- `build.yml` creates installers for Windows, macOS, and Linux, for x64 and ARM64.
- Each platform package is uploaded to the workflow run as a downloadable artifact.

Open the repository, select **Actions**, then select **Build installers** to watch progress or download results.

## Publish a release

Update the version in `package.json` and `CHANGELOG.md`, commit it, then create a matching Git tag:

```bash
npm version 0.1.1 --no-git-tag-version
git add package.json package-lock.json CHANGELOG.md
git commit -m "Release 0.1.1"
git tag v0.1.1
git push origin main --tags
```

The `release.yml` workflow builds every platform and creates a GitHub Release automatically.

## Repository settings

Recommended settings:

- Enable **Issues** for bug reports and feature requests.
- Enable **Private vulnerability reporting** under Security.
- Protect the `main` branch after the initial push.
- Require the `Validate / test` status check before merging pull requests.
- Keep GitHub Actions enabled for the repository.

Unsigned installers do not require secrets. Signing and notarization should be added later before broad public distribution.
