# Sprint 14: Login-Seite Redesign

**Datum:** 2026-03-25
**Status:** Abgeschlossen
**Issue:** [#4](https://github.com/patthefat-ade/gtsplaner2026/issues/4)
**Pull Request:** [#8](https://github.com/patthefat-ade/gtsplaner2026/pull/8)

---

## 1. Ziele

- Neugestaltung der Login-Seite in einem modernen 40/60 Splitscreen-Layout.
- Integration von fröhlichen, animierten Cartoon-Kinder-Illustrationen, um die Zielgruppe anzusprechen.
- Vollständige Umsetzung nach dem etablierten GitHub Flow (Feature Branch, Pull Request, CI-Checks).

---

## 2. Umsetzung & Technische Details

Die Entwicklung erfolgte im Feature Branch `feature/login-redesign`.

### 2.1 Layout-Anpassung

- **Datei:** `frontend/src/app/(auth)/layout.tsx`
- **Änderung:** Das Layout wurde komplett umgebaut, um eine zweigeteilte Ansicht zu ermöglichen:
  - **Linke Seite (40%):** Beinhaltet das Login-Formular. Auf mobilen Geräten nimmt dieser Bereich 100% der Breite ein.
  - **Rechte Seite (60%):** Zeigt die Illustration und ist auf mobilen Geräten (unter dem `lg`-Breakpoint) ausgeblendet, um die Benutzerfreundlichkeit zu gewährleisten.

### 2.2 Illustrationen & Animationen

- **Assets:** Zwei AI-generierte Illustrationen wurden erstellt und als optimierte WebP-Dateien im Ordner `frontend/public/assets/login/` abgelegt:
  - `children-scene-main.webp` (314 KB) für den Light Mode.
  - `children-scene-dark.webp` (442 KB) für den Dark Mode.
- **Dynamischer Wechsel:** Die Komponente `(auth)/layout.tsx` verwendet den `useTheme`-Hook von `next-themes`, um je nach aktivem Theme automatisch die passende Illustration zu laden.
- **Animationen:** In `frontend/src/app/globals.css` wurden mehrere CSS-Keyframe-Animationen hinzugefügt, um die Illustrationsseite lebendiger zu gestalten:
  - `float-slow`, `float-medium`, `float-fast`: Simulieren schwebende, dekorative Kreise.
  - `twinkle`: Lässt kleine Sterne/Funkeln aufblitzen.
  - `fade-in-up`: Sorgt für ein sanftes Einblenden der Hauptillustration.
  - `gentle-bounce`: Lässt die Hauptillustration leicht auf und ab schweben.

### 2.3 Code-Anpassungen

- **Datei:** `frontend/src/app/(auth)/login/page.tsx`
- **Änderung:** Die `Card`-Komponente wurde angepasst, um auf dem Desktop einen Rahmen und Schatten zu haben, auf Mobilgeräten aber rahmenlos und transparent zu sein, damit sie sich nahtlos in das Layout einfügt.

---

## 3. Ergebnis

- Die neue Login-Seite ist fertig entwickelt und als **Pull Request #8** zur Review bereit.
- Der PR hat automatisch die CI-Pipeline (GitHub Actions) ausgelöst, welche die Code-Qualität durch Tests und Linting sicherstellt.
- Nach der Genehmigung und dem Merge des PRs in den `main`-Branch wird die CD-Pipeline (`cd.yml`) das neue Design automatisch auf `www.gtsplaner.app` deployen.

Dieses Vorgehen demonstriert den vollständigen, etablierten DevOps-Zyklus: von der Anforderung (Issue) über die Entwicklung im Feature Branch bis zum automatisierten Deployment.
