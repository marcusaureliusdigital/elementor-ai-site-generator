import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { getModel, type ModelId } from "@/lib/ai-provider";
import { z } from "zod";
import { PLAN_SYSTEM_PROMPT } from "@/lib/prompts/plan-system";
import { LANDING_PLAN_SYSTEM_PROMPT } from "@/lib/prompts/landing-plan-system";
import { MARCUS_AURELIUS_BRAND, BRAND_VOICE } from "@/lib/brand";
import { IdManager } from "@/lib/id-manager";
import {
  processUploadedFile,
  buildUploadContext,
  validateUploadLimits,
} from "@/lib/upload-processor";
import type {
  SiteBlueprint,
  LandingPageBlueprint,
  GenerationMode,
  PageDef,
  PostDef,
  CptDef,
  CategoryDef,
  TemplateDef,
  PluginDef,
  UploadContext,
} from "@/lib/types";

// ── Zod Schemas (for LLM structured output) ──────────────────────

const ColorsSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  text: z.string(),
  accent: z.string(),
  background: z.string(),
  black: z.string(),
  white: z.string(),
});

const TypographySchema = z.object({
  headingFont: z.string(),
  bodyFont: z.string(),
});

const PageSchema = z.object({
  title: z.string(),
  slug: z.string(),
  isHome: z.boolean(),
  sections: z.array(z.string()),
});

const PostSchema = z.object({
  title: z.string(),
  slug: z.string(),
  category: z.string(),
  excerpt: z.string(),
});

const CptFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "image", "date", "relationship"]),
});

const CptPostSchema = z.object({
  title: z.string(),
  slug: z.string(),
  fields: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })),
});

const CptSchema = z.object({
  name: z.string(),
  label: z.string(),
  singularLabel: z.string(),
  fields: z.array(CptFieldSchema),
  posts: z.array(CptPostSchema),
});

const CategorySchema = z.object({
  name: z.string(),
  slug: z.string(),
  taxonomy: z.string(),
});

const SocialLinksSchema = z.object({
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  youtube: z.string().optional(),
  pinterest: z.string().optional(),
});

const BlueprintResponseSchema = z.object({
  name: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  colors: ColorsSchema,
  typography: TypographySchema,
  pages: z.array(PageSchema),
  posts: z.array(PostSchema),
  customPostTypes: z.array(CptSchema),
  categories: z.array(CategorySchema),
  hasContactForm: z.boolean(),
  hasBlog: z.boolean(),
  socialLinks: SocialLinksSchema,
});

// ── Helpers ────────────────────────────────────────────────────────

function buildTemplates(
  pages: PageDef[],
  cpts: CptDef[],
  hasBlog: boolean,
  idMgr: IdManager
): TemplateDef[] {
  const templates: TemplateDef[] = [];

  // Header (global)
  templates.push({
    id: idMgr.allocatePostId(),
    title: "Header",
    docType: "header",
    location: "header",
    conditions: [{ type: "include", name: "general", sub_name: "", sub_id: "" }],
  });

  // Footer (global)
  templates.push({
    id: idMgr.allocatePostId(),
    title: "Footer",
    docType: "footer",
    location: "footer",
    conditions: [{ type: "include", name: "general", sub_name: "", sub_id: "" }],
  });

  // Single post template (if blog)
  if (hasBlog) {
    templates.push({
      id: idMgr.allocatePostId(),
      title: "Single Post",
      docType: "single-post",
      location: "single",
      conditions: [{ type: "include", name: "singular", sub_name: "post", sub_id: "" }],
    });

    // Post archive
    templates.push({
      id: idMgr.allocatePostId(),
      title: "Blog Archive",
      docType: "archive",
      location: "archive",
      conditions: [{ type: "include", name: "archive", sub_name: "post", sub_id: "" }],
    });

    // Post loop item
    templates.push({
      id: idMgr.allocatePostId(),
      title: "Post Loop Item",
      docType: "loop-item",
      location: "",
      conditions: [],
    });
  }

  // CPT templates
  for (const cpt of cpts) {
    // Single CPT template
    templates.push({
      id: idMgr.allocatePostId(),
      title: `Single ${cpt.singularLabel}`,
      docType: "single-post",
      location: "single",
      conditions: [
        { type: "include", name: "singular", sub_name: cpt.name, sub_id: "" },
      ],
    });

    // CPT archive
    templates.push({
      id: idMgr.allocatePostId(),
      title: `${cpt.label} Archive`,
      docType: "archive",
      location: "archive",
      conditions: [
        { type: "include", name: "archive", sub_name: cpt.name, sub_id: "" },
      ],
    });

    // CPT loop item
    templates.push({
      id: idMgr.allocatePostId(),
      title: `${cpt.singularLabel} Loop Item`,
      docType: "loop-item",
      location: "",
      conditions: [],
    });
  }

  // 404 page
  templates.push({
    id: idMgr.allocatePostId(),
    title: "404 Page",
    docType: "error-404",
    location: "single",
    conditions: [{ type: "include", name: "singular", sub_name: "not_found404", sub_id: "" }],
  });

  return templates;
}

