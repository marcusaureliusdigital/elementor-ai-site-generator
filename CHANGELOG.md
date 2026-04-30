# Changelog

A curated log of significant changes to the Elementor Website Builder.
Newest entries at the top. For routine changes, see `git log`.

The intent of this file is to capture **why** a change was made and **what failure mode it prevents** — not what it changes (the diff already shows that). When the same problem class recurs, expand the relevant entry rather than adding a new one.

---

## 2026-04-30 — Round 2 quality pass after first successful import (Natalia kit)

The first end-to-end import succeeded earlier this day. Brand voice, colors, typography, recursive tree shape, manifest/WXR consistency all landed. Eleven distinct gaps surfaced once the kit imported cleanly; this round addressed all of them.

**The four areas of change:**

1. **Media pipeline (net-new infrastructure).** Logos and brand photos were never emitted into the kit zip — every image widget shipped with `placehold.co` URLs. Now [src/lib/brand/index.ts](src/lib/brand/index.ts) exports `BRAND_MEDIA` (raw bytes + role inference), [src/lib/generator/media-gen.ts](src/lib/generator/media-gen.ts) builds a `MediaPlan` (attachment IDs, slugs, zip paths, primary-logo selection), [src/lib/generator/wxr-gen.ts](src/lib/generator/wxr-gen.ts) emits `<wp:post_type>attachment</wp:post_type>` items with `_wp_attached_file`/`_wp_attachment_metadata` postmeta, [src/lib/zip-bundler.ts](src/lib/zip-bundler.ts) copies binary files into `wp-content/uploads/YYYY/MM/`, and [src/lib/generator/site-settings-gen.ts](src/lib/generator/site-settings-gen.ts) wires `custom_logo`/`site_icon` to the chosen logo's attachment ID. **Why this is the right place to land styling defaults** — the form widget delegates colors/typography to `__globals__` (verified against [reference-exports/site-kits/marketing-blog/templates/126.json](reference-exports/site-kits/marketing-blog/templates/126.json)), so per-widget overrides are unnecessary when the global defaults are correct. Forms now inherit brand colors automatically.

2. **Page depth + conversion structure.** Main pages averaged 3–5 sections — too thin for conversion sites that need pain-point → benefit → proof → CTA flow. [src/lib/prompts/plan-system.ts](src/lib/prompts/plan-system.ts) now requires 6–10 sections for conversion pages (3–6 for utility pages), with new vocabulary: `pain-points`, `benefits`, `how-it-works`, `social-proof`. [src/lib/generator/page-content-gen.ts](src/lib/generator/page-content-gen.ts) enriches per-section guidance — hero gets WOW direction (italic emphasis word, brand-photo background, 80–95vh min-height); multi-column sections (features, services, portfolio, pain-points, benefits) are explicitly told to use `container_type: "grid"` with the verified shape; conversion pages get a closing-CTA enforcement paragraph.

3. **Theme builder fixes.** Both single templates were defaulting to `single-post` — CPT singles should land under Theme Builder → Single Page, not Single Post. [reference-exports/site-kits/travel-blog/manifest.json](reference-exports/site-kits/travel-blog/manifest.json) confirmed the split: blog posts → `single-post`, CPT singles → `single-page`. [src/app/api/plan/route.ts](src/app/api/plan/route.ts) now emits `single-page` for CPT singles; [src/lib/generator/template-gen.ts](src/lib/generator/template-gen.ts) gained a `single-page` case (no author-box/share-buttons/related-posts — those are post-specific). Archives were broken because the prompt suggested either `posts` widget OR `loop-grid`; the model defaulted to `posts`. The reference (marketing-blog/templates/385.json) uses `loop-grid` exclusively with `template_id` as a STRING. Archive prompt now mandates `loop-grid` and resolves the loop-item template ID via `findLoopItemForArchive` (matches archive title to its corresponding loop-item template). Generation order changed: loop-items generate first so archives can reference their IDs. Header is no longer bare — richer prompt instructs three-region layout (logo / nav / optional CTA), nav-menu styling tied to brand typography, and the logo attachment ID is threaded through to `theme-site-logo`.

