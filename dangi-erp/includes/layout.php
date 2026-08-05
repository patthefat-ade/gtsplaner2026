<?php
/**
 * DANGI ERP – Layout (Header/Footer)
 * CI: Türkis (#0FA7A0), Anthrazit (#3B4757), Montserrat/System-Fonts lokal
 */

function layout_header(string $title, string $active = ''): void {
    /* Icon-Set: schlanke Inline-SVGs (stroke = currentColor), Farbe via CSS-Variable --nav-icon-color steuerbar */
    ?><?php
    if (current_role() === 'employee') {
        $emp = current_employee();
        $nav = [
            ['type' => 'link', 'key' => 'my_day', 'url' => 'index.php?page=my_day', 'label' => 'Mein Tag', 'icon' => 'sun'],
            ['type' => 'link', 'key' => 'my_time', 'url' => 'index.php?page=my_time', 'label' => 'Zeiterfassung', 'icon' => 'clock'],
            ['type' => 'link', 'key' => 'my_inventory', 'url' => 'index.php?page=my_inventory', 'label' => 'Meine Geräte', 'icon' => 'tool'],
            ['type' => 'link', 'key' => 'logout', 'url' => 'index.php?page=login&action=logout', 'label' => 'Abmelden (' . trim(($emp['first_name'] ?? '') . ' ' . ($emp['last_name'] ?? '')) . ')', 'icon' => 'logout'],
        ];
    } else {
        $hasChef = (int)setting('admin_employee_id', '0') > 0;
        $nav = [
            ['type' => 'link', 'key' => 'dashboard', 'url' => 'index.php?page=dashboard', 'label' => 'Übersicht', 'icon' => 'home'],
            ['type' => 'group', 'label' => 'Verkauf', 'icon' => 'cart', 'keys' => ['quotes', 'invoices', 'services', 'planning'], 'items' => [
                'quotes'   => ['index.php?page=documents&type=quote', 'Angebote', 'file'],
                'invoices' => ['index.php?page=documents&type=invoice', 'Rechnungen', 'invoice'],
                'credit_notes' => ['index.php?page=documents&type=credit_note', 'Gutschriften', 'credit'],
                'services' => ['index.php?page=services', 'Dienstleistungen', 'broom'],
                'planning' => ['index.php?page=planning', 'Planrechnung', 'chart'],
            ]],
            ['type' => 'link', 'key' => 'customers', 'url' => 'index.php?page=customers', 'label' => 'Kunden', 'icon' => 'users'],
            ['type' => 'group', 'label' => 'Betrieb', 'icon' => 'briefcase', 'keys' => ['tickets', 'calendar', 'tasks', 'inventory'], 'items' => [
                'tickets'   => ['index.php?page=tickets', 'Aufträge', 'wrench'],
                'calendar'  => ['index.php?page=calendar', 'Kalender', 'calendar'],
                'tasks'     => ['index.php?page=tasks', 'Aufgaben', 'check'],
                'inventory' => ['index.php?page=inventory', 'Inventar', 'box'],
            ]],
            ['type' => 'group', 'label' => 'Personal', 'icon' => 'badge', 'keys' => ['employees', 'timeclock'], 'items' => [
                'employees' => ['index.php?page=employees', 'Mitarbeiter', 'user'],
                'timeclock' => ['index.php?page=timeclock', 'Zeiterfassung', 'clock'],
            ]],
        ];
        if ($hasChef) {
            $nav[] = ['type' => 'group', 'label' => 'Mein Bereich', 'icon' => 'star', 'keys' => ['my_day', 'my_time', 'my_inventory'], 'items' => [
                'my_day'       => ['index.php?page=my_day', 'Meine Aufträge', 'sun'],
                'my_time'      => ['index.php?page=my_time', 'Meine Zeiten', 'clock'],
                'my_inventory' => ['index.php?page=my_inventory', 'Meine Geräte', 'tool'],
            ]];
        }
        $nav[] = ['type' => 'link', 'key' => 'settings', 'url' => 'index.php?page=settings', 'label' => 'Einstellungen', 'icon' => 'gear'];
        if (APP_PASSWORD !== '' || setting('chef_password_hash', '') !== '') {
            $nav[] = ['type' => 'link', 'key' => 'logout', 'url' => 'index.php?page=login&action=logout', 'label' => 'Abmelden', 'icon' => 'logout'];
        }
    }
    /* Rollenbasierte Sichtbarkeit anwenden (Einstellungen → Menü-Sichtbarkeit) */
    $navRole = current_role() === 'employee' ? 'employee' : 'chef';
    $filtered = [];
    foreach ($nav as $entry) {
        if ($entry['type'] === 'link') {
            if (nav_visible($entry['key'], $navRole)) $filtered[] = $entry;
        } else {
            $items = [];
            foreach ($entry['items'] as $k => $item) {
                if (nav_visible($k, $navRole)) $items[$k] = $item;
            }
            if ($items) {
                $entry['items'] = $items;
                $entry['keys']  = array_keys($items);
                $filtered[] = $entry;
            }
        }
    }
    $nav = $filtered;
    $navIconColor = trim(setting('nav_icon_color', '#FFFFFF')) ?: '#FFFFFF';
    ?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title><?= e($title) ?> – <?= e(APP_NAME) ?></title>
  <link rel="stylesheet" href="assets/css/app.css">
  <link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">
  <style>:root { --nav-icon-color: <?= e($navIconColor) ?>; }</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="index.php">
      <?php $menuLogo = setting('menu_logo_path', ''); ?>
      <?php if ($menuLogo && file_exists(__DIR__ . '/../' . $menuLogo)): ?>
        <img src="<?= e($menuLogo) ?>" alt="<?= e(APP_NAME) ?>" class="brand-logo">
      <?php else: ?>
        <span class="brand-mark">D</span>
        <span class="brand-text">DANGI <strong>ERP</strong></span>
      <?php endif; ?>
    </a>
    <button class="nav-toggle" aria-label="Menü öffnen" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <nav class="main-nav">
      <ul>
        <?php foreach ($nav as $entry): ?>
          <?php if ($entry['type'] === 'link'): ?>
            <li><a href="<?= e($entry['url']) ?>" class="<?= $entry['key'] === $active ? 'active' : '' ?>"><?= nav_icon($entry['icon'] ?? '') ?><?= e($entry['label']) ?></a></li>
          <?php else: $isActive = in_array($active, $entry['keys'], true); ?>
            <li class="nav-group">
              <button type="button" class="nav-group-btn <?= $isActive ? 'active' : '' ?>" aria-expanded="false">
                <?= nav_icon($entry['icon'] ?? '') ?><?= e($entry['label']) ?> <span class="nav-caret">▾</span>
              </button>
              <ul class="nav-sub">
                <?php foreach ($entry['items'] as $key => $item): [$url, $label] = $item; $ic = $item[2] ?? ''; ?>
                  <li><a href="<?= e($url) ?>" class="<?= $key === $active ? 'active' : '' ?>"><?= nav_icon($ic) ?><?= e($label) ?></a></li>
                <?php endforeach; ?>
              </ul>
            </li>
          <?php endif; ?>
        <?php endforeach; ?>
      </ul>
    </nav>
  </div>
</header>
<main class="content">
<?php if ($m = flash()): ?>
  <div class="alert alert-success"><?= e($m) ?></div>
<?php endif; ?>
<?php
}

