# Repository Notes for Coding Agents

This file is read by AI coding agents (Claude Code, etc.) at session start. It captures non-obvious operational rules that have already burned us once.

## Database operations — read this before running any Prisma command

The production Postgres lives on a Supabase project shared with the running app. There is no separate dev database. The schema and data here are real even though there are no end users yet.

### URLs in `.env.local`

- `DATABASE_URL` — pooled connection (port 6543, `pgbouncer=true`). The Next.js app uses this at runtime.
- `DIRECT_URL` — direct connection (port 5432, no pooler). **Required** for `prisma migrate diff`, `prisma migrate resolve`, and any Prisma Migrate command. The pooled URL hangs `migrate diff` indefinitely on Windows.
- `SHADOW_DATABASE_URL` — local Postgres in Docker on `localhost:5433`. Used by `prisma migrate dev` and explicit `--shadow-database-url` flags.

### Hard rules

1. **NEVER pass `DATABASE_URL` or `DIRECT_URL` as `--shadow-database-url`.** Prisma resets the shadow DB on each invocation. Passing the production URL there wipes production. (We learned this the hard way — see commit `0c9c828` for the schema-side guardrail.)

2. **NEVER run `prisma migrate dev` interactively** without confirming the shadow URL is set to the local Docker container. The fail-open behavior of `migrate dev` (creating a temp DB it then resets) does not work against managed Supabase.

3. **For schema changes, prefer this workflow:**
   - Edit `schema.prisma`
   - Generate SQL: `pnpm prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --script`
   - Save to `prisma/migrations/<timestamp>_<name>/migration.sql`
   - Apply: `pnpm prisma db execute --file <that path> --schema prisma/schema.prisma`
   - Register: `pnpm prisma migrate resolve --applied <timestamp>_<name>`

4. **Always source `.env.local`** before any Prisma command:
   ```
   cd full-kit
   set -a && source .env.local && set +a
   ```

### Shadow Postgres setup

If the shadow container isn't running:
```
docker start shadow-postgres
# or, fresh:
docker run -d --name shadow-postgres -e POSTGRES_PASSWORD=shadow -p 5433:5432 postgres:15
```

To make it persist across Docker Desktop restarts:
```
docker update --restart unless-stopped shadow-postgres
```

### Migration history quirk

The `_prisma_migrations` table on Supabase was missing for a while and we baselined all existing migrations as applied via `prisma migrate resolve --applied <name>` for each. New migrations should follow the workflow above (apply via `db execute`, then resolve as applied). `prisma migrate deploy` should work going forward, but `migrate dev` will still fail on the TTY check in this harness.

## Running tests

```
cd full-kit
pnpm test           # vitest run, full suite
pnpm exec tsc --noEmit --pretty false   # type check, no emit
```

Both should be clean before committing.

## Active plan

The current implementation effort lives at `docs/superpowers/plans/2026-04-29-deal-pipeline-and-ai-backfill.md`. The "Amendments after audit" section near the top documents the corrections from external review passes — read it before working on any phase.
