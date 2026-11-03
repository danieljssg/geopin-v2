# Repository Discovery

## Runtime and architecture

- Next.js 16.3.1 App Router, React 19, Better Auth, MongoDB-compatible Cosmos persistence.
- Leaflet 1.9.4 through React Leaflet 5; map tiles are configured through `lib/map/capas.ts` and `lib/map/tile-sources.ts`.
- Offline client storage is `geopin-field` in Dexie v1 (`outbox`, `parcelas`, `esquemas`). Serwist is configured in `app/sw.ts`.
- Server persistence is accessed through repositories under `lib/server/repositories`.

## Existing data and authorization

- `Parcela` has `creadoPor`, `levantamientoId`, creation/update timestamps, module data, coordinates, and area in m².
- `Levantamiento` has a creator but no workspace or membership relation.
- Roles are currently `encuestador` and `admin`.
- List endpoint scopes non-admin users to their own records; record detail checks creator; exports previously fetched every record in a requested survey. Export ownership is fixed in commit `1de7eb4`.
- Dashboard endpoint requires the global management permission and previously allowed an unscoped query. It now requires a selected survey and the UI selects the first available survey (`2716d9f`).
- Schemas and surveys are global collections; no workspace, invitation, manager request, or membership entities exist.

## Map findings

- Leaflet controls are custom React buttons rendered over the map; the map click handler moves the draft marker.
- Controls now register Leaflet click/scroll propagation suppression (`e8ca1ff`).
- Capture location uses a watch-based geolocation hook with accuracy filtering; the active marker follows accepted readings and manual corrections take precedence.

## Known gaps against the plan

- Registration UI only supports sign-in; Better Auth email/password signup is enabled server-side.
- Workspace and Manager model/migration do not exist.
- Dashboard has no requested category/date filters or population/surface summary.
- Dexie records and outbox are not partitioned by account or survey.
- Cached dashboard snapshots are not implemented.
- Export currently applies creator scope for non-admins but not a unified survey authorization policy or dashboard filters.

## Verification commands

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
