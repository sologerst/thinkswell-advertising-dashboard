<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- Product spec: `SPEC.md`. Setup and deploy: `README.md`.
- Every client-facing query must go through `scopeWhere()` in `src/lib/metrics/query.ts`, and every page/action must call a guard from `src/lib/auth/current.ts` (`requireAdmin`, `requireClientAccess`).
- Ratios (CTR, CPC, ROAS…) are computed from summed base fields via `src/lib/metrics/catalog.ts`; never average them.
- Schema changes: edit `src/lib/db/schema.ts`, then `npm run db:generate`.
- Local dev uses embedded PGlite (`.data/`); `npm run setup` seeds demo data. Checks: `npm run typecheck && npm run lint && npm run build`.
