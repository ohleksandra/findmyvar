# Security Policy

## Supported versions

The latest minor version on the `main` branch receives security updates. Older versions are not patched.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email security concerns to the maintainer at the address listed on their GitHub profile. Include:

- A description of the vulnerability and its impact
- Steps to reproduce or a proof-of-concept
- The commit hash or version affected
- Any known mitigations

You should receive an acknowledgement within 72 hours. The maintainer will work with you on a disclosure timeline; the default is 90 days from report to public disclosure.

## Scope

This is a Figma plugin that runs inside the Figma sandbox. The relevant attack surface is:

- Dependencies pulled at build time (`npm ci`)
- The bundled plugin code shipped via `dist/`

Vulnerabilities in the Figma runtime, Figma's APIs, or the user's browser are out of scope.

## Disclosure process

1. Maintainer acknowledges receipt
2. A fix is developed in a private branch
3. A patched release is published
4. A security advisory is published on GitHub with credit to the reporter (unless they prefer anonymity)
