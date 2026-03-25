# Sprint 13: Deployment & DevOps-Konzept

**Datum:** 2026-03-25
**Status:** In Arbeit

**Ziele:**
1.  Dokumentation des erfolgreichen Deployments auf DigitalOcean App Platform.
2.  Erstellung eines langfristigen DevOps-Konzepts für zukünftige Feature-Entwicklung und Skalierung (inkl. React Native).
3.  Aktualisierung der zentralen Knowledge Base.

---

## 1. Deployment auf DigitalOcean: Ein Erfahrungsbericht

Dieser Abschnitt dokumentiert die Schritte, Herausforderungen und Lösungen während des ersten Deployments der GTS Planer App auf der DigitalOcean App Platform.

### 1.1 Ausgangslage & Probleme

Nach dem initialen Push auf das mit DigitalOcean verbundene GitHub-Repository (`patthefat-ade/gtsplaner2026`) traten mehrere Probleme auf:

1.  **Routing-Problem:** API-Aufrufe an `/api/*` wurden vom Frontend-Service abgefangen und auf die Hauptdomain umgeleitet (HTTP 302), anstatt an den Backend-Service weitergeleitet zu werden.
2.  **CORS-Fehler:** Nachdem das Routing teilweise funktionierte, blockierte die CORS-Policy Anfragen vom Frontend (`www.gtsplaner.app`) an die API (`api.gtsplaner.app`).
3.  **`ALLOWED_HOSTS`-Fehler:** Die API lieferte einen `400 Bad Request`, da die Custom Domains (`api.gtsplaner.app`) nicht in den `ALLOWED_HOSTS` von Django eingetragen waren.
4.  **DNS- & SSL-Problem:** Die Apex-Domain (`gtsplaner.app`) blieb im Status "Configuring", da der DNS-Provider (Hetzner) kein CNAME Flattening unterstützt, was für die SSL-Zertifikatsausstellung durch DigitalOcean bei Apex-Domains erforderlich ist.

### 1.2 Implementierte Lösungen

Die Probleme wurden durch eine Kombination aus Code-Anpassungen und Konfigurationsänderungen gelöst.

#### Backend-Anpassungen (`settings.py`)

Die `settings.py` wurde an mehreren Stellen für den Produktionsbetrieb hinter einem Reverse-Proxy (wie bei DigitalOcean) gehärtet:

```python
# /backend/config/settings.py

# 1. Dynamische ALLOWED_HOSTS aus Umgebungsvariable oder sicherem Default
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1,gtsplaner.app,api.gtsplaner.app,www.gtsplaner.app,gtsplaner-58p4a.ondigitalocean.app",
    cast=Csv(),
)

# 2. Reverse-Proxy Header erkennen
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# 3. Secure Cookies in Produktion
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# 4. CORS & CSRF Origins erweitert um die www-Subdomain
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,https://gtsplaner-58p4a.ondigitalocean.app,https://gtsplaner.app,https://www.gtsplaner.app,https://api.gtsplaner.app",
    cast=Csv(),
)
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000,https://gtsplaner-58p4a.ondigitalocean.app,https://gtsplaner.app,https://www.gtsplaner.app,https://api.gtsplaner.app",
    cast=Csv(),
)
```

#### DNS-Konfiguration (Hetzner & DigitalOcean)

- **Lösung:** Umstieg auf die `www`-Subdomain für das Frontend, da hier ein CNAME-Record problemlos möglich ist.
- **Aktion:** Bei Hetzner wurde ein `CNAME`-Record für `www` auf den DigitalOcean-Hostnamen `gtsplaner-58p4a.ondigitalocean.app` gesetzt.
- **Ergebnis:** `www.gtsplaner.app` und `api.gtsplaner.app` wurden im DigitalOcean Dashboard als "Active" erkannt und erhielten SSL-Zertifikate.

#### DigitalOcean App Platform Konfiguration

- **Umgebungsvariablen:** Die `ALLOWED_HOSTS` wurden direkt in der App-Spezifikation bzw. im Dashboard gesetzt, um die Code-Defaults zu überschreiben und alle Domains explizit zu erlauben.
- **Routing:** Die `do-app-spec.yml` wurde so konfiguriert, dass Anfragen an `/api` an den Backend-Service und alle anderen (`/`) an den Frontend-Service geleitet werden.

```yaml
# /do-app-spec.yml
services:
  - name: backend
    routes:
      - path: /api
  - name: frontend
    routes:
      - path: /
```

### 1.3 Finaler Status

Die Anwendung ist nun unter folgenden Adressen stabil erreichbar:

| URL | Zweck | Status |
|---|---|---|
| `https://www.gtsplaner.app` | Frontend (Next.js) | **Aktiv** |
| `https://api.gtsplaner.app` | Backend (Django API) | **Aktiv** |
| `https://api.gtsplaner.app/api/docs/` | API-Dokumentation | **Aktiv** |
| `https://api.gtsplaner.app/admin/` | Django Admin Panel | **Aktiv** |

