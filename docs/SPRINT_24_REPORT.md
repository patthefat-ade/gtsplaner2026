# Sprint 24 Report – Educator-Rolle Berechtigungen und Route-Guards

**Sprint:** 24
**Datum:** 26.03.2026
**Fokus:** Educator-Benutzerrolle (educator@gtsplaner.app)
**Status:** Geplant und gestartet

---

## 1. Sprint-Ziel

Systematische Prüfung der Educator-Rolle auf der Live-Domain (www.gtsplaner.app) gegen die Spezifikation (02_ROLES_AND_PERMISSIONS.md). Identifikation aller Abweichungen zwischen SOLL- und IST-Zustand und Erstellung von GitHub Issues.

---

## 2. Durchgeführte Tests

### 2.1 Getestete Seiten

| Seite | URL | Educator-Zugriff SOLL | Educator-Zugriff IST | Status |
|-------|-----|----------------------|---------------------|--------|
| Dashboard | / | Erlaubt | Erlaubt | OK |
| Transaktionen | /finance/transactions | Erlaubt (eigene Gruppen) | Erlaubt | OK |
| Gruppen | /groups/list | Erlaubt (zugewiesene) | Erlaubt | OK |
| Zeiteinträge | /timetracking/entries | Erlaubt (eigene) | Erlaubt | OK |
| Abwesenheiten | /timetracking/leave-requests | Erlaubt (eigene) | Erlaubt | OK |
| Profil | /profile | Erlaubt | Erlaubt | OK |
| Finanzberichte | /finance/reports | Gesperrt | Zugänglich | **BUG** |
| Kategorien | /finance/categories | Gesperrt | Zugänglich | **BUG** |
| Schüler:innen | /groups/students | Gesperrt | Zugänglich | **BUG** |
| Genehmigungen | /timetracking/approval | Gesperrt | Zugänglich | **BUG** |
| Neue Gruppe | /groups/new | Gesperrt | Zugänglich | **BUG** |
| Admin Users | /admin/users | Gesperrt | Gesperrt | OK |
| Admin Audit-Log | /admin/audit-log | Gesperrt | Gesperrt | OK |
| Admin Settings | /admin/settings | Gesperrt | Gesperrt | OK |
| Admin Orgs | /admin/organizations | Gesperrt | Gesperrt | OK |

### 2.2 Getestete Formulare

| Formular | Ergebnis |
|----------|----------|
| Neue Transaktion | Gruppen-Dropdown leer (Bug #68) |
| Neuer Zeiteintrag | Funktional |
| Neuer Abwesenheitsantrag | Funktional |
| Profil bearbeiten | Funktional, E-Mail korrekt gesperrt |
| Passwort ändern | Formular vorhanden |
| 2FA einrichten | Button vorhanden |

---

## 3. Identifizierte Issues

### 3.1 Aus Sprint 23 übernommen (4 Issues)

| Issue | Titel | Priorität | Typ |
|-------|-------|-----------|-----|
| #67 | Frontend Route-Guards: Educator kann auf gesperrte Seiten per URL zugreifen | Hoch | Bugfix |
| #68 | Gruppen-Dropdown leer für Educator in Transaktions-/Zeiteintrag-Formularen | Mittel | Bugfix |
| #70 | Seed Data: Educator als Gruppenmitglied hinzufügen | Mittel | Chore |
| #71 | Dashboard-Cards zeigen 0 für Educator-Rolle | Mittel | Bugfix |

### 3.2 Neue Issues Sprint 24 (7 Issues)

| Issue | Titel | Priorität | Typ |
|-------|-------|-----------|-----|
| #72 | Route-Guard: /groups/new ohne Zugriffskontrolle für Educator | Hoch | Bugfix |
| #73 | "Neue Gruppe" Button für Educator auf /groups/list sichtbar | Mittel | Bugfix |
| #74 | "Neue Kategorie" Button für Educator auf /finance/categories sichtbar | Mittel | Bugfix |
| #75 | "Neues Kind" Button für Educator auf /groups/students sichtbar | Mittel | Bugfix |
| #76 | Dashboard: "Ausstehende Genehmigungen" Card für Educator ausblenden | Niedrig | Bugfix |
| #77 | Zentrale Route-Guard-Middleware für rollenbasierte Seitenzugriffskontrolle | Hoch | Feature |
| #78 | Educator: Rollenbasierte Button-Sichtbarkeit auf allen Seiten | Mittel | Feature |

---

## 4. Sprint-Analyse

### 4.1 Kernproblem

Das Hauptproblem ist das Fehlen einer **zentralen Route-Guard-Middleware** im Frontend. Die Sidebar versteckt Links korrekt basierend auf Rollen, aber es gibt keine Zugriffskontrolle auf Seitenebene. Benutzer können per direkter URL auf gesperrte Seiten zugreifen.

Die Admin-Seiten (/admin/*) sind bereits korrekt geschützt, was zeigt, dass das Pattern bekannt ist, aber nicht konsistent angewendet wurde.

### 4.2 Empfohlene Implementierungsreihenfolge

1. **#77** Zentrale Route-Guard-Middleware (löst #67, #72 gleichzeitig)
2. **#70** Seed Data: Educator als Gruppenmitglied (Voraussetzung für weitere Tests)
3. **#78** Rollenbasierte Button-Sichtbarkeit (löst #73, #74, #75 gleichzeitig)
4. **#68** Gruppen-Dropdown für Educator (Backend-Fix)
5. **#71** Dashboard-Cards für Educator (hängt von #70 ab)
6. **#76** Dashboard Genehmigungen-Card ausblenden

### 4.3 Positive Befunde

- Sidebar-Navigation korrekt konfiguriert (Educator sieht nur erlaubte Links)
- Admin-Seiten korrekt geschützt ("Zugriff verweigert")
- Profil-Seite funktioniert korrekt (E-Mail nicht editierbar)
- 2FA-Einrichtung verfügbar
- DatePicker und TimePicker funktionieren korrekt (Sprint 23 Fixes)

---

## 5. Gesamt-Statistik

| Metrik | Wert |
|--------|------|
| Getestete Seiten | 15 |
| Getestete Formulare | 6 |
| Bugs gefunden (neu) | 7 |
| Bugs übernommen (Sprint 23) | 4 |
| **Gesamt Issues Sprint 24** | **11** |
| Davon Priorität Hoch | 3 |
| Davon Priorität Mittel | 6 |
| Davon Priorität Niedrig | 1 |
| Scope Frontend | 10 |
| Scope Backend | 1 |
