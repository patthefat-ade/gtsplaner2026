# GTS Planner Kassenbuch App v2 Knowledgebase

Version: v10 (nach Sprint 10)
Letzte Aktualisierung: 2026-03-24
Status: Sprint 10 abgeschlossen

## Sprint-Fortschritt

- Sprint 1-7: ERLEDIGT (2026-03-01)
- Sprint 8 Admin Panel und Audit: ERLEDIGT (2026-03-24)
- Sprint 9 Frontend-Seiten erweitern: ERLEDIGT (2026-03-24)
- Sprint 10 Testing: ERLEDIGT (2026-03-24)
- Sprint 11 Dokumentation: OFFEN
- Sprint 12 Deployment: OFFEN

## Kennzahlen

- 25 Frontend-Routen (Build erfolgreich)
- 201 Backend-Tests, 93% Coverage
- 131 Frontend-Tests (Vitest)
- 48 API-Pfade (OpenAPI 3.0.3)
- 17 Django Models

## Technische Regeln

- Export Parameter: export_format (nicht format)
- AuditLog object_id: leerer String als Default (nicht NULL)
- Frontend-Tests: Vitest + jsdom + testing-library/react
- Backend-Tests: pytest-django + pytest-cov
