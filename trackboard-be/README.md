# trackboard-be

REST API, Google sign-in, AI, file storage and the live-editing socket for Trackdocs. Elysia on Bun, PostgreSQL for data.
Routing is thin; shared logic and wire types live in the sibling `trackboard-packages`, resolved through the `paths`
alias in `tsconfig.json`. No build step.

## Run it locally

```bash
cd ../trackboard-packages && bun install && cd ../trackboard-be
bun install
cp .env.example .env          # set TB_DEV_LOGIN=1 to sign in without Google
bun run dev                   # API on :3400, collaboration socket on :3401
```

With no `DATABASE_URL` the server uses embedded PGlite in `.tb-db` (local only). The frontend needs
`NEXT_PUBLIC_API_URL=http://localhost:3400` and `NEXT_PUBLIC_COLLAB_URL=ws://localhost:3401`
(see `trackboard-fe/.env.example`). `GET /api/auth/dev?name=Ana` signs in as Ana when `TB_DEV_LOGIN=1`; it is forced off in production.

| Command | |
|---|---|
| `bun test` | API tests (in-memory PGlite) and a real two-client collaboration test |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:migrate` | Apply migrations (they also run at start-up) |

## How data is stored

| What | Where | Why |
|---|---|---|
| Page content, page tree | `documents.ydoc` (Yjs state) | The source of truth for live editing; merges concurrent edits. |
| Read copy of a page | `documents.content_json`, `documents.text` | Search, export and previews without an editor. Written on every store. |
| Versions | `snapshots` | Per page; the newest 40 automatic ones are kept, named ones never pruned. |
| Uploads | `files` row + `TB_FILES_DIR/<workspace>/<id>` | Pages hold a URL, not the bytes. |
| Tickets | `tickets` | |

Every collaboration document is named `<workspaceId>/<local name>`; the socket checks the person is a member of that
workspace before it opens, so documents never cross workspaces.

## Endpoints

`GET /api/health` · `GET /api/auth/google`, `/api/auth/google/callback` · `GET|DELETE /api/session` · `GET /api/collab-token` ·
`GET|PATCH /api/me` · `GET|POST /api/pages/:id/snapshots`, `GET /api/pages/:id/snapshots/:sid` ·
`GET /api/pages/:id/export?format=json|text` · `POST /api/pages/:id/duplicate` · `POST /api/pages/purge` ·
`POST /api/files`, `GET /api/files/:id` · `POST /api/tickets` · `POST /api/ai` (NDJSON stream).

The collaboration socket (Hocuspocus) is a separate listener on its own port, and in production its own host. The session cookie belongs to the API host, so the app sends a five-minute token from `GET /api/collab-token` instead. Hocuspocus's bundled `Server` runs on crossws's Node adapter, which
refuses to start under Bun, so `src/lib/collab.ts` serves the sockets with `Bun.serve` and hands them to Hocuspocus.

## Configuration

See `.env.example`. In production `SESSION_SECRET` is required, and `TB_CROSS_SITE_COOKIE=1` is only for an app and API
on different sites; keep them on one site (production: `trackboard.eaco1.xyz`, `api.eaco1.xyz`, `ws.eaco1.xyz`) so cookies stay `SameSite=Lax`.
Google redirect URI to register: `<TB_PUBLIC_URL>/api/auth/google/callback`.

## Deployment

`deploy/trackboard.yml` is the Semaphore UI (Ansible) template and `scripts/deploy-remote.sh` runs on the VPS: it pulls the
repo, installs dependencies, restarts `trackboard-backend.service` and waits for `/api/health`. `.semaphore/` at the
repository root runs the tests on every push for Semaphore CI.

On the server: `deploy/trackboard-backend.service` (systemd, memory-capped), `deploy/nginx-trackboard-api.conf` (`api.eaco1.xyz` to :3400) and
`deploy/nginx-trackboard-ws.conf` (`ws.eaco1.xyz` to the socket on :3401), and `scripts/backup-db.sh` (daily `pg_dump`, 7 days kept). The production `.env` lives next
to the code on the server and is never committed; deployment does not touch it.
