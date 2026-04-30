// ── Generation Mode ─────────────────────────────────────────────

export type GenerationMode = "website" | "landing-page";

// ── Upload Types ────────────────────────────────────────────────

export type UploadedFileKind = "image" | "html" | "css" | "json" | "zip" | "text";

export interface UploadedFile {
  name: string;
  kind: UploadedFileKind;
  mimeType: string;
  sizeBytes: number;
  base64?: string;       // images only — for multimodal LLM vision
  textContent?: string;  // non-images — extracted text for prompt injection
}

export interface UploadContext {
  images: UploadedFile[];    // sent as image parts to the LLM
  documents: UploadedFile[]; // injected as text context in the user prompt
}

// ── Blueprint Types ──────────────────────────────────────────────

export interface SiteBlueprint {
  name: string;
  slug: string;
  title: string;
  description: string;
  siteUrl: string;
  author: {
    name: string;
    login: string;
    email: string;
  };
  colors: SiteColors;
  typography: SiteTypography;
  pages: PageDef[];
  posts: PostDef[];
  customPostTypes: CptDef[];
  categories: CategoryDef[];
  templates: TemplateDef[];
  plugins: PluginDef[];
  hasContactForm: boolean;
  hasBlog: boolean;
  socialLinks: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
    pinterest?: string;
  };
}

export interface SiteColors {
  primary: string;
  secondary: string;
  text: string;
  accent: string;
  background: string;
  black: string;
  white: string;
}

export interface SiteTypography {
  headingFont: string;
  bodyFont: string;
}

export interface PageDef {
  id: number;
  title: string;
  slug: string;
  isHome: boolean;
  sections: string[];
}

export interface PostDef {
  id: number;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
}

export interface CptDef {
  name: string;
  label: string;
  singularLabel: string;
  fields: CptFieldDef[];
  posts: CptPostDef[];
}

export interface CptFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "image" | "date" | "relationship";
  fieldId: string;
}

export interface CptPostDef {
  id: number;
  title: string;
  slug: string;
  thumbnailId: number;
  fields: Record<string, string>;
}

export interface CategoryDef {
  termId: number;
  name: string;
  slug: string;
  taxonomy: string;
  parent: number;
}

export interface TemplateDef {
  id: number;
  title: string;
  docType: string;
  location: string;
  conditions: TemplateCondition[];
}

export interface TemplateCondition {
  type: string;
  name: string;
  sub_name: string;
  sub_id: string;
}

export interface PluginDef {
  name: string;
  plugin: string;
  pluginUri?: string;
  version?: string;
}

// ── Landing Page Blueprint ───────────────────────────────────────

export interface LandingPageBlueprint {
  name: string;
  slug: string;
  title: string;
  description: string;
  colors: SiteColors;
  typography: SiteTypography;
  sections: string[];
  hasContactForm: boolean;
  socialLinks: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
}

// ── Site Kit Files ──────────────────────────────────────────────

export interface SiteKitFiles {
  manifest: string;
  siteSettings: string;
  customCode: string;
  customFonts: string;
  templates: Record<string, string>;
  taxonomies: Record<string, string>;
  contentPages: Record<string, string>;
  wpContent: Record<string, string>;
  /** Binary media to copy verbatim into the zip. Path is relative to the kit root. */
  binaryFiles?: { path: string; bytes: Uint8Array }[];
}

// ── Brand Media (raw assets for kit emission) ───────────────────

export type BrandMediaRole = "logo" | "photo" | "icon" | "other";

export interface BrandMediaFile {
  /** Path relative to brand-assets/, e.g. "Assets/logo/wordmark.svg". */
  path: string;
  /** Filename without directories, e.g. "wordmark.svg". */
  filename: string;
  /** Lowercased extension including the dot, e.g. ".svg". */
  ext: string;
  /** MIME type, e.g. "image/svg+xml". */
  mimeType: string;
  /** Raw file bytes. */
  bytes: Uint8Array;
  /** Inferred role from path/filename — drives whether the file is treated as the site logo, etc. */
  role: BrandMediaRole;
}

// ── Media Plan (attachments to ship in the kit) ─────────────────

export interface AttachmentRecord {
  /** WordPress post ID for the attachment. */
  id: number;
  /** Stable slug used in URLs and filenames, e.g. "wordmark-lockup". */
  slug: string;
  /** Filename inside wp-content/uploads/YYYY/MM/, e.g. "wordmark-lockup.svg". */
  filename: string;
  /** Public URL for the attachment, e.g. "https://example.com/wp-content/uploads/2026/04/wordmark-lockup.svg". */
  url: string;
  /** Path inside the kit zip, e.g. "wp-content/uploads/2026/04/wordmark-lockup.svg". */
  zipPath: string;
  /** MIME type. */
  mimeType: string;
  /** Width in pixels (0 for SVG). */
  width: number;
  /** Height in pixels (0 for SVG). */
  height: number;
  /** Role hint — used by prompts to pick the right image. */
  role: BrandMediaRole;
  /** Human-readable title shown in the WP media library. */
  title: string;
}

export interface MediaPlan {
  attachments: AttachmentRecord[];
  files: { path: string; bytes: Uint8Array }[];
  /** Attachment ID for the site logo, when one was found. Used to set custom_logo. */
  logoAttachmentId?: number;
  /** Lookup helper for prompt injection — model picks images by slug. */
  bySlug: Record<string, AttachmentRecord>;
}

// ── Job State ───────────────────────────────────────────────────

export type FileStatus = "pending" | "generating" | "done" | "error";
export type JobStatus = "pending" | "generating" | "complete" | "error";

export interface FileState {
  status: FileStatus;
  label: string;
  content?: string;
  error?: string;
}

export interface JobState {
  id: string;
  mode: GenerationMode;
  blueprint: SiteBlueprint;
  landingBlueprint?: LandingPageBlueprint;
  status: JobStatus;
  files: Record<string, FileState>;
  progress: number;
  error?: string;
  warnings?: string[];
  createdAt: number;
  /** Binary media files (logo, brand assets) to copy into the kit zip. */
  mediaFiles?: { path: string; bytes: Uint8Array }[];
}
