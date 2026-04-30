"use client";

import { useState } from "react";
import { PromptInput } from "@/components/prompt-input";
import { BlueprintEditor } from "@/components/blueprint-editor";
import { LandingBlueprintEditor } from "@/components/landing-blueprint-editor";
import { GenerationProgress } from "@/components/generation-progress";
import { DownloadReady } from "@/components/download-ready";
import type { SiteBlueprint, LandingPageBlueprint, GenerationMode } from "@/lib/types";

type Phase = "prompt" | "blueprint" | "generating" | "done";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [mode, setMode] = useState<GenerationMode>("website");
  const [modelId, setModelId] = useState("claude-opus-4-7");
  const [blueprint, setBlueprint] = useState<SiteBlueprint | null>(null);
  const [landingBlueprint, setLandingBlueprint] = useState<LandingPageBlueprint | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePromptSubmit = async (userPrompt: string, selectedModelId: string, selectedMode: GenerationMode, files: File[]) => {
    setModelId(selectedModelId);
    setMode(selectedMode);
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("prompt", userPrompt);
      formData.append("modelId", selectedModelId);
      formData.append("mode", selectedMode);
      for (const file of files) {
        formData.append("files", file);
      }
      const res = await fetch("/api/plan", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate blueprint");
      }
      const data = await res.json();

      if (selectedMode === "landing-page") {
        setLandingBlueprint(data.blueprint);
        setBlueprint(null);
      } else {
        setBlueprint(data.blueprint);
        setLandingBlueprint(null);
      }
      setPhase("blueprint");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate blueprint. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlueprintApprove = async (approvedBlueprint: SiteBlueprint) => {
    setBlueprint(approvedBlueprint);
    setPhase("generating");
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint: approvedBlueprint, modelId, mode: "website" }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      const data = await res.json();
      setJobId(data.jobId);
    } catch (err) {
      console.error(err);
      setError("Failed to start generation. Please try again.");
      setPhase("blueprint");
    }
  };

  const handleLandingApprove = async (approvedBlueprint: LandingPageBlueprint) => {
    setLandingBlueprint(approvedBlueprint);
    setPhase("generating");
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint: approvedBlueprint, modelId, mode: "landing-page" }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      const data = await res.json();
      setJobId(data.jobId);
    } catch (err) {
      console.error(err);
      setError("Failed to start generation. Please try again.");
      setPhase("blueprint");
    }
  };

  const handleGenerationComplete = () => {
    setPhase("done");
  };

  const handleStartOver = () => {
    setPhase("prompt");
    setMode("website");
    setBlueprint(null);
    setLandingBlueprint(null);
    setJobId(null);
    setError(null);
  };

  const siteName = mode === "landing-page"
    ? landingBlueprint?.name || "Landing Page"
    : blueprint?.name || "Generated Site";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-brand-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Elementor AI Site Generator</h1>
        </div>

        {/* Phase indicator */}
        <div className="flex items-center gap-2 text-sm">
          {(["prompt", "blueprint", "generating", "done"] as Phase[]).map((p, i) => (
            <div key={p} className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  phase === p
                    ? "bg-brand-accent"
                    : (["prompt", "blueprint", "generating", "done"].indexOf(phase) > i)
                    ? "bg-brand-accent/50"
                    : "bg-brand-border"
                }`}
              />
              <span className={`hidden sm:inline capitalize ${phase === p ? "text-brand-text" : "text-brand-muted"}`}>
                {p === "done" ? "Download" : p}
              </span>
              {i < 3 && <span className="text-brand-border hidden sm:inline">—</span>}
            </div>
          ))}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" className="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl phase-enter" key={phase}>
          {phase === "prompt" && (
            <PromptInput onSubmit={handlePromptSubmit} isLoading={isLoading} />
          )}
          {phase === "blueprint" && mode === "website" && blueprint && (
            <BlueprintEditor
              blueprint={blueprint}
              onApprove={handleBlueprintApprove}
              onBack={() => setPhase("prompt")}
            />
          )}
          {phase === "blueprint" && mode === "landing-page" && landingBlueprint && (
            <LandingBlueprintEditor
              blueprint={landingBlueprint}
              onApprove={handleLandingApprove}
              onBack={() => setPhase("prompt")}
            />
          )}
          {phase === "generating" && jobId && (
            <GenerationProgress
              jobId={jobId}
              mode={mode}
              onComplete={handleGenerationComplete}
            />
          )}
          {phase === "done" && jobId && (
            <DownloadReady
              jobId={jobId}
              siteName={siteName}
              mode={mode}
              onStartOver={handleStartOver}
            />
          )}
        </div>
      </main>
    </div>
  );
}
