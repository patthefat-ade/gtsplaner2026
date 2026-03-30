# GTS Planner – Kassenbuch App v2 – Knowledgebase

**Version:** v24 (nach Sprint 39 – OpenAPI Fixes, WeeklyPlan Tests & Features)
**Letzte Aktualisierung:** 2026-03-28
**Status:** Sprint 39 abgeschlossen, v2.4.0 deployed und verifiziert auf Produktivumgebung

---

## Projektübersicht

| Eigenschaft | Wert |
|---|---|
| **Projektname** | GTS Planner – Kassenbuch App v2 |
| **Backend** | Django 5.2 + DRF + drf-spectacular + Django Unfold |
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| **Datenbank** | PostgreSQL 16 (Docker) / SQLite (Dev) |
| **Auth** | JWT (SimpleJWT) + 2FA/OTP (django-otp) |
| **API-Standard** | OpenAPI 3.0.3 (82+ Pfade, 0 Errors, 0 Warnings) |
| **Deployment** | Digital Ocean App Platform via GitHub Actions CD |
| **Repository** | github.com/patthefat-ade/gtsplaner2026 |
| **Produktiv-Frontend** | https://www.gtsplaner.app |
| **Produktiv-API** | https://api.gtsplaner.app |
| **API-Basis-Pfad** | `/api/v1/` |

---

## Technische Grundregeln

1.  **Backend:** Django + DRF + Django Unfold Admin.
2.  **Frontend:** Next.js App Router + shadcn/ui + Tailwind CSS 4.
3.  **API:** Alle Endpunkte unter `/api/v1/`.
4.  **Rollen:** Educator, LocationManager, Admin, SuperAdmin.
5.  **Auth:** JWT via SimpleJWT, Tokens in localStorage.
6.  **Encryption:** `EncryptedCharField` verhindert DB-Filterung. Nur für hochsensible PII verwenden.
7.  **Frontend/Backend Type Sync:** Das Frontend-Interface muss exakt die vom Backend-Serializer zurückgegebene Struktur widerspiegeln.
8.  **Tenant-Middleware:** Lazy Tenant Context Resolution ist entscheidend, da die Middleware vor der DRF-Auth läuft.
9.  **Seed-Daten:** `create_test_users.py` nutzt `bulk_create` für Performance (Sprint 38 Hotfix).
10. **Deployment:** `startup.sh` führt `migrate`, `setup_permissions` synchron aus; `create_test_users` läuft im **Hintergrund**, damit Gunicorn sofort startet und der Health-Check nicht fehlschlägt.
11. **Neue Django-Apps:** Müssen in `INSTALLED_APPS`, `config/urls.py` und `setup_permissions.py` registriert werden.
12. **UX-Standards (Sprint 33):** Alle Unterseiten müssen Breadcrumbs, Toast-Nachrichten bei CRUD-Aktionen, Skeleton-Loading-States und eine Error-Boundary haben.
13. **Audit-Log (Sprint 35):** Eine `CurrentUserMiddleware` setzt den Benutzer im Thread-Local-Kontext, damit Signal-Handler den korrekten Benutzer loggen können.
14. **Multi-Tenant-Fix (Sprint 36):** Admins haben jetzt ein direktes `organization`-Feld, um den Tenant-Kontext auch ohne Standortbezug sicherzustellen.
15. **Feature-Branch-Strategie (Sprint 36):** Alle neuen Features und Bugfixes müssen in einem eigenen Branch entwickelt und via Pull Request (PR) in `main` gemerged werden.
16. **Dashboard-Konsistenz (Sprint 38):** Dashboard-Zählungen müssen die gleichen Filter wie die entsprechenden API-Listenansichten verwenden, um Datenkonsistenz für alle Benutzerrollen zu gewährleisten.
17. **Produktiv-Testing (Sprint 38):** Tests müssen IMMER auf der Produktivumgebung (`api.gtsplaner.app`) durchgeführt werden, NIEMALS lokal. Lokale Tests bilden nicht die tatsächliche Infrastruktur ab.
18. **Deployment-Performance (Sprint 38):** Seed-Kommandos mit vielen DB-Operationen müssen `bulk_create` statt `update_or_create` verwenden und im Hintergrund laufen, um Health-Check-Timeouts auf kleinen Instanzen zu vermeiden.
19. **API-Pfade in Frontend-Hooks (Sprint 38 Hotfix):** Alle Frontend-Hooks müssen relative Pfade OHNE `/api/v1`-Prefix verwenden (z.B. `/weeklyplans/`, nicht `/api/v1/weeklyplans/`), da die Axios-`baseURL` bereits `https://api.gtsplaner.app/api/v1` enthält. Doppelte Prefixe führen zu 404-Fehlern auf der Produktivumgebung, die lokal nicht reproduzierbar sind.
20. **OpenAPI Enum-Naming (Sprint 39):** Serializer-Namenskonflikte (z.B. mehrere `UserCompactSerializer` in verschiedenen Apps) müssen durch eindeutige Benennung (z.B. `FinanceUserCompactSerializer`, `GroupUserCompactSerializer`) behoben werden. `ENUM_NAME_OVERRIDES` in `SPECTACULAR_SETTINGS` löst Enum-Namenskonflikte. Alle `SerializerMethodField` müssen Python Type Hints haben.
21. **Model-Properties Robustheit (Sprint 39):** Berechnete Properties wie `calendar_week` und `week_end_date` müssen String-Datumswerte korrekt verarbeiten können (`isinstance(d, str)` Check), da Django in bestimmten Kontexten (z.B. nach `create()` mit String-Parametern) den Wert noch nicht in ein `datetime.date`-Objekt konvertiert hat.

