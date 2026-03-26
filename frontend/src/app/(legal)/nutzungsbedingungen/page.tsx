import { LEGAL_CONTENT } from "@/lib/legal-content";
import { LegalPage } from "@/components/legal-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nutzungsbedingungen – GTS Planner",
  description:
    "Nutzungsbedingungen des GTS Planners – Hilfswerk Österreich.",
};

export default function NutzungsbedingungenPage() {
  return (
    <LegalPage
      title={LEGAL_CONTENT.nutzungsbedingungen.title}
      content={LEGAL_CONTENT.nutzungsbedingungen.content}
    />
  );
}
