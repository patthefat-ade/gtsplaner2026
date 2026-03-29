/**
 * Rechtliche Inhalte für Impressum, Datenschutz und Nutzungsbedingungen.
 *
 * Diese Texte werden in Modals auf der Login-Seite und im Dashboard angezeigt.
 * Die Datenschutzerklärung und Nutzungsbedingungen müssen beim ersten Login
 * akzeptiert werden.
 */

export const LEGAL_CONTENT = {
  impressum: {
    title: "Impressum",
    content: `**Medieninhaber, Hersteller und Herausgeber:**

Hilfswerk Österreich
Bundesgeschäftsstelle

Grünbergstraße 15/2/5, 1120 Wien
Tel.: 01 / 40 57 500
Fax: DW -60
E-Mail: office@hilfswerk.at
Internet: [www.hilfswerk.at](https://www.hilfswerk.at)
ZVR-Zahl: 878060546

**Vertretungsbefugte Organe:**
Präsident: Dr. Othmar Karas
Geschäftsführerin: Elisabeth Anselm

**Bankverbindung:**
ERSTE Bank, Konto lautend auf Hilfswerk Österreich
IBAN: AT29 2011 1292 4605 3900
BIC: GIBAATWW

**Anwendung:**
GTS Planer – Digitale Unterstützung in der täglichen Zusammenarbeit
Entwickelt im Auftrag des Hilfswerk Österreich für die Verwaltung von Ganztagesschulen.

**Haftungsausschluss:**
Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.

**Urheberrecht:**
Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem österreichischen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.`,
  },

  datenschutz: {
    title: "Datenschutzerklärung",
    content: `**Datenschutzerklärung für die Anwendung GTS Planer**
*Information nach Artikel 13 und 14 Datenschutz-Grundverordnung (DSGVO)*
*Stand: März 2026*

**1. Verantwortlicher**

Hilfswerk Österreich
Grünbergstraße 15/2/5, 1120 Wien
Tel.: 01 / 40 57 500
E-Mail: office@hilfswerk.at

Externer Datenschutzbeauftragter: Dr. Werner Pilgermair
E-Mail: datenschutz@pilgermair.at

**2. Zweck der Datenverarbeitung**

Die Anwendung GTS Planer dient der digitalen Unterstützung in der täglichen Zusammenarbeit an Ganztagesschulen. Im Rahmen der Nutzung werden folgende personenbezogene Daten verarbeitet:

- **Benutzerdaten:** Name, E-Mail-Adresse, Telefonnummer, Rolle, Standortzuordnung
- **Schülerdaten:** Name, Geburtsdatum, Kontaktdaten der Erziehungsberechtigten, Allergien, besondere Bedürfnisse
- **Einwilligungsdaten:** Status der Einwilligung, Datum, Name des Erziehungsberechtigten, Einwilligungsdokument
- **Zeiterfassungsdaten:** Arbeitszeiten, Urlaubsanträge
- **Finanzdaten:** Transaktionen im Rahmen der Kassenbuchführung

**3. Rechtsgrundlage**

Die Verarbeitung Ihrer personenbezogenen Daten erfolgt auf Grundlage von:
- Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) – insbesondere für die Verarbeitung von Daten Minderjähriger gemäß Art. 8 DSGVO
- Art. 6 Abs. 1 lit. b DSGVO (Erfüllung eines Vertrages bzw. vorvertraglicher Maßnahmen)
- Art. 6 Abs. 1 lit. c DSGVO (Erfüllung rechtlicher Verpflichtungen)
- Art. 6 Abs. 1 lit. d DSGVO (Schutz lebenswichtiger Interessen, z.B. Allergien, Notfallkontakte)
- Art. 6 Abs. 1 lit. f DSGVO (Berechtigtes Interesse des Verantwortlichen)
- Art. 9 Abs. 2 lit. h DSGVO (Gesundheitsvorsorge für besondere Kategorien personenbezogener Daten)

**4. Verarbeitung von Daten Minderjähriger (Art. 8 DSGVO)**

Für die Verarbeitung personenbezogener Daten von Kindern unter 14 Jahren (gemäß § 4 Abs. 4 DSG) ist die Einwilligung des Erziehungsberechtigten erforderlich. Die Anwendung erfasst und dokumentiert den Einwilligungsstatus, das Datum der Einwilligung sowie den Namen des Erziehungsberechtigten. Eine erteilte Einwilligung kann jederzeit widerrufen werden. Im Falle eines Widerrufs werden die betroffenen Daten nicht mehr aktiv verarbeitet, sondern nur noch gespeichert, soweit gesetzliche Aufbewahrungspflichten bestehen.

**5. Einschränkung der Verarbeitung (Art. 18 DSGVO)**

Betroffene Personen bzw. deren Erziehungsberechtigte haben das Recht, die Einschränkung der Verarbeitung ihrer Daten zu verlangen. In diesem Fall werden die Daten nur noch gespeichert, aber nicht mehr aktiv verarbeitet. Die Einschränkung wird im System dokumentiert und ist für alle berechtigten Benutzer sichtbar.

**6. Datensicherheit**

Wir setzen umfangreiche technische und organisatorische Maßnahmen zum Schutz Ihrer Daten ein:
- Verschlüsselung personenbezogener Daten auf Feldebene (Fernet-Verschlüsselung)
- Verschlüsselte Datenübertragung mittels TLS/HTTPS
- Zwei-Faktor-Authentifizierung (2FA/TOTP)
- Rollenbasierte Zugriffskontrolle (RBAC)
- Regelmäßige Sicherheitsaudits und Audit-Logging aller Zugriffe
- Hosting auf ISO 27001 zertifizierten Servern (DigitalOcean, EU-Rechenzentren)

**7. Cookies und Authentifizierung**

Die Anwendung verwendet ausschließlich technisch notwendige Cookies:
- **Authentifizierungs-Cookies (httpOnly, Secure, SameSite=Lax):** Für die sichere Anmeldung und Sitzungsverwaltung. Diese Cookies können nicht von JavaScript gelesen werden und bieten Schutz vor Cross-Site-Scripting (XSS).
- **CSRF-Cookie:** Zum Schutz vor Cross-Site-Request-Forgery-Angriffen.

Es werden keine Tracking-, Analyse- oder Werbe-Cookies eingesetzt. Eine Einwilligung für diese technisch notwendigen Cookies ist gemäß § 165 Abs. 3 TKG 2021 nicht erforderlich.

**8. Speicherdauer und Aufbewahrungsfristen**

Ihre personenbezogenen Daten werden nur so lange gespeichert, wie dies für die Erfüllung der oben genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen:

- **Benutzerdaten:** 6 Monate nach Ausscheiden aus dem Unternehmen, danach Anonymisierung
- **Schülerdaten:** Bis zum Ende des Betreuungsverhältnisses, danach gemäß schulrechtlichen Aufbewahrungsfristen
- **Zeiterfassungsdaten:** 7 Jahre gemäß arbeits- und steuerrechtlichen Vorschriften
- **Finanzdaten:** 7 Jahre gemäß § 132 BAO
- **Audit-Logs:** 12 Monate

Nach Ablauf der Aufbewahrungsfristen werden die Daten gelöscht oder anonymisiert.

**9. Empfänger der Daten**

Eine Übermittlung Ihrer Daten an Dritte erfolgt nur, soweit dies zur Erfüllung der genannten Zwecke erforderlich ist oder eine gesetzliche Verpflichtung besteht. Auftragsverarbeiter (z.B. Hosting-Provider) sind vertraglich zur Einhaltung der DSGVO verpflichtet.

Es findet keine Übermittlung von Daten an Drittländer außerhalb der EU statt.

**10. Ihre Rechte**

Sie haben das Recht auf:
- **Auskunft** über die von uns verarbeiteten personenbezogenen Daten (Art. 15 DSGVO)
- **Berichtigung** unrichtiger Daten (Art. 16 DSGVO)
- **Löschung** Ihrer Daten, sofern keine gesetzliche Aufbewahrungspflicht besteht (Art. 17 DSGVO)
- **Einschränkung** der Verarbeitung (Art. 18 DSGVO)
- **Datenübertragbarkeit** in einem strukturierten, gängigen Format (Art. 20 DSGVO)
- **Widerspruch** gegen die Verarbeitung (Art. 21 DSGVO)
- **Widerruf** einer erteilten Einwilligung jederzeit mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)
- **Beschwerde** bei der österreichischen Datenschutzbehörde (https://www.dsb.gv.at/)

**11. Kontakt**

Bei Fragen zum Datenschutz wenden Sie sich bitte an:
Hilfswerk Österreich, Grünbergstraße 15/2/5, 1120 Wien
Tel.: 01 / 40 57 500
E-Mail: office@hilfswerk.at

Externer Datenschutzbeauftragter: Dr. Werner Pilgermair
E-Mail: datenschutz@pilgermair.at`,
  },

  nutzungsbedingungen: {
    title: "Nutzungsbedingungen",
    content: `**Nutzungsbedingungen für die Anwendung GTS Planer**
*Stand: März 2026*

**1. Geltungsbereich**

Diese Nutzungsbedingungen regeln die Nutzung der Webanwendung GTS Planer (nachfolgend „Anwendung"), die vom Hilfswerk Österreich, Grünbergstraße 15/2/5, 1120 Wien (nachfolgend „Betreiber"), betrieben wird. Mit der Nutzung der Anwendung erklären Sie sich mit diesen Nutzungsbedingungen einverstanden.

**2. Zweck der Anwendung**

Die Anwendung dient der digitalen Unterstützung in der täglichen Zusammenarbeit an Ganztagesschulen. Sie umfasst insbesondere folgende Funktionen:
- Verwaltung von Gruppen und Schülerdaten
- Zeiterfassung und Urlaubsverwaltung
- Kassenbuchführung und Finanzverwaltung
- Standort- und Organisationsverwaltung

**3. Zugang und Benutzerkonten**

3.1. Der Zugang zur Anwendung erfolgt über persönliche Benutzerkonten, die von einem Administrator zugewiesen werden.

3.2. Sie sind verpflichtet, Ihre Zugangsdaten vertraulich zu behandeln und vor dem Zugriff Dritter zu schützen. Bei Verdacht auf Missbrauch ist unverzüglich der Administrator zu informieren.

3.3. Die Nutzung der Zwei-Faktor-Authentifizierung (2FA) wird dringend empfohlen und kann vom Administrator verpflichtend vorgeschrieben werden.

**4. Pflichten der Nutzer**

4.1. Sie verpflichten sich, die Anwendung ausschließlich für dienstliche Zwecke im Rahmen Ihrer Tätigkeit zu nutzen.

4.2. Es ist untersagt:
- Die Anwendung für rechtswidrige Zwecke zu verwenden
- Unbefugt auf Daten anderer Benutzer zuzugreifen
- Die Sicherheitsmechanismen der Anwendung zu umgehen oder zu manipulieren
- Daten aus der Anwendung unbefugt an Dritte weiterzugeben

4.3. Sie sind für die Richtigkeit und Aktualität der von Ihnen eingegebenen Daten verantwortlich.

**5. Datenschutz**

Die Verarbeitung personenbezogener Daten erfolgt gemäß der Datenschutzerklärung des GTS Planers und den Bestimmungen der Datenschutz-Grundverordnung (DSGVO). Detaillierte Informationen finden Sie in unserer Datenschutzerklärung.

**6. Verfügbarkeit**

6.1. Der Betreiber bemüht sich um eine möglichst hohe Verfügbarkeit der Anwendung, kann jedoch keine ununterbrochene Verfügbarkeit garantieren.

6.2. Wartungsarbeiten werden nach Möglichkeit außerhalb der üblichen Arbeitszeiten durchgeführt und rechtzeitig angekündigt.

**7. Haftung**

7.1. Der Betreiber haftet nicht für Schäden, die durch die Nutzung oder Nichtverfügbarkeit der Anwendung entstehen, soweit gesetzlich zulässig.

7.2. Der Betreiber haftet nicht für den Verlust von Daten, die durch unsachgemäße Nutzung der Anwendung entstehen.

**8. Geistiges Eigentum**

Alle Rechte an der Anwendung, einschließlich des Quellcodes, der Benutzeroberfläche und der Dokumentation, liegen beim Betreiber. Eine Vervielfältigung, Verbreitung oder anderweitige Verwertung ist ohne ausdrückliche Genehmigung untersagt.

**9. Änderungen der Nutzungsbedingungen**

Der Betreiber behält sich vor, diese Nutzungsbedingungen jederzeit zu ändern. Über wesentliche Änderungen werden die Nutzer rechtzeitig informiert. Die fortgesetzte Nutzung der Anwendung nach Inkrafttreten der Änderungen gilt als Zustimmung.

**10. Kündigung**

Der Betreiber kann den Zugang zur Anwendung jederzeit und ohne Angabe von Gründen sperren oder löschen, insbesondere bei Verstößen gegen diese Nutzungsbedingungen.

**11. Anwendbares Recht und Gerichtsstand**

Es gilt österreichisches Recht. Gerichtsstand ist Wien, Österreich.

**12. Kontakt**

Hilfswerk Österreich
Grünbergstraße 15/2/5, 1120 Wien
Tel.: 01 / 40 57 500
E-Mail: office@hilfswerk.at
Internet: www.hilfswerk.at`,
  },
} as const;

export type LegalContentKey = keyof typeof LEGAL_CONTENT;
