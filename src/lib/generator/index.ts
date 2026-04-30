import type { ModelId } from "../ai-provider";
import { IdManager } from "../id-manager";
import {
  createJob,
  getJob,
  setJobStatus,
  setJobWarnings,
  setJobMediaFiles,
  registerFile,
  setFileContent,
  setFileError,
  setFileGenerating,
} from "../job-store";
import { generateSiteSettings } from "./site-settings-gen";
import { generateManifest, type ManifestContext } from "./manifest-gen";
import { generateTaxonomies } from "./taxonomy-gen";
import { generateWxrFiles, type WxrGenResult } from "./wxr-gen";
import { generateCustomCode } from "./custom-code-gen";
import { generateCustomFonts } from "./custom-fonts-gen";
import { generateTemplate } from "./template-gen";
import { generatePageContent } from "./page-content-gen";
import { buildMediaPlan } from "./media-gen";
import { BRAND_MEDIA } from "../brand";
import type { SiteBlueprint } from "../types";

/**
 * Main orchestrator — generates a complete Elementor Site Kit from a blueprint.
 *
 * Generation order (dependency graph):
 * 1. Parallel/deterministic: site-settings, custom-code, custom-fonts, taxonomies
 * 2. Sequential LLM: templates (header → footer → singles → archives → loop-items → 404)
 * 3. Sequential LLM: page content JSONs
 * 4. Deterministic: WXR XML files
 * 5. Deterministic: manifest.json (needs all IDs from above)
 */