---

## API-Endpunkte (korrekte Pfade)

| Endpunkt | Beschreibung |
|---|---|
| `/api/v1/auth/login/` | JWT-Login |
| `/api/v1/auth/me/` | Aktueller Benutzer |
| `/api/v1/dashboard/stats/` | Dashboard-Statistiken |
| `/api/v1/weeklyplans/` | Wochenpläne (CRUD) |
| `/api/v1/weeklyplans/{id}/duplicate/` | Wochenplan duplizieren |
| `/api/v1/weeklyplans/{id}/duplicate-entry/` | Einzelnen Eintrag duplizieren (NEU Sprint 39) |
| `/api/v1/weeklyplans/{id}/create-from-template/` | Aus Vorlage erstellen |
| `/api/v1/weeklyplans/{id}/pdf/` | PDF-Export |
| `/api/v1/weeklyplans/templates/` | Vorlagen auflisten |
| `/api/v1/users/` | Benutzerverwaltung |
| `/api/v1/locations/` | Standorte (CRUD) |
| `/api/v1/groups/` | Gruppen (CRUD) |
| `/api/v1/groups/students/` | Schüler (CRUD) |
| `/api/v1/timetracking/entries/` | Zeiteinträge |
| `/api/v1/finance/transactions/` | Transaktionen |
| `/api/v1/admin/organizations/` | Organisationen (Admin) |
| `/api/v1/admin/audit-logs/` | Audit-Logs (Admin) |
| `/api/v1/system/` | System-Einstellungen |
| `/api/v1/export/` | Daten-Export |

---

## Sprint-Fortschritt

| Sprint | Status | Version | Datum | Bemerkung |
|---|---|---|---|---|
| Sprint 33 | **ERLEDIGT** | – | 2026-03-27 | Verfeinerung: Dashboard-Bug-Fix, UX-Verbesserungen, Mobile Responsiveness |
| Sprint 34 | **ERLEDIGT** | – | 2026-03-27 | System-Konsistenz: Security-Fixes, DSGVO, API-Sync, Fehlerbehandlung |
| Sprint 35 | **ERLEDIGT** | – | 2026-03-27 | Audit-Log-Fixes, Anwesenheits-Modul (MVP), Filter-Verbesserungen |
| Sprint 36 | **ERLEDIGT** | v2.1.0 | 2026-03-28 | Kritischer Fix: Multi-Tenant-Workflow, Wochenplan-Filter, OpenAPI-Fixes |
| Sprint 37 | **ERLEDIGT** | v2.2.0 | 2026-03-28 | Wochenplan-Neugestaltung nach Prototyp, PDF-Export, Release-Management |
| Sprint 38 | **ERLEDIGT** | v2.3.0 | 2026-03-28 | Dashboard-Konsistenz-Fix, Deployment-Fix, Produktiv-Testing |
| Sprint 39 | **ERLEDIGT** | v2.4.0 | 2026-03-28 | OpenAPI Fixes, WeeklyPlan Tests & Features |

