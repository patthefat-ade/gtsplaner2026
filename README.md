# GTS Planner – Kassenbuch App v2

**Version:** 2.0.0 (Sprint 11)
**Status:** In Entwicklung

---

## Übersicht

Die Kassenbuch App v2 ist eine modulare, skalierbare Webanwendung zur Verwaltung von Klassenkassen für Freizeitpädagoginnen. Sie bietet rollenbasierte Zugriffskontrolle, Audit-Logging und ist für den on-premise Betrieb ausgelegt.

### Kernfunktionen

- **Finanzverwaltung:** Einnahmen, Ausgaben, Beleg-Upload, Kategorien, Salden.
- **Zeiterfassung:** Arbeitszeiten, Urlaubsanträge, Genehmigungsworkflow.
- **Gruppenverwaltung:** Klassen, Schüler, Zuweisungen.
- **Systemverwaltung:** Benutzer, Rollen, Standorte, Schuljahre, Audit-Log.

---

## Technische Architektur

| Komponente | Technologie |
|---|---|
| **Backend** | Django 5.2, Django REST Framework, PostgreSQL 16 |
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui |
| **Async Tasks** | Celery, Redis |
| **Container** | Docker, Docker Compose |
| **API-Standard** | OpenAPI 3.0.3 |

---

## Schnellstart (Entwicklung)

### Voraussetzungen

- Docker & Docker Compose
- Node.js 20+ & pnpm
- Python 3.11+

### 1. Klonen & Konfigurieren

```bash
git clone <repository-url>
cd kassenbuch-app

# Backend .env erstellen (siehe .env.example)
cp backend/.env.example backend/.env

# Frontend .env.local erstellen
cp frontend/.env.local.example frontend/.env.local
```

### 2. Docker-Container starten

```bash
docker-compose up -d db redis
```

### 3. Backend starten

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 4. Frontend starten

```bash
cd frontend
pnpm install
pnpm dev
```

Die Anwendung ist jetzt unter `http://localhost:3000` verfügbar.

---

## Dokumentation

- **API-Dokumentation:** `/api/schema/swagger-ui/` (nach dem Starten des Backends)
- **Benutzerhandbuch:** `docs/BENUTZERHANDBUCH.md`
- **Deployment Guide:** `docs/DEPLOYMENT.md`

---

## Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert. Siehe `LICENSE` für weitere Informationen.
