# spora-plugin-memories-frontend

Pre-built Vue SPA for the Spora **Memories** admin panel. Delivered as a Composer package of type `spora-plugin-frontend`; `spora-installer`'s `SporaPluginFrontendInstaller` copies this repo's `frontend/` directory into `public/plugins/spora-plugin-memories-frontend/` so the host SPA can lazy-load it via `/plugins/spora-plugin-memories-frontend/main.js`.

## Why a separate repo from the PHP plugin?

- The Vue bundle has its own release cadence (visual fixes don't need a PHP tag).
- Backend-only operators can `composer require spora-ai/spora-plugin-memories` without pulling in npm-buildable assets.
- The bundle is independently testable in isolation (Vitest + the smoke script).

## What it surfaces

A sidebar-and-detail admin panel (`/apps/memories`) per user (global memories) and per agent (agent-scoped memories). The plugin's UI mirrors `spora-frontend/src/apps/memories/` (which it replaces):

- **Scope bar** — `PrincipalChipRow` toggles between the caller's user-principal and any group-principals they're a member of. Memory reads and writes are scoped to the active principal (`?principal_id=N`).
- **Mode row** — segmented `Global` / `Agent: <name>` control. Selecting the agent pill in global mode routes to the first visible agent; in agent mode it opens a dropdown for fast switching.
- **Documents panel** (sidebar) — type-filter chips (`All` / `Plans` / `Docs` / `Examples` / `Context`) live next to the list they filter. Drag-to-reorder persists via PATCH `/memories/reorder` (global) or PATCH `/agents/:id/memories/reorder` (agent).
- **Memory editor** — Markdown body via `md-editor-v3` (externalised; shared with the host SPA). Edit-only by default (`:preview="false"`); the toolbar's preview button toggles between edit, split, and preview modes. `Attach media` opens the host's `openMediaPicker` and inserts `![](<asset_url>)` at end-of-content. Markdown is sanitised via DOMPurify before preview render.
- **Routing** — both `/` (`global-memories`) and `/agents/:id` (`agent-memories/:id`) resolve to the same component; mode is derived from `route.name`, active agent from `route.params.id`, and the active memory from `?memory=<id>` or `?create=1`.

## Document types

Every memory is tagged with a `type` from the set `plan | documentation | examples | context` (mandatory on save/get/replace). The Documents panel exposes per-type filter chips; the list endpoints honour `?type=` for the same filter.

## Build

```bash
npm install
npm run build   # writes frontend/main.js + frontend/style.css
npm run smoke   # asserts window.SporaAppMemories.mount is a function
```

The build output (`main.js` + `style.css`) is committed to this repo. Operators get the new bundle on the next `composer update`.

## Dev mode (plugin author)

```bash
npm run dev   # vite dev server on :5175
```

The host SPA's `vite.config.ts` proxies `/plugins/spora-plugin-memories-frontend` to `:5175` so editing `src/*` updates the panel without rebuilding the host. The dev sandbox uses an in-memory mock API (`src/dev-mock.ts`) so it renders without the PHP backend — set `SPORA_PLUGIN_DEV_PORTS=memories:5175` on the host for the cross-port proxy.

## Mount contract

The IIFE bundle installs `window.SporaAppMemories` (the PascalCase of the slug) with two methods:

- `mount(target: HTMLElement, hostContext)` — create the app, install local Pinia + local router (createMemoryHistory), mount into the host's slot.
- `unmount(target: HTMLElement)` — tear down.

The host's `apps/registry.ts` reads both. The bundle names **must** stay aligned with `memories` → `SporaAppMemories` (see `vite.config.ts → build.lib.name`).

## Plugin-local router

The plugin installs its own `vue-router` instance with `createMemoryHistory()` — sidebar and `?create=1` / `?memory=N` navigation lives entirely in JS state. The host SPA owns the browser address bar; deep-link routes inside the memories bundle won't change the URL by default. Operators sharing a specific memory view will see only `/apps/memories` in their address bar.

If you need a future deep-link feature, `src/lib/route-detection.ts` already parses `/apps/memories/agents/:id(/:memoryId)?` and returns a typed `PluginRouteMatch`.

## Backend compatibility

The bundle expects a Spora host with the `memories` plugin installed (`spora-ai/spora-plugin-memories >= 0.1.0`). The plugin's PHP side provides the `/memories` and `/agents/:id/memories` endpoints the bundle calls via `hostContext.api`.

## License

MIT — see [LICENSE](LICENSE).
