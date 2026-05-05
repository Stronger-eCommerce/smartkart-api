# AGENTS.md

Guidance for AI coding agents (Cursor, Claude Code, Codex, etc.) working **on** this repository.

For guidance on _using_ the published package as a consumer, see [`README.md`](./README.md) and `.cursor/rules/smartkart-api.mdc`.

## Project layout

```
src/
  client.ts            # SmartKartClient (fetch, retry, timeout, pagination)
  errors.ts            # SmartKartApiError + isSmartKartApiError
  request-options.ts   # RequestOptions, RetryOptions, PaginationOptions, Logger
  types/               # Wire-format request/response types
  schemas/             # (planned) Zod runtime schemas
  mcp/                 # (planned) MCP server entrypoint
examples/usage.ts      # Reference usage; not published
.github/workflows/     # ci.yml, publish.yml (tag-driven), publish-canary.yml
```

## Commands

| Task          | Command           |
| ------------- | ----------------- |
| Install       | `npm install`     |
| Typecheck     | `npm run typecheck` |
| Build         | `npm run build`   |
| Test          | `npm test`        |
| Watch build   | `npm run watch`   |
| Dry-run pack  | `npm pack --dry-run` |

The `prepublishOnly` hook runs `typecheck && build` automatically.

## Build system

- Bundler: `tsup` → `dist/{index.js,index.cjs,index.d.ts,index.d.cts}` plus `.map` files.
- Dual ESM/CJS published. `package.json` `exports` is the source of truth — never delete it.
- Source maps are shipped (`--sourcemap`).
- `sideEffects: false` is set; do not add top-level side effects to any file under `src/`.

## Versioning & release

- `latest` is published from the [`Publish` workflow](./.github/workflows/publish.yml) on `v*` tags.
- Canary builds publish on every push to `main` via [`Publish Canary`](./.github/workflows/publish-canary.yml) under the `canary` dist-tag.
- Always bump via `npm version patch|minor|major` so the working tree, `package-lock.json`, and tag stay aligned.
- Provenance (`--provenance`) is enabled. The repo MUST stay public for Sigstore to validate, and `repository.url` in `package.json` must match the GitHub repo URL casing exactly (`Stronger-eCommerce/smartkart-api`).

## Things to never commit

- `dist/` (build output)
- `node_modules/`
- `*.tgz` (npm pack artifacts)
- `.env*` files

These are all in `.gitignore`. If you find any tracked accidentally, run `git rm --cached <path>`.

## Testing conventions

- Test runner: Vitest.
- Always inject `fetch` via `options.fetch` rather than mocking globals — the client supports custom fetch for exactly this reason.
- Cover both happy paths and error envelopes (`success: false`). Use `isSmartKartApiError` instead of `instanceof` to avoid dual-package hazards.

## Coding conventions

- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
- Use `import type` for type-only imports.
- All async paths must propagate `AbortSignal`; never swallow `signal.aborted`.
- Public methods accept an optional `RequestOptions` last argument (`signal`, `timeoutMs`, `retry`, `logger`).
- Wire-format types live in `src/types/`. "Public input" types (e.g. `GetItemsInput`) make `storeID` optional because the client backfills `defaultStoreId`.
- Errors thrown inside the client must be `SmartKartApiError` so consumers can detect them with `isSmartKartApiError`.

## Common gotchas

- `AbortSignal.any` is **not** safe — use the `mergeSignals` helper in `src/client.ts` (we support Node 18+).
- The default base URL has a typo (`Connectros`, not `Connectors`) that matches the upstream API. Don't "fix" it.
- `CustomerShippingAddress` uses **PascalCase** keys (`Address1`, `Phone1`); the camelCase `address` field is separate. Don't mix.
- `npm publish` will fail if `dist/` isn't built. The `prepublishOnly` hook handles this.
- npm rejects republishing the same version. Always bump.
