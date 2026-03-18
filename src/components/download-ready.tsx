"use client";

import type { GenerationMode } from "@/lib/types";

interface DownloadReadyProps {
  jobId: string;
  siteName: string;
  mode: GenerationMode;
  onStartOver: () => void;
}

export function DownloadReady({ jobId, siteName, mode, onStartOver }: DownloadReadyProps) {
  const isLandingPage = mode === "landing-page";

  const handleDownload = async () => {
    const res = await fetch(`/api/download?jobId=${jobId}`);
    if (!res.ok) {
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isLandingPage
      ? `${siteName.toLowerCase().replace(/\s+/g, "-")}-landing-page.json`
      : `${siteName.toLowerCase().replace(/\s+/g, "-")}-site-kit.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const websiteSteps = [
    "Open your WordPress dashboard",
    "Go to Elementor → Tools → Import/Export",
    "Click \"Import\" and select the downloaded .zip",
    "Choose which parts to import (templates, content, settings)",
    "Click \"Import\" and wait for completion",
  ];

  const landingPageSteps = [
    "Open your WordPress dashboard",
    "Go to Pages → Add New",
    "Click \"Edit with Elementor\" to open the Elementor editor",
    "Click the folder icon (⬆) in the top bar → Import",
    "Upload the downloaded .json file",
  ];

  const steps = isLandingPage ? landingPageSteps : websiteSteps;
  const fileType = isLandingPage ? ".json" : ".zip";

  return (
    <div className="space-y-8 text-center">
      {/* Success icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-brand-accent/10 border-2 border-brand-accent/30 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F2B705" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight">
          Your {isLandingPage ? "Landing Page" : "Site Kit"} is <span className="text-brand-accent">Ready</span>
        </h2>
        <p className="text-brand-muted text-sm max-w-md mx-auto">
          <strong className="text-brand-text">{siteName}</strong> has been generated
          {isLandingPage
            ? " as an Elementor template. Download the "
            : " as a complete Elementor Pro Site Kit. Download the "}
          <code className="text-xs bg-brand-surface px-1.5 py-0.5 rounded border border-brand-border">{fileType}</code>
          {" file and import it into WordPress."}
        </p>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="inline-flex items-center gap-3 px-8 py-4 bg-brand-accent text-brand-dark font-semibold rounded-lg hover:bg-brand-accent/90 transition-all text-lg"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download {isLandingPage ? "Template" : "Site Kit"}
      </button>

      {/* Import instructions */}
      <div className="max-w-md mx-auto space-y-3 text-left">
        <p className="text-xs font-medium text-brand-muted uppercase tracking-wider text-center">
          How to Import
        </p>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-2.5 bg-brand-surface/50 border border-brand-border/50 rounded-lg"
            >
              <span className="text-xs font-mono text-brand-accent mt-0.5">
                {i + 1}.
              </span>
              <span className="text-sm text-brand-muted">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Start over */}
      <button
        onClick={onStartOver}
        className="text-sm text-brand-muted hover:text-brand-text transition-colors"
      >
        ← Generate Another {isLandingPage ? "Landing Page" : "Site"}
      </button>
    </div>
  );
}
