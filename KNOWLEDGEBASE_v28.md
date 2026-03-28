# GTS Planner – Wissensdatenbank

**Version:** v28 (nach Sprint 44 – Wochenplan-Konsistenz)
**Letzte Aktualisierung:** 2026-03-28
**Status:** Sprint 44 abgeschlossen, v2.9.0 deployed und verifiziert auf Produktivumgebung

---

## Projektübersicht

| Eigenschaft | Wert |
|---|---|
| **Projektname** | GTS Planner – Kassenbuch App v2 |
| **Backend** | Django 5.2 + DRF + drf-spectacular + Django Unfold |
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| **Datenbank** | PostgreSQL 16 (Docker) / SQLite (Dev) |
| **Auth** | JWT (SimpleJWT) + 2FA/OTP (django-otp) |
| **API-Standard** | OpenAPI 3.0.3 (100+ Pfade, 0 Errors, 0 Warnings) |
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
9.  **Seed-Daten:** `create_test_users.py` nutzt `bulk_create` für Performance.
10. **Deployment:** `startup.sh` führt `migrate`, `setup_permissions` synchron aus; `create_test_users` läuft im **Hintergrund**.
11. **Neue Django-Apps:** Müssen in `INSTALLED_APPS`, `config/urls.py` und `setup_permissions.py` registriert werden.
12. **UX-Standards (Sprint 33):** Alle Unterseiten müssen Breadcrumbs, Toast-Nachrichten bei CRUD-Aktionen, Skeleton-Loading-States und eine Error-Boundary haben.
13. **Audit-Log (Sprint 35):** Eine `CurrentUserMiddleware` setzt den Benutzer im Thread-Local-Kontext.
14. **Multi-Tenant-Fix (Sprint 36):** Admins haben jetzt ein direktes `organization`-Feld.
15. **Feature-Branch-Strategie (Sprint 36):** Alle neuen Features und Bugfixes müssen in einem eigenen Branch entwickelt und via Pull Request (PR) in `main` gemerged werden.
16. **Dashboard-Konsistenz (Sprint 38):** Dashboard-Zählungen müssen die gleichen Filter wie die entsprechenden API-Listenansichten verwenden.
17. **Produktiv-Testing (Sprint 38):** Tests müssen IMMER auf der Produktivumgebung (`api.gtsplaner.app`) durchgeführt werden.
18. **Deployment-Performance (Sprint 38):** Seed-Kommandos müssen `bulk_create` statt `update_or_create` verwenden und im Hintergrund laufen.
19. **API-Pfade in Frontend-Hooks (Sprint 38 Hotfix):** Alle Frontend-Hooks müssen relative Pfade OHNE `/api/v1`-Prefix verwenden.
20. **OpenAPI Enum-Naming (Sprint 39):** Serializer-Namenskonflikte müssen durch eindeutige Benennung und `ENUM_NAME_OVERRIDES` behoben werden.
21. **Model-Properties Robustheit (Sprint 39):** Berechnete Properties müssen String-Datumswerte korrekt verarbeiten können.
22. **Test-Infrastruktur Auth-Gruppen (Sprint 40):** Die `conftest.py` enthält jetzt eine `_assign_auth_group()`-Hilfsfunktion.
23. **Verschlüsselte Felder und Suche (Sprint 40):** `EncryptedCharField` verhindert DB-seitige Filterung.
24. **Gruppenwechsel-Workflow (Sprint 40):** Der Status-Workflow für GroupTransfer ist: `pending` → `confirmed` → `completed`.
25. **Permission-Management (Sprint 41):** `setup_permissions.py` definiert die Berechtigungen pro Rolle.
26. **Schuljahr-Zuordnung (Sprint 41):** Gruppen, Wochenpläne und Finanztransaktionen müssen einem Schuljahr zugeordnet sein.
27. **Wochenplan-Erstellung vereinheitlicht (Sprint 41):** Die `new/page.tsx` wurde komplett überarbeitet.
28. **Generische Exporte (Sprint 43):** Ein `ExportMixin` in `core/mixins_export.py` stellt `@action(detail=False, methods=["get"])` für `export-xlsx` und `export-pdf` bereit. Es nutzt `openpyxl` und `reportlab`.
29. **Serverseitige Pagination (Sprint 43):** Eine `StandardPagination`-Klasse in `core/pagination.py` liefert die Metadaten `count`, `total_pages`, `current_page`, `page_size`, `next` und `previous`.
30. **Token-basierter Download (Sprint 44):** Eine `QueryParameterJWTAuthentication` in `core/authentication.py` ermöglicht authentifizierte Datei-Downloads über einen `?token=` URL-Parameter. `CORS_EXPOSE_HEADERS` wurde gesetzt, um `Content-Disposition` im Browser lesbar zu machen.

