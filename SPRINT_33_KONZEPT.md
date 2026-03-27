# Sprint 33: Konzept für Verfeinerung und UX-Verbesserungen

**Sprint-Ziel:** Bestehende Funktionalität stabilisieren, kritische Bugs beheben und die allgemeine User Experience durch gezielte Verbesserungen polieren. Es werden keine neuen Major-Features entwickelt.

## 1. Kritische Bug-Fixes (Höchste Priorität)

Diese Bugs beeinträchtigen die Kernfunktionalität und müssen umgehend behoben werden.

| ID | Titel | Beschreibung | Priorität |
| :--- | :--- | :--- | :--- |
| **BUG-01** | Dashboard Stats API gibt 500 Fehler zurück | Die API unter `/api/v1/dashboard/stats/` schlägt fehl, weil sie auf nicht-existente Felder in den `TimeEntry` (`hours`, `description`) und `Transaction` (`date`) Modellen zugreift. Das führt dazu, dass auf dem Dashboard für alle Rollen nur Nullen angezeigt werden. | **Kritisch** |
| **BUG-02** | Wochenplan-Seiten laden endlos | Das Frontend ruft die falsche API-URL (`/api/v1/weeklyplans/`) anstelle der korrekten (`/api/v1/weeklyplans/plans/`) auf. Dadurch können keine Wochenpläne geladen werden. | **Kritisch** |
| **BUG-03** | Keine Wochenpläne trotz Seed-Daten | Selbst mit korrekter URL und SuperAdmin-Rechten werden keine Wochenpläne angezeigt (`count: 0`). Die Seed-Daten müssen überprüft und der Filter-Mechanismus in der `WeeklyPlanViewSet` untersucht werden. | **Hoch** |

## 2. UX-Verbesserungen (Mittlere Priorität)

Diese Verbesserungen erhöhen die Benutzerfreundlichkeit und sorgen für ein konsistentes Erlebnis in der gesamten Applikation.

| ID | Titel | Beschreibung | Betroffene Seiten |
| :--- | :--- | :--- | :--- |
| **UX-01** | Breadcrumbs implementieren | Aktuell fehlen Breadcrumbs im gesamten System. Sie sollen auf allen Unterseiten zur besseren Navigation hinzugefügt werden. | Alle außer Dashboard |
| **UX-02** | Toast-Nachrichten für Wochenpläne | Die vier Wochenplan-Seiten (Liste, Editor, Neu, Vorlagen) zeigen keine Bestätigung (Toast) nach Aktionen wie Speichern, Löschen oder Erstellen. | `/weeklyplans/*` |
| **UX-03** | Skeleton-Loading für Wochenpläne | Die Wochenplan-Seiten zeigen keinen Lade-Indikator (Skeleton), während Daten abgerufen werden. | `/weeklyplans/*` |
| **UX-04** | Mobile Responsiveness für Wochenplan-Editor | Der Wochenplan-Editor ist auf mobilen Geräten nicht nutzbar. Die Grid-Ansicht muss für kleinere Bildschirme optimiert werden. | `/weeklyplans/[id]` |
| **UX-05** | Pagination für Listenansichten | Wichtige Listenansichten wie die Wochenplan-Liste und die Vorlagen-Seite haben keine Pagination, was bei vielen Einträgen zu Performance-Problemen führt. | `/weeklyplans`, `/weeklyplans/templates` |

## 3. Technische Schulden (Niedrige Priorität)

| ID | Titel | Beschreibung |
| :--- | :--- | :--- |
| **TECH-01** | Fehlende Formular-Validierungen | Überprüfung aller Formulare auf fehlende client- und serverseitige Validierungen, um die Datenintegrität zu gewährleisten. |
| **TECH-02** | Code-Duplikation in Hooks | Überprüfung der React-Hooks auf Duplikationen und Refactoring-Potenzial. |

## Zeitplan & Umsetzung

Der Sprint wird in drei Phasen unterteilt:
1.  **Phase 1 (Tage 1-2):** Behebung der kritischen Bugs (BUG-01, BUG-02, BUG-03).
2.  **Phase 2 (Tage 3-5):** Implementierung der UX-Verbesserungen (UX-01 bis UX-05).
3.  **Phase 3 (Tage 6-7):** Abbau technischer Schulden, Browser-Tests und Dokumentation.

Für jede Aufgabe wird ein separates GitHub-Issue erstellt.
