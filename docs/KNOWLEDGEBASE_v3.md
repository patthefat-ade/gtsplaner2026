# GTS Planner Kassenbuch App v2 – Knowledge Base

**Version:** v3.1 (nach Sprint 13: GitHub-Infrastruktur)
**Letzte Aktualisierung:** 2026-03-25

---

## 1. Projektübersicht & Tech-Stack

| Eigenschaft | Wert |
|---|---|
| **Projektname** | GTS Planner – Kassenbuch App v2 |
| **Backend** | Django 5.2 + DRF + drf-spectacular + Django Unfold |
| **Frontend** | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui |
| **Datenbank** | PostgreSQL 16 |
| **Deployment** | DigitalOcean App Platform (Docker-basiert) |
| **CI/CD** | GitHub Actions |
| **API-Standard** | OpenAPI 3.0 |

---

## 2. DevOps & Workflow

### 2.1 Git-Workflow: GitHub Flow

Wir verwenden den **GitHub Flow** als primäres Branching-Modell.

- **`main` Branch:** Ist immer produktionsreif. Direkte Commits sind durch **Branch Protection Rules** blockiert.
- **Feature Branches:** Jede Änderung (Feature, Bugfix, Chore) wird in einem eigenen Branch entwickelt, der von `main` abzweigt. (z.B. `feature/neues-feature`, `fix/alter-bug`).
- **Pull Requests (PRs):** Änderungen werden ausschließlich über Pull Requests in `main` gemerged. Jeder PR erfordert mindestens **eine genehmigende Review** und **erfolgreiche CI-Checks**.

### 2.2 Task-Management: GitHub Issues

- **Zentrale Verwaltung:** Alle Tasks, Bugs und Features werden als **GitHub Issues** angelegt.
- **Kategorisierung:** Issues werden mit **Labels** für Sprint (`sprint-14`), Bereich (`scope:frontend`), Typ (`type:feature`) und Priorität (`priority:high`) versehen.
- **Nachvollziehbarkeit:** PRs werden mit Issues verknüpft (`Closes #42`), um den Entwicklungszyklus transparent zu machen.

### 2.3 Versionierung: Semantic Versioning & GitHub Releases

- **Schema (SemVer):** `MAJOR.MINOR.PATCH` (z.B. `v1.2.1`)
- **Tags:** Jeder Release wird mit einem Git-Tag markiert (z.B. `v1.2.1`).
- **Releases:** Zu jedem Tag wird ein **GitHub Release** mit einem automatisierten Changelog erstellt.

### 2.4 CI/CD: GitHub Actions

Drei Workflows automatisieren den Prozess:

1.  **`ci.yml` (Continuous Integration):**
    -   **Trigger:** Bei jedem Push auf einen Feature-Branch oder PR nach `main`.
    -   **Aktionen:** Führt Backend-Tests (pytest + PostgreSQL) und Frontend-Tests (Vitest + Lint) aus.
    -   **Ziel:** Stellt die Code-Qualität sicher, bevor ein Merge stattfindet.

2.  **`cd.yml` (Continuous Deployment):**
    -   **Trigger:** Nur bei einem Merge in den `main`-Branch.
    -   **Aktionen:** Löst ein neues Deployment auf der DigitalOcean App Platform aus.
    -   **Ziel:** Automatisierte und schnelle Veröffentlichung von neuem, getestetem Code.

3.  **`release.yml` (Release Automatisierung):**
    -   **Trigger:** Bei jedem Push eines neuen Tags (`v*.*.*`).
    -   **Aktionen:** Erstellt automatisch ein GitHub Release mit einem Changelog der Commits seit dem letzten Tag.

### 2.5 Zukünftige Skalierung: React Native

Für die Entwicklung einer mobilen App wird eine Erweiterung des Monorepos empfohlen, um maximalen Code-Austausch zu ermöglichen.

-   **Tooling:** Einsatz von **Turborepo** oder **Nx** zur Verwaltung des Monorepos.
-   **Struktur:**
    ```
    /apps
    ├── backend/      # Django
    ├── web/          # Next.js
    └── mobile/       # React Native
    /packages
    ├── ui/           # Geteilte UI-Komponenten (z.B. mit Tamagui)
    ├── api-client/   # Geteilter Axios-Client & API-Typen
    └── logic/        # Geteilte Hooks, Validierungen, etc.
    ```
-   **UI-Sharing:** Nutzung von Frameworks wie **Tamagui** oder **Solito**, um plattformübergreifende UI-Komponenten zu erstellen.

---

## 3. Deployment & Infrastruktur

### 3.1 Plattform: DigitalOcean App Platform

-   **Services:** `backend` (Django), `frontend` (Next.js)
-   **Datenbank:** Managed PostgreSQL von DigitalOcean.
-   **Domains:**
    -   Frontend: `https://www.gtsplaner.app`
    -   Backend: `https://api.gtsplaner.app`
-   **Secrets:** `DIGITALOCEAN_ACCESS_TOKEN` und `DO_APP_ID` sind als Repository Secrets für GitHub Actions hinterlegt.

### 3.2 DNS-Hinweis

-   Die Apex-Domain (`gtsplaner.app`) kann mit Hetzner als DNS-Provider nicht direkt auf DigitalOcean zeigen. **Empfehlung:** Umstieg auf **Cloudflare DNS** (kostenlos), um CNAME Flattening zu nutzen und die Apex-Domain ebenfalls "Active" zu schalten.

---

## 4. Wichtige Befehle

```bash
# Lokale Entwicklung starten (Docker)
docker-compose up -d --build

# Backend-Tests ausführen
docker-compose exec backend pytest

# Frontend-Tests ausführen
docker-compose exec frontend pnpm test

# Superuser im Backend erstellen
docker-compose exec backend python manage.py createsuperuser

# Logs anzeigen
docker-compose logs -f <service_name> # z.B. backend oder frontend
```
