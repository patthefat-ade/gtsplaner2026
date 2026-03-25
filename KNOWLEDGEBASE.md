# GTS Planner – Kassenbuch App v2 – Knowledgebase

**Version:** v9 (nach Sprint 15)
**Letzte Aktualisierung:** 2026-03-25
**Status:** Sprint 15 abgeschlossen

---

## Projektübersicht

| Eigenschaft | Wert |
|---|---|
| **Projektname** | GTS Planner – Kassenbuch App v2 |
| **Backend** | Django 5.2 + DRF + drf-spectacular + Django Unfold |
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| **Datenbank** | PostgreSQL 16 (Docker) / SQLite (Dev) |
| **Auth** | JWT (SimpleJWT) – Login, Logout, Refresh, Password Reset/Change |
| **Async** | Celery + Redis |
| **API-Standard** | OpenAPI 3.0.3 (48 Pfade) |
| **Theme** | Dark Mode (Standard), Light Mode |
| **Primärfarbe** | #FFCC00 (Gold/Gelb) |
| **Frontend-Routen** | 16 Routen (Build erfolgreich) |
| **Zod-Version** | v4.3.6 (Zod v4 API – `error` statt `required_error`) |
| **Security** | Field-level Encryption, Brute-Force Protection, Security Headers, JWT Hardening |

---

## Technische Grundregeln

1. **Backend:** Django + Django REST Framework + Django Unfold Admin
2. **Frontend:** Next.js App Router + shadcn/ui Komponenten + Tailwind CSS 4
3. **Dark Mode:** Standard-Theme, implementiert via `next-themes`
4. **API:** Alle Endpunkte unter `/api/v1/`, OpenAPI 3.0 Schema unter `/api/schema/`
5. **Sprache:** Deutsch (UI), Englisch (Code-Kommentare und Variablennamen)
6. **Zeitzone:** Europe/Vienna
7. **Rollen:** Educator, LocationManager, Admin, SuperAdmin
8. **Auth:** JWT via SimpleJWT, Tokens in localStorage, Cookie-Flag für Middleware
9. **Zod v4:** `z.enum()` nutzt `{ error: "..." }` statt `{ required_error: "..." }`
10. **Zod v4:** `z.number()` statt `z.coerce.number()` für TypeScript-Kompatibilität mit React Hook Form
11. **Zod v4:** `z.boolean()` statt `z.boolean().default(true)` für korrekte Typ-Inferenz
12. **TypeScript:** Prop-Namen müssen exakt mit den Interface-Definitionen übereinstimmen (z.B. `entry` statt `timeEntry`)
13. **GroupCreate:** Benötigt `location`-Feld – muss aus Auth-Context oder als Default gesetzt werden
14. **Encryption:** `django-fernet-encrypted-fields` für PII-Daten. Alle verschlüsselten Felder müssen `null=True` haben für PostgreSQL-Kompatibilität.

---

## Sprint-Fortschritt

| Sprint | Status | Datum | Bemerkung |
|---|---|---|---|
| Sprint 1 – Grundlagen & Setup | **ERLEDIGT** | 2026-02-28 | Alle Aufgaben abgeschlossen |
| Sprint 2 – Authentifizierung | **ERLEDIGT** | 2026-03-01 | 54 Tests bestanden, Frontend baut |
| Sprint 3 – Datenmodell & Migrationen | **ERLEDIGT** | 2026-03-01 | 110 Tests bestanden, 17 Models |
| Sprint 4 – API Endpoints | **ERLEDIGT** | 2026-03-01 | 67 Tests, 48 API-Pfade, OpenAPI 3.0.3 |
| Sprint 5 – Frontend Pages & Components | **ERLEDIGT** | 2026-03-01 | 16 Routen, 13 shadcn/ui + 6 Common Komponenten |
| Sprint 6 – Forms & Validation | **ERLEDIGT** | 2026-03-01 | 8 Formulare, Zod v4 Schemas, Toast, DatePicker |
| Sprint 7 – Data Fetching & State | **ERLEDIGT** | 2026-03-01 | Formulare integriert, Error Boundary, Skeleton Loading, Debounce |
| Sprint 8 – Admin Panel & Audit | **ERLEDIGT** | 2026-03-25 | Django Unfold Admin, Audit Logging, Signals |
| Sprint 9 – PWA Features | OFFEN | – | – |
| Sprint 10 – Testing | **ERLEDIGT** | 2026-03-25 | CI-Fixes, Test-Anpassungen für Verschlüsselung |
| Sprint 11 – Dokumentation | **ERLEDIGT** | 2026-03-25 | Knowledge Base, Checkliste aktualisiert |
| Sprint 12 – Deployment | OFFEN | – | – |
| Sprint 13 – Production Ready | OFFEN | – | – |
| Sprint 14 – Launch | OFFEN | – | – |
| Sprint 15 – Security Hardening | **ERLEDIGT** | 2026-03-25 | Field Encryption, Brute-Force Protection, JWT Hardening |

