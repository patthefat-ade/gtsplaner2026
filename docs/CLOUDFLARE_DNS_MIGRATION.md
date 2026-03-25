# Cloudflare DNS Migration – Apex-Domain `gtsplaner.app`

## Problem

Die Apex-Domain `gtsplaner.app` (ohne `www`) kann bei Hetzner DNS nicht auf DigitalOcean App Platform zeigen, weil Hetzner kein **CNAME Flattening** unterstützt. Für Apex-Domains ist ein CNAME-Record laut RFC nicht erlaubt, und A-Records funktionieren nicht mit DigitalOcean App Platform (dynamische IPs hinter Cloudflare-Proxy).

**Aktueller Stand:**

| Domain | Status | Anmerkung |
|--------|--------|-----------|
| `www.gtsplaner.app` | Aktiv | CNAME auf DigitalOcean |
| `api.gtsplaner.app` | Aktiv | CNAME auf DigitalOcean |
| `gtsplaner.app` | Nicht aktiv | Hetzner kann keinen CNAME für Apex setzen |

## Lösung: Cloudflare als DNS-Provider

Cloudflare bietet kostenloses **CNAME Flattening**, das einen CNAME-Record für die Apex-Domain ermöglicht. Cloudflare löst den CNAME intern auf und gibt A-Records an den Client zurück.

## Schritt-für-Schritt Anleitung

### 1. Cloudflare-Konto erstellen

1. Öffnen Sie https://dash.cloudflare.com/sign-up
2. Erstellen Sie ein kostenloses Konto
3. Bestätigen Sie Ihre E-Mail-Adresse

### 2. Domain zu Cloudflare hinzufügen

1. Klicken Sie auf **"Add a site"** im Cloudflare Dashboard
2. Geben Sie `gtsplaner.app` ein
3. Wählen Sie den **Free Plan**
4. Cloudflare scannt automatisch Ihre bestehenden DNS-Records

### 3. DNS-Records konfigurieren

Löschen Sie alle automatisch importierten Records und erstellen Sie folgende neue Records:

| Typ | Name | Ziel | Proxy-Status | TTL |
|-----|------|------|-------------|-----|
| CNAME | `@` | `gtsplaner-58p4a.ondigitalocean.app` | **DNS only** (graue Wolke) | Auto |
| CNAME | `www` | `gtsplaner-58p4a.ondigitalocean.app` | **DNS only** (graue Wolke) | Auto |
| CNAME | `api` | `gtsplaner-58p4a.ondigitalocean.app` | **DNS only** (graue Wolke) | Auto |

**Wichtig:** Der Proxy-Status **muss** auf **"DNS only"** (graue Wolke) stehen, nicht auf "Proxied" (orange Wolke). Andernfalls kann DigitalOcean kein SSL-Zertifikat ausstellen, da die SSL-Terminierung bei Cloudflare stattfinden würde und DigitalOcean den Domain-Besitz nicht verifizieren kann.

### 4. Nameserver bei Domain-Registrar ändern

Cloudflare zeigt Ihnen zwei Nameserver an, z.B.:

```
ada.ns.cloudflare.com
bob.ns.cloudflare.com
```

Diese müssen Sie bei Ihrem **Domain-Registrar** (wo Sie `gtsplaner.app` gekauft haben) als Nameserver eintragen:

1. Loggen Sie sich bei Ihrem Registrar ein
2. Navigieren Sie zu den Nameserver-Einstellungen für `gtsplaner.app`
3. Ersetzen Sie die Hetzner-Nameserver durch die Cloudflare-Nameserver
4. Speichern Sie die Änderungen

**Hinweis:** Die Nameserver-Änderung kann bis zu 24 Stunden dauern, ist aber meist innerhalb von 1–2 Stunden aktiv.

### 5. DigitalOcean Domain aktivieren

Nachdem die DNS-Propagation abgeschlossen ist:

1. Öffnen Sie das DigitalOcean Dashboard → Apps → GTS Planer → Settings → Domains
2. Klicken Sie bei `gtsplaner.app` auf **"Refresh status"**
3. Der Status sollte von "Configuring" auf **"Active"** wechseln
4. DigitalOcean stellt automatisch ein SSL-Zertifikat aus

### 6. Verifizierung

Testen Sie alle Domains:

```bash
# Apex-Domain (sollte jetzt funktionieren)
curl -sL https://gtsplaner.app/ | head -5

# www-Subdomain
curl -sL https://www.gtsplaner.app/ | head -5

# API
curl -s https://api.gtsplaner.app/api/health-check/
```

## Nach der Migration

### Backend-Konfiguration

Die `settings.py` enthält bereits alle nötigen Domains in `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` und `CSRF_TRUSTED_ORIGINS`. Es sind keine Code-Änderungen nötig.

### Redirect einrichten (optional)

Falls Sie möchten, dass `gtsplaner.app` automatisch auf `www.gtsplaner.app` weiterleitet (oder umgekehrt), können Sie das in Cloudflare unter **Rules** → **Redirect Rules** konfigurieren:

1. Gehen Sie zu Cloudflare → Ihre Domain → **Rules** → **Redirect Rules**
2. Erstellen Sie eine neue Regel:
   - **When:** Hostname equals `gtsplaner.app`
   - **Then:** Dynamic Redirect to `https://www.gtsplaner.app${http.request.uri.path}`
   - **Status Code:** 301 (Permanent)

### Cloudflare SSL-Einstellungen

Stellen Sie sicher, dass unter **SSL/TLS** der Modus auf **"Full"** steht (nicht "Full (strict)" und nicht "Flexible"). Da der Proxy-Status auf "DNS only" steht, ist diese Einstellung zwar nicht relevant, aber als Sicherheitsmaßnahme empfehlenswert.

## Rollback

Falls Probleme auftreten, können Sie jederzeit die Nameserver bei Ihrem Registrar zurück auf Hetzner ändern. Die bestehende Konfiguration mit `www.gtsplaner.app` und `api.gtsplaner.app` funktioniert weiterhin.

## Zeitaufwand

| Schritt | Geschätzte Dauer |
|---------|-----------------|
| Cloudflare-Konto erstellen | 2 Minuten |
| Domain hinzufügen & DNS konfigurieren | 5 Minuten |
| Nameserver ändern | 2 Minuten |
| DNS-Propagation | 1–24 Stunden (meist 1–2h) |
| DigitalOcean Domain aktivieren | 5 Minuten |
| **Gesamt** | **~15 Minuten + Wartezeit** |
