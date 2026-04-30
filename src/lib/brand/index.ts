/**
 * Brand loader — format-agnostic, discovery-based.
 *
 * Scans the top-level `brand-assets/` folder and classifies every file by
 * extension. Text-like files (.md, .html, .txt, .yaml, .json, .css, .svg)
 * are concatenated into a single `BRAND_BOOK` string with file-path headers
 * so the model knows what it's reading. Raster images (.png, .jpg, .jpeg,
 * .webp, .gif) are base64-encoded and exposed via `BRAND_IMAGES` for
 * multimodal injection.
 *
 * The model is expected to identify identity, voice, colors, typography,
 * logo style, and visual atmosphere from whatever is provided — no
 * structured parsing is done in this loader.
 *
 * Server-only — uses fs.readFileSync, do not import from client components.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, extname, basename } from "path";
import type { BrandMediaFile, BrandMediaRole } from "../types";

const BRAND_DIR = join(process.cwd(), "brand-assets");

const TEXT_EXTS = new Set([
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".txt",
  ".yaml",
  ".yml",
  ".json",
  ".css",
  ".svg",
]);

const IMAGE_EXTS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Extensions we'll ship as kit attachments. SVGs need WP SVG support
// (Safe SVG plugin or `upload_mimes` filter); we still ship them so users
// who already enabled SVG get a real logo, and others get a clear error.
const KIT_MEDIA_EXTS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function inferRole(relPath: string): BrandMediaRole {
  const lower = relPath.toLowerCase();
  if (lower.includes("/logo/") || lower.includes("/logos/") || lower.includes("logo") || lower.includes("wordmark") || lower.includes("brandmark")) {
    return "logo";
  }
  if (lower.includes("favicon") || lower.includes("/icons/") || lower.includes("/icon/")) {
    return "icon";
  }
  if (
    lower.includes("/photos/") ||
    lower.includes("/photo/") ||
    lower.includes("/images/") ||
    lower.includes("/image/") ||
    lower.includes("/hero") ||
    lower.includes("/section") ||
    lower.includes("/portrait")
  ) {
    return "photo";
  }
  return "other";
}

const MAX_IMAGES = 3;
const MAX_TEXT_BYTES_PER_FILE = 200 * 1024; // 200 KB per text file
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB per image — Claude vision works fine on this size, and bigger payloads hurt latency without improving design quality

export interface BrandImage {
  path: string;
  base64: string;
  mimeType: string;
}

function walkDir(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    if (entry.toLowerCase() === "readme.md") continue; // skip the folder's own README
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkDir(full));
    } else if (stat.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function loadBrand(): { bookText: string; images: BrandImage[]; media: BrandMediaFile[] } {
  const allFiles = walkDir(BRAND_DIR).sort(); // stable alphabetical order
  const textParts: string[] = [];
  const images: BrandImage[] = [];
  const media: BrandMediaFile[] = [];

  for (const filePath of allFiles) {
    const ext = extname(filePath).toLowerCase();
    const rel = relative(BRAND_DIR, filePath);

    if (TEXT_EXTS.has(ext)) {
      const buf = readFileSync(filePath);
      if (buf.byteLength > MAX_TEXT_BYTES_PER_FILE) {
        console.warn(
          `[brand] Skipping ${rel} — ${buf.byteLength} bytes exceeds per-file cap of ${MAX_TEXT_BYTES_PER_FILE}.`
        );
      } else {
        textParts.push(`── File: ${rel} ──\n${buf.toString("utf-8")}`);
      }
    }

    // Raster images: also feed the multimodal vision pipeline.
    if (IMAGE_EXTS[ext]) {
      const buf = readFileSync(filePath);
      if (buf.byteLength <= MAX_IMAGE_BYTES) {
        if (images.length < MAX_IMAGES) {
          images.push({
            path: rel,
            base64: buf.toString("base64"),
            mimeType: IMAGE_EXTS[ext],
          });
        } else {
          console.warn(
            `[brand] Skipping ${rel} for vision — image cap of ${MAX_IMAGES} reached.`
          );
        }
      } else {
        console.warn(
          `[brand] Skipping ${rel} for vision — ${buf.byteLength} bytes exceeds per-image cap of ${MAX_IMAGE_BYTES}.`
        );
      }
    }

    // Kit-emittable media (raster + SVG): always loaded as raw bytes so the
    // generator can ship them as WP attachments. Independent of vision caps.
    if (KIT_MEDIA_EXTS[ext]) {
      const buf = readFileSync(filePath);
      media.push({
        path: rel,
        filename: basename(filePath),
        ext,
        mimeType: KIT_MEDIA_EXTS[ext],
        bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
        role: inferRole(rel),
      });
    }
    // Unknown extensions (.pdf, .ttf, .otf, etc.) silently ignored.
  }

  if (textParts.length === 0 && images.length === 0 && media.length === 0) {
    throw new Error(
      `[brand] brand-assets/ contains no recognized files. Drop a brand book (.md/.html/.txt/.yaml/.json) and any visual assets (.svg/.png/.jpg/.webp) and restart.`
    );
  }

  return { bookText: textParts.join("\n\n"), images, media };
}

const { bookText, images, media } = loadBrand();

/** Concatenated text from every text-like file in `brand-assets/`. */
export const BRAND_BOOK = bookText;