**Offener Punkt:** Die Apex-Domain `gtsplaner.app` leitet nicht auf `www` weiter. **Empfehlung:** Umstieg auf Cloudflare als DNS-Provider, um CNAME Flattening für die Apex-Domain zu nutzen.


---

## 2. Langfristiges DevOps-Konzept

Basierend auf dem aktuellen Tech-Stack (Django, Next.js, Docker) und den zukünftigen Anforderungen (React Native, Feature-Erweiterungen) wird folgendes DevOps-Konzept empfohlen, um Skalierbarkeit, Stabilität und eine hohe Entwicklungsgeschwindigkeit sicherzustellen.

### 2.1 Git-Workflow: GitHub Flow mit Feature Branches

Für dieses Projekt wird der **GitHub Flow** als Branching-Modell empfohlen. Er ist einfach, schnell und fördert kontinuierliche Releases, was ideal für Webanwendungen und kleine bis mittelgroße Teams ist. Das komplexere GitFlow-Modell mit separaten `develop`- und `release`-Branches ist für dieses Projekt aktuell ein Overkill.

**Kernprinzipien:**

1.  **`main` ist immer produktionsreif:** Alles auf dem `main`-Branch muss jederzeit deploybar sein. Direkte Commits auf `main` sind streng verboten.
2.  **Feature Branches für alles:** Jede neue Funktion, jeder Bugfix und jede Änderung wird in einem eigenen, dedizierten Branch entwickelt. Der Branch wird direkt von `main` erstellt.
    -   **Namenskonvention:** `feature/login-redesign`, `fix/cors-error`, `chore/update-dependencies`
3.  **Pull Requests (PRs) für Code-Reviews:** Bevor ein Feature Branch in `main` gemerged wird, muss ein Pull Request auf GitHub erstellt werden. Mindestens ein anderes Teammitglied muss den Code reviewen und genehmigen.
4.  **Deployment nach dem Merge:** Sobald ein PR in `main` gemerged wird, wird automatisch ein neues Deployment auf der Staging- oder Produktionsumgebung ausgelöst (via GitHub Actions).

**Vorteile:**
-   **Stabiler `main`-Branch:** Reduziert das Risiko von fehlerhaftem Code in der Produktion.
-   **Code-Qualität:** Pull Requests und Code-Reviews sind ein integraler Bestandteil des Prozesses.
-   **Parallelentwicklung:** Mehrere Entwickler können ungestört an verschiedenen Features arbeiten.
-   **Einfachheit:** Leicht zu erlernen und umzusetzen.

### 2.2 CI/CD mit GitHub Actions

GitHub Actions sind das Werkzeug der Wahl, um den oben beschriebenen Workflow zu automatisieren. Es werden zwei zentrale Workflows empfohlen:

1.  **`ci.yml` (Continuous Integration):** Wird bei jedem Push auf einen Feature Branch und bei jedem Pull Request auf `main` ausgelöst.
2.  **`cd.yml` (Continuous Deployment):** Wird nur bei einem Merge auf den `main`-Branch ausgelöst.

#### Workflow 1: `ci.yml` (Test & Lint)

Dieser Workflow stellt sicher, dass neuer Code die Qualitätsstandards erfüllt, bevor er überhaupt für einen Merge in Frage kommt.

```yaml
# .github/workflows/ci.yml
name: CI - Test & Lint

on:
  push:
    branches:
      - "**"
      - "!main"
  pull_request:
    branches:
      - main

jobs:
  backend-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >- 
          --health-cmd="pg_isready" 
          --health-interval=10s 
          --health-timeout=5s 
          --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install Dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run Tests
        run: |
          cd backend
          pytest --cov=.
        env:
          DATABASE_URL: postgres://test_user:test_password@localhost:5432/test_db
          SECRET_KEY: test-secret-key

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install Dependencies
        run: |
          cd frontend
          corepack enable pnpm
          pnpm install --frozen-lockfile
      - name: Run Lint & Tests
        run: |
          cd frontend
          pnpm lint
          pnpm test
```

#### Workflow 2: `cd.yml` (Build & Deploy)

Dieser Workflow baut die Docker-Images und pusht sie nach DigitalOcean, was automatisch ein neues Deployment auslöst. (Hinweis: DigitalOcean App Platform kann auch direkt von GitHub bauen, aber ein eigener Build-Prozess gibt mehr Kontrolle).

