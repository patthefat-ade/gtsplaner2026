"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Shield, FileText, Check } from "lucide-react";
import { LEGAL_CONTENT } from "@/lib/legal-content";

interface TermsAcceptanceDialogProps {
  onAccept: () => void;
  isLoading?: boolean;
}

export function TermsAcceptanceDialog({
  onAccept,
  isLoading = false,
}: TermsAcceptanceDialogProps) {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [expandedSection, setExpandedSection] = useState<
    "datenschutz" | "nutzungsbedingungen" | null
  >(null);

  const canAccept = privacyAccepted && termsAccepted;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-zinc-800 dark:to-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Shield className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Datenschutz & Nutzungsbedingungen
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Bitte lesen und akzeptieren Sie die folgenden Bedingungen, um
                fortzufahren.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Datenschutz Section */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
            <button
              onClick={() =>
                setExpandedSection(
                  expandedSection === "datenschutz" ? null : "datenschutz"
                )
              }
              className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-zinc-900 dark:text-white">
                  Datenschutzerklärung
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {expandedSection === "datenschutz"
                  ? "Einklappen"
                  : "Vollständig lesen"}
              </span>
            </button>
            {expandedSection === "datenschutz" && (
              <div className="px-4 py-3 max-h-64 overflow-y-auto border-t border-zinc-200 dark:border-zinc-700">
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-sm prose-p:text-xs prose-li:text-xs">
                  <ReactMarkdown>
                    {LEGAL_CONTENT.datenschutz.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Nutzungsbedingungen Section */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
            <button
              onClick={() =>
                setExpandedSection(
                  expandedSection === "nutzungsbedingungen"
                    ? null
                    : "nutzungsbedingungen"
                )
              }
              className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-green-500" />
                <span className="font-medium text-zinc-900 dark:text-white">
                  Nutzungsbedingungen
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {expandedSection === "nutzungsbedingungen"
                  ? "Einklappen"
                  : "Vollständig lesen"}
              </span>
            </button>
            {expandedSection === "nutzungsbedingungen" && (
              <div className="px-4 py-3 max-h-64 overflow-y-auto border-t border-zinc-200 dark:border-zinc-700">
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-sm prose-p:text-xs prose-li:text-xs">
                  <ReactMarkdown>
                    {LEGAL_CONTENT.nutzungsbedingungen.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    privacyAccepted
                      ? "bg-yellow-500 border-yellow-500"
                      : "border-zinc-300 dark:border-zinc-600 group-hover:border-yellow-400"
                  }`}
                >
                  {privacyAccepted && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
              </div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Ich habe die{" "}
                <strong className="text-zinc-900 dark:text-white">
                  Datenschutzerklärung
                </strong>{" "}
                gelesen und stimme der Verarbeitung meiner personenbezogenen
                Daten zu.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    termsAccepted
                      ? "bg-yellow-500 border-yellow-500"
                      : "border-zinc-300 dark:border-zinc-600 group-hover:border-yellow-400"
                  }`}
                >
                  {termsAccepted && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
              </div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Ich akzeptiere die{" "}
                <strong className="text-zinc-900 dark:text-white">
                  Nutzungsbedingungen
                </strong>{" "}
                des GTS Planers.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={onAccept}
            disabled={!canAccept || isLoading}
            className={`w-full py-3 px-4 rounded-xl font-medium text-white transition-all ${
              canAccept && !isLoading
                ? "bg-yellow-500 hover:bg-yellow-600 shadow-lg shadow-yellow-500/20"
                : "bg-zinc-300 dark:bg-zinc-700 cursor-not-allowed"
            }`}
          >
            {isLoading
              ? "Wird gespeichert..."
              : "Akzeptieren und fortfahren"}
          </button>
        </div>
      </div>
    </div>
  );
}
