# @aicore8 packages

Shared packages of ai-core, published to npm under the `@aicore8` scope. TypeScript sources are published as they are; every ai-core resource bundles what it imports at build time.

| Package | Content |
|---|---|
| `@aicore8/lib` | Helpers: `/shared` (no natives), `/server`, `/client` |
| `@aicore8/shared` | Contracts between resources: event names, payload and export types |
| `@aicore8/mysql` | Database engine: in-process mysql2 pool per resource, oxmysql-compatible behaviour (parts adapted from oxmysql, LGPL-3.0, Overextended) |
| `@aicore8/build` | Build steps (`aicore-client-errors`) |

In the ai-core server folder (the bun workspace root, with this repo as `packages/`), resources link these local copies automatically when the version satisfies their range.

License: GPL-3.0-only.
