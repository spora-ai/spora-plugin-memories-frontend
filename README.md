# spora-plugin-memories-frontend

Pre-built Vue SPA for the Spora **Memories** admin panel. Delivered as a Composer package of type `spora-plugin-frontend`; `spora-installer`'s `SporaPluginFrontendInstaller` copies this repo's `frontend/` directory into `public/plugins/memories/` so the host SPA can lazy-load it via `/plugins/memories/main.js`.

## Why a separate repo from the PHP plugin?

- The Vue bundle has its own release cadence (visual fixes don't need a PHP tag).
- Backend-only operators can `composer require spora-ai/spora-plugin-memories` without pulling in npm-buildable assets.
- The bundle is independently testable in isolation (Vitest + the smoke script).

## What it surfaces

The plugin's UI mirrors the host plugin app shell:

- **Global memories** — memories shared across every agent. Drag-to-reorder, create/edit with a Markdown editor, delete.
- **Agent memories** — per-agent memory lists. The sidebar exposes a dropdown to flip between agents; the page shows the same CRUD + reorder affordances scoped to the selected agent.
- **Markdown editor** — each memory's content body uses the plugin-bundled `md-editor-v3` editor.
- **Drag-to-reorder** — `vue-draggable-plus` drives the list ordering UI; reorder mutations PATCH back to the backend.

## Build

```bash
npm install
npm run build   # writes frontend/main.js + frontend/style.css
npm run smoke   # asserts window.SporaAppMemories.mount is a function
```

CI generates the build output during release packaging; operators get the new bundle on the next `composer update`.

## Dev mode (plugin author)

```bash
npm run dev   # vite dev server on :5175
```

The host SPA's `vite.config.ts` proxies `/plugins/memories` to `:5175` so editing `src/*` updates the panel without rebuilding the host. The dev sandbox uses an in-memory mock API (`src/dev-mock.ts`) so it renders without the PHP backend — set `SPORA_PLUGIN_DEV_PORTS=memories:5175` on the host for the cross-port proxy.

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
