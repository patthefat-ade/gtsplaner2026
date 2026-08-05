<?php
/**
 * DANGI ERP – Bootstrap: DB-Verbindung, Session, Helper
 */
require_once __DIR__ . '/../config/config.php';

date_default_timezone_set(APP_TZ);
session_start();

/* ---------- Datenbank ---------- */
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
    }
    return $pdo;
}

/* ---------- Zugangsschutz & Rollen ----------
 * Rollen:
 *  - admin:    per APP_PASSWORD (wie bisher). Ist APP_PASSWORD leer, gilt
 *              jeder nicht als Mitarbeiter eingeloggte Besucher als Admin
 *              (Schutz erfolgt dann ausschließlich über die Basic-Auth).
 *  - employee: Login über die employees-Tabelle (Benutzername + Passwort).
 */
function current_role(): string {
    if (!empty($_SESSION['employee_id'])) return 'employee';
    if (!empty($_SESSION['authed'])) return 'admin';
    /* Ohne gesetztes Passwort (weder config.php noch Chef-Konto in den
     * Einstellungen) gilt jeder Besucher als Admin – Schutz erfolgt dann
     * ausschließlich über die Basic-Auth des Hostings. Sobald irgendwo ein
     * Passwort existiert, ist die Anmeldung verpflichtend. */
    if (APP_PASSWORD === '' && setting('chef_password_hash', '') === '') return 'admin';
    return 'guest';
}

function is_admin(): bool { return current_role() === 'admin'; }

function current_employee(): ?array {
    static $emp = false;
    if ($emp === false) {
        $emp = null;
        if (!empty($_SESSION['employee_id'])) {
            $st = db()->prepare('SELECT * FROM employees WHERE id = ? AND is_active = 1');
            $st->execute([$_SESSION['employee_id']]);
            $emp = $st->fetch() ?: null;
            if ($emp === null) {
                unset($_SESSION['employee_id']); // deaktiviert/gelöscht → ausloggen
            }
        }
    }
    return $emp;
}

function require_admin(): void {
    if (!is_admin()) {
        header('Location: index.php?page=' . (current_role() === 'employee' ? 'my_day' : 'login'));
        exit;
    }
}

/**
 * Mitarbeiter-Kontext für Arbeitsansichten (Mein Tag / Auftragsdetail).
 * - Mitarbeiter: der angemeldete Mitarbeiter selbst.
 * - Admin/Chef: der in den Einstellungen verknüpfte eigene Mitarbeiter-
 *   Account (Setting "admin_employee_id"), damit der Chef seine eigenen
 *   Aufträge wie ein Mitarbeiter abarbeiten kann.
 */
function working_employee(): ?array {
    static $we = false;
    if ($we === false) {
        $we = current_employee();
        if ($we === null && is_admin()) {
            $aid = (int)setting('admin_employee_id', '0');
            if ($aid > 0) {
                $st = db()->prepare('SELECT * FROM employees WHERE id = ? AND is_active = 1');
                $st->execute([$aid]);
                $we = $st->fetch() ?: null;
            }
        }
    }
    return $we;
}

$isLoginRequest = (($_GET['page'] ?? '') === 'login');
if (current_role() === 'guest' && !$isLoginRequest) {
    header('Location: index.php?page=login');
    exit;
}

/* ---------- Helper ---------- */
function e(?string $s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function money(float $v): string {
    return number_format($v, 2, ',', '.') . ' €';
}

function dmy(?string $date): string {
    if (!$date) return '';
    $t = strtotime($date);
    return $t ? date('d.m.Y', $t) : '';
}

/** Leistungszeitraum eines Dokuments als Anzeigetext ('' wenn keiner) */
function service_period_label(array $doc): string {
    $type = $doc['service_period_type'] ?? 'none';
    if ($type === 'frei') {
        return (string)($doc['service_period_text'] ?? '');
    }
    if (in_array($type, ['von_bis', 'letzter_monat', 'dieser_monat'], true)
        && !empty($doc['service_period_from']) && !empty($doc['service_period_to'])) {
        return dmy($doc['service_period_from']) . ' – ' . dmy($doc['service_period_to']);
    }
    return '';
}

function setting(string $key, string $default = ''): string {
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach (db()->query('SELECT skey, svalue FROM settings') as $row) {
            $cache[$row['skey']] = $row['svalue'];
        }
    }
    return $cache[$key] ?? $default;
}

