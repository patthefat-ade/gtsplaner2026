'''
# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

**Stand:** 30.03.2026

## A. Stammdatenblatt: Allgemeine Angaben

| Feld | Angaben |
|---|---|
| **Verantwortlicher** | Hilfswerk Österreich | 
| **Adresse** | Musterstraße 1, 1010 Wien, Österreich |
| **E-Mail** | datenschutz@hilfswerk.at |
| **Datenschutzbeauftragter** | Nicht benannt (keine gesetzliche Verpflichtung) |
| **Vertreter des Verantwortlichen** | Nicht zutreffend (Sitz in der EU) |

---

## B. Übersicht der Datenverarbeitungszwecke

1.  **Benutzer- & Rechteverwaltung:** Authentifizierung, Autorisierung und Verwaltung von Benutzerkonten der Rollen SuperAdmin, Admin, LocationManager, Educator.
2.  **Stammdatenverwaltung (Mandanten, Standorte, Gruppen):** Verwaltung der Organisationsstruktur, Standorte und pädagogischen Gruppen.
3.  **Schülerverwaltung:** Erfassung, Verwaltung und Betreuung von Schüler:innen-Stammdaten, inklusive sensibler Daten und Einverständniserklärungen (Consent Management).
4.  **Finanzverwaltung & Kassenbuch:** Abwicklung von Transaktionen, Kategorisierung von Einnahmen/Ausgaben und Buchhaltung.
5.  **Zeiterfassung & Abwesenheitsmanagement:** Erfassung von Arbeitszeiten, Urlaubs- und Krankenstandsanträgen der Mitarbeiter.
6.  **Pädagogische Planung (Wochenpläne):** Erstellung und Verwaltung von Wochenplänen und Vorlagen für die pädagogische Arbeit.
7.  **Veranstaltungsmanagement:** Planung und Verwaltung von schulischen Veranstaltungen und Events.
8.  **Aufgabenmanagement:** Zuweisung und Verfolgung von Aufgaben innerhalb der Organisation.
9.  **System & Monitoring:** API-Health-Checks, Logging und Fehleranalyse.

---

## C. Detailangaben zu den Datenverarbeitungszwecken

### 1. Benutzer- & Rechteverwaltung

| Betroffene Personen | Datenkategorien | Rechtsgrundlage | Löschfrist |
|---|---|---|---|
| SuperAdmins, Admins, LocationManager, Educators | Name, E-Mail, Passwort (Hashed), Rolle, Organisation, 2FA-Status | Vertragserfüllung (Art. 6 Abs. 1 lit. b) | 3 Jahre nach letzter Aktivität |

### 2. Stammdatenverwaltung

| Betroffene Personen | Datenkategorien | Rechtsgrundlage | Löschfrist |
|---|---|---|---|
| Organisationen, Standorte, Gruppen | Name, Adresse, Kontaktdaten | Vertragserfüllung (Art. 6 Abs. 1 lit. b) | 7 Jahre nach Vertragsende |

### 3. Schülerverwaltung

| Betroffene Personen | Datenkategorien | Besondere Kategorien (Art. 9) | Rechtsgrundlage | Löschfrist |
|---|---|---|---|---|
| Schüler:innen, Erziehungsberechtigte | **Stammdaten:** Name, Geb.Datum, Adresse, E-Mail, Telefon (alle verschlüsselt) <br> **Consent:** Status, Datum, Name (verschlüsselt), Dokument | Gesundheitsdaten (indirekt über Allergien/Notizen mögl.) | Einwilligung (Art. 6 Abs. 1 lit. a), Vertragserfüllung (Art. 6 Abs. 1 lit. b) | 7 Jahre nach Schulaustritt |

### 4. Finanzverwaltung

| Betroffene Personen | Datenkategorien | Rechtsgrundlage | Löschfrist |
|---|---|---|---|
| Mitarbeiter, Lieferanten | Transaktionsdetails, Betrag, Datum, Kategorie, Beschreibung | Gesetzliche Verpflichtung (BAO, UGB) (Art. 6 Abs. 1 lit. c) | 7 Jahre (gesetzl. Aufbewahrungspflicht) |

### 5. Zeiterfassung

| Betroffene Personen | Datenkategorien | Besondere Kategorien (Art. 9) | Rechtsgrundlage | Löschfrist |
|---|---|---|---|---|
| Mitarbeiter | Arbeitszeiten, Pausen, Abwesenheitsart, Datum, Dauer | Gesundheitsdaten (bei Krankenstand) | Vertragserfüllung (Art. 6 Abs. 1 lit. b), Gesetzl. Verpflichtung (AZG) | 7 Jahre nach Austritt |

---

## D. Empfängerkategorien

| Empfängerkategorie | Zweck | Ort |
|---|---|---|
| **DigitalOcean, Inc.** | Hosting der Anwendung und Datenbanken (Auftragsverarbeiter) | Frankfurt, Deutschland (EU) |
| **Gerichte, Behörden** | Erfüllung gesetzlicher Auskunftspflichten | Österreich (EU) |

---

## E. Allgemeine Beschreibung der technisch-organisatorischen Maßnahmen (TOMs)

1.  **Vertraulichkeit:**
    *   **Verschlüsselung:** Sensible personenbezogene Daten (PII) von Schülern und Kontakten werden auf Feld-Ebene in der Datenbank verschlüsselt (AES-128, `django-fernet-encrypted-fields`).
    *   **Zugriffskontrolle:** Rollenbasiertes Berechtigungssystem (RBAC) stellt sicher, dass Benutzer nur auf die für ihre Rolle relevanten Daten zugreifen können.
    *   **Authentifizierung:** JWT-basierte Authentifizierung mit httpOnly-Cookies und optionaler Zwei-Faktor-Authentifizierung (2FA).

2.  **Integrität:**
    *   **Validierung:** Alle Dateneingaben werden serverseitig validiert.
    *   **Audit-Logs:** Wichtige Änderungen (z.B. Seed-Prozesse) werden protokolliert.
    *   **CSRF-Schutz:** Standardmäßiger CSRF-Schutz von Django wird für alle relevanten Endpunkte verwendet.

3.  **Verfügbarkeit und Belastbarkeit:**
    *   **Hosting:** Die Anwendung wird auf der hochverfügbaren DigitalOcean App Platform gehostet.
    *   **Backups:** Tägliche automatische Backups der PostgreSQL-Datenbank durch DigitalOcean.
    *   **Monitoring:** Health-Check-Endpunkte zur Überwachung der Systemverfügbarkeit.

4.  **Pseudonymisierung und Verschlüsselung:**
    *   Wie unter "Vertraulichkeit" beschrieben, werden hochsensible Daten auf Feld-Ebene verschlüsselt. Eine Pseudonymisierung findet derzeit nicht statt, da die Klarnamen für die Anwendungslogik erforderlich sind.

5.  **Evaluierungsmaßnahmen:**
    *   Regelmäßige Code-Reviews und Security-Audits (zuletzt Sprint 51-53).
    *   Systematisches Testing nach jedem Sprint auf der Produktionsumgebung.
'''
