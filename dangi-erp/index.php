<?php
/**
 * DANGI ERP – Front-Controller
 * Routing über ?page=…
 */
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/layout.php';

csrf_check();

$page = $_GET['page'] ?? 'dashboard';

// Mitarbeiter landen standardmäßig auf ihrer Tagesansicht
if (!is_admin() && current_role() === 'employee' && $page === 'dashboard') {
    $page = 'my_day';
}

$routes = [
    'dashboard'    => 'pages/dashboard.php',
    'login'        => 'pages/login.php',
    'customers'    => 'pages/customers.php',
    'services'     => 'pages/services.php',
    'documents'    => 'pages/documents.php',
    'document_edit'=> 'pages/document_edit.php',
    'document_view'=> 'pages/document_view.php',
    'planning'     => 'pages/planning.php',
    'tasks'        => 'pages/tasks.php',
    'calendar'     => 'pages/calendar.php',
    'ical'         => 'pages/ical.php',
    'pdf'          => 'pages/pdf.php',
    'settings'     => 'pages/settings.php',
    'employees'    => 'pages/employees.php',
    'tickets'      => 'pages/tickets.php',
    'my_day'       => 'pages/my_day.php',
    'ticket_view'  => 'pages/ticket_view.php',
    'ticket_photo' => 'pages/ticket_photo.php',
    'inventory'    => 'pages/inventory.php',
    'my_inventory' => 'pages/my_inventory.php',
    'my_time'      => 'pages/my_time.php',
    'timeclock'    => 'pages/timeclock.php',
    'employee_contract' => 'pages/employee_contract.php',
];

// Admin-only-Seiten für Mitarbeiter sperren
$adminOnly = ['dashboard','customers','services','documents','document_edit','document_view',
              'planning','tasks','calendar','ical','pdf','settings','employees','tickets','inventory',
              'timeclock','employee_contract'];
if (in_array($page, $adminOnly, true) && current_role() === 'employee') {
    redirect('index.php?page=my_day');
}

/* Routen-Gate für ausgeblendete Menüpunkte (verstecktes Menü = kein Zugriff).
 * Hilfsseiten (pdf, ical, ticket_photo, login etc.) bleiben unberührt. */
$navKeyForPage = [
    'dashboard' => 'dashboard', 'services' => 'services', 'planning' => 'planning',
    'customers' => 'customers', 'tickets' => 'tickets', 'ticket_view' => 'tickets',
    'calendar' => 'calendar', 'tasks' => 'tasks', 'inventory' => 'inventory',
    'employees' => 'employees', 'timeclock' => 'timeclock',
    'my_day' => 'my_day', 'my_time' => 'my_time', 'my_inventory' => 'my_inventory',
];
$gateKey = $navKeyForPage[$page] ?? null;
if ($page === 'documents' || $page === 'document_edit' || $page === 'document_view') {
    $gateKey = (($_GET['type'] ?? '') === 'quote') ? 'quotes' : 'invoices';
}
/* Mitarbeiter arbeiten Aufträge über my_day ab – ticket_view folgt dort my_day */
if ($page === 'ticket_view' && current_role() === 'employee') {
    $gateKey = 'my_day';
}
if ($gateKey !== null && !nav_visible($gateKey)) {
    redirect(current_role() === 'employee' ? 'index.php?page=my_day' : 'index.php?page=settings');
}

$file = $routes[$page] ?? null;
if ($file === null || !is_file(__DIR__ . '/' . $file)) {
    http_response_code(404);
    layout_header('Nicht gefunden');
    echo '<div class="card"><h1>Seite nicht gefunden</h1><p><a href="index.php">Zur Übersicht</a></p></div>';
    layout_footer();
    exit;
}

require __DIR__ . '/' . $file;