function save_setting(string $key, string $value): void {
    $st = db()->prepare('INSERT INTO settings (skey, svalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)');
    $st->execute([$key, $value]);
}

/* ---------- Rollenbasierte Menü-Sichtbarkeit ----------
 * Der Chef legt in den Einstellungen fest, welche Menüpunkte je Rolle
 * sichtbar sind (settings: nav_visibility_chef / nav_visibility_employee,
 * JSON-Array mit ausgeblendeten Nav-Keys – Standard: nichts ausgeblendet).
 * "settings" (Chef) und "my_day" (Mitarbeiter) können nie ausgeblendet
 * werden, damit sich niemand aussperrt.
 */
function nav_hidden_keys(string $role): array {
    static $cache = [];
    if (!isset($cache[$role])) {
        $raw = setting('nav_visibility_' . $role, '');
        $arr = $raw !== '' ? json_decode($raw, true) : [];
        $cache[$role] = is_array($arr) ? array_values(array_map('strval', $arr)) : [];
    }
    return $cache[$role];
}

function nav_visible(string $key, ?string $role = null): bool {
    $role = $role ?? (current_role() === 'employee' ? 'employee' : 'chef');
    /* Aussperr-Schutz */
    if ($role === 'chef' && in_array($key, ['settings', 'logout'], true)) return true;
    if ($role === 'employee' && in_array($key, ['my_day', 'logout'], true)) return true;
    return !in_array($key, nav_hidden_keys($role), true);
}

/**
 * Nächste Dokumentnummer erzeugen und Zähler erhöhen.
 * Format-Platzhalter: {PREFIX} {YEAR} {NR4} {NR}
 */
function next_doc_number(string $type): string {
    $prefixKey  = $type === 'credit_note' ? 'credit_note_prefix' : ($type === 'invoice' ? 'invoice_prefix' : 'quote_prefix');
    $counterKey = $type === 'credit_note' ? 'credit_note_next' : ($type === 'invoice' ? 'invoice_next' : 'quote_next');

    $pdo = db();
    $ownTx = !$pdo->inTransaction();
    if ($ownTx) {
        $pdo->beginTransaction();
    }
    try {
        $st = $pdo->prepare('SELECT svalue FROM settings WHERE skey = ? FOR UPDATE');
        $st->execute([$counterKey]);
        $nr = (int)($st->fetchColumn() ?: 1);

        $prefix = setting($prefixKey, $type === 'credit_note' ? 'GS' : ($type === 'invoice' ? 'RE' : 'AN'));
        $format = setting('number_format', '{PREFIX}-{YEAR}-{NR4}');
        $number = str_replace(
            ['{PREFIX}', '{YEAR}', '{NR4}', '{NR}'],
            [$prefix, date('Y'), str_pad((string)$nr, 4, '0', STR_PAD_LEFT), (string)$nr],
            $format
        );

        $up = $pdo->prepare('UPDATE settings SET svalue = ? WHERE skey = ?');
        $up->execute([(string)($nr + 1), $counterKey]);
        if ($ownTx) {
            $pdo->commit();
        }
        return $number;
    } catch (Throwable $t) {
        if ($ownTx && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $t;
    }
}

function customer_display_name(array $c): string {
    if (!empty($c['company'])) return $c['company'];
    return trim(($c['first_name'] ?? '') . ' ' . ($c['last_name'] ?? ''));
}

function flash(string $msg = null): ?string {
    if ($msg !== null) {
        $_SESSION['flash'] = $msg;
        return null;
    }
    $m = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $m;
}

function redirect(string $url): void {
    header('Location: ' . $url);
    exit;
}

/* ---------- CSRF ---------- */
function csrf_token(): string {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string {
    return '<input type="hidden" name="csrf" value="' . csrf_token() . '">';
}

function csrf_check(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!hash_equals(csrf_token(), $_POST['csrf'] ?? '')) {
            http_response_code(419);
            die('Ungültiges Formular-Token. Bitte Seite neu laden.');
        }
    }
}
