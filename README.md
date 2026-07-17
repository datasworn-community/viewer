# @datasworn-community/viewer

Web viewer for [Datasworn](https://github.com/datasworn-community/datasworn) content — browse rulesets, roll on oracles, and follow entity links across expansions.

- **Deployed:** https://datasworn-community.github.io/viewer/
- **Consumes:** `@datasworn-community/core` for types + every published `@datasworn-community/*` content package (see [`package.json`](./package.json)) via ES module imports. Each ruleset is loaded on-demand via a dynamic import, so the initial page load stays small.

## Development

```sh
bun install
bun run dev            # http://localhost:3000
bun run build          # production bundle in dist/
bun run test           # vitest with jsdom
bun run preview        # serve the production bundle locally
```

## Features

- Ruleset picker for Ironsworn / Delve / Lodestar / Starforged / Sundered Isles + community expansions (Starsmith, Ironsmith, and more as they publish)
- Full-tree navigation of moves, oracles, assets, delve sites, atlas entries, truths, and NPCs
- Interactive oracle rolls with match detection and roll history
- Follows `datasworn:` cross-entity links (moves → oracles → assets, etc.)
- Markdown safely rendered via DOMPurify — arbitrary HTML in oracle text can't XSS the page

## Schema versions — single-line-at-a-time policy

The viewer pins to **one Datasworn schema line at a time**. The version bundled here matches `@datasworn-community/core`'s current schema version; content packages that ship for a different schema line aren't loaded.

Why: rulesets on different schema lines have different validated shapes. Loading them side-by-side would need per-package version-branching in every renderer — not worth it unless there's real cross-line-playset demand (there isn't yet).

Recommended flow when core bumps its schema line:

1. Bump the viewer's `@datasworn-community/core` dependency to the new line.
2. Bump every `@datasworn-community/<ruleset>` dependency to a version on the same line. Content packages that haven't caught up get dropped from `RULESETS` in [`src/utils/loader.ts`](./src/utils/loader.ts) with a `TODO` comment until they publish.
3. Release a new viewer version. Users who need to browse content on the old schema line install the previous viewer release.

Practical note: the loader tolerates missing packages gracefully (dynamic import failure → `console.warn`, ruleset omitted from the picker). So the "bump the line even if some rulesets lag" case degrades to "some rulesets temporarily not shown" rather than a broken build.

## Adding a new ruleset

When a new content package publishes to npm, add it to two places:

1. `package.json` — as a `dependencies` entry. Note that community package names on npm are **hyphenated** (e.g. `@datasworn-community/fe-runners`, `@datasworn-community/ancient-wonders`) even though the ruleset ids in `RULESETS` use underscores (`fe_runners`, `ancient_wonders`) to match the JSON `_id`.
2. [`src/utils/loader.ts`](./src/utils/loader.ts) — a new entry in the `RULESETS` array with the package's dynamic import.

Vite's route-based code splitting will handle the rest.

## Provenance

Ported from [`tbsvttr/datasworn` `tools/viewer/`](https://github.com/tbsvttr/datasworn/tree/main/tools/viewer) as part of the fork's deprecation. Original data-loading path (fetch from a co-located `datasworn/` directory) replaced with published-package ES imports so the app is fully standalone and doesn't rely on a monorepo layout.
