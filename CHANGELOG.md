# Changelog

## [1.1.0](https://github.com/ohleksandra/findmyvar/compare/v1.0.1...v1.1.0) (2026-08-04)

### Features

- **store:** persist recent searches and scope across sessions ([4ca2bba](https://github.com/ohleksandra/findmyvar/commit/4ca2bba8feff3be87f44ad4f03c030d74057a148))

### Bug Fixes

- **a11y:** add aria attributes and use semantic elements ([5267e6a](https://github.com/ohleksandra/findmyvar/commit/5267e6ad5c21914183bee2072358b578ff2b98a3))
- **a11y:** make recent-search badges keyboard-accessible ([eef2697](https://github.com/ohleksandra/findmyvar/commit/eef269734db163932d9f011f52162a4e4fa61926))
- **cache:** implement true LRU eviction on cache reads ([15bf702](https://github.com/ohleksandra/findmyvar/commit/15bf7020c8cc8635da872786b45617fd29b6d026))
- resolve TypeScript errors in UI components ([0d24d18](https://github.com/ohleksandra/findmyvar/commit/0d24d18e1e5ca5ea39fa346db01199d2e008a0a6))
- **rpc:** send error response when handler throws ([fda477a](https://github.com/ohleksandra/findmyvar/commit/fda477a3bbab681b3518690601fb826fd2f4a0b3))
- **search:** align searchId between main process and UI store ([3b64086](https://github.com/ohleksandra/findmyvar/commit/3b64086de3924e1a98a7c7e6fe2bc22fed8c2c79))
- **search:** generate searchId in UI to prevent race condition ([501dd3c](https://github.com/ohleksandra/findmyvar/commit/501dd3ca05f3f30881ea96bf8b05ed7ecdb7050b))
- **search:** resolve variableSearch.start immediately and stream via notifications ([947816f](https://github.com/ohleksandra/findmyvar/commit/947816f14d10098bf161a06955928ec506ea078f))
- **store:** ignore stale search notifications after cancel ([83aec1f](https://github.com/ohleksandra/findmyvar/commit/83aec1f134ad9776e21886e43f0653b5543ca885))
- **types:** make RpcResponse non-optional in response messages ([153f8ba](https://github.com/ohleksandra/findmyvar/commit/153f8ba58deaa58820e4bee877ca5b2c0d185e36))
- **types:** type nodeType as Figma SceneNode type ([c3f7a75](https://github.com/ohleksandra/findmyvar/commit/c3f7a753ce850d6f59e5859e82fb04e8df616229))

## [1.0.1](https://github.com/ohleksandra/findmyvar/compare/v1.0.0...v1.0.1) (2026-07-12)

### Bug Fixes

- **ci:** exclude plugma example from vitest run ([1553db2](https://github.com/ohleksandra/findmyvar/commit/1553db220e182ad70ca550bcdb571e829bc4d1a6))
- code review cleanup ([c10daad](https://github.com/ohleksandra/findmyvar/commit/c10daadade858ff65c4f18509948d3739d0ab5aa))
- resolve tsc errors and remove dead code ([53e1d21](https://github.com/ohleksandra/findmyvar/commit/53e1d21268a247e34e192535c3f7800e3cfb2080))
- surface cache-hit state and dedupe recent searches ([fe34d6f](https://github.com/ohleksandra/findmyvar/commit/fe34d6f4198dbd0e74bd106ba7a4321df9d6deda))
- typos and restore skipInvisibleInstanceChildren on exit ([8ecd20b](https://github.com/ohleksandra/findmyvar/commit/8ecd20b71f160151d39e9370b576d9ae9fbebea9))
