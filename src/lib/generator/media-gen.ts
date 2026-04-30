import type { BrandMediaFile, MediaPlan, AttachmentRecord, SiteBlueprint } from "../types";
import { IdManager } from "../id-manager";

/**
 * Builds the MediaPlan for a kit: takes brand-asset files (logos, photos,
 * icons), allocates WP attachment IDs, and produces the metadata + zip-bound
 * file copies needed to ship them as WordPress media library entries.
 *
 * The plan is purely deterministic — no LLM. Downstream generators (WXR,
 * site-settings, page/template prompts) consume `MediaPlan` to:
 *  - emit `<wp:post_type>attachment</wp:post_type>` items in WXR
 *  - set `custom_logo` / `site_icon` on the customizer
 *  - tell prompts which real images they can reference (`bySlug`)
 *
 * SVG note: WordPress core blocks SVG uploads by default. We still include
 * SVGs as attachments — users with Safe SVG (or a `upload_mimes` filter) get
 * a real logo on import; users without will see an MIME-type error during
 * import and can either install Safe SVG or supply a PNG/JPG logo. We do not
 * rasterize on the server (no native deps in this project; vector-perfect
 * logos win when SVG is enabled).
 */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "") // strip extension
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
}

function uploadDateFolder(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}`;
}

function pickPrimaryLogo(media: BrandMediaFile[]): BrandMediaFile | undefined {
  const logos = media.filter((m) => m.role === "logo");
  if (logos.length === 0) return undefined;
  // Prefer wordmark/lockup over single-mark icons; prefer non-white (visible
  // on light backgrounds) over white-only variants. Falls back to the first.
  const score = (m: BrandMediaFile) => {
    const lower = m.filename.toLowerCase();
    let s = 0;
    if (lower.includes("wordmark") || lower.includes("lockup")) s += 4;
    if (lower.includes("primary") || lower.includes("main")) s += 2;
    if (lower.includes("white") || lower.includes("inverse")) s -= 3;
    if (m.ext === ".svg") s += 1; // vector preferred when available
    return s;
  };
  return [...logos].sort((a, b) => score(b) - score(a))[0];
}

export function buildMediaPlan(
  blueprint: SiteBlueprint,
  brandMedia: BrandMediaFile[],
  idMgr: IdManager
): MediaPlan {
  const attachments: AttachmentRecord[] = [];
  const files: { path: string; bytes: Uint8Array }[] = [];
  const bySlug: Record<string, AttachmentRecord> = {};
  const usedSlugs = new Set<string>();

  const folder = uploadDateFolder();
  const baseUrl = blueprint.siteUrl.replace(/\/$/, "");

  const primaryLogo = pickPrimaryLogo(brandMedia);
  let logoAttachmentId: number | undefined;

  for (const m of brandMedia) {
    let slug = slugify(m.filename);
    let unique = slug;
    let n = 1;
    while (usedSlugs.has(unique)) {
      unique = `${slug}-${n++}`;
    }
    slug = unique;
    usedSlugs.add(slug);

    const id = idMgr.allocatePostId();
    const filename = `${slug}${m.ext}`;
    const zipPath = `wp-content/uploads/${folder}/${filename}`;
    const url = `${baseUrl}/${zipPath}`;

    const record: AttachmentRecord = {
      id,
      slug,
      filename,
      url,
      zipPath,
      mimeType: m.mimeType,
      width: 0,
      height: 0,
      role: m.role,
      title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };

    attachments.push(record);
    bySlug[slug] = record;
    files.push({ path: zipPath, bytes: m.bytes });

    if (primaryLogo && m.path === primaryLogo.path) {
      logoAttachmentId = id;
    }
  }

  return {
    attachments,
    files,
    logoAttachmentId,
    bySlug,
  };
}

/**
 * Renders the MediaPlan as a prompt-ready listing so the model can reference
 * real attachment URLs instead of placehold.co. Returns "" when the plan is
 * empty so prompts read cleanly.
 */
export function formatMediaForPrompt(plan: MediaPlan): string {
  if (plan.attachments.length === 0) return "";
  const lines = plan.attachments.map(
    (a) =>
      `- ${a.slug} (role: ${a.role}, id: ${a.id}) — url: ${a.url}`
  );
  return `Available media (use these REAL URLs in image widgets and container backgrounds — only fall back to https://placehold.co/WIDTHxHEIGHT when no listed asset matches):\n${lines.join("\n")}`;
}
