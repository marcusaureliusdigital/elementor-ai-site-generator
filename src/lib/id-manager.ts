import { randomBytes } from "crypto";

/**
 * Server-side ID manager for Elementor Site Kit generation.
 *
 * All IDs are pre-allocated here and passed to LLM prompts as ordered lists.
 * The LLM never invents IDs — it uses them in order from the list provided.
 *
 * Two ID types:
 * 1. Element IDs: 8-character lowercase hex strings (e.g., "6bf367ac")
 *    Used for every Elementor element in template/page JSON.
 *
 * 2. Post IDs: Incrementing integers starting from 10+
 *    Used for WordPress post/page/CPT/attachment/nav_menu_item IDs in WXR.
 */
export class IdManager {
  private usedElementIds = new Set<string>();
  private nextPostId: number;

  constructor(startPostId = 10) {
    this.nextPostId = startPostId;
  }

  /**
   * Generate a single unique 8-char hex element ID.
   */
  generate(): string {
    let id: string;
    do {
      id = randomBytes(4).toString("hex");
    } while (this.usedElementIds.has(id));
    this.usedElementIds.add(id);
    return id;
  }

  /**
   * Generate a batch of unique element IDs.
   */
  generateBatch(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generate());
    }
    return ids;
  }

  /**
   * Allocate the next available post ID (incrementing integer).
   */
  allocatePostId(): number {
    return this.nextPostId++;
  }

  /**
   * Allocate a batch of sequential post IDs.
   */
  allocatePostIds(count: number): number[] {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.allocatePostId());
    }
    return ids;
  }

  /**
   * Generate a color _id (7-char hex, used in site-settings custom_colors).
   */
  generateColorId(): string {
    let id: string;
    do {
      id = randomBytes(4).toString("hex").slice(0, 7);
    } while (this.usedElementIds.has(id));
    this.usedElementIds.add(id);
    return id;
  }

  /**
   * Generate a batch of color IDs.
   */
  generateColorIds(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generateColorId());
    }
    return ids;
  }

  /**
   * Generate a typography _id (7-char hex, used in site-settings system_typography).
   */
  generateTypographyId(): string {
    return this.generateColorId(); // same format
  }

  /**
   * Generate a term ID (for categories/taxonomies).
   * Uses post ID allocation to avoid collisions.
   */
  allocateTermId(): number {
    return this.allocatePostId();
  }

  /**
   * Allocate a batch of term IDs.
   */
  allocateTermIds(count: number): number[] {
    return this.allocatePostIds(count);
  }

  /**
   * Generate an ACF field key (e.g., "field_6793bdaa7a1ab").
   */
  generateFieldKey(): string {
    const hex = randomBytes(7).toString("hex").slice(0, 13);
    return `field_${hex}`;
  }

  /**
   * Validate that a set of IDs matches the expected allocated set.
   * Returns true if all IDs are present and no extras exist.
   */
  validateElementIds(expected: string[], actual: string[]): {
    valid: boolean;
    missing: string[];
    extra: string[];
  } {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const missing = expected.filter((id) => !actualSet.has(id));
    const extra = actual.filter((id) => !expectedSet.has(id));
    return {
      valid: missing.length === 0 && extra.length === 0,
      missing,
      extra,
    };
  }

  /**
   * Get current stats for debugging.
   */
  stats() {
    return {
      elementIdsGenerated: this.usedElementIds.size,
      nextPostId: this.nextPostId,
    };
  }
}
