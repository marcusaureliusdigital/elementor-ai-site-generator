import type { ModelId } from "../ai-provider";
import { IdManager } from "../id-manager";
import {
  createJob,
  getJob,
  setJobStatus,
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
  modelId: ModelId = "claude-opus-4-6"
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
    // ── Phase 1: Deterministic files ─────────────────────────────

    // Site settings
    setFileGenerating(jobId, "site-settings");
    const { json: siteSettingsJson, ids: settingsIds } = generateSiteSettings(
      blueprint,
      idMgr
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

    // Sort templates: header first, footer second, then rest
    const sortedTemplates = [...blueprint.templates].sort((a, b) => {
      const order: Record<string, number> = {
        header: 0,
        footer: 1,
        "single-post": 2,
        archive: 3,
        "loop-item": 4,
        "error-404": 5,
      };
      return (order[a.docType] ?? 10) - (order[b.docType] ?? 10);
    });

    for (const tpl of sortedTemplates) {
      setFileGenerating(jobId, `template:${tpl.id}`);
      try {
        const templateJson = await generateTemplate(
          tpl,
          blueprint,
          idMgr,
          settingsIds,
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

    // Build template ID map for loop-carousel references
    const templateIdMap: Record<string, number> = {};
    for (const tpl of blueprint.templates) {
      templateIdMap[tpl.title] = tpl.id;
    }

    for (const page of blueprint.pages) {
      setFileGenerating(jobId, `page:${page.id}`);
      try {
        const pageJson = await generatePageContent(
          page,
          blueprint,
          idMgr,
          settingsIds,
          templateIdMap,
          modelId
        );
        setFileContent(jobId, `page:${page.id}`, pageJson);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setFileError(jobId, `page:${page.id}`, msg);
        console.error(`Failed to generate page ${page.title}:`, msg);
      }
    }

    // ── Phase 4: WXR Files (deterministic) ───────────────────────

    setFileGenerating(jobId, "wxr:page");
    const wxrResult: WxrGenResult = generateWxrFiles({
      blueprint,
      idMgr,
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
    };
    const manifestJson = generateManifest(blueprint, manifestContext);
    setFileContent(jobId, "manifest", manifestJson);

    // ── Phase 6: Cross-reference validation ──────────────────────

    const manifestData = JSON.parse(manifestJson);
    const warnings: string[] = [];

    const currentJob = getJob(jobId);

    // Check template IDs in manifest vs generated files
    if (manifestData.templates && currentJob) {
      for (const tplId of Object.keys(manifestData.templates)) {
        const fileKey = `template:${tplId}`;
        const file = currentJob.files[fileKey];
        if (!file || file.status !== "done") {
          warnings.push(`Template ${tplId} in manifest but not generated`);
        }
      }
    }

    // Check page IDs in manifest vs generated content
    if (manifestData.content?.page && currentJob) {
      for (const pageId of Object.keys(manifestData.content.page)) {
        const fileKey = `page:${pageId}`;
        const file = currentJob.files[fileKey];
        if (!file || file.status !== "done") {
          warnings.push(`Page ${pageId} in manifest but content not generated`);
        }
      }
    }

    if (warnings.length > 0) {
      console.warn("Cross-reference warnings:", warnings);
    }

    // ── Complete ─────────────────────────────────────────────────

    setJobStatus(jobId, "complete");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    setJobStatus(jobId, "error", msg);
    console.error("Site kit generation failed:", msg);
  }
}