4. **Widget configuration gaps.** Icon-list was emitting incomplete shapes (missing `selected_icon`, missing per-item `_id`). [src/lib/prompts/template-system.ts](src/lib/prompts/template-system.ts) now documents the full schema — every item needs its own `_id` (8-char hex, distinct from the parent widget) and a non-empty `selected_icon.value` + `library` (FontAwesome 5: `fa-solid` / `fa-regular` / `fa-brands`). Grid containers had no documentation at all in the system prompt; now the exact shape from [reference-exports/site-kits/marketing-blog/templates/385.json](reference-exports/site-kits/marketing-blog/templates/385.json) is documented including `presetTitle`/`presetIcon`/`grid_gaps` (note: `grid_gaps` uses `{column, row, isLinked, unit}`, NOT the `flex_gap` shape) and a "when to use grid vs flex" paragraph. Mega-menu reference added for richer headers.

**Honest scope note for non-logo media.** When the brand has no photography under `brand-assets/` (only logos), hero and section image widgets continue to fall back to `placehold.co`. AI-generated stock photography is intentionally out of scope this round. The improvement here is: **logo always works** (when present), and any future brand with photos automatically benefits without further changes.

**Verified shape gotchas worth keeping.** Three subtleties from the reference exports — preserved here so future regressions are obvious:
- `loop-grid.template_id` is a **string**, not a number. `template_id: "157"` works, `template_id: 157` does not.
- Grid containers MUST include `presetTitle: "Grid"` and `presetIcon: "eicon-container-grid"` — without these, Elementor renders the grid as flex.
- `grid_gaps` has shape `{column: "24", row: "24", isLinked: true, unit: "px"}` — totally different from `flex_gap: {unit: "px", size: 20, column: 20}`.

**Verification:** `npx tsc --noEmit`, `npx eslint src`, `npx next build` all pass clean. Manual smoke: dev server starts in 451ms, app loads in browser.

---

## 2026-04-30 — Site kit import was producing blank pages in Elementor Pro

