# GTS Planner Kassenbuch App v2 Knowledgebase

Version: v14 (nach Sprint 14: DevOps-Finalisierung)
Letzte Aktualisierung: 2026-03-25
Status: Sprint 14 abgeschlossen

## Sprint-Fortschritt

| Sprint | Status | Datum |
|---|---|---|
| Sprint 1-10: Vollständige App | ERLEDIGT | 2026-03-24 |
| Sprint 11: Dokumentation | ERLEDIGT | 2026-03-25 |
| Sprint 12: Deployment | ERLEDIGT | 2026-03-25 |
| Sprint 13: DevOps-Konzept | ERLEDIGT | 2026-03-25 |
| Sprint 14: DevOps-Finalisierung & ESLint | ERLEDIGT | 2026-03-25 |
| Sprint 15: React Native Mobile App | OFFEN | – |

## Kennzahlen

- 25 Frontend-Routen (Build erfolgreich)
- 201 Backend-Tests, 93% Coverage
- 131 Frontend-Tests (Vitest), alle grün
- 48 API-Pfade (OpenAPI 3.0.3)
- 17 Django Models
- 2 Produktions-Domains (www.gtsplaner.app, api.gtsplaner.app)

## Technische Regeln

- Export Parameter: `export_format` (nicht `format`)
- AuditLog `object_id`: leerer String als Default (nicht `NULL`)
- Frontend-Tests: Vitest + jsdom + testing-library/react
- Backend-Tests: pytest-django + pytest-cov
- Git-Workflow: GitHub Flow (Feature Branches + PRs)
- CI/CD: GitHub Actions (`ci.yml` + `cd.yml` + `release.yml`)
- NEXT_PUBLIC_API_URL wird zur Build-Zeit im Dockerfile gesetzt
- ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS müssen alle Domains enthalten
- SECURE_PROXY_SSL_HEADER ist gesetzt für Reverse-Proxy (DigitalOcean)
- Apex-Domain (`gtsplaner.app`) erfordert Cloudflare DNS für CNAME Flattening
- ESLint: Flat Config (`eslint.config.mjs`) mit `eslint .` als Lint-Script

## Deployment

- Plattform: DigitalOcean App Platform
- Region: Frankfurt (fra)
- Frontend: `www.gtsplaner.app` (CNAME -> `gtsplaner-58p4a.ondigitalocean.app`)
- Backend: `api.gtsplaner.app` (CNAME -> `gtsplaner-58p4a.ondigitalocean.app`)
- DNS-Provider: Hetzner (Empfehlung: Cloudflare für Apex-Domain)
- Autodeploy: Aktiv über GitHub Actions (`cd.yml`)

## Nächster Sprint: Sprint 15 – React Native Mobile App

Aufgaben:
1. Monorepo-Struktur vorbereiten (Turborepo/Nx)
2. Shared Packages extrahieren (api-client, logic)
3. UI-Komponenten-Strategie evaluieren (Tamagui)
