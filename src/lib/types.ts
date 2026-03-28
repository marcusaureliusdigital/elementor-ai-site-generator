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
  createdAt: number;
}