---

## Sprint 39 – OpenAPI Fixes, WeeklyPlan Tests & Features

### Haupt-Features

Der Sprint hat sechs Issues (#200–#205) umgesetzt. Die OpenAPI-Schema-Qualität wurde durch die Behebung aller 47 Enum-Naming-Warnungen auf 0 Warnungen und 0 Fehler gebracht. Das weeklyplans-Modul erhielt eine umfassende Testabdeckung mit 52 neuen Tests (Model- und API-Tests). Vier neue Frontend-Features wurden für den Wochenplan implementiert: Anzeige des KW-Datumsbereichs in Listen- und Detailseite, Darstellung des Wochenthemas als styled Card, Tagesaktivitäten-Karten pro Wochentag und die Möglichkeit, einzelne Zeitfenster-Zellen auf einen anderen Wochentag zu duplizieren.

### Technische Details

Die Backend-Änderungen umfassen: `ENUM_NAME_OVERRIDES` in SPECTACULAR_SETTINGS, Type Hints für alle SerializerMethodField, Umbenennung von Serializer-Namenskonflikten (UserCompactSerializer → GroupUserCompactSerializer / FinanceUserCompactSerializer), neuer `duplicate-entry` API-Endpunkt, und robustere Model-Properties für `calendar_week` und `week_end_date`.

Die Frontend-Änderungen umfassen: KW-Datumsbereich in der Listenseite (Spalte "KW / Zeitraum"), KW-Datumsbereich im Header der Detailseite, Wochenthema-Card, Tagesaktivitäten-Sektion, Duplizier-Button pro Zelle mit Dialog zur Ziel-Tag-Auswahl, und neuer `useDuplicateEntry`-Hook.

### Produktiv-Verifizierung

Die Produktivumgebung wurde nach dem Deployment verifiziert. Die Listenseite zeigt den KW-Datumsbereich korrekt an (z.B. "KW 13 / 23.03. – 27.03."). Die Detailseite zeigt den vollständigen Datumsbereich im Header, alle 50 Einträge im Grid, die Kategorie-Legende und den Duplizier-Button pro Zelle. Dashboard-Konsistenz bleibt erhalten (amalia.bogdan: 5/5 Wochenpläne).

---

## Django-Apps Übersicht (nach Sprint 39)

| App | Beschreibung | Models | Tests |
|---|---|---|---|
| `core` | Benutzer, Organisationen, Standorte, Auth | User, Organization, Location | – |
| `groups` | Gruppen, Schüler, Schuljahre, Anwesenheit | Group, Student, SchoolYear, Semester, Attendance | test_api.py |
| `timetracking` | Zeiterfassung, Abwesenheiten | TimeEntry, LeaveRequest, LeaveType | – |
| `finance` | Finanzen, Transaktionen | Transaction, TransactionCategory, Receipt | – |
| `weeklyplans` | Wochenpläne | WeeklyPlan, WeeklyPlanEntry, DailyActivity | test_models.py, test_api.py (52 Tests) |
| `system` | Export, GDPR, Health, Audit | AuditLog | – |

---

## Bekannte Einschränkungen / Nächste Schritte

1.  **E-Mail-Versand für Passwort-Reset (#179):** Offenes Issue seit Sprint 38.
2.  **Anwesenheits-Modul erweitern:** Eine Statistik-Seite mit Fehlzeiten pro Schüler und Anwesenheitsquoten.
3.  **Seed-Daten erweitern:** Wochenthemen und Tagesaktivitäten in die Seed-Daten aufnehmen, damit die neuen Features auf der Produktivumgebung sichtbar sind.
4.  **CI-Pipeline für Tests:** Die CI-Pipeline muss eine Test-Datenbank bereitstellen, damit die weeklyplans-Tests im CI laufen.
5.  **Frontend-Testing auf Produktivumgebung:** Bisher nur API-Tests; Frontend-Validierung im Browser sollte systematisiert werden.
