# Datenschutz-Folgenabschätzung (DSFA) – GTS Planner

**System- oder Projektname:** GTS Planner
**Datum:** 30.03.2026
**Zuständige Person:** Manus AI (im Auftrag von Hilfswerk Österreich)

---

## I. Grundlegende Informationen

| Frage | Antwort | Risikofaktor |
|---|---|---|
| **System- & Projektbeschreibung** | Webanwendung zur Verwaltung von Ganztagsschulen (GTS), inkl. Schüler, Personal, Finanzen, Planung und Kommunikation. | - |
| **Welche personenbezogenen Daten werden verarbeitet?** | Stammdaten (Name, Adresse, Kontakt), Authentifizierungsdaten, Rollen, Berechtigungen, Finanzdaten, Zeit- & Abwesenheitsdaten, Planungsdaten, Gesundheitsdaten (indirekt), Consent-Daten. Siehe [Verarbeitungsverzeichnis](VERARBEITUNGSVERZEICHNIS.md) für Details. | **Hoch** |
| **Zweck der Verarbeitung?** | Vertragserfüllung zur Organisation des Schulbetriebs, Erfüllung gesetzlicher Pflichten (Arbeitszeit, Buchhaltung), pädagogische Planung. | Mittel |
| **Kategorien betroffener Personen?** | Mitarbeiter (SuperAdmins, Admins, LocationManager, Educators), Schüler:innen, Erziehungsberechtigte. | Mittel |
| **Anzahl betroffener Personen?** | Skalierend, aktuell ca. 112 Schüler, ca. 50 Mitarbeiter. | Mittel |
| **Genutzte Technologie?** | Cloud-basierte Webanwendung (DigitalOcean), PostgreSQL-Datenbank, Django/Python Backend, Next.js/React Frontend. | **Hoch** |
| **Wurden Betroffene informiert?** | Ja, über die Datenschutzerklärung bei der Registrierung und Einholung der Einwilligung für Schülerdaten. | Niedrig |
| **Automatisierte Entscheidungen?** | Nein, es finden keine automatisierten Einzelentscheidungen mit rechtlicher Wirkung statt. | Niedrig |
| **Kombination von Datensätzen?** | Ja, Daten werden innerhalb der Anwendung verknüpft (z.B. Schüler zu Gruppen, Zeiteinträge zu Mitarbeitern). | Mittel |

---

## II. Rechtliche Beurteilung

### (a) Schwellwertanalyse

**Liegt eine Verarbeitung gemäß Blacklist der Datenschutzbehörde vor?**

Ja, die Verarbeitung fällt unter die Notwendigkeit einer DSFA, da eine **umfangreiche Verarbeitung besonderer Kategorien von Daten** (Gesundheitsdaten von Kindern, Art. 9 DSGVO) stattfindet. Die Verarbeitung von Daten von Kindern, die besonders schutzbedürftig sind, und die mögliche Erfassung von Gesundheitsinformationen (z.B. Allergien) in Notizfeldern begründen das hohe Risiko.

**Liegt eine systematische, umfangreiche Überwachung öffentlich zugänglicher Bereiche vor?**

Nein.

**Ergebnis:** Eine Datenschutz-Folgenabschätzung ist **zwingend durchzuführen**.

### (b) Rechtliche Risikobewertung

| Frage | Bewertung | Begründung |
|---|---|---|
| **Zweckbindung & Rechtmäßigkeit** | **Konform** | Zwecke sind klar definiert (Vertragserfüllung, gesetzl. Pflicht, Einwilligung). Rechtsgrundlagen sind im Verarbeitungsverzeichnis dokumentiert. |
| **Datenminimierung** | **Konform** | Es werden nur die für den jeweiligen Zweck erforderlichen Daten erhoben. Die Datenfelder sind auf das notwendige Maß beschränkt. |
| **Speicherbegrenzung** | **Konform** | Löschfristen sind definiert und orientieren sich an gesetzlichen Aufbewahrungspflichten (z.B. 7 Jahre für Buchhaltung) oder dem Zweckentfall. |
| **Zugriffsbeschränkung** | **Konform** | Das rollenbasierte Berechtigungssystem (RBAC) beschränkt den Datenzugriff auf das für die jeweilige Aufgabe notwendige Maß ("Need-to-know"-Prinzip). |
| **Betroffenenrechte (Information, Auskunft, Löschung etc.)** | **Konform** | Die Anwendung stellt Mechanismen zur Verfügung, um den Betroffenenrechten nachzukommen. Die Informationspflichten werden durch die Datenschutzerklärung erfüllt. |
| **Empfänger & Drittlandtransfer** | **Konform** | Der einzige Auftragsverarbeiter ist DigitalOcean mit Serverstandort in Frankfurt (EU). Es findet kein Transfer in unsichere Drittländer statt. |

