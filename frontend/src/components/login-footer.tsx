"use client";

import { useState } from "react";
import { LegalModal } from "./legal-modal";
import { LEGAL_CONTENT, type LegalContentKey } from "@/lib/legal-content";

export function LoginFooter() {
  const [openModal, setOpenModal] = useState<LegalContentKey | null>(null);

  const links: { key: LegalContentKey; label: string }[] = [
    { key: "impressum", label: "Impressum" },
    { key: "datenschutz", label: "Datenschutz" },
    { key: "nutzungsbedingungen", label: "Nutzungsbedingungen" },
  ];

  return (
    <>
      {/* Footer links – no absolute positioning, flows naturally in layout */}
      <div className="py-3 px-4">
        <div className="flex items-center justify-center gap-3 sm:gap-4 text-[11px] sm:text-xs flex-wrap">
          {links.map((link, index) => (
            <span key={link.key} className="flex items-center gap-3 sm:gap-4">
              {index > 0 && (
                <span className="text-zinc-400 dark:text-zinc-600">|</span>
              )}
              <button
                onClick={() => setOpenModal(link.key)}
                className="text-zinc-500 dark:text-zinc-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors underline-offset-2 hover:underline whitespace-nowrap"
              >
                {link.label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Modal rendered at top level with high z-index */}
      {openModal && (
        <LegalModal
          isOpen={true}
          onClose={() => setOpenModal(null)}
          title={LEGAL_CONTENT[openModal].title}
          content={LEGAL_CONTENT[openModal].content}
        />
      )}
    </>
  );
}
