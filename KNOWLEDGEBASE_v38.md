## 10. Rollen & Berechtigungen (5-stufig)

| Level | Rolle | Sichtbarkeit |
|---|---|---|
| 1 | Educator | Eigene Gruppe |
| 2 | LocationManager | Eigener Standort |
| 3 | SubAdmin | Gesamter Sub-Mandant kumuliert |
| 4 | Admin | Hauptmandant + alle Sub-Mandanten |
| 5 | SuperAdmin | Alles (cross-tenant), filterbar nach Sub-Mandant |

### 10.1 Sub-Mandanten-Admin (SubAdmin)

Der SubAdmin hat dieselben Berechtigungen wie der Admin, **ohne** `manage_organizations` und `cross_tenant_access`. Er kann innerhalb seines Sub-Mandanten (z.B. Hilfswerk Kärnten) Locations erstellen, Standortleitungen und Pädagoginnen verwalten und alle Daten kumuliert einsehen.

### 10.2 SuperAdmin/Admin: Organization-Filter

SuperAdmins und Admins können das Dashboard und alle Listen-Ansichten (Standorte, Benutzer, etc.) nach einer einzelnen Organisation filtern. Dies geschieht über den `?organization_id=<id>` Query-Parameter in der API und ein Dropdown-Menü im Frontend.

## 11. Tenant-Architektur (Refactoring geplant)

Die aktuelle Tenant-Isolation basiert auf einer Middleware-Funktion (`TenantMiddleware`), die `request.tenant_ids` als Seiteneffekt setzt. Dies ist nicht ideal und wird in Sprint 56 durch eine saubere, API-basierte Lösung mit `django-filter` ersetzt (siehe Issue #302).
