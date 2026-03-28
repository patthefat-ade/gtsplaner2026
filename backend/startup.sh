#!/bin/bash
# ============================================================================
# GTS Planer Backend – Startup Script
# ============================================================================
# Runs database migrations, permission setup, and seed data before starting
# the Gunicorn server. Management commands are wrapped in error handling
# to ensure the server starts even if a command fails.
#
# IMPORTANT: create_test_users runs in the background to avoid blocking
# the Gunicorn startup and causing health check timeouts on small instances.
# ============================================================================

set -e

echo "============================================"
echo "GTS Planer Backend – Starting up..."
echo "============================================"

# 1. Database migrations (critical – must succeed)
echo "[1/4] Running database migrations..."
python manage.py migrate --noinput

# 2. Collect static files (critical – must succeed)
echo "[2/4] Collecting static files..."
python manage.py collectstatic --noinput

# 3. Setup permissions (non-critical – server can start without)
echo "[3/4] Setting up permissions..."
python manage.py setup_permissions --reset --migrate-users || {
    echo "WARNING: setup_permissions failed, continuing..."
}

# 4. Create/update test users (non-critical – runs in background)
# This command creates ~3100 DB entries and can take 30-60s on basic-xxs.
# Running it in the background ensures Gunicorn starts immediately and
# the health check passes within the timeout window.
echo "[4/4] Creating/updating test users (background)..."
python manage.py create_test_users > /tmp/seed_output.log 2>&1 &
SEED_PID=$!
echo "  Seed process started (PID: $SEED_PID), continuing with server start..."

echo "============================================"
echo "Starting Gunicorn server..."
echo "============================================"

# Start Gunicorn
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
