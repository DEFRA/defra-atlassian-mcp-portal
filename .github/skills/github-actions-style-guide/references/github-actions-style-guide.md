---
layout: default
title: GitHub Actions Style Guide
---

# GitHub Actions Style Guide

This page outlines the style guide / coding conventions for GitHub Actions workflows within the Defra AICE team.

## Table of Contents

- [1 GitHub Actions Project Rules](#1-github-actions-project-rules)
  - [1.1 Workflow Structure](#11-workflow-structure)
    - [1.1.1 File Naming](#111-file-naming)
    - [1.1.2 Required Workflows](#112-required-workflows)
  - [1.2 Security](#12-security)
    - [1.2.1 Permissions](#121-permissions)
    - [1.2.2 Secrets](#122-secrets)
  - [1.3 Third-Party Actions](#13-third-party-actions)
  - [1.4 Security Scanning](#14-security-scanning)
    - [1.4.1 scan.yml — Reusable Scan Workflow](#141-scanyml--reusable-scan-workflow)
    - [1.4.2 Trivy Vulnerability Scanning](#142-trivy-vulnerability-scanning)
    - [1.4.3 SonarCloud Code Scanning](#143-sonarcloud-code-scanning)
    - [1.4.4 Unpinned Dependency Check](#144-unpinned-dependency-check)

## 1 GitHub Actions Project Rules

### 1.1 Workflow Structure

#### 1.1.1 File Naming

All workflow files must be placed in `.github/workflows/` at the root of the project. Workflow file names must be in kebab-case with a `.yml` extension.

Use descriptive names that reflect the workflow's purpose:

- `check-pull-request.yml` — runs checks on pull requests (linting, tests, security scan)
- `publish.yml` — builds and publishes the application on merge to `main`
- `publish-hotfix.yml` — builds and publishes a hotfix release
- `scan.yml` — reusable security scanning workflow (Trivy + SonarCloud)

#### 1.1.2 Required Workflows

All AICE projects must have at minimum the following workflows:

| Workflow | Trigger | Purpose |
|---|---|---|
| `check-pull-request.yml` | `pull_request` | PR checks including security scan |
| `publish.yml` | `push` to `main` | Build and publish; security scan runs first |
| `scan.yml` | `workflow_call`, `schedule`, `workflow_dispatch` | Reusable security scanning |

`scan.yml` is a **reusable workflow** that is called by `check-pull-request.yml`, `publish.yml` and `publish-hotfix.yml`. It also runs on a nightly schedule as a standalone scan. This pattern ensures security scanning runs consistently at every stage of the delivery pipeline.

See the following for reference implementations:
- [scan.yml](https://github.com/DEFRA/rag-evaluation-runtime/blob/main/.github/workflows/scan.yml)
- [check-pull-request.yml](https://github.com/DEFRA/rag-evaluation-runtime/blob/main/.github/workflows/check-pull-request.yml)
- [publish.yml](https://github.com/DEFRA/rag-evaluation-runtime/blob/main/.github/workflows/publish.yml)
- [publish-hotfix.yml](https://github.com/DEFRA/rag-evaluation-runtime/blob/main/.github/workflows/publish-hotfix.yml)

### 1.2 Security

#### 1.2.1 Permissions

Always apply the principle of least privilege to the `GITHUB_TOKEN`. Set the default permissions to read-only at the workflow level, then grant only the specific write permissions required per job.

#### 1.2.2 Secrets

Sensitive values must always be stored as [GitHub secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions) and never hardcoded in workflow files or stored as GitHub environment variables.

- Use the least-privileged credentials possible for each secret.
- Do not use structured data (JSON, YAML, etc.) as a secret value — store each sensitive value as an individual secret.
- If a secret is used to generate another sensitive value (e.g. a signed JWT from a private key), register the derived value as a secret too.
- Periodically audit and rotate registered secrets. Remove secrets that are no longer needed.

When calling reusable workflows that need secrets (e.g. `SONAR_TOKEN`), pass them with `secrets: inherit`:

```yaml
jobs:
  security-scan:
    name: Security Scanning
    uses: ./.github/workflows/scan.yml
    secrets: inherit
```

Do not hardcode secrets in workflow files:

```yaml
# Never do this
- name: Deploy
  run: ./deploy.sh --key "my-secret-api-key"
```

### 1.3 Third-Party Actions

Like with dependencies, avoid using a third-party action that can be easily replaced with a custom script or action that the project controls. For example, if you have step to check for a version bump, it's safer to implement this as a custom script that lives in the repository rather than using a third-party action that performs this check. This reduces the attack surface and ensures you have full visibility and control over the code being executed in your workflows.

Where a third-party action is necessary, pin to a specific commit SHA and monitor the action's repository for security issues or updates. If the action becomes unmaintained or has a security vulnerability, replace it with an alternative or custom implementation as soon as possible.

Before using a third-party action, audit its source code to verify it handles repository contents and secrets as expected. Prefer actions from [GitHub Verified Creators](https://github.com/marketplace?type=actions&verification=verified_creator) where possible.

Do this:

```yaml
# Pin to a full-length commit SHA, with the tag documented in a comment
- uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
```

Don't do this:

```yaml
# Tag — can be moved by a bad actor
- uses: actions/checkout@v4

# No pin at all
- uses: actions/checkout@main
```

### 1.4 Security Scanning

#### 1.4.1 scan.yml — Reusable Scan Workflow

`scan.yml` must be structured as a reusable workflow using `workflow_call`, so that it can be called from `check-pull-request.yml`, `publish.yml`, and `publish-hotfix.yml`. It must also support `schedule` and `workflow_dispatch` triggers so that it runs as a standalone nightly scan.

```yaml
# .github/workflows/scan.yml
name: Security scan

on:
  schedule:
    - cron: '0 1 * * *'
  workflow_dispatch:
  workflow_call:
```

Calling workflows must invoke `scan.yml` as the first job so that a build or publish never proceeds if the security scan fails:

```yaml
# check-pull-request.yml / publish.yml / publish-hotfix.yml
jobs:
  security-scan:
    name: Security Scanning
    uses: ./.github/workflows/scan.yml
    secrets: inherit

  build:
    needs: security-scan
    ...
```

#### 1.4.2 SonarCloud Code Scanning

All repositories must be connected to [SonarCloud](https://sonarcloud.io/) for static analysis and code quality scanning. The SonarCloud scan job runs within `scan.yml` alongside the Trivy scan.

The SonarCloud job should be skipped for scheduled runs, as it requires a valid `SONAR_TOKEN` scoped to a branch or PR:

```yaml
jobs:
  sonarcloud:
    name: SonarCloud Scan
    if: ${{ github.event_name != 'schedule' && github.actor != 'dependabot[bot]' }}
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
        with:
          fetch-depth: 0

      - name: Set up Python
        uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5.6.0
        with:
          python-version: '3.13'
          cache: 'pip'

      - name: Test code and create coverage reports
        run: |
          pipx install uv
          uv sync --locked
          mkdir -p coverage
          chmod -R a+rw ./coverage
          uv run task test

      - name: SonarCloud Scan
        uses: SonarSource/sonarqube-scan-action@fd88b7d7ccbaefd23d8f36f73b59db7a3d246602 # v6.0.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

For JavaScript projects, replace the Python setup and test steps with the appropriate Node.js equivalents.

#### 1.4.3 Unpinned Dependency Check

All AICE projects must include a `scripts/check-unpinned-dependencies.sh` script and run it as part of the Trivy scan job. This enforces the dependency pinning rules described in the [JavaScript](./javascript.md#14-dependency-management) and [Python](./python.md#14-dependency-management) style guides at CI time.

```yaml
- name: Check for unpinned dependencies
  run: |
    chmod +x ./scripts/check-unpinned-dependencies.sh
    ./scripts/check-unpinned-dependencies.sh
```

## Contributions

If you would like to contribute to this style guide, please open a pull request on the [Defra AICE Team GitHub](https://github.com/DEFRA/aice-team) repository.

For anything not covered by this style guide, refer to the official [GitHub Actions security hardening documentation](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) and the [GitHub Actions secure use reference](https://docs.github.com/en/actions/reference/security/secure-use). If alignment across AICE is required, please raise an issue in [Defra AICE Team GitHub](https://github.com/DEFRA/aice-team/issues).