/**
 * Inline-SVG-Icon für die Navigation (stroke: currentColor via CSS-Variable).
 * Kein CDN nötig – funktioniert offline und auf jedem Hosting.
 */
function nav_icon(string $name): string {
    static $icons = null;
    if ($icons === null) {
        $icons = [
            'home'      => '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M10 20v-5h4v5"/>',
            'cart'      => '<circle cx="9" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/><path d="M3 4h2.4l2.2 11h10.9l2-8H7"/>',
            'file'      => '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/>',
            'invoice'   => '<path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
        'credit' => '<path d="M3 10h10a5 5 0 0 1 0 10H9M3 10l4-4M3 10l4 4"/>',
            'broom'     => '<path d="M19 4 12.5 10.5"/><path d="M12.5 10.5c-2.6-1-5.4-.2-7 2L4 14l6.5 6.5 1.5-1.5c2.2-1.6 3-4.4 2-7z"/><path d="m7.5 15 3.5 3.5"/>',
            'chart'     => '<path d="M4 20h16"/><path d="M6.5 16.5v-5M11 16.5V7.5M15.5 16.5v-3M20 16.5V5"/>',
            'users'     => '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 20c.5-3.4 2.8-5.2 5.5-5.2s5 1.8 5.5 5.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16 14.6c2.3.2 4 1.8 4.5 4.4"/>',
            'briefcase' => '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.7"/><path d="M3.5 12.5h17"/>',
            'wrench'    => '<path d="M14.5 6.5a4.2 4.2 0 0 1 5.4-4L17 5.4l1.6 1.6L21.5 4a4.2 4.2 0 0 1-5.7 5.2L8 17l-3-1 6.9-6.9a4.2 4.2 0 0 1 2.6-2.6z"/><path d="m5 16 3 3-2.5 2.5a2.1 2.1 0 1 1-3-3z"/>',
            'calendar'  => '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3v3.5M16 3v3.5"/><path d="M7.5 13h2M12 13h2M16.5 13h0M7.5 16.5h2M12 16.5h2"/>',
            'check'     => '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.5 2.5 2.5 4.8-5.5"/>',
            'box'       => '<path d="m12 3 8 4v10l-8 4-8-4V7z"/><path d="m4 7 8 4 8-4"/><path d="M12 11v10"/>',
            'badge'     => '<rect x="4.5" y="6" width="15" height="14" rx="2"/><path d="M9.5 6V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V6"/><circle cx="12" cy="12" r="2.2"/><path d="M8 17.5c.6-1.8 2.2-2.7 4-2.7s3.4.9 4 2.7"/>',
            'user'      => '<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 20c.7-3.6 3.3-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/>',
            'clock'     => '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
            'star'      => '<path d="m12 3.5 2.5 5.2 5.7.7-4.2 4 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6-4.2-4 5.7-.7z"/>',
            'sun'       => '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19"/>',
            'tool'      => '<path d="M6 3v7a2 2 0 0 0 2 2h1v9h2v-9h1a2 2 0 0 0 2-2V3"/><path d="M6 7h8"/><path d="M17.5 3c1.7 1 2.5 2.6 2.5 4.5V12h-2.5v9h-2v-9"/>',
            'gear'      => '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>',
            'logout'    => '<path d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7"/><path d="m17 8 4 4-4 4"/><path d="M21 12H10"/>',
        ];
    }
    if ($name === '' || !isset($icons[$name])) return '';
    return '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $icons[$name] . '</svg>';
}

function layout_footer(): void {
    ?>
</main>
<footer class="footer">
  <p><?= e(setting('company_name', 'DANGI Hausbetreuung & Reinigung')) ?> · internes Verwaltungstool · erp.dangi.at</p>
</footer>
<script src="assets/js/app.js"></script>
</body>
</html>
<?php
}
