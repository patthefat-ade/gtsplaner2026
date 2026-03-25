# GTS Planner Kassenbuch App v2 – Knowledge Base

**Version:** v3 (nach Sprint 13: Deployment & DevOps)
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

- **`main` Branch:** Ist immer produktionsreif. Direkte Commits sind verboten.
- **Feature Branches:** Jede Änderung (Feature, Bugfix, Chore) wird in einem eigenen Branch entwickelt, der von `main` abzweigt. (z.B. `feature/neues-feature`, `fix/alter-bug`).
- **Pull Requests (PRs):** Änderungen werden ausschließlich über Pull Requests in `main` gemerged. Jeder PR erfordert mindestens ein Review von einem anderen Teammitglied.

### 2.2 CI/CD: GitHub Actions

Zwei Workflows automatisieren den Prozess:

1.  **`ci.yml` (Continuous Integration):**
    -   **Trigger:** Bei jedem Push auf einen Feature-Branch oder PR nach `main`.
    -   **Aktionen:** Führt Backend-Tests (pytest) gegen eine temporäre PostgreSQL-DB und Frontend-Tests (Vitest) sowie Linting aus.
    -   **Ziel:** Stellt die Code-Qualität sicher, bevor ein Merge stattfindet.

2.  **`cd.yml` (Continuous Deployment):**
    -   **Trigger:** Nur bei einem Merge in den `main`-Branch.
    -   **Aktionen:** Baut die Docker-Images für Backend und Frontend, pusht sie in die DigitalOcean Container Registry und löst ein neues Deployment auf der App Platform aus.
    -   **Ziel:** Automatisierte und schnelle Veröffentlichung von neuem, getestetem Code.

### 2.3 Zukünftige Skalierung: React Native

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

Die Anwendung wird als Multi-Service-App auf der DigitalOcean App Platform gehostet. Die Konfiguration wird über die `do-app-spec.yml` im Root-Verzeichnis des Repositories verwaltet.

-   **Services:** `backend` (Django), `frontend` (Next.js)
-   **Datenbank:** Managed PostgreSQL von DigitalOcean.
-   **Domains:**
    -   Frontend: `https://www.gtsplaner.app`
    -   Backend: `https://api.gtsplaner.app`

### 3.2 Wichtige Produktions-Konfigurationen

-   **`ALLOWED_HOSTS` (Django):** Muss alle verwendeten Domains enthalten. Wird über eine Umgebungsvariable im DigitalOcean Dashboard gesetzt.
-   **`CORS_ALLOWED_ORIGINS` (Django):** Muss die Frontend-Domain (`https://www.gtsplaner.app`) enthalten, damit der Browser API-Anfragen erlaubt.
-   **`CSRF_TRUSTED_ORIGINS` (Django):** Muss ebenfalls die Frontend-Domain enthalten.
-   **`SECURE_PROXY_SSL_HEADER` (Django):** Ist gesetzt, damit Django den `X-Forwarded-Proto`-Header von DigitalOceans Load Balancer korrekt interpretiert und HTTPS-Links generiert.
-   **`NEXT_PUBLIC_API_URL` (Next.js):** Wird zur Build-Zeit im `Dockerfile` auf `https://api.gtsplaner.app/api/v1` gesetzt, um sicherzustellen, dass das Frontend immer die korrekte API-URL verwendet.

### 3.3 DNS-Hinweis

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
