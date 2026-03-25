# Sprint 14: DevOps-Finalisierung & ESLint-Setup

## Übersicht

Dieser Sprint konzentrierte sich auf die Finalisierung des DevOps-Workflows und die Behebung von CI-Problemen. Alle offenen Sprint-14-Issues wurden abgearbeitet.

## Erledigte Issues

| Issue | Titel | Status | Anmerkung |
|---|---|---|---|
| #1 | GitHub Actions CI Workflow einrichten | Geschlossen | Erledigt in Sprint 13, aber ESLint-Setup nachgeholt |
| #2 | GitHub Actions CD Workflow einrichten | Geschlossen | Verifiziert, funktioniert mit Secrets |
| #3 | Branch Protection Rules für main | Geschlossen | Verifiziert, Regeln sind aktiv |
| #4 | Login-Seite Redesign | Geschlossen | Erledigt in Sprint 13, PR #8 gemerged |
| #5 | Cloudflare DNS für Apex-Domain | Geschlossen | Anleitung erstellt (`docs/CLOUDFLARE_DNS_MIGRATION.md`) |
| #6 | Release-Workflow definieren | Geschlossen | Anleitung erstellt (`docs/RELEASE_WORKFLOW.md`) |

## ESLint-Setup (PR #9)

**Problem:** Die CI-Pipeline schlug bei Frontend-Tests fehl, weil ESLint nicht korrekt konfiguriert war.

**Lösung:**

1. **ESLint 9 + eslint-config-next** als devDependencies in `package.json` hinzugefügt
2. **`eslint.config.mjs`** mit Flat Config für Next.js 16 erstellt
3. **Lint-Script** in `package.json` von `next lint` auf `eslint .` geändert
4. **2 ESLint-Errors** gefixt (`react-hooks/set-state-in-effect`)
5. **1 Vitest-Test** gefixt (baseURL-Test für CI-Umgebung)

**Ergebnis:** Die CI-Pipeline läuft jetzt vollständig grün durch.

## CD-Workflow Verifizierung

Der CD-Workflow (`cd.yml`) wurde verifiziert und funktioniert. Nach dem Merge von PR #9 wurde automatisch ein Deployment auf DigitalOcean ausgelöst.

- **Letzter erfolgreicher Run:** #23538075301
- **Dauer:** 4m 19s
- **Secrets:** `DIGITALOCEAN_ACCESS_TOKEN` und `DO_APP_ID` sind korrekt konfiguriert

## Dokumentation

Zwei neue Anleitungen wurden erstellt:

1. **`docs/RELEASE_WORKFLOW.md`**: Beschreibt den vollständigen Release-Prozess mit Semantic Versioning, Tags, GitHub Actions und Hotfix-Workflow.
2. **`docs/CLOUDFLARE_DNS_MIGRATION.md`**: Schritt-für-Schritt-Anleitung für die Migration von Hetzner DNS zu Cloudflare, um die Apex-Domain `gtsplaner.app` zu aktivieren.

## Nächster Sprint: Sprint 15 – React Native Mobile App

Der nächste Sprint konzentriert sich auf die Planung und Vorbereitung der React Native Mobile App.

**Offene Issues:**

| Issue | Titel | Labels |
|---|---|---|
| #7 | [Planung] React Native Mobile App: Monorepo-Struktur vorbereiten | `sprint-15`, `scope:mobile`, `priority:medium` |
