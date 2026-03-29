"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/sanitize";

interface LegalPageProps {
  title: string;
  content: string;
}

/**
 * Reusable legal page component for Impressum, Datenschutz, and Nutzungsbedingungen.
 * Renders Markdown-like content with proper formatting in a clean, branded layout.
 */
export function LegalPage({ title, content }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b border-border/40 bg-white/80 backdrop-blur-sm dark:bg-gray-950/80">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <span className="text-[10px] font-bold text-primary-foreground">
                GTS
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              GTS Planner
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold text-foreground">{title}</h1>
        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
          {content.split("\n\n").map((paragraph, index) => {
            // Handle bold headers (lines starting with **)
            if (paragraph.startsWith("**") && paragraph.endsWith("**")) {
              const text = paragraph.replace(/\*\*/g, "");
              return (
                <h2 key={index} className="mt-6 text-lg font-semibold">
                  {text}
                </h2>
              );
            }

            // Handle italic subheaders
            if (paragraph.startsWith("*") && paragraph.endsWith("*")) {
              const text = paragraph.replace(/^\*|\*$/g, "");
              return (
                <p key={index} className="italic text-muted-foreground">
                  {text}
                </p>
              );
            }

            // Handle list items
            if (paragraph.includes("\n- ")) {
              const parts = paragraph.split("\n");
              const intro = parts[0];
              const items = parts.filter((p) => p.startsWith("- "));
              return (
                <div key={index}>
                  {intro && !intro.startsWith("- ") && (
                    <p
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(formatText(intro)),
                      }}
                    />
                  )}
                  <ul className="list-disc pl-6">
                    {items.map((item, i) => (
                      <li
                        key={i}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(formatText(item.replace(/^- /, ""))),
                        }}
                      />
                    ))}
                  </ul>
                </div>
              );
            }

            // Regular paragraph with bold/link formatting
            return (
              <p
                key={index}
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(formatText(paragraph)),
                }}
              />
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Hilfswerk &mdash; GTS Planner
      </footer>
    </div>
  );
}

/**
 * Format text with bold and link markdown syntax.
 */
function formatText(text: string): string {
  return text
    .replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="font-semibold text-foreground">$1</strong>',
    )
    .replace(
      /\[(.*?)\]\((.*?)\)/g,
      '<a href="$2" class="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}
