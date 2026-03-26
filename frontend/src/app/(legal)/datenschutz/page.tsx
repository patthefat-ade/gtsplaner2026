import { LEGAL_CONTENT } from "@/lib/legal-content";
import { LegalPage } from "@/components/legal-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – GTS Planner",
  description:
    "Datenschutzerklärung des GTS Planners gemäß DSGVO – Hilfswerk Österreich.",
};

export default function DatenschutzPage() {
  return (
    <LegalPage
      title={LEGAL_CONTENT.datenschutz.title}
      content={LEGAL_CONTENT.datenschutz.content}
    />
  );
}
