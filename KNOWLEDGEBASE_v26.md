# GTS Planner – Wissensdatenbank

**Version:** v26 (nach Sprint 41 – Permission-Fix, Wochenplan vereinheitlicht, Schuljahr-Verwaltung)
**Letzte Aktualisierung:** 2026-03-28
**Status:** Sprint 41 abgeschlossen, v2.6.0 deployed und verifiziert auf Produktivumgebung

---

## Projektübersicht

| Eigenschaft | Wert |
|---|---|
| **Projektname** | GTS Planner – Kassenbuch App v2 |
| **Backend** | Django 5.2 + DRF + drf-spectacular + Django Unfold |
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| **Datenbank** | PostgreSQL 16 (Docker) / SQLite (Dev) |
| **Auth** | JWT (SimpleJWT) + 2FA/OTP (django-otp) |
| **API-Standard** | OpenAPI 3.0.3 (95+ Pfade, 0 Errors, 0 Warnings) |
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
22. **Test-Infrastruktur Auth-Gruppen (Sprint 40):** Die `conftest.py` enthält jetzt eine `_assign_auth_group()`-Hilfsfunktion, die Django Auth-Gruppen automatisch basierend auf der User-Rolle zuweist. Dies ist notwendig, weil `user_has_perm()` Django-Permissions über Auth-Gruppen prüft, die in Tests manuell zugewiesen werden müssen.
23. **Verschlüsselte Felder und Suche (Sprint 40):** `EncryptedCharField` (z.B. für Telefon/E-Mail bei StudentContact) verhindert DB-seitige Filterung. Für Suchfunktionen müssen alternative Felder (z.B. `first_name`, `last_name`) verwendet werden. Die Suche in der Contacts-API filtert daher nur nach Namen, nicht nach Kontaktdaten.
24. **Gruppenwechsel-Workflow (Sprint 40):** Der Status-Workflow für GroupTransfer ist: `pending` → `confirmed` → `completed` (oder `rejected`/`cancelled`). Nur bestimmte Status-Übergänge sind erlaubt. Die `confirmed_by`-Beziehung wird automatisch beim Bestätigen gesetzt.
25. **Permission-Management (Sprint 41):** `setup_permissions.py` definiert die Berechtigungen pro Rolle. Educator hat jetzt `manage_students` (hinzugefügt in Sprint 41). Neue Permissions müssen sowohl in `setup_permissions.py` als auch in der ViewSet-`get_permissions()`-Methode konfiguriert werden.
26. **Schuljahr-Zuordnung (Sprint 41):** Gruppen, Wochenpläne und Finanztransaktionen müssen einem Schuljahr zugeordnet sein. Das `school_year` FK ist nullable für Rückwärtskompatibilität. Frontend-Formulare wählen automatisch das aktive Schuljahr vor.
27. **Wochenplan-Erstellung vereinheitlicht (Sprint 41):** Die `new/page.tsx` wurde komplett überarbeitet und enthält jetzt alle Features der Edit-Ansicht: Kategorie-Farbcodierung, Duplizier-Buttons, Wochenthema (TipTap), Tagesaktivitäten, automatische Standort-/Gruppen-/Schuljahr-Zuordnung.

---

## API-Endpunkte (korrekte Pfade)

| Endpunkt | Beschreibung |
|---|---|
| `/api/v1/auth/login/` | JWT-Login |
| `/api/v1/auth/me/` | Aktueller Benutzer |
| `/api/v1/dashboard/stats/` | Dashboard-Statistiken |
| `/api/v1/weeklyplans/` | Wochenpläne (CRUD) |
| `/api/v1/weeklyplans/{id}/duplicate/` | Wochenplan duplizieren |
| `/api/v1/weeklyplans/{id}/duplicate-entry/` | Einzelnen Eintrag duplizieren |
| `/api/v1/weeklyplans/{id}/create-from-template/` | Aus Vorlage erstellen |
| `/api/v1/weeklyplans/{id}/pdf/` | PDF-Export |
| `/api/v1/weeklyplans/templates/` | Vorlagen auflisten |
| `/api/v1/users/` | Benutzerverwaltung |
| `/api/v1/locations/` | Standorte (CRUD) |
| `/api/v1/groups/` | Gruppen (CRUD) |
| `/api/v1/groups/students/` | Schüler (CRUD) |
| `/api/v1/groups/transfers/` | Gruppenwechsel (CRUD + Workflow) |
| `/api/v1/groups/transfers/{id}/confirm/` | Gruppenwechsel bestätigen |
| `/api/v1/groups/transfers/{id}/reject/` | Gruppenwechsel ablehnen |
| `/api/v1/groups/transfers/{id}/complete/` | Gruppenwechsel abschließen |
| `/api/v1/groups/contacts/` | Kontaktpersonen (CRUD) |
| `/api/v1/groups/school-years/` | Schuljahre (CRUD) |
| `/api/v1/groups/holidays/` | Ferien (CRUD) **(NEU Sprint 41)** |
| `/api/v1/groups/autonomous-days/` | Autonome Schultage (CRUD) **(NEU Sprint 41)** |
| `/api/v1/timetracking/entries/` | Zeiteinträge |
| `/api/v1/finance/transactions/` | Transaktionen (jetzt mit school_year Filter) |
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
| Sprint 40 | **ERLEDIGT** | v2.5.0 | 2026-03-28 | Gruppenwechsel & Kontaktpersonen |
| Sprint 41 | **ERLEDIGT** | v2.6.0 | 2026-03-28 | Permission-Fix, Wochenplan vereinheitlicht, Schuljahr-Verwaltung |

