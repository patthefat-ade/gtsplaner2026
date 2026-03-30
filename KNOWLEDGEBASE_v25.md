# GTS Planner – Kassenbuch App v2 – Knowledgebase

**Version:** v25 (nach Sprint 54 – DSGVO-Dokumentation & DevOps-Hardening)
**Letzte Aktualisierung:** 2026-03-30
**Status:** Sprint 54 abgeschlossen, v2.19.0 deployed und verifiziert auf Produktivumgebung

---

## Projektübersicht

| Eigenschaft | Wert |
|---|---|
| **Projektname** | GTS Planner – Kassenbuch App v2 |
| **Backend** | Django 5.2 + DRF + drf-spectacular + Django Unfold |
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| **Datenbank** | PostgreSQL 16 (Managed) |
| **Cache / Broker** | Redis 7 (Managed) |
| **Auth** | JWT (SimpleJWT) + 2FA/OTP (django-otp) |
| **API-Standard** | OpenAPI 3.0.3 |
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
5.  **Auth:** JWT via SimpleJWT, Tokens in httpOnly-Cookies.
6.  **Encryption:** `EncryptedCharField` für PII. **`SALT_KEY` ist eine kritische, obligatorische Umgebungsvariable.**
7.  **Frontend/Backend Type Sync:** Das Frontend-Interface muss exakt die vom Backend-Serializer zurückgegebene Struktur widerspiegeln.
8.  **Tenant-Middleware:** Lazy Tenant Context Resolution ist entscheidend.
9.  **Seed-Daten:** `create_test_users.py` nutzt `bulk_create` für Performance.
10. **Deployment:** `startup.sh` führt `migrate`, `setup_permissions` synchron aus.
11. **Neue Django-Apps:** Müssen in `INSTALLED_APPS`, `config/urls.py` und `setup_permissions.py` registriert werden.
12. **UX-Standards:** Breadcrumbs, Toast-Nachrichten, Skeleton-Loading, Error-Boundary.
13. **Audit-Log:** `CurrentUserMiddleware` setzt den Benutzer im Thread-Local-Kontext.
14. **Multi-Tenant-Fix:** Admins haben ein direktes `organization`-Feld.
15. **Feature-Branch-Strategie:** Alle Änderungen über PR in `main`.
16. **Dashboard-Konsistenz:** Dashboard-Filter müssen mit API-Listenansichten übereinstimmen.
17. **Produktiv-Testing:** Tests müssen IMMER auf der Produktivumgebung (`api.gtsplaner.app`) durchgeführt werden.
18. **Deployment-Performance:** Seed-Kommandos müssen `bulk_create` verwenden und im Hintergrund laufen.
19. **API-Pfade in Frontend-Hooks:** Relative Pfade OHNE `/api/v1`-Prefix verwenden.
20. **OpenAPI Enum-Naming:** Eindeutige Serializer-Namen und `ENUM_NAME_OVERRIDES` verwenden.
21. **Model-Properties Robustheit:** Müssen String-Datumswerte korrekt verarbeiten.
22. **`do-app-spec.yml` (NEU Sprint 54):** Die `do-app-spec.yml` muss die Umgebungsvariablen `SALT_KEY` (für Encryption) und `VALKEY_URL` (für Caching) für die `backend` und `celery-worker` Services enthalten.
23. **API-Dokumentation (NEU Sprint 54):** Die OpenAPI-Endpunkte (`/api/schema/`, `/api/docs/`, `/api/redoc/`) sind in Produktion verfügbar, aber durch `IsAdminUser` auf Staff-User beschränkt.

---

## Sprint-Fortschritt

| Sprint | Status | Version | Datum | Bemerkung |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |
| Sprint 53 | **ERLEDIGT** | v2.18.0 | 2026-03-30 | Security Hardening: Encryption Key Management, Seed-Command-Fix |
| Sprint 54 | **ERLEDIGT** | v2.19.0 | 2026-03-30 | DSGVO-Dokumentation & DevOps-Hardening |

---

## Sprint 54 – DSGVO-Dokumentation & DevOps-Hardening

### Haupt-Features

Der Sprint hat fünf Issues (#289, #284, #290, #268, #271) umgesetzt. Das Hauptziel war die Härtung der Produktionsumgebung und die Erfüllung von DSGVO-Dokumentationspflichten.

### Technische Details

- **DevOps:** Die `do-app-spec.yml` wurde um die kritischen Umgebungsvariablen `SALT_KEY` und `VALKEY_URL` für das Backend und den Celery-Worker erweitert. Dies stellt die Funktionsfähigkeit der Verschlüsselung und des Cachings nach einem Deployment sicher.
- **API:** Ein Alias für den Health-Check wurde unter `/api/v1/health/` hinzugefügt. Die OpenAPI-Schema-Endpunkte wurden aus dem `DEBUG`-Block gelöst und sind nun in Produktion für Staff-User verfügbar, was die API-Validierung erheblich erleichtert.
- **DSGVO:** Es wurden zwei zentrale Dokumente erstellt: das **Verzeichnis von Verarbeitungstätigkeiten** (Art. 30 DSGVO), das alle Datenflüsse und deren Rechtsgrundlagen dokumentiert, und eine **Datenschutz-Folgenabschätzung** (Art. 35 DSGVO), die aufgrund der Verarbeitung von sensiblen Daten von Kindern zwingend erforderlich war.

### Produktiv-Verifizierung

Alle 11 Tests waren erfolgreich. Die Health-Check-Endpunkte liefern 200 OK. Der Zugriff auf das OpenAPI-Schema ist wie erwartet auf Staff-User beschränkt und für andere blockiert. Die Verschlüsselung der Schülerdaten funktioniert nach dem Hinzufügen des `SALT_KEY` in der Konfiguration weiterhin korrekt.

---

## Bekannte Einschränkungen / Nächste Schritte

1.  **E-Mail-Versand für Passwort-Reset (#179):** Offenes Issue. Benötigt Konfiguration von SMTP-Variablen in `do-app-spec.yml`.
2.  **Anwesenheits-Modul erweitern:** Eine Statistik-Seite mit Fehlzeiten pro Schüler.
3.  **Seed-Daten erweitern:** Wochenthemen und Tagesaktivitäten in die Seed-Daten aufnehmen.
4.  **CI-Pipeline für Tests:** Die CI-Pipeline muss eine Test-Datenbank bereitstellen.
5.  **Frontend-Testing auf Produktivumgebung:** Systematisches Browser-basiertes Testing etablieren.
