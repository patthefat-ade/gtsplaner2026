# ADR-001: Serverseitige Multi-Tenant-Architektur und Berechtigungsverwaltung

**Datum:** 2026-03-26

**Status:** Vorgeschlagen

## Zusammenfassung

Dieses Dokument schlägt eine grundlegende Überarbeitung der Backend-Architektur vor, um eine robuste, skalierbare und sichere Multi-Tenant-Fähigkeit zu implementieren. Die aktuelle Implementierung, die auf einem einfachen `role`-Feld und manueller Datenfilterung basiert, ist für die neuen hierarchischen Anforderungen – ein Hauptmandant (z. B. Bundesland) mit systemübergreifender Sicht auf mehrere Unter-Mandanten (z. B. Schulen) – nicht ausreichend. 

Die empfohlene Lösung besteht aus zwei Kernkomponenten:

1.  **Multi-Tenancy**: Umstellung auf eine explizite **"Shared Database, Shared Schema"**-Architektur. Anstatt `django-tenants` (Schema-per-Tenant) zu verwenden, wird ein `organization_id`-Fremdschlüssel in allen relevanten Modellen genutzt und die Datenfilterung auf Datenbankebene durch einen benutzerdefinierten `TenantedManager` erzwungen. Dieser Ansatz ist für hierarchische Datenabfragen unerlässlich.

2.  **Berechtigungsverwaltung**: Migration vom aktuellen, starren `role`-Feld im `User`-Modell zum **standardmäßigen Django-Authentifizierungssystem** (`auth.Group` und `auth.Permission`). Dies ermöglicht eine flexiblere, erweiterbare und über das Django-Admin-Interface verwaltbare Rollen- und Berechtigungsstruktur.

Diese Änderungen verlagern die Zugriffs- und Datenlogik vollständig auf den Server, machen die clientseitigen `Route-Guard`-Implementierungen überflüssig und schaffen eine sicherere, wartbarere und zukunftsfähige Grundlage für die Anwendung.

## Kontext und Problemstellung

Die GTS-Planer-Anwendung muss eine komplexe Organisationshierarchie abbilden. Ein Haupt-Tenant (z. B. "Hilfswerk Kärnten") muss die Daten mehrerer ihm untergeordneter Sub-Tenants (Schulstandorte) einsehen und verwalten können. Jeder Sub-Tenant wiederum hat eigene Benutzer (Standortleiter, Pädagogen) und Daten (Gruppen, Transaktionen), die von anderen Sub-Tenants isoliert sein müssen.

Die aktuelle Architektur weist hierbei entscheidende Schwächen auf:

*   **Keine echte Mandantentrennung**: Die Datenfilterung erfolgt implizit über `location`-Fremdschlüssel. Es gibt keine garantierte, systemweite Trennung auf Organisationsebene.
*   **Fehlende Hierarchie-Unterstützung**: Cross-Location- oder Cross-Organization-Abfragen für übergeordnete Rollen sind umständlich und fehleranfällig zu implementieren.
*   **Starres Berechtigungssystem**: Das `role`-Feld im `User`-Modell ist nicht erweiterbar. Neue Rollen oder granulare Berechtigungen erfordern Code-Änderungen und Datenbankmigrationen.
*   **Clientseitige Sicherheitslogik**: Die `Route-Guard`-Komponente im Frontend dupliziert Berechtigungslogik, die primär auf dem Server liegen sollte. Dies ist ein Verstoß gegen das "Defense in Depth"-Prinzip.

## Betrachtete Optionen

### Option 1: `django-tenants` (Schema-per-Tenant)

Diese Bibliothek implementiert Multi-Tenancy durch die Erstellung eines separaten PostgreSQL-Schemas für jeden Mandanten. Dies bietet eine starke Datenisolierung.

| Vorteile | Nachteile |
| :--- | :--- |
| **Starke Datenisolierung**: Physische Trennung der Tabellen pro Mandant. [1] | **Keine hierarchische Sicht**: Cross-Schema-Abfragen sind nicht vorgesehen und extrem komplex umzusetzen. [2] |
| **Einfache Backups/Wiederherstellung pro Mandant**: Jedes Schema kann einzeln gesichert werden. | **Migrations-Overhead**: Datenbankmigrationen müssen für jeden einzelnen Mandanten ausgeführt werden, was bei vielen Mandanten sehr langsam wird. [3] |
| **Einfache Implementierung für simple SaaS-Modelle**: Geringe Änderungen am bestehenden Code. | **Skalierungsprobleme**: Die Anzahl der Schemas kann zu Verbindungslimits und Verwaltungsproblemen führen. |

**Bewertung:** Aufgrund der Unfähigkeit, hierarchische Daten über Mandantengrenzen hinweg abzufragen, ist dieser Ansatz für die Anforderungen des GTS-Planers **ungeeignet**.

### Option 2: Shared Database, Shared Schema (Empfehlung)

Bei diesem Ansatz teilen sich alle Mandanten dieselbe Datenbank und dieselben Tabellen. Die Mandantenzugehörigkeit wird durch einen `organization_id`-Fremdschlüssel in jedem relevanten Modell gekennzeichnet.

| Vorteile | Nachteile |
| :--- | :--- |
| **Unterstützung für Hierarchien**: Abfragen über mehrere Mandanten hinweg sind durch einfache SQL-Joins möglich. | **Schwächere Datenisolierung**: Programmierfehler (vergessene `WHERE`-Klausel) können zu Datenlecks führen. |
| **Hohe Skalierbarkeit**: Keine Begrenzung der Mandantenanzahl durch die Datenbankarchitektur. | **Komplexere Backups/Wiederherstellung**: Einzelne Mandanten müssen aus den gemeinsamen Tabellen extrahiert werden. |
| **Effiziente Migrationen**: Migrationen laufen nur einmal für das öffentliche Schema. | **Potenziell große Indizes**: Indizes über mandantenübergreifende Tabellen können sehr groß werden. |

