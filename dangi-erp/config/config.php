<?php
/**
 * DANGI ERP – Konfiguration
 * Für das Live-Hosting (erp.dangi.at) die Zugangsdaten der MariaDB eintragen.
 */
define('DB_HOST', 'localhost');
define('DB_NAME', 'dangi_erp');
define('DB_USER', 'dangi');
define('DB_PASS', 'dangi_erp_2026');

// Optional: einfacher Zugangsschutz (leer lassen = deaktiviert)
// Wird ein Passwort gesetzt, verlangt das Tool beim Aufruf eine Anmeldung.
define('APP_PASSWORD', '');

define('APP_NAME', 'DANGI ERP');
define('APP_TZ', 'Europe/Vienna');