---

## III. Technische Risikobewertung

Die technischen und organisatorischen Maßnahmen (TOMs) sind detailliert im [Verarbeitungsverzeichnis (Abschnitt E)](VERARBEITUNGSVERZEICHNIS.md) beschrieben. Diese Maßnahmen werden als **ausreichend** erachtet, um die identifizierten Risiken zu mitigieren.

---

## IV. Maßnahmen zur Risikobegrenzung

| Festgestelltes Risiko | Eintrittswahrscheinlichkeit & Auswirkung | Maßnahmen zur Risikobegrenzung | Risikoeffekt (nach Maßnahme) |
|---|---|---|---|
| **Unbefugter Zugriff auf sensible Schülerdaten (Gesundheit, PII)** | **Mittel:** Trotz starker TOMs kann menschliches Versagen (z.B. Phishing) oder eine Sicherheitslücke nie zu 100% ausgeschlossen werden. **Auswirkung: Hoch** (Diskriminierung, Identitätsdiebstahl). | 1. **Feld-Level-Verschlüsselung:** Alle PII von Schülern sind in der DB verschlüsselt. <br> 2. **Striktes RBAC:** Zugriff nur für autorisiertes Personal. <br> 3. **2FA (optional):** Zusätzliche Sicherheitsebene für Benutzer-Logins. <br> 4. **Regelmäßige Security Audits.** | **Niedrig** |
| **Datenverlust durch Systemausfall oder Angriff** | **Niedrig:** Hosting auf hochverfügbarer Plattform. **Auswirkung: Hoch** (Betriebsunterbrechung, Verletzung der Rechenschaftspflicht). | 1. **Tägliche, automatische DB-Backups** durch DigitalOcean. <br> 2. **Health-Check-Monitoring** zur proaktiven Überwachung der Systemverfügbarkeit. | **Niedrig** |
| **Verletzung der Datenintegrität (unbeabsichtigte Änderung)** | **Niedrig:** Serverseitige Validierung und strukturierte Eingabemasken minimieren das Risiko. **Auswirkung: Mittel** (Falsche Abrechnungen, inkorrekte pädagogische Planung). | 1. **Serverseitige Validierung** aller Eingaben. <br> 2. **Audit-Logging** für kritische Operationen. <br> 3. **CSRF-Schutz** und weitere Django-Security-Features. | **Niedrig** |

---

## V. Implementierung & Überprüfung

| Getroffene Maßnahme | Status | Zuständig | Datum der Fertigstellung |
|---|---|---|---|
| Feld-Level-Verschlüsselung für Schülerdaten | **Implementiert** | Manus AI | Sprint 53 (29.03.2026) |
| Rollenbasiertes Zugriffskontrollsystem (RBAC) | **Implementiert** | Manus AI | Seit Sprint 48 |
| Zwei-Faktor-Authentifizierung (2FA) | **Implementiert** | Manus AI | Sprint 51 |
| Tägliche Datenbank-Backups | **Implementiert** | DigitalOcean / Manus AI | Seit Projektstart |
| Regelmäßige Security Audits | **Laufend** | Manus AI | Zuletzt Sprint 51-53 |

**Überprüfung:** Die Wirksamkeit der Maßnahmen wird nach jedem Sprint im Rahmen des systemweiten Tests und bei Bedarf durch dedizierte Security-Audits überprüft.
