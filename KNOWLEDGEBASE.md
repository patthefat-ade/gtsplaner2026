# GTS Planner Kassenbuch App v2 Knowledgebase

Version: v13 (nach Sprint 13: Deployment & DevOps)
Letzte Aktualisierung: 2026-03-25
Status: Sprint 13 abgeschlossen

## Sprint-Fortschritt

| Sprint | Status | Datum |
|---|---|---|
| Sprint 1-7: Grundlagen bis State Management | ERLEDIGT | 2026-03-01 |
| Sprint 8: Admin Panel und Audit | ERLEDIGT | 2026-03-24 |
| Sprint 9: Frontend-Seiten erweitern | ERLEDIGT | 2026-03-24 |
| Sprint 10: Testing | ERLEDIGT | 2026-03-24 |
| Sprint 11: Dokumentation | ERLEDIGT (im Rahmen Sprint 13) | 2026-03-25 |
| Sprint 12: Deployment | ERLEDIGT | 2026-03-25 |
| Sprint 13: Deployment & DevOps-Konzept | ERLEDIGT | 2026-03-25 |
| Sprint 14: Login-Redesign | IN ARBEIT (PR #8) | 2026-03-25 |
| Sprint 15: React Native Mobile App | OFFEN | – |

## Kennzahlen

- 25 Frontend-Routen (Build erfolgreich)
- 201 Backend-Tests, 93% Coverage
- 131 Frontend-Tests (Vitest)
- 48 API-Pfade (OpenAPI 3.0.3)
- 17 Django Models
- 2 Produktions-Domains (www.gtsplaner.app, api.gtsplaner.app)

## Technische Regeln

- Export Parameter: export_format (nicht format)
- AuditLog object_id: leerer String als Default (nicht NULL)
- Frontend-Tests: Vitest + jsdom + testing-library/react
- Backend-Tests: pytest-django + pytest-cov
- Git-Workflow: GitHub Flow (Feature Branches + PRs)
- CI/CD: GitHub Actions (ci.yml + cd.yml)
- NEXT_PUBLIC_API_URL wird zur Build-Zeit im Dockerfile gesetzt
- ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS muessen alle Domains enthalten
- SECURE_PROXY_SSL_HEADER ist gesetzt fuer Reverse-Proxy (DigitalOcean)
- Apex-Domain (gtsplaner.app) erfordert Cloudflare DNS fuer CNAME Flattening

## Deployment

- Plattform: DigitalOcean App Platform
- Region: Frankfurt (fra)
- Frontend: www.gtsplaner.app (CNAME -> gtsplaner-58p4a.ondigitalocean.app)
- Backend: api.gtsplaner.app (CNAME -> gtsplaner-58p4a.ondigitalocean.app)
- DNS-Provider: Hetzner (Empfehlung: Cloudflare fuer Apex-Domain)
- Autodeploy: Manuell (Empfehlung: GitHub Actions aktivieren)

## Naechster Sprint: Sprint 15 – React Native Mobile App

Aufgaben:
1. Monorepo-Struktur vorbereiten (Turborepo/Nx)
2. Shared Packages extrahieren (api-client, logic)
3. UI-Komponenten-Strategie evaluieren (Tamagui)
