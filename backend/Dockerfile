# ============================================================================
# Kassenbuch App v2 – Django Backend Dockerfile
# ============================================================================

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Create necessary directories
RUN mkdir -p /app/staticfiles /app/media /app/logs

# Collect static files
# Collect static files wird im run command ausgefuehrt

# Expose port
EXPOSE 8000

# Default command
# Startup script: migrate, setup permissions, seed data, then start server
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && python manage.py setup_permissions && python manage.py create_test_users && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3"]
