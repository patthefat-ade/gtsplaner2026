# Sprint 23 Report: Location Manager Testing

**Sprint-Zeitraum:** 26.03.2026  
**Rolle:** Location Manager (locationmanager@gtsplaner.app / Lisa Standortleitung)  
**Status:** Abgeschlossen

## Zusammenfassung

Sprint 23 konzentrierte sich auf das systematische Testen der Anwendung aus der Perspektive der Standortleitung (Location Manager). Es wurden fünf Issues identifiziert und erfolgreich behoben. Zusätzlich wurde ein kritischer Login-Bug entdeckt und gefixt.

## Issues und Ergebnisse

| Issue | Titel | Status | PR |
|-------|-------|--------|-----|
| #60 | Formulare: Native HTML-Inputs durch DatePicker/TimePicker ersetzen | Geschlossen | #65 |
| #61 | JWT Access Token Lifetime von 15 auf 60 Minuten erhöhen | Geschlossen | #65 |
| #62 | Transaktionsformular: Gruppen-Dropdown leer für Standortleiter | Geschlossen | #65 (Seed Data) |
| #63 | Dashboard-Karten zeigen 0 für Standortleiter-Rolle | Geschlossen | #65 (Seed Data) |
| #64 | TimePicker-Komponente im 24h-Format erstellen | Geschlossen | #65 |
| (Bonus) | Login-Bug: Abgelaufene Tokens verhindern Login | Behoben | #66 |

## Implementierte Änderungen

### DatePicker/TimePicker Integration (Issue #60, #64)

Alle Formulare verwenden jetzt die shadcn/ui-basierten DatePicker- und TimePicker-Komponenten statt nativer HTML-Inputs. Das Datumsformat ist konsistent auf **dd.MM.yyyy** (deutsches Format) und das Zeitformat auf **HH:mm** (24-Stunden-Format) eingestellt.

Die betroffenen Formulare umfassen das Transaktionsformular, das Zeiteintrag-Formular, das Abwesenheitsformular und das Gruppenformular. Die neue TimePicker-Komponente bietet Stunden- und Minuten-Dropdowns mit den Labels "Std." und "Min." und ist visuell konsistent mit der bestehenden DatePicker-Komponente.

### JWT Token Lifetime (Issue #61)

Die Access Token Lifetime wurde von 15 auf 60 Minuten erhöht, um häufiges Ausloggen zu vermeiden. Die Konfiguration erfolgt über die Umgebungsvariable `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` in der Django-Settings-Datei.

### Seed Data (Issue #62, #63)

Ein Django Management Command `seed_data` wurde erstellt, der Testdaten für Schuljahre, Abwesenheitstypen, Gruppen, Schüler, Transaktionen und Zeiteinträge anlegt. Dies behebt die leeren Dropdowns und Dashboard-Karten für alle Benutzerrollen.

### Login-Bug Fix (PR #66)

Ein kritischer Bug wurde entdeckt: Wenn ein Benutzer abgelaufene Tokens im localStorage von einer vorherigen Session hat, schlug der Login mit der Fehlermeldung "Der Token ist für keinen Tokentyp gültig" fehl. Der Fix löscht alte Tokens aus dem localStorage, bevor der Login-API-Call gemacht wird.

## Live-Test Ergebnisse

Alle Tests wurden auf der Produktionsumgebung (www.gtsplaner.app) durchgeführt.

| Testbereich | Ergebnis |
|-------------|----------|
| Login als Location Manager | Erfolgreich |
| Dashboard Cards (Gruppen, Transaktionen, Genehmigungen, Zeiteinträge) | Korrekte Werte |
| DatePicker in Transaction Form (dd.MM.yyyy) | Korrekt |
| DatePicker in Time Entry Form (dd.MM.yyyy) | Korrekt |
| TimePicker in Time Entry Form (HH:mm, 24h) | Korrekt |
| DatePicker in Absence Form (dd.MM.yyyy) | Korrekt |
| Gruppen-Dropdown im Transaktionsformular | Funktional |
| Sidebar-Navigation (kein Admin-Bereich sichtbar) | Korrekt |
| 403-Fehlerseiten bei Admin-URLs | Korrekt |
| Profil-Seite | Funktional |
| Finanzberichte mit Recharts | Funktional |

## Merged Pull Requests

| PR | Titel | Branch |
|----|-------|--------|
| #65 | Sprint 23: DatePicker/TimePicker, JWT Lifetime, Seed Data | sprint-23/location-manager-fixes |
| #66 | fix: Clear stale tokens before login to prevent token type error | fix/login-stale-tokens |

## Nächste Schritte (Sprint 24)

Sprint 24 wird sich auf das systematische Testen als **Teacher-Rolle** (teacher@gtsplaner.app) konzentrieren. Dabei werden alle Seiten und Formulare aus der Perspektive eines Lehrers getestet und eventuelle Berechtigungs- oder Funktionsprobleme identifiziert.