**Symptoms reported:** Generated kits imported structurally (Elementor's importer didn't crash) but pages rendered blank. Some templates partially imported (e.g. footer rendered, single-post didn't). About 80% of generated artifacts silently dropped.

**Root causes (three compounding bugs):**

1. **Flat element trees.** The Zod schema in `src/lib/generator/generate-elements.ts` had `elements: z.array(z.any()).optional().describe("Child elements following the same flat structure")`. The "flat structure" description and the non-recursive `z.array(z.any())` caused Anthropic's structured-output path to emit every element as a top-level sibling with empty `elements: []`. Elementor needs a recursive tree.
2. **Phantom manifest IDs.** `manifest.json` was built from `blueprint.pages` / `blueprint.templates`, not from successfully-generated files. When per-page LLM calls failed, the manifest still listed those IDs. Elementor's importer choked on missing files.
3. **Missing `settings.template`.** Page wrappers shipped with `"settings": {}`. Without `{"template": "default", "hide_title": "yes"}`, WordPress rendered the page through the active theme's `page.php`, which calls `the_content()` against an empty `post_content` field. Elementor data lives in post-meta, so the page rendered blank even when the JSON was structurally correct.

**Fixes (in commit order):**

- **`generate-elements.ts`** — initially tried `z.lazy()` for a recursive schema. The Vercel AI SDK's JSON-Schema converter rejected it with `Circular reference detected in schema definitions: __schema0 -> __schema0`. Final fix: switched to `generateText` + `JSON.parse` for both Claude and Gemini. The recursive shape comes through naturally as the LLM writes it. **Do not reintroduce `z.lazy()` here without first confirming the SDK accepts it end-to-end.**
- **`page-content-gen.ts`, `template-gen.ts`** — call `cleanLlmJson()` from `post-processor.ts` between the LLM call and validation, picking up widget-type fixes, background/typography activation, and dimension-object normalization that were previously dead code on this path.
- **`post-processor.ts`** — added `validateTreeShape()` to `validateTemplateJson`. Rejects output if any top-level element is a widget OR if 2+ top-level containers all have empty `elements`. Triggers retry-with-feedback so the LLM gets a concrete error message and re-emits.
- **`index.ts`, `manifest-gen.ts`, `types.ts`, `job-store.ts`** — manifest is now filtered to only IDs of templates/pages whose files actually generated (status === "done"). Failures surface as `JobState.warnings` (visible to the UI). Job stays partial-success rather than failing the whole kit.
- **`page-content-gen.ts`** — page wrapper now forces `settings: {"template": "default", "hide_title": "yes"}` and `metadata: []` after generation. Matches what `marketing-blog/content/page/7.json` ships.

**Reference kits added** under `reference-exports/site-kits/`: `elementor 1` and `elementor 2` (direct from Elementor Pro template library, v2.0 manifest schema). These confirmed: top-level is always all-containers (never widgets), `manifest.content.page` count == on-disk file count, and trees are deeply recursive.

**Verification:** Three invariants must hold for a kit to import correctly. See `CLAUDE.md` "Known pitfalls — do not regress" for the checklist and one-liner verification commands.

### 2026-04-30 (follow-up) — WXR shipped orphan WP page records when LLM page generation failed

A user-reported import showed every page rendering blank with a working header/footer. Inspection of the kit confirmed all 5 templates generated, **0 of 6 pages did**, and the `content/page/` directory was missing entirely. The prior manifest filter correctly excluded the failed page IDs, but `wp-content/page/page.xml` and the nav menu still listed all 6 pages. WordPress imported the page records with no Elementor JSON to back them, so they rendered as blank theme pages — exactly the symptom the prior fix was supposed to prevent.

**Fourth failure mode** (compounds with the previous three):

4. **Orphan WP records.** [src/lib/generator/wxr-gen.ts](src/lib/generator/wxr-gen.ts) iterated `blueprint.pages` unconditionally for both page WXR items and nav menu items, while [src/lib/generator/index.ts](src/lib/generator/index.ts) only computed the success set in Phase 5 (manifest), after WXR had already run. Result: WXR shipped page records for failures, manifest correctly excluded them, and the user got blank theme-rendered pages.

**Fixes:**

- **`wxr-gen.ts`** — `WxrGenOptions` now requires `generatedPageIds: Set<string>`. Page WXR items and nav menu items are filtered to that set. CPT WXR is unchanged (deterministic, not LLM-generated).
- **`index.ts`** — success-set computation hoisted out of Phase 5 to run before Phase 4 (WXR). Phase 5 reuses the already-computed sets. WXR is given the filter, so failed pages don't ship as WP records.
- **`index.ts` fail-fast** — when `blueprint.pages.length > 0 && generatedPageIds.size === 0`, the job ends `status: "error"` with warnings populated, before WXR/manifest/zip. Download is blocked at [src/app/api/download/route.ts](src/app/api/download/route.ts) by the existing `status !== "complete"` guard. No new job state.
- **`status/route.ts`** — now returns `warnings` on the response. Was set in `JobState` but never read by the client.
- **`download-ready.tsx`** — fetches `/api/status` on mount and renders a yellow banner above the download button listing per-item failures when any exist. Partial-success kits download with the user informed.
- **`generation-progress.tsx`** — when a job ends in `error`, the per-item warning list is shown in a collapsed `<details>` so the user can see *which* items failed and why.

**Fifth verification invariant** (added to the existing three): every `<wp:post_id>` in `wp-content/page/page.xml` must appear in `manifest.content.page`. One-liner in CLAUDE.md.

**Out of scope (not changed):** the page prompt at [src/lib/generator/page-content-gen.ts](src/lib/generator/page-content-gen.ts) is more open-ended than the docType-specific template prompts and is a probable contributor to systematic page failure. Without server-side logs from the failing run we can't confirm the cause, and shipping a prompt change on guesswork is the wrong move. The new warning surface gives us per-page error reasons on the next failure — diagnose first, then harden.
