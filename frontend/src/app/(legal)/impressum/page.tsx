import { LEGAL_CONTENT } from "@/lib/legal-content";
import { LegalPage } from "@/components/legal-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum – GTS Planner",
  description:
    "Impressum des GTS Planners – Hilfswerk Österreich, Grünbergstraße 15/2/5, 1120 Wien.",
};

export default function ImpressumPage() {
  return (
    <LegalPage
      title={LEGAL_CONTENT.impressum.title}
      content={LEGAL_CONTENT.impressum.content}
    />
  );
}
