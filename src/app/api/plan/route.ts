import { NextRequest, NextResponse } from "next/server";
import { generateObject, NoObjectGeneratedError } from "ai";
import { getModel, anthropicProviderOptions, repairJsonText, type ModelId } from "@/lib/ai-provider";
import { z } from "zod";
import { PLAN_SYSTEM_PROMPT } from "@/lib/prompts/plan-system";
import { LANDING_PLAN_SYSTEM_PROMPT } from "@/lib/prompts/landing-plan-system";
import { BRAND_SYSTEM_PREFIX } from "@/lib/brand";
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
  primary: z.string().describe("Main brand color, hex e.g. #1A2B3C. Cohesive with the requested mood/industry."),
  secondary: z.string().describe("Complementary or lighter shade of the primary, hex e.g. #4D6F90."),
  text: z.string().describe("Body text color, hex. Must contrast strongly against background."),
  accent: z.string().describe("CTA/highlight color, hex. Often a bold contrast color used sparingly on buttons and emphasis."),
  background: z.string().describe("Page background color, hex. Light for light themes, dark for dark themes."),
  black: z.string().describe("Darkest color used in the palette, hex (often near-black like #0B0B0F)."),
  white: z.string().describe("Lightest color used in the palette, hex (often near-white like #FAFAFA)."),
});

const TypographySchema = z.object({
  headingFont: z.string().describe("Google Font family name for headings, exact case e.g. 'Playfair Display' or 'Cormorant Garamond'. Distinctive and on-brand."),
  bodyFont: z.string().describe("Google Font family name for body text, exact case e.g. 'Inter' or 'Open Sans'. Highly readable at small sizes."),
});

const PageSchema = z.object({
  title: z.string().describe("Human-readable page title shown in nav and tab, e.g. 'About Us'."),
  slug: z.string().describe("URL slug in kebab-case, e.g. 'about-us'. No leading slash."),
  isHome: z.boolean().describe("True only for the single home page. Exactly one page must have isHome=true."),
  sections: z.array(z.string()).describe("Ordered section names for the page. Conversion-focused pages (home, services, about) must have 6–10 items moving the visitor through Pain → Benefit → Proof → CTA; utility pages (contact, privacy) may have 3–6 items. Use descriptive lowercase names from this vocabulary: hero, pain-points, benefits, features, how-it-works, services, portfolio, social-proof, testimonials, stats, team, pricing, faq, cta, contact, newsletter, gallery, blog-grid, partners, about."),
});

const PostSchema = z.object({
  title: z.string().describe("Realistic blog post title (no Lorem ipsum)."),
  slug: z.string().describe("URL slug in kebab-case."),
  category: z.string().describe("Slug of one of the categories defined in the categories array."),
  excerpt: z.string().describe("1–2 sentence excerpt summarising the post."),
});

const CptFieldSchema = z.object({
  key: z.string().describe("Field machine name in snake_case, e.g. 'project_location'."),
  label: z.string().describe("Human-readable label shown in the WP admin, e.g. 'Project Location'."),
  type: z.enum(["text", "textarea", "image", "date", "relationship"]).describe("ACF field type. Only these five values are supported."),
});

const CptPostSchema = z.object({
  title: z.string().describe("Realistic CPT post title."),
  slug: z.string().describe("URL slug in kebab-case."),
  fields: z.array(z.object({
    key: z.string().describe("Field key matching one of the CPT's defined field keys."),
    value: z.string().describe("Sample value for the field, plausible and on-topic."),
  })).describe("Sample values for the CPT's custom fields."),
});

const CptSchema = z.object({
  name: z.string().describe("CPT machine name in snake_case singular, e.g. 'destination' or 'menu_item'."),
  label: z.string().describe("Plural human label, e.g. 'Destinations'."),
  singularLabel: z.string().describe("Singular human label, e.g. 'Destination'."),
  fields: z.array(CptFieldSchema).describe("2–4 custom fields that capture this CPT's structured data."),
  posts: z.array(CptPostSchema).describe("3–5 realistic sample posts."),
});

const CategorySchema = z.object({
  name: z.string().describe("Human-readable category name."),
  slug: z.string().describe("URL slug in kebab-case."),
  taxonomy: z.string().describe("Taxonomy machine name. Use 'category' for blog post categories or the CPT's taxonomy name for CPT categories."),
});

const SocialLinksSchema = z.object({
  instagram: z.string().optional().describe("Full https:// URL to the brand's Instagram, or omit."),
  twitter: z.string().optional().describe("Full https:// URL to the brand's X/Twitter, or omit."),
  youtube: z.string().optional().describe("Full https:// URL to the brand's YouTube, or omit."),
  pinterest: z.string().optional().describe("Full https:// URL to the brand's Pinterest, or omit."),
});

