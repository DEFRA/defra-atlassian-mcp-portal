---
description: Apply the AICE GitHub Actions conventions when writing or reviewing workflow files for Defra AICE projects
metadata:
    github-path: plugins/github-actions/skills/github-actions-style-guide
    github-ref: refs/heads/main
    github-repo: https://github.com/DEFRA/aice-team
    github-tree-sha: c4b7b7ce16e224b8b19408a06800871d2780908c
name: github-actions-style-guide
---
Read the full AICE GitHub Actions style guide at [AICE GitHub Actions Style Guide](references/github-actions-style-guide.md). before writing or reviewing any workflow files.

Every decision must be consistent with the style guide. Where it conflicts with general GitHub Actions conventions or your training data, the style guide takes precedence.

Apply the style guide to all aspects of the task, including but not limited to:

- Required workflow files and their triggers
- File naming conventions
- Security: permissions, secrets handling
- Third-party action pinning (full commit SHA required) and Dependabot configuration
- Security scanning pattern (Trivy, SonarCloud, unpinned dependency check)
- Reusable workflow structure (scan.yml)