---

## API-Endpunkte (korrekte Pfade)

| Endpunkt | Beschreibung |
|---|---|
| `/api/v1/auth/login/` | JWT-Login |
| `/api/v1/auth/me/` | Aktueller Benutzer |
| `/api/v1/dashboard/stats/` | Dashboard-Statistiken |
| `/api/v1/weeklyplans/` | Wochenpläne (CRUD) |
| `/api/v1/weeklyplans/export-xlsx/` | Wochenpläne als XLSX exportieren |
| `/api/v1/weeklyplans/pdf/` | **GEÄNDERT:** Wochenpläne als PDF exportieren (URL-Fix) |
| `/api/v1/groups/students/` | Schüler (CRUD) |
| `/api/v1/groups/students/export-xlsx/` | Schüler als XLSX exportieren |
| `/api/v1/groups/students/pdf/` | **GEÄNDERT:** Schüler als PDF exportieren (URL-Fix) |
| `/api/v1/groups/daily-protocols/` | Tagesprotokolle (CRUD) |
| `/api/v1/groups/daily-protocols/export-xlsx/` | Tagesprotokolle als XLSX exportieren |
| `/api/v1/groups/daily-protocols/pdf/` | **GEÄNDERT:** Tagesprotokolle als PDF exportieren (URL-Fix) |

---

## Sprint-Fortschritt

| Sprint | Status | Version | Datum | Bemerkung |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |
| Sprint 41 | **ERLEDIGT** | v2.6.0 | 2026-03-28 | Permission-Fix, Wochenplan vereinheitlicht, Schuljahr-Verwaltung |
| Sprint 43 | **ERLEDIGT** | v2.8.0 | 2026-03-28 | Systemweite Export- (XLSX/PDF) und Pagination-Infrastruktur |
| Sprint 44 | **ERLEDIGT** | v2.9.0 | 2026-03-28 | Wochenplan-Workflow: Konsistenz, Button-Farben, PDF-Download-Fix, Schuljahr-Zuordnung |

---

## Sprint 44 – Wochenplan-Konsistenz

### Haupt-Features

Dieser Sprint hat den Wochenplan-Workflow für Pädagogen entscheidend verbessert. Die Masken zum Erstellen und Bearbeiten sind jetzt konsistent, die Button-Farben entsprechen dem Design-System, die Schuljahr-Zuordnung funktioniert durchgängig und der kritische PDF-Download-Fehler wurde behoben.

### Backend

*   **PDF-Generierung:** Die PDF-Generierung wurde auf eine reine `reportlab`-Lösung umgestellt, um System-Abhängigkeiten zu vermeiden. Ein Unicode-fähiger Font (DejaVu) wurde registriert, um deutsche Umlaute korrekt darzustellen.
*   **Token-Authentifizierung:** Eine `QueryParameterJWTAuthentication`-Klasse wurde implementiert, um authentifizierte Downloads direkt über die URL (`?token=...`) zu ermöglichen.
*   **Serializer-Optimierung:** Der `WeeklyPlanViewSet` wurde angepasst, um nach `update`-Operationen den `WeeklyPlanDetailSerializer` für die Response zu verwenden.

### Frontend

*   **Download-Mechanismus:** Der Datei-Download wurde von einem `Blob`-basierten Ansatz auf `window.open(url)` umgestellt.
*   **Button-Konsistenz:** Alle inkonsistenten, hartcodierten Button-Farben (`bg-green-600`) wurden entfernt und durch die `Button`-Komponente aus dem Design-System ersetzt.
*   **Edit-Mode-Fix:** Die `useEffect`-Hooks in der Wochenplan-Detail-Seite wurden korrigiert, um sicherzustellen, dass alle Felder beim Öffnen des Bearbeiten-Modus korrekt aus den API-Daten in den State geladen und angezeigt werden.