const BlueprintResponseSchema = z.object({
  name: z.string().describe("Short site name shown in the header/admin, e.g. 'Studio Arch'."),
  slug: z.string().describe("Site slug in kebab-case."),
  title: z.string().describe("Full site title for the browser tab."),
  description: z.string().describe("1–2 sentence description of the site's purpose."),
  colors: ColorsSchema,
  typography: TypographySchema,
  pages: z.array(PageSchema).describe("3–7 pages including exactly one Home page (isHome: true)."),
  posts: z.array(PostSchema).describe("If hasBlog is true, 3–5 realistic blog posts. Otherwise an empty array."),
  customPostTypes: z.array(CptSchema).describe("Custom post types implied by the brief, e.g. portfolio→project, restaurant→menu_item. Empty array if none applicable."),
  categories: z.array(CategorySchema).describe("Categories for blog posts and CPT taxonomies. Empty array if neither applies."),
  hasContactForm: z.boolean().describe("True if the site mentions or implies a contact page/form."),
  hasBlog: z.boolean().describe("True if the site mentions or implies a blog/news section."),
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
    // Single CPT template — uses `single-page` doc_type so it lands under
    // Theme Builder → Single Page (matching travel-blog reference). Blog
    // posts stay on `single-post`. WP renders both via the singular hook,
    // but the Theme Builder UI groups them differently and Elementor's
    // conditions resolve correctly when the doc_type matches the post type.
    templates.push({
      id: idMgr.allocatePostId(),
      title: `Single ${cpt.singularLabel}`,
      docType: "single-page",
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
  name: z.string().describe("Short landing page name, e.g. 'SaaS Launch' or 'Newsletter Signup'."),
  slug: z.string().describe("URL slug in kebab-case."),
  title: z.string().describe("Full page title for the browser tab."),
  description: z.string().describe("1–2 sentence description of the landing page's purpose and target audience."),
  colors: ColorsSchema,
  typography: TypographySchema,
  sections: z
    .array(z.string())
    .describe(
      "Ordered list of 8–13 section names that flow as a conversion funnel (Hook → Educate → Trust → Convert → Close). Always include at minimum: header, hero, footer. Pick from this vocabulary as appropriate: header, hero, social-proof, features, benefits, how-it-works, testimonials, stats, pricing, faq, cta, newsletter, contact, gallery, footer."
    ),
  hasContactForm: z.boolean().describe("True if the page is for lead generation, contact, or mentions a form."),
  socialLinks: z
    .object({
      instagram: z.string().optional().describe("Full https:// URL or omit."),
      twitter: z.string().optional().describe("Full https:// URL or omit."),
      youtube: z.string().optional().describe("Full https:// URL or omit."),
    })
    .describe("Only include platforms that make sense for the brand. All fields optional."),
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
    const modelId: ModelId = (formData.get("modelId") as ModelId) || "claude-opus-4-7";
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

    // ── Build system prompt with conditional addendums ─────────────
    const hasImages = uploadCtx.images.length > 0;
    const hasDocs = uploadCtx.documents.length > 0;

    // Brand text (colors, typography, voice) flows into the planner via
    // BRAND_SYSTEM_PREFIX. Brand reference images are intentionally NOT
    // attached here — the planner produces a small structural blueprint and
    // the visual payload tipped Claude into conversational responses instead
    // of tool calls. Images are still injected in downstream generators
    // (landing-page-gen.ts, generate-elements.ts) where layout matters.

    // ── Landing Page Mode ──────────────────────────────────────────
    if (mode === "landing-page") {
      let systemPrompt = BRAND_SYSTEM_PREFIX + LANDING_PLAN_SYSTEM_PROMPT;
      if (hasImages) systemPrompt += IMAGE_ADDENDUM;
      if (hasDocs) systemPrompt += DOCUMENT_ADDENDUM;

      const userContent = buildUserMessageParts(prompt, "landing page", uploadCtx);

      const { object: rawLandingBlueprint } = await generateObject({
        model: getModel(modelId),
        schema: LandingBlueprintResponseSchema,
        schemaName: "LandingPageBlueprint",
        schemaDescription:
          "Structural blueprint for a single Elementor landing page: name, slug, colors, typography, ordered sections, contact-form flag, and social links.",
        system: systemPrompt,
        messages: [{ role: "user" as const, content: userContent }],
        maxOutputTokens: 2048,
        experimental_repairText: repairJsonText,
        providerOptions: anthropicProviderOptions,
      });

      const landingBlueprint: LandingPageBlueprint = {
        ...rawLandingBlueprint,
      };

      return NextResponse.json({ blueprint: landingBlueprint, mode: "landing-page" });
    }

    // ── Full Website Mode ──────────────────────────────────────────
    let systemPrompt = BRAND_SYSTEM_PREFIX + PLAN_SYSTEM_PROMPT;
    if (hasImages) systemPrompt += IMAGE_ADDENDUM;
    if (hasDocs) systemPrompt += DOCUMENT_ADDENDUM;

    const userContent = buildUserMessageParts(prompt, "website", uploadCtx);

    const { object: rawBlueprint } = await generateObject({
      model: getModel(modelId),
      schema: BlueprintResponseSchema,
      schemaName: "SiteBlueprint",
      schemaDescription:
        "Structural blueprint for a multi-page Elementor site: pages, posts, custom post types, categories, colors, typography, contact-form/blog flags, and social links.",
      system: systemPrompt,
      messages: [{ role: "user" as const, content: userContent }],
      maxOutputTokens: 4096,
      experimental_repairText: repairJsonText,
      providerOptions: anthropicProviderOptions,
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
    if (NoObjectGeneratedError.isInstance(error)) {
      // The model didn't emit a parseable tool call. Surface enough detail
      // to debug — refusal vs. truncation vs. bad keys all look identical
      // from the client otherwise.
      const text = error.text ?? "";
      const finishReason = error.finishReason ?? "unknown";
      const usage = error.usage;
      const responseModel = error.response?.modelId;
      console.error("Plan generation: NoObjectGeneratedError", {
        finishReason,
        usage,
        responseModel,
        textPreview: text.slice(0, 1000),
        cause: error.cause,
      });
      const excerpt = text.replace(/\s+/g, " ").trim().slice(0, 240);
      return NextResponse.json(
        {
          error: `Failed to generate blueprint: model did not return a valid object (finishReason: ${finishReason}).${excerpt ? ` Model said: "${excerpt}${text.length > 240 ? "…" : ""}"` : ""}`,
        },
        { status: 500 }
      );
    }

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
