# Release-Workflow – GTS Planer

## Übersicht

Der GTS Planer verwendet **Semantic Versioning** (SemVer) und einen automatisierten Release-Workflow über GitHub Actions. Dieses Dokument beschreibt den vollständigen Prozess von der Entwicklung bis zum Release.

## Semantic Versioning

Die Versionsnummer folgt dem Schema **`MAJOR.MINOR.PATCH`**:

| Segment | Wann erhöhen? | Beispiel |
|---------|---------------|----------|
| **MAJOR** | Breaking Changes, große Architektur-Umbauten | `1.0.0` → `2.0.0` |
| **MINOR** | Neue Features, die abwärtskompatibel sind | `1.2.0` → `1.3.0` |
| **PATCH** | Bugfixes, kleine Verbesserungen | `1.2.0` → `1.2.1` |

## Bisherige Releases

| Version | Sprint | Beschreibung |
|---------|--------|--------------|
| `v1.0.0` | Sprint 1–10 | Vollständige Kassenbuch-App (Backend + Frontend) |
| `v1.1.0` | Sprint 12 | Deployment auf DigitalOcean App Platform |
| `v1.2.0` | Sprint 13 | DevOps-Konzept, GitHub-Infrastruktur, Dokumentation |

## Release-Prozess

### Schritt 1: Sprint abschließen

Alle Issues des Sprints müssen geschlossen und alle Feature-Branches in `main` gemerged sein. Die CI-Pipeline muss auf `main` grün sein.

### Schritt 2: Version bestimmen

Entscheiden Sie anhand der Änderungen, ob es ein MAJOR, MINOR oder PATCH Release ist. In der Regel gilt:

- Neuer Sprint mit Features → **MINOR** (z.B. `v1.3.0`)
- Nur Bugfixes nach einem Release → **PATCH** (z.B. `v1.2.1`)
- API-Breaking Changes oder große Umbauten → **MAJOR** (z.B. `v2.0.0`)

### Schritt 3: Tag erstellen und pushen

```bash
# Auf main wechseln und aktualisieren
git checkout main
git pull origin main

# Tag erstellen
git tag -a v1.3.0 -m "v1.3.0 – Sprint 14: Login-Redesign & DevOps"

# Tag pushen (löst automatisch den Release-Workflow aus)
git push origin v1.3.0
```

### Schritt 4: Automatischer Release

Nach dem Push des Tags passiert automatisch:

1. **GitHub Actions `release.yml`** wird ausgelöst
2. Der Workflow generiert ein **Changelog** aus den Commits seit dem letzten Tag
3. Ein **GitHub Release** wird erstellt mit:
   - Automatisch generiertem Changelog
   - Link zum vollständigen Diff

### Schritt 5: Deployment verifizieren

Der Tag-Push auf `main` löst auch den **CD-Workflow** aus, der ein Deployment auf DigitalOcean startet. Verifizieren Sie nach dem Deployment:

```bash
# API Health Check
curl https://api.gtsplaner.app/api/health-check/

# Frontend erreichbar
curl -sL https://www.gtsplaner.app/ | head -5
```

## Hotfix-Workflow

Für dringende Bugfixes nach einem Release:

```bash
# Hotfix-Branch von main erstellen
git checkout main
git checkout -b hotfix/critical-bug-fix

# Fix implementieren und committen
git add .
git commit -m "fix: kritischen Bug in XY beheben"

# PR erstellen
gh pr create --title "hotfix: kritischen Bug beheben" --base main

# Nach Merge: Patch-Release erstellen
git checkout main
git pull origin main
git tag -a v1.2.1 -m "v1.2.1 – Hotfix: kritischen Bug behoben"
git push origin v1.2.1
```

## Commit-Konventionen

Für saubere Changelogs verwenden wir **Conventional Commits**:

| Prefix | Bedeutung | Beispiel |
|--------|-----------|----------|
| `feat:` | Neues Feature | `feat: Login-Seite Redesign mit Splitscreen` |
| `fix:` | Bugfix | `fix: CORS-Header für www-Domain hinzufügen` |
| `docs:` | Dokumentation | `docs: Release-Workflow dokumentieren` |
| `chore:` | Wartung, Dependencies | `chore: ESLint Dependencies aktualisieren` |
| `refactor:` | Code-Refactoring | `refactor: Auth Layout mit useSyncExternalStore` |
| `test:` | Tests | `test: baseURL-Test für CI-Umgebung anpassen` |
| `ci:` | CI/CD Änderungen | `ci: Frontend Lint-Step in CI-Pipeline fixen` |

## Branch-Naming-Konventionen

| Typ | Pattern | Beispiel |
|-----|---------|----------|
| Feature | `feature/<beschreibung>` | `feature/login-redesign` |
| Bugfix | `fix/<beschreibung>` | `fix/cors-headers` |
| Hotfix | `hotfix/<beschreibung>` | `hotfix/critical-auth-bug` |
| DevOps | `chore/<beschreibung>` | `chore/eslint-setup` |
| Docs | `docs/<beschreibung>` | `docs/release-workflow` |

## Checkliste vor einem Release

- [ ] Alle Sprint-Issues geschlossen
- [ ] Alle Feature-Branches in `main` gemerged
- [ ] CI-Pipeline auf `main` grün (Backend-Tests + Frontend Lint & Tests)
- [ ] Knowledge Base aktualisiert
- [ ] Sprint-Dokumentation erstellt
- [ ] Google Drive synchronisiert
- [ ] Version bestimmt (MAJOR/MINOR/PATCH)
- [ ] Tag erstellt und gepusht
- [ ] Release auf GitHub erstellt (automatisch)
- [ ] Deployment verifiziert (API + Frontend)