export async function generateSiteKit(
  jobId: string,
  blueprint: SiteBlueprint,
  modelId: ModelId = "claude-opus-4-7"
): Promise<void> {
  createJob(jobId, blueprint);
  const idMgr = new IdManager(500); // start post IDs at 500 to avoid conflicts

  // ── Register all files ─────────────────────────────────────────

  registerFile(jobId, "site-settings", "Site Settings");
  registerFile(jobId, "custom-code", "Custom Code");
  registerFile(jobId, "custom-fonts", "Custom Fonts");

  // Taxonomies
  registerFile(jobId, "tax:nav_menu", "Nav Menu Taxonomy");
  if (blueprint.categories.length > 0) {
    const taxNames = new Set(blueprint.categories.map((c) => c.taxonomy));
    for (const tax of taxNames) {
      registerFile(jobId, `tax:${tax}`, `${tax} Taxonomy`);
    }
  }

  // Templates
  for (const tpl of blueprint.templates) {
    registerFile(jobId, `template:${tpl.id}`, tpl.title);
  }

  // Pages
  for (const page of blueprint.pages) {
    registerFile(jobId, `page:${page.id}`, `${page.title} Page Content`);
  }

  // WXR files
  registerFile(jobId, "wxr:page", "Pages WXR");
  registerFile(jobId, "wxr:nav_menu_item", "Nav Menu Items WXR");
  if (blueprint.hasBlog) {
    registerFile(jobId, "wxr:post", "Blog Posts WXR");
  }
  for (const cpt of blueprint.customPostTypes) {
    registerFile(jobId, `wxr:${cpt.name}`, `${cpt.label} WXR`);
  }

  registerFile(jobId, "manifest", "Manifest");

  // ── Start generation ───────────────────────────────────────────

  setJobStatus(jobId, "generating");

  try {
    // ── Phase 0: Media plan (deterministic, runs first) ──────────
    //
    // Allocates attachment IDs and stages brand-asset files for the kit zip.
    // Built up-front so site-settings can reference the logo (`custom_logo`)
    // and downstream prompts can pass real attachment URLs to the model.

    const mediaPlan = buildMediaPlan(blueprint, BRAND_MEDIA, idMgr);
    if (mediaPlan.attachments.length > 0) {
      registerFile(jobId, "wxr:attachment", "Media Attachments WXR");
    }
    if (mediaPlan.files.length > 0) {
      setJobMediaFiles(jobId, mediaPlan.files);
    }

    // ── Phase 1: Deterministic files ─────────────────────────────

    // Site settings
    setFileGenerating(jobId, "site-settings");
    const { json: siteSettingsJson, ids: settingsIds } = generateSiteSettings(
      blueprint,
      idMgr,
      mediaPlan
    );
    setFileContent(jobId, "site-settings", siteSettingsJson);

    // Custom code & fonts
    setFileGenerating(jobId, "custom-code");
    setFileContent(jobId, "custom-code", generateCustomCode());

    setFileGenerating(jobId, "custom-fonts");
    setFileContent(jobId, "custom-fonts", generateCustomFonts());

    // Taxonomies
    setFileGenerating(jobId, "tax:nav_menu");
    const taxonomies = generateTaxonomies(blueprint, idMgr);
    for (const [name, content] of Object.entries(taxonomies)) {
      setFileContent(jobId, `tax:${name}`, content);
    }

    // ── Phase 2: Templates (LLM, sequential) ─────────────────────

    // Sort templates so loop-items generate FIRST — archives need their IDs
    // to wire `loop-grid template_id`. Then header → footer → singles →
    // archive → 404. (Header gets the logo attachment; everyone else is
    // independent.)
    const sortedTemplates = [...blueprint.templates].sort((a, b) => {
      const order: Record<string, number> = {
        "loop-item": 0,
        header: 1,
        footer: 2,
        "single-post": 3,
        "single-page": 4,
        archive: 5,
        "error-404": 6,
      };
      return (order[a.docType] ?? 10) - (order[b.docType] ?? 10);
    });

    // Build template ID map incrementally so archives that come after their
    // matching loop-items can resolve `template_id` references.
    const templateIdMap: Record<string, number> = {};
    for (const tpl of blueprint.templates) {
      templateIdMap[tpl.title] = tpl.id;
    }

    for (const tpl of sortedTemplates) {
      setFileGenerating(jobId, `template:${tpl.id}`);
      try {
        const templateJson = await generateTemplate(
          tpl,
          blueprint,
          idMgr,
          settingsIds,
          templateIdMap,
          mediaPlan,
          modelId
        );
        setFileContent(jobId, `template:${tpl.id}`, templateJson);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setFileError(jobId, `template:${tpl.id}`, msg);
        console.error(`Failed to generate template ${tpl.title}:`, msg);
      }
    }

    // ── Phase 3: Page Content (LLM, sequential) ──────────────────

    for (const page of blueprint.pages) {
      setFileGenerating(jobId, `page:${page.id}`);
      try {
        const pageJson = await generatePageContent(
          page,
          blueprint,
          idMgr,
          settingsIds,
          templateIdMap,
          mediaPlan,
          modelId
        );
        setFileContent(jobId, `page:${page.id}`, pageJson);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setFileError(jobId, `page:${page.id}`, msg);
        console.error(`Failed to generate page ${page.title}:`, msg);
      }
    }

    // ── Compute success sets (used by WXR + manifest) ────────────
    //
    // Both WXR and manifest must reflect only the templates/pages that
    // actually generated, so Elementor's importer never sees an ID without
    // backing content and WP never imports a page record without Elementor
    // JSON to render. Computed here, before Phase 4, so WXR can filter.

    const jobAfterContent = getJob(jobId);
    const generatedTemplateIds = new Set<string>();
    const generatedPageIds = new Set<string>();
    const warnings: string[] = [];

    if (jobAfterContent) {
      for (const tpl of blueprint.templates) {
        const file = jobAfterContent.files[`template:${tpl.id}`];
        if (file && file.status === "done") {
          generatedTemplateIds.add(String(tpl.id));
        } else {
          warnings.push(
            `Template "${tpl.title}" (id ${tpl.id}) failed to generate — excluded from manifest. Reason: ${file?.error ?? "unknown"}`
          );
        }
      }
      for (const page of blueprint.pages) {
        const file = jobAfterContent.files[`page:${page.id}`];
        if (file && file.status === "done") {
          generatedPageIds.add(String(page.id));
        } else {
          warnings.push(
            `Page "${page.title}" (id ${page.id}) failed to generate — excluded from manifest. Reason: ${file?.error ?? "unknown"}`
          );
        }
      }
    }

    // Fail-fast when every page failed: the kit would import as a set of
    // blank-rendering WP pages with working header/footer only — worse than
    // returning nothing, because it pollutes the user's WP install with
    // empty page records that have to be deleted by hand.
    if (blueprint.pages.length > 0 && generatedPageIds.size === 0) {
      if (warnings.length > 0) {
        console.warn("Site kit generation warnings:", warnings);
        setJobWarnings(jobId, warnings);
      }
      setJobStatus(
        jobId,
        "error",
        "All page generations failed — kit would import as blank pages. See warnings for per-page errors."
      );
      return;
    }

    // ── Phase 4: WXR Files (deterministic) ───────────────────────

    setFileGenerating(jobId, "wxr:page");
    const wxrResult: WxrGenResult = generateWxrFiles({
      blueprint,
      idMgr,
      generatedPageIds,
      mediaPlan,
    });

    for (const [path, content] of Object.entries(wxrResult.files)) {
      // path is like "page/page", "post/post", "nav_menu_item/nav_menu_item"
      const key = `wxr:${path.split("/")[0]}`;
      setFileContent(jobId, key, content);
    }

    // ── Phase 5: Manifest (deterministic, last) ──────────────────

    setFileGenerating(jobId, "manifest");

    const manifestContext: ManifestContext = {
      navMenuItemIds: wxrResult.navMenuItemIds,
      wpContentItems: wxrResult.wpContentItems,
      generatedTemplateIds,
      generatedPageIds,
    };
    const manifestJson = generateManifest(blueprint, manifestContext);
    setFileContent(jobId, "manifest", manifestJson);

    // ── Complete ─────────────────────────────────────────────────
    //
    // Set warnings BEFORE flipping status to "complete" so the next status
    // poll sees both atomically — the client renders the warning banner on
    // the same response that surfaces "ready to download".
    if (warnings.length > 0) {
      console.warn("Site kit generation warnings:", warnings);
      setJobWarnings(jobId, warnings);
    }

    setJobStatus(jobId, "complete");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    setJobStatus(jobId, "error", msg);
    console.error("Site kit generation failed:", msg);
  }
}
