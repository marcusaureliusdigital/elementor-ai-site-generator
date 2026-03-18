"use client";

import { useState } from "react";
import type { LandingPageBlueprint } from "@/lib/types";

const AVAILABLE_SECTIONS = [
  "header", "hero", "social-proof", "features", "benefits",
  "how-it-works", "testimonials", "stats", "pricing", "faq",
  "cta", "newsletter", "contact", "gallery", "footer",
];

interface LandingBlueprintEditorProps {
  blueprint: LandingPageBlueprint;
  onApprove: (blueprint: LandingPageBlueprint) => void;
  onBack: () => void;
}

export function LandingBlueprintEditor({ blueprint, onApprove, onBack }: LandingBlueprintEditorProps) {
  const [bp, setBp] = useState<LandingPageBlueprint>(blueprint);
  const [isApproving, setIsApproving] = useState(false);

  const updateColors = (key: keyof typeof bp.colors, value: string) => {
    setBp((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  };

  const updateTypography = (key: keyof typeof bp.typography, value: string) => {
    setBp((prev) => ({ ...prev, typography: { ...prev.typography, [key]: value } }));
  };

  const removeSection = (index: number) => {
    setBp((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  };

  const addSection = (section: string) => {
    setBp((prev) => ({
      ...prev,
      sections: [...prev.sections, section],
    }));
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    setBp((prev) => {
      const sections = [...prev.sections];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sections.length) return prev;
      [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
      return { ...prev, sections };
    });
  };

  const handleApprove = () => {
    setIsApproving(true);
    onApprove(bp);
  };

  const unusedSections = AVAILABLE_SECTIONS.filter(
    (s) => !bp.sections.includes(s)
  );

  const colorFields: { key: keyof typeof bp.colors; label: string }[] = [
    { key: "primary", label: "Primary" },
    { key: "secondary", label: "Secondary" },
    { key: "accent", label: "Accent" },
    { key: "background", label: "Background" },
    { key: "text", label: "Text" },
    { key: "black", label: "Black" },
    { key: "white", label: "White" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Review Landing Page</h2>
          <p className="text-brand-muted text-sm mt-1">
            Fine-tune your landing page before generation
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Page Info */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
          Page Info
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Name</label>
            <input
              type="text"
              value={bp.name}
              onChange={(e) => setBp((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">Slug</label>
            <input
              type="text"
              value={bp.slug}
              onChange={(e) => setBp((prev) => ({ ...prev, slug: e.target.value }))}
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-brand-muted mb-1">Description</label>
          <textarea
            value={bp.description}
            onChange={(e) => setBp((prev) => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text resize-none focus:outline-none focus:border-brand-accent/50 transition-colors"
          />
        </div>
      </section>

      {/* Colors */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
          Colors
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {colorFields.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label className="block text-xs text-brand-muted">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bp.colors[key]}
                  onChange={(e) => updateColors(key, e.target.value)}
                  className="w-8 h-8 rounded border border-brand-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={bp.colors[key]}
                  onChange={(e) => updateColors(key, e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-brand-surface border border-brand-border rounded text-xs text-brand-text font-mono focus:outline-none focus:border-brand-accent/50 transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
          Typography
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Heading Font</label>
            <input
              type="text"
              value={bp.typography.headingFont}
              onChange={(e) => updateTypography("headingFont", e.target.value)}
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">Body Font</label>
            <input
              type="text"
              value={bp.typography.bodyFont}
              onChange={(e) => updateTypography("bodyFont", e.target.value)}
              className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent/50 transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
          Sections ({bp.sections.length})
        </h3>
        <div className="space-y-2">
          {bp.sections.map((section, i) => (
            <div
              key={`${section}-${i}`}
              className="flex items-center gap-3 px-4 py-3 bg-brand-surface border border-brand-border rounded-lg"
            >
              <span className="text-xs font-mono text-brand-accent w-6">{i + 1}.</span>
              <span className="flex-1 text-sm text-brand-text capitalize">{section.replace(/-/g, " ")}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveSection(i, "up")}
                  disabled={i === 0}
                  className="text-brand-muted hover:text-brand-text disabled:opacity-30 transition-colors p-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
                <button
                  onClick={() => moveSection(i, "down")}
                  disabled={i === bp.sections.length - 1}
                  className="text-brand-muted hover:text-brand-text disabled:opacity-30 transition-colors p-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <button
                  onClick={() => removeSection(i)}
                  className="text-brand-muted hover:text-red-400 transition-colors p-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add section */}
        {unusedSections.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs text-brand-muted self-center">Add:</span>
            {unusedSections.map((section) => (
              <button
                key={section}
                onClick={() => addSection(section)}
                className="text-xs px-2.5 py-1 bg-brand-surface/50 border border-brand-border/50 rounded-full text-brand-muted hover:text-brand-text hover:border-brand-border transition-colors capitalize"
              >
                + {section.replace(/-/g, " ")}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Features summary */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-brand-muted uppercase tracking-wider">
          Features
        </h3>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2.5 py-1 bg-brand-accent/10 border border-brand-accent/20 rounded-full text-brand-accent font-medium">
            Landing Page
          </span>
          {bp.hasContactForm && (
            <span className="text-xs px-2.5 py-1 bg-brand-surface border border-brand-border rounded-full text-brand-text">
              Contact Form
            </span>
          )}
          <span className="text-xs px-2.5 py-1 bg-brand-surface border border-brand-border rounded-full text-brand-text">
            {bp.sections.length} Sections
          </span>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-6 border border-brand-border text-brand-text font-medium rounded-lg hover:bg-brand-surface transition-colors"
        >
          Back to Prompt
        </button>
        <button
          onClick={handleApprove}
          disabled={isApproving}
          className="flex-1 py-3 px-6 bg-brand-accent text-brand-dark font-semibold rounded-lg hover:bg-brand-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isApproving ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting Generation...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Approve &amp; Generate
            </>
          )}
        </button>
      </div>
    </div>
  );
}