function buildPlugins(cpts: CptDef[]): PluginDef[] {
  const plugins: PluginDef[] = [
    {
      name: "Elementor",
      plugin: "elementor/elementor.php",
      pluginUri: "https://elementor.com/",
      version: "3.35.7",
    },
    {
      name: "Elementor Pro",
      plugin: "elementor-pro/elementor-pro.php",
      pluginUri: "https://elementor.com/",
      version: "3.35.7",
    },
  ];

  if (cpts.length > 0) {
    plugins.push({
      name: "Advanced Custom Fields PRO",
      plugin: "advanced-custom-fields-pro/acf.php",
      pluginUri: "https://www.advancedcustomfields.com/",
      version: "6.3.12",
    });
  }

  // Contact form is handled by Elementor Pro, already included above

  return plugins;
}

// ── Landing Page Zod Schema ────────────────────────────────────────

const LandingBlueprintResponseSchema = z.object({
  name: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  colors: ColorsSchema,
  typography: TypographySchema,
  sections: z.array(z.string()),
  hasContactForm: z.boolean(),
  socialLinks: z.object({
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    youtube: z.string().optional(),
  }),
});

// ── Upload-aware prompt addendums ──────────────────────────────────

const IMAGE_ADDENDUM = `

## Reference Images

The user has uploaded reference images. Analyze these images carefully to inform your design decisions: color palette extraction, layout patterns, typography style, spacing conventions, and overall aesthetic direction. Use them as directional inspiration — match the feel and quality, not pixel-for-pixel reproduction. If colors or fonts are clearly visible in the images, prefer those over generic defaults.`;

const DOCUMENT_ADDENDUM = `

## Existing Website Files

The user has uploaded existing website files. Analyze the current site's structure, content, design patterns, and copy. Your blueprint should be an OPTIMIZED version that improves: visual hierarchy, color harmony, typography pairing, section flow, CTA placement, content quality, mobile responsiveness, and conversion best practices. Preserve the core brand identity and content intent while elevating the overall quality. Extract real copy, headings, and section structure from the uploaded files rather than inventing new content.`;

// ── Build multimodal user message parts ────────────────────────────

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image"; image: string; mediaType?: string };
type UserPart = TextPart | ImagePart;

function buildUserMessageParts(
  prompt: string,
  modeLabel: string,
  uploadCtx: UploadContext
): UserPart[] {
  const parts: UserPart[] = [];

  // Text prompt
  parts.push({
    type: "text",
    text: `Create a detailed ${modeLabel} blueprint for the following request:\n\n${prompt}`,
  });

  // Document context
  if (uploadCtx.documents.length > 0) {
    const docText = uploadCtx.documents
      .map((d) => `--- File: ${d.name} ---\n${d.textContent}`)
      .join("\n\n");
    parts.push({
      type: "text",
      text: `\n\n# Existing Website Files for Analysis & Optimization\n\n${docText}`,
    });
  }

  // Images for vision
  for (const img of uploadCtx.images) {
    parts.push({
      type: "image",
      image: img.base64!,
      mediaType: img.mimeType,
    });
  }

  return parts;
}