---

## Sprint 41 – Permission-Fix, Wochenplan vereinheitlicht, Schuljahr-Verwaltung

### Haupt-Features

Der Sprint hat fünf Issues (#214–#218) umgesetzt. **Permission-Bug behoben (#214):** Pädagoginnen können jetzt Schüler erstellen und Kontaktpersonen zuweisen, da `manage_students` zur Educator-Rolle in `setup_permissions.py` hinzugefügt wurde. **Wochenplan-Erstellung vereinheitlicht (#215):** Die `new/page.tsx` wurde komplett überarbeitet und enthält jetzt alle Features der Edit-Ansicht: Kategorie-Farbcodierung pro Zelle, Duplizier-Buttons, Wochenthema (TipTap Rich-Text-Editor), Tagesaktivitäten für Mo-Fr, automatische Standort-/Gruppen-/Schuljahr-Zuordnung basierend auf User-Zugehörigkeit. **Schuljahr-Verwaltung (#216, #218):** Neue Models `HolidayPeriod` und `AutonomousDay` mit vollständiger CRUD-API und Frontend-Seite. **Schuljahr-Zuordnung für Finanzen (#217):** `school_year` FK zu Transaction Model hinzugefügt mit Filter-Unterstützung.

### Neue Models

**HolidayPeriod** (groups/models_calendar.py): name, start_date, end_date, school_year FK. Multi-Tenant über TenantModel. Audit-Log registriert.

**AutonomousDay** (groups/models_calendar.py): name, date, description, school_year FK. Multi-Tenant über TenantModel. Audit-Log registriert.

### Neue API-Endpunkte

- `/api/v1/groups/holidays/` – Ferien CRUD (LocationManager+)
- `/api/v1/groups/autonomous-days/` – Autonome Schultage CRUD (LocationManager+)
- Transaction-Filter: `school_year_id` Parameter hinzugefügt

### Frontend-Seiten

Neue Seite `/groups/school-years` mit Master-Detail-Layout: Schuljahre links, Details (Ferien + autonome Tage) rechts. Sidebar-Menüpunkt "Schuljahre" hinzugefügt. Wochenplan-Erstellungsseite komplett überarbeitet mit automatischer Zuordnung und allen Edit-Features.

---

## Django-Apps Übersicht (nach Sprint 41)

| App | Beschreibung | Models | Tests |
|---|---|---|---|
| `core` | Benutzer, Organisationen, Standorte, Auth | User, Organization, Location | – |
| `groups` | Gruppen, Schüler, Schuljahre, Anwesenheit, Gruppenwechsel, Kontaktpersonen, **Schulkalender** | Group, Student, SchoolYear, Semester, Attendance, GroupTransfer, StudentContact, **HolidayPeriod, AutonomousDay** | test_api.py, test_transfer.py (17), test_contacts.py (13) |
| `timetracking` | Zeiterfassung, Abwesenheiten | TimeEntry, LeaveRequest, LeaveType | – |
| `finance` | Finanzen, Transaktionen | Transaction (jetzt mit school_year FK), TransactionCategory, Receipt | – |
| `weeklyplans` | Wochenpläne | WeeklyPlan, WeeklyPlanEntry, DailyActivity | test_models.py, test_api.py (52 Tests) |
| `system` | Export, GDPR, Health, Audit | AuditLog | – |

---

## Bekannte Einschränkungen / Nächste Schritte

1.  **E-Mail-Versand für Passwort-Reset (#179):** Offenes Issue seit Sprint 38.
2.  **Tagesprotokoll für Schüler:** Pädagoginnen sollen je Schüler ein Tagesprotokoll anlegen können (Ankunft, Vorkommnisse, Abholung durch Kontaktperson). Systemübergreifend einsehbar, auch auf Mandantenebene.
3.  **Seed-Daten erweitern:** Gruppenwechsel-, Kontaktpersonen- und Schulkalender-Testdaten in die Seed-Daten aufnehmen.
4.  **CI-Pipeline für Tests:** Die CI-Pipeline muss eine Test-Datenbank bereitstellen, damit die Tests im CI laufen.
5.  **Gruppenwechsel-Benachrichtigungen:** Pädagog:innen der Zielgruppe sollten bei neuen Gruppenwechsel-Anfragen benachrichtigt werden.
