# E-Mail-Konfiguration für GTS Planer

## Übersicht

Der GTS Planer verwendet E-Mail-Versand für:
- **Passwort-Vergessen** (`/forgot-password`) – Sendet einen Reset-Link per E-Mail
- **System-Benachrichtigungen** – Benachrichtigt Admins über wichtige Ereignisse

## Architektur

Der E-Mail-Versand funktioniert auf zwei Wegen:
1. **Asynchron via Celery** (bevorzugt): `send_password_reset_email.delay(user_id, reset_link)`
2. **Synchroner Fallback**: Falls Celery/Redis nicht verfügbar ist, wird die E-Mail direkt gesendet

## Erforderliche Environment-Variablen

Die folgenden Variablen müssen im DigitalOcean App Platform Dashboard unter **Settings > Environment Variables** konfiguriert werden:

| Variable | Beschreibung | Beispiel |
|---|---|---|
| `EMAIL_BACKEND` | Django E-Mail-Backend | `django.core.mail.backends.smtp.EmailBackend` |
| `EMAIL_HOST` | SMTP-Server | `smtp.gmail.com` oder `mail.your-server.de` |
| `EMAIL_PORT` | SMTP-Port | `587` (TLS) oder `465` (SSL) |
| `EMAIL_USE_TLS` | TLS aktivieren | `True` |
| `EMAIL_HOST_USER` | SMTP-Benutzername | `auto_benachrichtigungen@gtsplaner.app` |
| `EMAIL_HOST_PASSWORD` | SMTP-Passwort | `(App-Passwort)` |
| `DEFAULT_FROM_EMAIL` | Absender-Adresse | `GTS Planer <auto_benachrichtigungen@gtsplaner.app>` |
| `FRONTEND_URL` | Frontend-URL für Reset-Links | `https://www.gtsplaner.app` |

## Option A: Gmail SMTP (Empfohlen für den Start)

1. Google-Konto mit 2-Faktor-Authentifizierung aktivieren
2. App-Passwort generieren unter: https://myaccount.google.com/apppasswords
3. Environment-Variablen setzen:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=auto_benachrichtigungen@gtsplaner.app
EMAIL_HOST_PASSWORD=<app-passwort>
DEFAULT_FROM_EMAIL=GTS Planer <auto_benachrichtigungen@gtsplaner.app>
FRONTEND_URL=https://www.gtsplaner.app
```

## Option B: Eigener SMTP-Server

```
EMAIL_HOST=mail.your-server.de
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=auto_benachrichtigungen@gtsplaner.app
EMAIL_HOST_PASSWORD=<passwort>
DEFAULT_FROM_EMAIL=GTS Planer <auto_benachrichtigungen@gtsplaner.app>
FRONTEND_URL=https://www.gtsplaner.app
```

## Option C: SendGrid (Für Produktionsbetrieb)

1. SendGrid-Konto erstellen: https://sendgrid.com
2. API-Key generieren
3. Environment-Variablen setzen:

```
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=<sendgrid-api-key>
DEFAULT_FROM_EMAIL=GTS Planer <auto_benachrichtigungen@gtsplaner.app>
FRONTEND_URL=https://www.gtsplaner.app
```

## Testen

Nach der Konfiguration kann die E-Mail-Funktion getestet werden:

```bash
# Via API
curl -X POST https://api.gtsplaner.app/api/v1/auth/password-reset/ \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

Oder direkt über die Frontend-Seite: https://www.gtsplaner.app/forgot-password

## Hinweis zu Celery

Wenn Celery/Redis auf dem Server nicht konfiguriert ist, werden E-Mails **synchron** gesendet.
Dies funktioniert zuverlässig, kann aber bei hoher Last die API-Antwortzeit erhöhen.
Für Produktionsbetrieb wird empfohlen, Celery mit Redis zu konfigurieren:

```
CELERY_BROKER_URL=redis://<redis-host>:6379/0
CELERY_RESULT_BACKEND=redis://<redis-host>:6379/1
```
