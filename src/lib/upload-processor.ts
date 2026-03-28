/* eslint-disable @typescript-eslint/no-explicit-any */
import type { UploadedFile, UploadedFileKind, UploadContext } from "./types";

// ── Limits ──────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;       // 5 MB per image
const MAX_TEXT_BYTES = 50 * 1024;               // 50 KB per text file
const MAX_ZIP_TEXT_BYTES = 200 * 1024;          // 200 KB total extracted text from ZIP
const MAX_IMAGES = 4;
const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;       // 20 MB total payload

// ── Classification ──────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function classifyFile(name: string, mimeType: string): UploadedFileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  if (IMAGE_EXTENSIONS.has(ext) || IMAGE_MIMES.has(mimeType)) return "image";
  if (ext === "html" || ext === "htm" || mimeType === "text/html") return "html";
  if (ext === "css" || mimeType === "text/css") return "css";
  if (ext === "json" || mimeType === "application/json") return "json";
  if (ext === "zip" || mimeType === "application/zip" || mimeType === "application/x-zip-compressed") return "zip";
  return "text";
}

// ── Processing ──────────────────────────────────────────────────

function truncateText(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  if (encoded.length <= maxBytes) return text;
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return decoder.decode(encoded.slice(0, maxBytes)) + "\n... [truncated]";
}

function summarizeElementorJson(parsed: any): string {
  const lines: string[] = [];

  if (parsed.title) lines.push(`Title: ${parsed.title}`);
  if (parsed.type) lines.push(`Type: ${parsed.type}`);

  if (parsed.content && Array.isArray(parsed.content)) {
    lines.push(`Top-level elements: ${parsed.content.length}`);
    const widgets = extractWidgetTypes(parsed.content);
    if (widgets.length > 0) {
      lines.push(`Widget types used: ${[...new Set(widgets)].join(", ")}`);
    }
  }

  if (parsed.page_settings) {
    lines.push(`Page settings keys: ${Object.keys(parsed.page_settings).join(", ")}`);
  }

  if (parsed.settings) {
    const keys = Object.keys(parsed.settings);
    if (keys.length > 0) {
      lines.push(`Settings: ${keys.slice(0, 20).join(", ")}${keys.length > 20 ? "..." : ""}`);
    }
  }

  return lines.join("\n");
}

function extractWidgetTypes(elements: any[]): string[] {
  const types: string[] = [];
  for (const el of elements) {
    if (el.widgetType) types.push(el.widgetType);
    if (el.elements && Array.isArray(el.elements)) {
      types.push(...extractWidgetTypes(el.elements));
    }
  }
  return types;
}

async function processImageFile(file: File): Promise<UploadedFile> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image "${file.name}" exceeds ${MAX_IMAGE_BYTES / 1024 / 1024}MB limit`);
  }
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return {
    name: file.name,
    kind: "image",
    mimeType: file.type || "image/png",
    sizeBytes: file.size,
    base64,
  };
}

async function processTextFile(file: File, kind: UploadedFileKind): Promise<UploadedFile> {
  const raw = await file.text();
  return {
    name: file.name,
    kind,
    mimeType: file.type || "text/plain",
    sizeBytes: file.size,
    textContent: truncateText(raw, MAX_TEXT_BYTES),
  };
}

async function processJsonFile(file: File): Promise<UploadedFile> {
  const raw = await file.text();
  let textContent: string;

  try {
    const parsed = JSON.parse(raw);
    // Check if this looks like an Elementor export (has content array with elType)
    const isElementor =
      parsed.content && Array.isArray(parsed.content) &&
      parsed.content.some((el: any) => el.elType);

    if (isElementor) {
      textContent = `[Elementor Export]\n${summarizeElementorJson(parsed)}`;
      // Also include the raw JSON but truncated
      textContent += `\n\nRaw JSON:\n${truncateText(JSON.stringify(parsed, null, 2), MAX_TEXT_BYTES - textContent.length)}`;
    } else {
      textContent = truncateText(JSON.stringify(parsed, null, 2), MAX_TEXT_BYTES);
    }
  } catch {
    // Invalid JSON — treat as raw text
    textContent = truncateText(raw, MAX_TEXT_BYTES);
  }

  return {
    name: file.name,
    kind: "json",
    mimeType: "application/json",
    sizeBytes: file.size,
    textContent,
  };
}

async function processZipFile(file: File): Promise<UploadedFile> {
  const JSZip = (await import("jszip")).default;
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const extractedParts: string[] = [];
  let totalTextBytes = 0;

  // Sort entries to prioritize key files (manifest, site-settings, etc.)
  const entries = Object.entries(zip.files).sort(([a], [b]) => {
    const priority = (name: string) => {
      if (name.includes("manifest")) return 0;
      if (name.includes("site-settings")) return 1;
      if (name.endsWith(".json")) return 2;
      if (name.endsWith(".html") || name.endsWith(".css")) return 3;
      return 4;
    };
    return priority(a) - priority(b);
  });

  for (const [path, entry] of entries) {
    if (entry.dir) continue;
    if (totalTextBytes >= MAX_ZIP_TEXT_BYTES) break;

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const isText = ["json", "html", "htm", "css", "txt", "md", "xml", "yaml", "yml"].includes(ext);
    if (!isText) continue;

    try {
      const content = await entry.async("string");
      const remaining = MAX_ZIP_TEXT_BYTES - totalTextBytes;
      const truncated = truncateText(content, Math.min(remaining, MAX_TEXT_BYTES));
      extractedParts.push(`--- ${path} ---\n${truncated}`);
      totalTextBytes += new TextEncoder().encode(truncated).length;
    } catch {
      // Skip files that can't be read as text
    }
  }

  return {
    name: file.name,
    kind: "zip",
    mimeType: "application/zip",
    sizeBytes: file.size,
    textContent: extractedParts.join("\n\n") || "[Empty or binary-only ZIP archive]",
  };
}

// ── Public API ──────────────────────────────────────────────────

export async function processUploadedFile(file: File): Promise<UploadedFile> {
  const kind = classifyFile(file.name, file.type);

  switch (kind) {
    case "image":
      return processImageFile(file);
    case "json":
      return processJsonFile(file);
    case "zip":
      return processZipFile(file);
    default:
      return processTextFile(file, kind);
  }
}

export function buildUploadContext(files: UploadedFile[]): UploadContext {
  return {
    images: files.filter((f) => f.kind === "image"),
    documents: files.filter((f) => f.kind !== "image"),
  };
}

export function validateUploadLimits(files: File[]): string | null {
  if (files.length > MAX_FILES) {
    return `Too many files: ${files.length} uploaded, maximum is ${MAX_FILES}`;
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return `Total upload size (${(totalBytes / 1024 / 1024).toFixed(1)}MB) exceeds ${MAX_TOTAL_BYTES / 1024 / 1024}MB limit`;
  }

  const imageCount = files.filter((f) => classifyFile(f.name, f.type) === "image").length;
  if (imageCount > MAX_IMAGES) {
    return `Too many images: ${imageCount} uploaded, maximum is ${MAX_IMAGES}`;
  }

  return null;
}