---

## Sprint 15 – Erledigte Aufgaben

### Feld-Verschlüsselung (DSGVO-Konformität) - PR #18
- [x] `django-fernet-encrypted-fields` für At-Rest-Verschlüsselung
- [x] Student: Vorname, Nachname, Geburtsdatum, E-Mail, Telefon, Adresse verschlüsselt
- [x] User: Telefon verschlüsselt
- [x] Organization/Location: E-Mail, Telefon, Adresse verschlüsselt
- [x] PostgreSQL-kompatibel mit `null=True` für alle verschlüsselten Felder

### API-Dokumentation gesichert - PR #19
- [x] Swagger/ReDoc nur für authentifizierte Staff-User zugänglich
- [x] Schema-Endpoint geschützt

### Brute-Force-Schutz & Security Headers - PR #20
- [x] `django-axes`: 5 Versuche, 30 Min Sperre
- [x] HSTS, X-Content-Type-Options, X-Frame-Options
- [x] Rate Limiting: 100 req/min allgemein, 5 req/min Login

### JWT Token-Optimierung - PR #21
- [x] Access Token: 15 Minuten Lebensdauer
- [x] Refresh Token: 7 Tage mit Rotation
- [x] Custom Claims: `role`, `location_id`

---

## Alle 17 Models (Übersicht)

| App | Model | Tabelle | Status |
|---|---|---|---|
| core | User | users_user | Sprint 1 |
| core | Organization | users_organization | Sprint 1 |
| core | Location | users_location | Sprint 1 |
| system | AuditLog | system_auditlog | Sprint 1 |
| system | SystemSetting | system_setting | Sprint 1 |
| finance | TransactionCategory | finance_transactioncategory | Sprint 3 |
| finance | Transaction | finance_transaction | Sprint 3 |
| finance | Receipt | finance_receipt | Sprint 3 |
| timetracking | TimeEntry | timetracking_timeentry | Sprint 3 |
| timetracking | LeaveType | timetracking_leavetype | Sprint 3 |
| timetracking | LeaveRequest | timetracking_leaverequest | Sprint 3 |
| timetracking | WorkingHoursLimit | timetracking_workinghourslimit | Sprint 3 |
| groups | SchoolYear | calendar_schoolyear | Sprint 3 |
| groups | Semester | calendar_semester | Sprint 3 |
| groups | Group | groups_group | Sprint 3 |
| groups | GroupMember | groups_groupmember | Sprint 3 |
| groups | Student | groups_student | Sprint 3 |

---

## Projektstruktur (aktualisiert nach Sprint 15)

```
kassenbuch-app/
├── backend/
│   ├── config/                    # Django Konfiguration
│   ├── core/                      # User, Auth, Permissions
│   ├── finance/                   # TransactionCategory, Transaction, Receipt
│   ├── timetracking/              # TimeEntry, LeaveType, LeaveRequest
│   ├── groups/                    # SchoolYear, Semester, Group, Student
│   ├── admin_panel/               # AuditLog, SystemSettings ViewSets
│   ├── system/                    # AuditLog, SystemSetting Models
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/            # Login, Forgot Password
│   │   │   ├── (dashboard)/       # Dashboard Layout + alle Seiten (voll integriert)
│   │   │   ├── layout.tsx         # Root Layout mit Providers (Theme, Query, Auth, Toast)
│   │   │   └── globals.css        # Tailwind + Dark Mode CSS Variables
│   │   ├── components/
│   │   │   ├── ui/                # 19 shadcn/ui Komponenten
│   │   │   ├── common/            # 9 Common Components (inkl. ErrorBoundary, SkeletonLoaders)
│   │   │   ├── forms/             # 8 Formular-Komponenten (Dialog-basiert)
│   │   │   ├── layout/            # Sidebar, Header
│   │   │   ├── auth-provider.tsx
│   │   │   ├── query-provider.tsx
│   │   │   ├── theme-provider.tsx
│   │   │   └── protected-route.tsx
│   │   ├── hooks/                 # use-auth, use-finance, use-timetracking, use-groups, use-admin, use-debounce
│   │   ├── lib/                   # api.ts, utils.ts, format.ts, constants.ts, auth-api.ts, validations.ts, form-utils.ts
│   │   ├── types/                 # models.ts, auth.ts
│   │   └── middleware.ts
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── KNOWLEDGEBASE.md
```

---

## Nächster Sprint: Sprint 16 – PWA & Mobile App

### Geplante Aufgaben

1. **PWA Features** – Web Manifest, Service Worker, Offline-Fähigkeit
2. **React Native Mobile App** – Initiales Setup mit Expo, Login-Screen
3. **Deployment-Vorbereitung** – Docker-Images für Produktion optimieren
4. **Bugfixes & Refactoring** – Code-Qualität verbessern
