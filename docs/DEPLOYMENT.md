# Deployment Guide

**Ziel:** On-Premise Hosting der Kassenbuch App v2 mit Docker.

---

## 1. Systemanforderungen

- **Betriebssystem:** Linux (Ubuntu 22.04+ empfohlen)
- **Software:** Docker (v20.10+), Docker Compose (v2.5+)
- **Hardware:** 2 CPU-Kerne, 4 GB RAM, 20 GB Speicherplatz

---

## 2. Konfiguration

### 2.1 Umgebungsvariablen

Erstellen Sie eine `.env.production`-Datei im Hauptverzeichnis mit folgendem Inhalt. Passen Sie die Werte entsprechend Ihrer Umgebung an.

```env
# Django Settings
SECRET_KEY='eine-sehr-sichere-zufaellige-zeichenfolge-fuer-produktivbetrieb'
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,ihre-domain.com

# Datenbank (PostgreSQL)
POSTGRES_DB=kassenbuch
POSTGRES_USER=kassenbuch_user
POSTGRES_PASSWORD='ein-sehr-sicheres-passwort'
DATABASE_URL=postgres://kassenbuch_user:ein-sehr-sicheres-passwort@db:5432/kassenbuch

# Redis (Celery Broker)
CELERY_BROKER_URL=redis://redis:6379/0

# Frontend URL
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://ihre-domain.com
```

### 2.2 Docker Compose

Die `docker-compose.yml` im Hauptverzeichnis ist für die Produktion vorkonfiguriert. Sie startet die folgenden Dienste:

- `db`: PostgreSQL-Datenbank
- `redis`: Redis-Server für Celery
- `backend`: Django-Anwendung (Gunicorn)
- `frontend`: Next.js-Anwendung
- `celery_worker`: Celery Worker für asynchrone Aufgaben
- `celery_beat`: Celery Beat für geplante Aufgaben
- `nginx`: Reverse Proxy für Backend und Frontend

---

## 3. Deployment-Schritte

### 3.1 Docker-Images bauen

```bash
docker-compose build
```

### 3.2 Datenbank initialisieren & Anwendung starten

```bash
docker-compose up -d
```

Die Anwendung ist jetzt unter `http://localhost` oder Ihrer konfigurierten Domain erreichbar.

### 3.3 Superuser erstellen

```bash
docker-compose exec backend python manage.py createsuperuser
```

---

## 4. Backup & Restore

### 4.1 Backup erstellen

Ein tägliches Backup der PostgreSQL-Datenbank wird empfohlen.

```bash
docker-compose exec -T db pg_dumpall -c -U kassenbuch_user | gzip > backup.sql.gz
```

### 4.2 Backup wiederherstellen

```bash
docker-compose exec -T db psql -U kassenbuch_user -d kassenbuch < backup.sql
```

---

## 5. Monitoring & Logging

Logs können direkt über Docker Compose eingesehen werden:

```bash
# Alle Logs anzeigen
docker-compose logs -f

# Logs eines bestimmten Dienstes anzeigen
docker-compose logs -f backend
```