**Bewertung:** Dieser Ansatz ist die **optimale Lösung** für die Anforderungen des GTS-Planers. Das Risiko von Datenlecks wird durch die Implementierung eines benutzerdefinierten `TenantedManager`, der die Filterung nach `organization_id` erzwingt, effektiv minimiert. [4]

### Berechtigungssystem: Custom RBAC vs. Django Groups

| Kriterium | Aktuelles Custom RBAC (`role`-Feld) | Django `auth.Group` & `auth.Permission` (Empfehlung) |
| :--- | :--- | :--- |
| **Flexibilität** | Starr; neue Rollen erfordern Code-Änderungen. | Hoch; Rollen (Gruppen) und Berechtigungen können dynamisch im Admin-Panel erstellt werden. |
| **Granularität** | Gering; Berechtigungen sind an die Rolle gekoppelt. | Hoch; Feingranulare Berechtigungen (z.B. `finance.add_transaction`) können Gruppen zugewiesen werden. |
| **Standardkonformität** | Proprietäre Lösung. | Django-Standard; nutzt bewährte, gut dokumentierte Django-Komponenten. [5] |
| **Wartbarkeit** | Gering; Logik ist im Code verstreut. | Hoch; Zentrale Verwaltung über das Django-Admin-Interface. |

**Bewertung:** Die Migration zu Djangos eingebautem System ist ein klarer Gewinn an Flexibilität, Wartbarkeit und Sicherheit.

## Entscheidung und Konsequenzen

Wir werden die Architektur wie folgt umstellen:

1.  **Datenmodell-Anpassung**: Wir führen ein `TenantModel` als abstrakte Basisklasse ein, die ein `organization = ForeignKey(Organization)`-Feld enthält. Alle mandantenabhängigen Modelle (z.B. `Group`, `Transaction`, `TimeEntry`) werden von dieser Klasse erben.

2.  **Erzwungene Datenfilterung**: Wir implementieren einen `TenantedManager`, der sicherstellt, dass alle `objects.all()`-Abfragen automatisch und zwingend nach der `organization_id` des aktuellen Benutzers filtern. Ein `all_tenants_objects`-Manager wird für Super-Admin-Sichten bereitgestellt.

3.  **Berechtigungssystem-Migration**: Das `role`-Feld im `User`-Modell wird entfernt. Stattdessen werden Django `Group`-Objekte für die Rollen `Educator`, `LocationManager`, `Admin` und `SuperAdmin` erstellt. Detaillierte Berechtigungen (`add_transaction`, `approve_leaverequest` etc.) werden erstellt und diesen Gruppen zugewiesen.

4.  **API-Anpassung**: Die DRF-Views werden `DjangoModelPermissions` nutzen, um die Berechtigungen serverseitig zu prüfen. Die benutzerdefinierten Permission-Klassen werden entsprechend angepasst, um die neue Gruppen- und Hierarchielogik zu reflektieren.

5.  **Frontend-Anpassung**: Die clientseitigen `Route-Guard`- und `usePermissions`-Hooks werden entfernt. Das Frontend wird sich ausschließlich auf die vom Backend zurückgegebenen Daten und HTTP-Statuscodes (z.B. 403 Forbidden) verlassen, um die Benutzeroberfläche zu rendern. Buttons für Aktionen, für die der Benutzer keine Berechtigung hat, werden gar nicht erst an das Frontend übermittelt.

### Positive Konsequenzen:
*   **Erhöhte Sicherheit**: Die Berechtigungslogik ist zentralisiert und wird auf dem Server erzwungen.
*   **Bessere Skalierbarkeit**: Die Architektur unterstützt eine große Anzahl von Mandanten und komplexe Organisationsstrukturen.
*   **Gesteigerte Wartbarkeit**: Rollen und Berechtigungen können ohne Code-Änderungen im Admin-Panel verwaltet werden.
*   **Vereinfachtes Frontend**: Die Frontend-Logik wird schlanker und weniger fehleranfällig.

### Negative Konsequenzen:
*   **Einmaliger Migrationsaufwand**: Die Umstellung erfordert eine signifikante, einmalige Investition in die Refaktorierung des Backends und die Migration der bestehenden Daten.

---

## Referenzen

[1] django-tenants. (n.d.). *Welcome to django-tenants documentation!* django-tenants.readthedocs.io. Abgerufen am 26. März 2026, von https://django-tenants.readthedocs.io/en/latest/

[2] Stack Overflow. (2018, November 1). *Hierarchical multi-tenant architecture with Django and Postgresql using separate schemas*. Abgerufen am 26. März 2026, von https://stackoverflow.com/questions/53206853/hierarchical-multi-tenant-architecture-with-django-and-postgresql-using-separate

[3] Jacques, A. (2026, Februar 2). *Is Django Multitenant really worth implementing in 2026?* Reddit. Abgerufen am 26. März 2026, von https://www.reddit.com/r/django/comments/1qu31ra/is_django_multitenant_really_worth_implementing/

[4] Block, H. (2025, August 12). *Multi-Tenant Django at Scale: Isolated Schemas vs Shared Models*. Medium. Abgerufen am 26. März 2026, von https://medium.com/@connect.hashblock/multi-tenant-django-at-scale-isolated-schemas-vs-shared-models-843acd58038a

[5] Django Software Foundation. (n.d.). *Using the Django authentication system*. Django documentation. Abgerufen am 26. März 2026, von https://docs.djangoproject.com/en/5.0/topics/auth/default/
