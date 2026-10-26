# spora-plugin-memories-frontend

Pre-built Vue SPA for the Spora **Memories** admin panel. Delivered as a Composer package of type `spora-plugin-frontend`; `spora-installer`'s `SporaPluginFrontendInstaller` copies this repo's `frontend/` directory into `public/plugins/memories/` (the parent plugin's `plugin.json#slug`, not this package's name) so the host SPA can lazy-load it via `/plugins/memories/main.js`.

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

The host SPA's `vite.config.ts` proxies `/plugins/memories` to `:5175` so editing `src/*` updates the panel without rebuilding the host. The dev sandbox uses an in-memory mock API (`src/dev-mock.ts`) so it renders without the PHP backend — set `SPORA_PLUGIN_DEV_PORTS=memories:5175` on the host for the cross-port proxy. The path is keyed on the plugin slug, the same key the env var uses.

## Languages

The panel ships its own `vue-i18n` instance (`src/i18n/index.ts`) built from its own catalogue — the host does not publish its instance, because that would couple the panel's catalogue lifetime to the host's and to a version-skewed peer range. The locale comes from the host through `PluginHostContext.locale`; the dev sandbox reads it from `?locale=de`.

```
src/locales/en.json   generated identity map — every key maps to itself
src/locales/de.json   the German catalogue
```

**The catalogue key is the English source string** — `t('Save Changes')`, not a slug. `en.json` is therefore generated, never hand-edited, and a copy edit orphans the German entry that was paired with it — which is exactly what the extractor's orphan rule catches.

```bash
npm run i18n:extract   # regenerate en.json from the source and report what is untranslated
npm run i18n:check     # the CI gate: en.json drift, a locale's key set, untranslated values, and copy outside t()
```

`npm run i18n:check` fails on an operator-facing string that is not wrapped in `t()`. The panel is the operator's whole surface, so a string that missed the catalogue is a string the operator reads in English.

### Catalogue grammar

The extractor accepts vue-i18n's interpolation syntax — `{name}`, `{0}` — as long as the braces are a well-formed placeholder. The **host's** extractor is stricter and rejects any key carrying a raw `{`, `}` or `|`, so the host's own catalogue holds no placeholder at all. The two grammars never meet: this panel's catalogue is read by this panel's extractor, and the host's `i18n:check` harvests the framework's own sources and never opens a plugin's catalogue. The difference is safe — vue-i18n compiles at render either way — and stable under the merge, because a key *is* the English source text, so a string present in both catalogues carries the same placeholders in both. Do not rewrite this panel's keys to satisfy the host's rule, and do not loosen the host's rule to match this one.

### What stays English, and why

- **A memory's name, summary and body** — the operator's own content, and model input. Translating them would rename the operator's memory behind their back.
- **`Principal` / `Principals`** — the house term. The German catalogue keeps it untranslated ("Die Principals konnten nicht geladen werden."), so a German operator reads "Principal" here too, and translating it would put two words for one concept on the same screen.
- **The document-type slugs** — `plan`, `documentation`, `examples`, `context` are the wire values the contract stores and filters on. The panel shows a translated label beside them; the slug itself is never rendered.

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
