# FindMyVar

[![CI](https://github.com/ohleksandra/findmyvar/actions/workflows/ci.yml/badge.svg)](https://github.com/ohleksandra/findmyvar/actions/workflows/ci.yml)
[![Figma Community](https://img.shields.io/badge/Figma-Install-blue?logo=figma&logoColor=white)](https://www.figma.com/community/plugin/1608643867941472937/findmyvar)
[![Version](https://img.shields.io/github/v/release/ohleksandra/findmyvar?label=version&sort=semver)](https://github.com/ohleksandra/findmyvar/releases)
[![License](https://img.shields.io/github/license/ohleksandra/findmyvar)](LICENSE)

![FindMyVar preview](docs/preview.png)

Find every place a variable is used.

Findmyvar lets you search for any variable by name and instantly see every place it's used across your entire design file, current page, or just your current selection. It can also find the variables nothing uses, so you can clean them up in bulk.

## What it does

### Search

- Search any variable by name
- See results grouped by page, with the full node path so you know exactly where each usage lives
- See which property the variable is bound to (Fills, Strokes, Gradient, and more)
- Navigate directly to that node and highlight it on the canvas
- Scope your search to all pages, current page, or selection

### Unused variables (new)

- Scan the file for variables that no layer, style, or prototype uses
- See how many can be deleted and how many are kept, grouped by collection
- Unused variables that alias another unused variable are nested under it, so you can see and remove a whole chain together
- Published variables are always kept, since other files may use them
- Select what to remove and bulk-delete it; Findmyvar saves a version history entry first ("Before FindMyVar cleanup") so you can roll back

## Who it's for

Whether you're a product designer auditing your work, or a design system maintainer tracking token usage across a large file, Findmyvar gives you the visibility you need.

## Why it matters

Figma doesn't give you a native way to find where a specific variable is used, or which ones aren't used at all. Findmyvar fills that gap, making variable audits, refactoring, and design system hygiene significantly faster.

---

> Note: Searches and unused-variable scans may take a moment on very large files, this is expected behavior.

## Install

1. Open the [FindMyVar page on Figma Community](https://www.figma.com/community/plugin/1608643867941472937/findmyvar).
2. Click **Install**.
3. Run the plugin from the **Actions** menu in any Figma file.

## License

[MIT](LICENSE)