// ── API Route ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Parse FormData ─────────────────────────────────────────────
    const formData = await req.formData();
    const prompt = formData.get("prompt") as string;
    const modelId: ModelId = (formData.get("modelId") as ModelId) || "claude-opus-4-6";
    const mode: GenerationMode = (formData.get("mode") as GenerationMode) || "website";
    const rawFiles = formData.getAll("files") as File[];

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    // ── Validate & process uploads ─────────────────────────────────
    const uploadError = validateUploadLimits(rawFiles);
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 });
    }

    const uploadedFiles = await Promise.all(rawFiles.map(processUploadedFile));
    const uploadCtx = buildUploadContext(uploadedFiles);

    // ── Brand context for planning ────────────────────────────────
    const brandContext = `# Brand Identity Reference\n${MARCUS_AURELIUS_BRAND}\n\n# Brand Voice Reference\n${BRAND_VOICE}\n\n---\n\n`;

    // ── Build system prompt with conditional addendums ─────────────
    const hasImages = uploadCtx.images.length > 0;
    const hasDocs = uploadCtx.documents.length > 0;

    // ── Landing Page Mode ──────────────────────────────────────────
    if (mode === "landing-page") {
      let systemPrompt = brandContext + LANDING_PLAN_SYSTEM_PROMPT;
      if (hasImages) systemPrompt += IMAGE_ADDENDUM;
      if (hasDocs) systemPrompt += DOCUMENT_ADDENDUM;

      const userContent = buildUserMessageParts(prompt, "landing page", uploadCtx);

      const { object: rawLandingBlueprint } = await generateObject({
        model: getModel(modelId),
        schema: LandingBlueprintResponseSchema,
        system: systemPrompt,
        messages: [{ role: "user" as const, content: userContent }],
      });

      const landingBlueprint: LandingPageBlueprint = {
        ...rawLandingBlueprint,
      };

      return NextResponse.json({ blueprint: landingBlueprint, mode: "landing-page" });
    }

    // ── Full Website Mode ──────────────────────────────────────────
    let systemPrompt = brandContext + PLAN_SYSTEM_PROMPT;
    if (hasImages) systemPrompt += IMAGE_ADDENDUM;
    if (hasDocs) systemPrompt += DOCUMENT_ADDENDUM;

    const userContent = buildUserMessageParts(prompt, "website", uploadCtx);

    const { object: rawBlueprint } = await generateObject({
      model: getModel(modelId),
      schema: BlueprintResponseSchema,
      system: systemPrompt,
      messages: [{ role: "user" as const, content: userContent }],
    });

    // Now allocate all IDs server-side
    const idMgr = new IdManager(10);

    // Allocate page IDs
    const pages: PageDef[] = rawBlueprint.pages.map((p) => ({
      ...p,
      id: idMgr.allocatePostId(),
    }));

    // Allocate post IDs
    const posts: PostDef[] = rawBlueprint.posts.map((p) => ({
      ...p,
      id: idMgr.allocatePostId(),
    }));

    // Allocate CPT IDs (posts + fields)
    const customPostTypes: CptDef[] = rawBlueprint.customPostTypes.map((cpt) => ({
      ...cpt,
      fields: cpt.fields.map((f) => ({
        ...f,
        fieldId: idMgr.generateFieldKey(),
      })),
      posts: cpt.posts.map((p) => {
        const fieldsRecord: Record<string, string> = {};
        for (const f of p.fields) {
          fieldsRecord[f.key] = f.value;
        }
        return {
          ...p,
          fields: fieldsRecord,
          id: idMgr.allocatePostId(),
          thumbnailId: idMgr.allocatePostId(),
        };
      }),
    }));

    // Allocate category term IDs
    const categories: CategoryDef[] = rawBlueprint.categories.map((c) => ({
      ...c,
      termId: idMgr.allocateTermId(),
      parent: 0,
    }));

    // Build templates with IDs
    const templates = buildTemplates(pages, customPostTypes, rawBlueprint.hasBlog, idMgr);

    // Build plugin list
    const plugins = buildPlugins(customPostTypes);

    // Assemble full blueprint
    const blueprint: SiteBlueprint = {
      name: rawBlueprint.name,
      slug: rawBlueprint.slug,
      title: rawBlueprint.title,
      description: rawBlueprint.description,
      siteUrl: "https://example.com",
      author: {
        name: "Admin",
        login: "admin",
        email: "admin@example.com",
      },
      colors: rawBlueprint.colors,
      typography: rawBlueprint.typography,
      pages,
      posts,
      customPostTypes,
      categories,
      templates,
      plugins,
      hasContactForm: rawBlueprint.hasContactForm,
      hasBlog: rawBlueprint.hasBlog,
      socialLinks: rawBlueprint.socialLinks,
    };

    return NextResponse.json({ blueprint, mode: "website" });
  } catch (error) {
    console.error("Plan generation error:", error);

    const message = error instanceof Error ? error.message : String(error);

    let userMessage = `Failed to generate blueprint: ${message}`;
    if (message.includes("API key") || message.includes("authentication") || message.includes("401")) {
      userMessage = "Failed to generate blueprint: API key configuration issue. Check your .env.local file.";
    } else if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      userMessage = "Failed to generate blueprint: request timed out, please try again";
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
