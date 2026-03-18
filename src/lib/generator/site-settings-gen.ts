import type { SiteBlueprint } from "../types";
import { IdManager } from "../id-manager";

/**
 * Generates site-settings.json from a blueprint.
 *
 * Maps colors → system_colors + custom_colors
 * Maps typography → system_typography
 * Generates heading sizes using clamp() formulas
 * All __globals__ references use the allocated color/typography _ids
 */

export interface SiteSettingsIds {
  colorIds: {
    background: string;
    black: string;
    white: string;
  };
  typographyIds: {
    primary: string;
    secondary: string;
    text: string;
    accent: string;
  };
}

export function generateSiteSettings(
  blueprint: SiteBlueprint,
  idMgr: IdManager
): { json: string; ids: SiteSettingsIds } {
  const { colors, typography } = blueprint;

  // Allocate custom color IDs
  const bgColorId = idMgr.generateColorId();
  const blackColorId = idMgr.generateColorId();
  const whiteColorId = idMgr.generateColorId();

  // Allocate typography IDs
  const typoIds = {
    primary: idMgr.generateTypographyId(),
    secondary: idMgr.generateTypographyId(),
    text: idMgr.generateTypographyId(),
    accent: idMgr.generateTypographyId(),
  };

  const siteSettings = {
    content: [],
    settings: {
      system_colors: [
        { _id: "primary", title: "Primary", color: colors.primary },
        { _id: "secondary", title: "Secondary", color: colors.secondary },
        { _id: "text", title: "Text", color: colors.text },
        { _id: "accent", title: "Accent", color: colors.accent },
      ],
      custom_colors: [
        { _id: bgColorId, title: "Background", color: colors.background },
        { _id: blackColorId, title: "Black", color: colors.black },
        { _id: whiteColorId, title: "White", color: colors.white },
      ],
      system_typography: [
        {
          _id: "primary",
          title: "Primary",
          typography_typography: "custom",
          typography_font_family: typography.headingFont,
          typography_font_weight: "600",
        },
        {
          _id: "secondary",
          title: "Secondary",
          typography_typography: "custom",
          typography_font_family: typography.bodyFont,
          typography_font_weight: "400",
        },
        {
          _id: "text",
          title: "Text",
          typography_typography: "custom",
          typography_font_family: typography.bodyFont,
          typography_font_weight: "400",
        },
        {
          _id: "accent",
          title: "Accent",
          typography_typography: "custom",
          typography_font_family: typography.headingFont,
          typography_font_weight: "500",
        },
      ],
      custom_typography: [
        {
          _id: typoIds.primary,
          title: "Heading Primary",
          typography_typography: "custom",
          typography_font_family: typography.headingFont,
          typography_font_weight: "700",
        },
        {
          _id: typoIds.secondary,
          title: "Heading Secondary",
          typography_typography: "custom",
          typography_font_family: typography.headingFont,
          typography_font_weight: "600",
        },
        {
          _id: typoIds.text,
          title: "Body",
          typography_typography: "custom",
          typography_font_family: typography.bodyFont,
          typography_font_weight: "400",
        },
        {
          _id: typoIds.accent,
          title: "Accent",
          typography_typography: "custom",
          typography_font_family: typography.headingFont,
          typography_font_weight: "500",
        },
      ],
      // Heading sizes with responsive clamp()
      hello_heading_1_typography_typography: "custom",
      hello_heading_1_typography_font_family: typography.headingFont,
      hello_heading_1_typography_font_size: {
        unit: "px",
        size: "clamp(2rem, 1.5rem + 2.5vw, 3.5rem)",
      },
      hello_heading_1_typography_font_weight: "700",

      hello_heading_2_typography_typography: "custom",
      hello_heading_2_typography_font_family: typography.headingFont,
      hello_heading_2_typography_font_size: {
        unit: "px",
        size: "clamp(1.75rem, 1.25rem + 2vw, 2.5rem)",
      },
      hello_heading_2_typography_font_weight: "700",

      hello_heading_3_typography_typography: "custom",
      hello_heading_3_typography_font_family: typography.headingFont,
      hello_heading_3_typography_font_size: {
        unit: "px",
        size: "clamp(1.25rem, 1rem + 1.5vw, 2rem)",
      },
      hello_heading_3_typography_font_weight: "600",

      hello_heading_4_typography_typography: "custom",
      hello_heading_4_typography_font_family: typography.headingFont,
      hello_heading_4_typography_font_size: {
        unit: "px",
        size: "clamp(1.125rem, 1rem + 0.75vw, 1.5rem)",
      },
      hello_heading_4_typography_font_weight: "600",

      hello_body_typography_typography: "custom",
      hello_body_typography_font_family: typography.bodyFont,
      hello_body_typography_font_size: { unit: "px", size: 16 },
      hello_body_typography_font_weight: "400",

      // Button styles
      button_typography_typography: "custom",
      button_typography_font_family: typography.bodyFont,
      button_typography_font_weight: "600",
      button_text_color: colors.white,
      button_background_color: colors.primary,
      button_border_radius: { unit: "px", top: "8", right: "8", bottom: "8", left: "8" },
      button_hover_background_color: colors.accent,

      // Form styles
      form_field_typography_typography: "custom",
      form_field_typography_font_family: typography.bodyFont,
      form_label_typography_typography: "custom",
      form_label_typography_font_family: typography.bodyFont,
    },
    metadata: [],
  };

  return {
    json: JSON.stringify(siteSettings, null, 2),
    ids: {
      colorIds: {
        background: bgColorId,
        black: blackColorId,
        white: whiteColorId,
      },
      typographyIds: typoIds,
    },
  };
}