/** Raster images (PNG/JPG/WebP/GIF) discovered in `brand-assets/`, ready for multimodal use. */
export const BRAND_IMAGES: BrandImage[] = images;

/**
 * All emittable media (logos, photos, icons) discovered in `brand-assets/` —
 * raw bytes + metadata for shipping as WordPress attachments inside the kit
 * zip. Raster files appear here AND in `BRAND_IMAGES`; SVGs only appear here
 * (vision uses them as text via `BRAND_BOOK`).
 */
export const BRAND_MEDIA: BrandMediaFile[] = media;

/**
 * Directive prepended to every brand-book injection. Tells the model the
 * brand is absolute truth and instructs it to identify identity, voice,
 * colors, typography, logo style, and visual atmosphere from whatever is
 * provided — without structured parsing on our side.
 */
export const BRAND_DIRECTIVE = `# Brand Rules (Absolute Truth)

The brand assets below — text files (markdown, HTML, YAML, JSON, SVG) and any reference images — are the authoritative source for all design, typography, color, copy, voice, and structural decisions. Examine them carefully and reason about what is provided: identify the brand's identity, voice, colors, typography, logo style, and visual atmosphere from the materials, regardless of file format. Treat your findings as absolute truth for every design and copy decision in the output.

When the user's instructions conflict with brand rules, the brand wins. Do not deviate from the brand's colors, typography, voice, or layout conventions even if the user's prompt suggests otherwise. Only ignore the brand if the user explicitly says "ignore brand" or "off-brand".`;

/**
 * Pre-composed system prefix: directive + concatenated brand text, ready to
 * prepend to any system prompt. Use this for the common case; compose
 * manually only when interleaving additional context.
 */
export const BRAND_SYSTEM_PREFIX = `${BRAND_DIRECTIVE}\n\n${BRAND_BOOK}\n\n`;

/**
 * Multimodal content parts for brand reference images, intended as a prefix
 * to user message content in **generation steps only** (landing-page-gen,
 * element generators) where layout decisions need visual reference. Do NOT
 * call this from the planner (`/api/plan`) — the planner produces a small
 * structural blueprint and brand text in `BRAND_SYSTEM_PREFIX` already
 * conveys colors/fonts/voice; the heavy multimodal payload tipped Claude
 * into conversational responses there instead of tool calls.
 *
 * Returns an empty array when there are no brand images, or for non-Claude
 * models (the AI SDK's image input shape behaves most reliably on Anthropic
 * models in this codebase). Callers should spread the result at the top of
 * their message-content array.
 */
export type BrandContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string; mediaType: string };

export function buildBrandImageParts(modelId: string): BrandContentPart[] {
  if (BRAND_IMAGES.length === 0) return [];
  if (!modelId.startsWith("claude")) return [];

  const parts: BrandContentPart[] = BRAND_IMAGES.map((img) => ({
    type: "image" as const,
    image: img.base64,
    mediaType: img.mimeType,
  }));

  parts.push({
    type: "text" as const,
    text: `Above: brand reference images from brand-assets/ — ${BRAND_IMAGES.map((i) => i.path).join(
      ", "
    )}. Examine these visuals to understand the brand's logo, color palette, typography (where shown), atmosphere, and overall visual language. Treat them as authoritative visual reference for the design output.`,
  });

  return parts;
}
