# Sprint 25 Report – Multi-Tenant-Architektur und Django Permission Groups

**Sprint:** 25
**Datum:** 26.03.2026
**Fokus:** Multi-Tenant-Architektur, serverseitige Berechtigungen, Organization-Hierarchie

---

## Zusammenfassung

Sprint 25 fuehrt eine grundlegende Architektur-Aenderung ein: Die gesamte Berechtigungs- und Mandantenlogik wird vom Frontend (clientseitige Route-Guards) auf den Server (Django Permission Groups + Tenant-Middleware) verlagert. Dies ermoeglicht eine sichere, skalierbare Multi-Tenant-Architektur mit Haupt- und Untermandanten.

## Architektur-Entscheidung

**Gewaehlt:** Shared Database, Shared Schema mit `organization_id`-Fremdschluessel
**Verworfen:** `django-tenants` (Schema-per-Tenant) – nicht geeignet fuer Cross-Tenant-Zugriff

Siehe [ADR-001](adr/ADR_001_MULTI_TENANCY_AND_PERMISSIONS.md) fuer die vollstaendige Analyse.

## Implementierte Issues

| Issue | Titel | Status |
|-------|-------|--------|
| #80 | TenantModel Basisklasse und TenantedManager | Implementiert |
| #81 | Bestehende Modelle auf TenantModel migrieren | Implementiert |
| #82 | Organization-Hierarchie: Haupt- und Untermandanten | Implementiert |
| #83 | Django Permission Groups: Migration von role-Feld | Implementiert |
| #84 | TenantMiddleware: Tenant-Kontext aus JWT | Implementiert |
| #85 | API-ViewSets: TenantViewSetMixin + Permissions | Implementiert |
| #86 | Frontend: API-basierte Permissions statt Route-Guards | Implementiert |
| #87 | Seed Data und Tests fuer Multi-Tenant | Implementiert |
| #88 | Dokumentation: ADR-001 und Spezifikationen | Implementiert |

## Neue Dateien

### Backend

| Datei | Beschreibung |
|-------|-------------|
| `core/managers.py` | TenantedQuerySet und TenantedManager fuer automatische Tenant-Filterung |
| `core/middleware.py` | TenantMiddleware – extrahiert Tenant-Kontext aus JWT und setzt `request.tenant_ids` |
| `core/mixins.py` | TenantViewSetMixin – automatische Tenant-Filterung in allen ViewSets |
| `core/management/commands/setup_permissions.py` | Erstellt Django Permission Groups mit definierten Berechtigungen |

### Frontend

| Datei | Beschreibung |
|-------|-------------|
| `hooks/use-permissions.ts` | Komplett umgeschrieben: nutzt API-Permissions statt hardcoded Rollen |
| `components/route-guard.tsx` | Nutzt jetzt `hasPermission()` statt Rollen-Hierarchie |
| `components/layout/sidebar.tsx` | Navigation basiert auf Permission-Codenames |

## Geaenderte Dateien

### Backend-Modelle (TenantModel-Migration)

Alle Modelle erben jetzt von `TenantModel` und haben ein `organization`-Feld:

- `core/models.py` – Organization (mit `org_type`, `parent`), TenantModel, User
- `groups/models.py` – SchoolYear, Semester, Group, GroupMember, Student
- `finance/models.py` – TransactionCategory, Transaction, Receipt
- `timetracking/models.py` – TimeEntry, LeaveType, LeaveRequest
- `system/models.py` – AuditLog, SystemSetting

### Backend-Views (TenantViewSetMixin)

Alle ViewSets nutzen jetzt `TenantViewSetMixin` und `require_permission()`:

- `finance/views.py`
- `groups/views.py`
- `timetracking/views.py`

### Frontend-Typen

- `types/auth.ts` – `AuthUser` um `group`, `permissions`, `organization_id` erweitert; `UserProfile` um `tenant_ids`, `is_cross_tenant`
- `types/models.ts` – `Organization` um `org_type`, `parent`, `children_count` erweitert

## Multi-Tenant-Hierarchie

```
GTS Kaernten (Hauptmandant)
├── VS Klagenfurt Mitte (Sub-Tenant)
│   └── GTS Klagenfurt Mitte (Standort)
│       ├── Lisa Standortleitung (LocationManager)
│       ├── Eva Paedagogin (Educator)
│       └── Anna Administratorin (Admin)
└── VS Villach Sued (Sub-Tenant)
    └── GTS Villach Sued (Standort)
        ├── Claudia Standortleitung (LocationManager)
        └── Maria Betreuerin (Educator)
```

## Django Permission Groups

| Gruppe | Berechtigungen |
|--------|---------------|
| Educator | view_dashboard, create_transactions, manage_timeentries |
| LocationManager | Alle Educator-Berechtigungen + manage_groups, manage_students, manage_categories, approve_transactions, view_reports, approve_leave |
| Admin | Alle LocationManager-Berechtigungen + manage_users, manage_settings, view_audit_log |
| SuperAdmin | Alle Berechtigungen + manage_organizations, cross_tenant_access |

## Deployment-Schritte

Nach dem Deployment muessen folgende Befehle ausgefuehrt werden:

```bash
# 1. Migrationen ausfuehren (neue Felder: organization, org_type, parent)
python manage.py makemigrations
python manage.py migrate

# 2. Permission Groups erstellen
python manage.py setup_permissions

# 3. Test-Benutzer mit Multi-Tenant-Daten erstellen
python manage.py create_test_users
```

## Test-Benutzer

| E-Mail | Rolle | Standort | Passwort |
|--------|-------|----------|----------|
| educator@gtsplaner.app | Educator | GTS Klagenfurt Mitte | Test123! |
| educator2@gtsplaner.app | Educator | GTS Villach Sued | Test123! |
| locationmanager@gtsplaner.app | LocationManager | GTS Klagenfurt Mitte | Test123! |
| locationmanager2@gtsplaner.app | LocationManager | GTS Villach Sued | Test123! |
| admin@gtsplaner.app | Admin | GTS Klagenfurt Mitte | Test123! |
| superadmin@gtsplaner.app | SuperAdmin | GTS Klagenfurt Mitte | Test123! |