```yaml
# .github/workflows/cd.yml
name: CD - Build & Deploy to DigitalOcean

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Build and push Docker images
        run: |
          doctl registry login
          docker build -t registry.digitalocean.com/gtsplaner-registry/backend:$(git rev-parse --short HEAD) ./backend
          docker build -t registry.digitalocean.com/gtsplaner-registry/frontend:$(git rev-parse --short HEAD) ./frontend
          docker push registry.digitalocean.com/gtsplaner-registry/backend:$(git rev-parse --short HEAD)
          docker push registry.digitalocean.com/gtsplaner-registry/frontend:$(git rev-parse --short HEAD)

      - name: Trigger App Platform deployment
        run: doctl apps create-deployment ${{ secrets.DO_APP_ID }} --wait
```

### 2.3 Zukunft: React Native Integration

Die aktuelle Monorepo-Struktur ist bereits gut geeignet, um eine React Native App hinzuzufügen. Der Schlüssel liegt darin, so viel Code wie möglich zwischen der Web-App (Next.js) und der Mobile-App (React Native) zu teilen.

**Struktur-Erweiterung:**

```
gtsplaner2026-repo/
├── apps/
│   ├── backend/      # Django
│   ├── web/          # Next.js (vorher: frontend)
│   └── mobile/       # React Native (neu)
├── packages/
│   ├── ui/           # Geteilte, plattformunabhängige UI-Komponenten (z.B. mit Tamagui)
│   ├── api-client/   # Geteilter Axios-Client & API-Typen
│   └── logic/        # Geteilte Business-Logik, Hooks, Validierungen
└── ...
```

**Strategie:**

1.  **Monorepo-Tooling:** Umstieg auf ein robustes Monorepo-Tool wie **Turborepo** oder **Nx**, um Abhängigkeiten und Build-Prozesse effizient zu verwalten.
2.  **Code Sharing:**
    -   **API-Client & Typen:** Der vorhandene `api.ts` und die `models.ts` können in ein separates `packages/api-client`-Paket ausgelagert und von beiden Frontends genutzt werden.
    -   **Business-Logik:** Hooks (`use-auth`, `use-finance`), Validierungsschemas (Zod) und Formatierungs-Utilities können ebenfalls in ein `packages/logic`-Paket.
    -   **UI-Komponenten:** Das ist die größte Herausforderung. Frameworks wie **Tamagui** oder **Solito** ermöglichen es, UI-Komponenten einmal zu schreiben und sie sowohl im Web (als `div`, `span`) als auch auf dem Handy (als `View`, `Text`) rendern zu lassen. Dies erfordert eine Umstellung der bestehenden `shadcn/ui`-Komponenten.
3.  **Authentifizierung:** Der bestehende JWT-Mechanismus (Access/Refresh Token im `localStorage` bzw. `AsyncStorage`) funktioniert für React Native genauso gut wie für das Web.

### 2.4 Beispiel-Workflow: Login-Redesign

Anhand des gewünschten Features ("Überarbeitung Frontend Login Bereich in 40/60 Splitscreen mit animierten Kindern") lässt sich der Workflow demonstrieren:

1.  **Ticket erstellen:** Ein neues Ticket/Issue auf GitHub wird erstellt: `FEAT: Login Page Redesign`.
2.  **Branch erstellen:** Ein Entwickler erstellt lokal einen neuen Branch:
    ```bash
    git checkout main
    git pull origin main
    git checkout -b feature/login-redesign
    ```
3.  **Entwicklung (Lokal):**
    -   **Assets:** Die animierten Cartoon-Kinder (z.B. als Lottie-Files oder SVGs) werden im `frontend/public/assets`-Ordner abgelegt.
    -   **Komponenten:** Die `login/page.tsx` wird umgebaut. Ein 60/40-Layout wird mit Flexbox oder CSS Grid erstellt. Die rechte Seite enthält die Animationen, die linke Seite das Login-Formular.
    -   **Commits:** Der Entwickler macht kleine, atomare Commits: `feat: add login page layout`, `feat: integrate login animation`, `style: adjust form styling`.
4.  **Push & CI:** Der Entwickler pusht seinen Branch:
    ```bash
    git push -u origin feature/login-redesign
    ```
    -   GitHub Actions (`ci.yml`) wird automatisch ausgelöst und führt alle Backend- und Frontend-Tests aus.
5.  **Pull Request:** Nach erfolgreichen Tests erstellt der Entwickler einen Pull Request von `feature/login-redesign` nach `main`. Er beschreibt die Änderungen und verlinkt das Ticket.
6.  **Code Review:** Ein anderer Entwickler prüft den Code, testet die Funktionalität in einer Preview-Umgebung (falls konfiguriert) und fordert ggf. Änderungen an.
7.  **Merge & CD:** Nach der Genehmigung wird der PR in `main` gemerged.
    -   GitHub Actions (`cd.yml`) wird ausgelöst.
    -   Die neuen Docker-Images werden gebaut und in die DigitalOcean Registry gepusht.
    -   Das Deployment auf der DigitalOcean App Platform wird angestoßen.
8.  **Verifizierung:** Nach wenigen Minuten ist die neue Login-Seite live auf `www.gtsplaner.app/login` verfügbar.
