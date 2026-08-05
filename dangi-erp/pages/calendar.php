<?php
/**
 * DANGI ERP – Kalender
 * Termine mit Monatsansicht, Liste kommender Termine und
 * iCal-Export (.ics) für iOS/Apple Kalender u. a.
 * CI: Türkis (#0FA7A0), Anthrazit (#3B4757)
 */
$pdo = db();
$action = $_GET['action'] ?? 'list';
$id = (int)($_GET['id'] ?? 0);

$month = $_GET['month'] ?? date('Y-m');
if (!preg_match('/^\d{4}-\d{2}$/', $month)) { $month = date('Y-m'); }

if (!function_exists('month_label')) {
    function month_label(string $ym): string {
        $names = [1=>'Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
        [$y, $m] = explode('-', $ym);
        return ($names[(int)$m] ?? $m) . ' ' . $y;
    }
}
if (!function_exists('month_shift')) {
    function month_shift(string $ym, int $delta): string {
        [$y, $m] = explode('-', $ym);
        return date('Y-m', mktime(12, 0, 0, (int)$m + $delta, 1, (int)$y));
    }
}

/* ---------- Termin speichern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === 'new' || $action === 'edit')) {
    $title       = trim($_POST['title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $location    = trim($_POST['location'] ?? '');
    $allDay      = isset($_POST['all_day']) ? 1 : 0;
    $date        = $_POST['date'] ?? '';
    $startTime   = $_POST['start_time'] ?? '';
    $endTime     = $_POST['end_time'] ?? '';

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) { $date = date('Y-m-d'); }
    if ($allDay) {
        $startDt = $date . ' 00:00:00';
        $endDt   = null;
    } else {
        if (!preg_match('/^\d{2}:\d{2}$/', $startTime)) { $startTime = '09:00'; }
        $startDt = $date . ' ' . $startTime . ':00';
        $endDt   = preg_match('/^\d{2}:\d{2}$/', $endTime) ? $date . ' ' . $endTime . ':00' : null;
        if ($endDt !== null && $endDt <= $startDt) { $endDt = null; }
    }

    if ($title === '') {
        flash('Bitte einen Titel angeben.');
    } else {
        if ($action === 'edit' && $id) {
            $st = $pdo->prepare('UPDATE events SET title=?, description=?, location=?, start_dt=?, end_dt=?, all_day=? WHERE id=?');
            $st->execute([$title, $description, $location, $startDt, $endDt, $allDay, $id]);
            flash('Termin aktualisiert.');
        } else {
            $st = $pdo->prepare('INSERT INTO events (title, description, location, start_dt, end_dt, all_day) VALUES (?,?,?,?,?,?)');
            $st->execute([$title, $description, $location, $startDt, $endDt, $allDay]);
            flash('Termin angelegt.');
        }
        redirect('index.php?page=calendar&month=' . urlencode(substr($startDt, 0, 7)));
    }
}

/* ---------- Termin löschen ---------- */
if ($action === 'delete' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo->prepare('DELETE FROM events WHERE id = ?')->execute([$id]);
    flash('Termin gelöscht.');
    redirect('index.php?page=calendar&month=' . urlencode($month));
}

/* ---------- Formular (neu/bearbeiten) ---------- */
if ($action === 'new' || $action === 'edit') {
    $ev = ['title'=>'','description'=>'','location'=>'','all_day'=>0,
           'date'=>$_GET['date'] ?? date('Y-m-d'), 'start_time'=>'09:00', 'end_time'=>''];
    if ($action === 'edit' && $id) {
        $st = $pdo->prepare('SELECT * FROM events WHERE id = ?');
        $st->execute([$id]);
        if ($row = $st->fetch()) {
            $ev = [
                'title' => $row['title'], 'description' => $row['description'] ?? '',
                'location' => $row['location'] ?? '', 'all_day' => (int)$row['all_day'],
                'date' => substr($row['start_dt'], 0, 10),
                'start_time' => substr($row['start_dt'], 11, 5),
                'end_time' => $row['end_dt'] ? substr($row['end_dt'], 11, 5) : '',
            ];
        }
    }
    layout_header($action === 'edit' ? 'Termin bearbeiten' : 'Neuer Termin', 'calendar');
    ?>
    <div class="page-head">
      <h1><?= $action === 'edit' ? 'Termin bearbeiten' : 'Neuer Termin' ?></h1>
      <a class="btn btn-secondary" href="index.php?page=calendar&month=<?= e($month) ?>">← Zum Kalender</a>
    </div>
    <div class="card">
      <form method="post">
        <?= csrf_field() ?>
        <div class="field"><label>Titel *</label>
          <input type="text" name="title" required value="<?= e($ev['title']) ?>" placeholder="z. B. Objektbegehung Hausverwaltung Muster"></div>
        <div class="field"><label>Ort (optional)</label>
          <input type="text" name="location" value="<?= e($ev['location']) ?>" placeholder="z. B. Musterstraße 1, 9020 Klagenfurt"></div>
        <div class="field"><label>Beschreibung (optional)</label>
          <textarea name="description" rows="3"><?= e($ev['description']) ?></textarea></div>
        <div class="grid-3">
          <div class="field"><label>Datum *</label>
            <input type="date" name="date" required value="<?= e($ev['date']) ?>"></div>
          <div class="field cal-time-field"><label>Beginn</label>
            <input type="time" name="start_time" value="<?= e($ev['start_time']) ?>"></div>
          <div class="field cal-time-field"><label>Ende (optional)</label>
            <input type="time" name="end_time" value="<?= e($ev['end_time']) ?>"></div>
        </div>
        <div class="field" style="flex-direction:row; align-items:center; gap:0.5rem;">
          <input type="checkbox" name="all_day" id="cal-allday" <?= $ev['all_day'] ? 'checked' : '' ?> style="width:auto;">
          <label for="cal-allday" style="margin:0;">Ganztägiger Termin</label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit"><?= $action === 'edit' ? 'Speichern' : 'Termin anlegen' ?></button>
          <a class="btn btn-secondary" href="index.php?page=calendar&month=<?= e($month) ?>">Abbrechen</a>
        </div>
      </form>
    </div>
    <script>
    (function () {
      var cb = document.getElementById('cal-allday');
      function sync() {
        document.querySelectorAll('.cal-time-field input').forEach(function (i) { i.disabled = cb.checked; });
      }
      cb.addEventListener('change', sync); sync();
    })();
    </script>
    <?php
    layout_footer();
    return;
}

/* ---------- Monatsdaten ---------- */
[$y, $m] = array_map('intval', explode('-', $month));
$firstDay = sprintf('%04d-%02d-01', $y, $m);
$daysInMonth = (int)date('t', strtotime($firstDay));
$lastDay = sprintf('%04d-%02d-%02d', $y, $m, $daysInMonth);

$st = $pdo->prepare("SELECT * FROM events WHERE DATE(start_dt) BETWEEN ? AND ? ORDER BY start_dt");
$st->execute([$firstDay, $lastDay]);
$byDay = [];
foreach ($st->fetchAll() as $ev) {
    $byDay[substr($ev['start_dt'], 0, 10)][] = $ev;
}

/* ---------- Aufträge (Tickets) im Monat, optional nach Mitarbeiter gefiltert ---------- */
$empFilter = (int)($_GET['employee'] ?? 0);
$employees = $pdo->query('SELECT id, first_name, last_name FROM employees ORDER BY last_name, first_name')->fetchAll();

$sqlT = "SELECT t.id, t.ticket_number, t.title, t.status, t.work_date, t.time_from, t.time_to,
           t.address_city, e.first_name AS e_first, e.last_name AS e_last,
           c.company, c.first_name AS c_first, c.last_name AS c_last
         FROM tickets t
         LEFT JOIN employees e ON e.id = t.employee_id
         LEFT JOIN customers c ON c.id = t.customer_id
         WHERE t.work_date BETWEEN ? AND ?";
$paramsT = [$firstDay, $lastDay];
if ($empFilter) { $sqlT .= " AND t.employee_id = ?"; $paramsT[] = $empFilter; }
$sqlT .= " ORDER BY t.time_from IS NULL, t.time_from";
$stT = $pdo->prepare($sqlT);
$stT->execute($paramsT);
$ticketsByDay = [];
foreach ($stT->fetchAll() as $tk) {
    $ticketsByDay[$tk['work_date']][] = $tk;
}
$ticketStatusClass = function (string $s): string {
    return match ($s) {
        'offen'       => 'cal-ticket-offen',
        'in_arbeit'   => 'cal-ticket-arbeit',
        'beendet'     => 'cal-ticket-beendet',
        'abgerechnet' => 'cal-ticket-abgerechnet',
        default       => '',
    };
};
$qsEmp = $empFilter ? '&employee=' . $empFilter : '';

$upcoming = $pdo->query("SELECT * FROM events WHERE start_dt >= NOW() - INTERVAL 1 DAY ORDER BY start_dt LIMIT 10")->fetchAll();

/* Wochentag des Monatsersten (Mo=0 … So=6) */
$startWeekday = ((int)date('N', strtotime($firstDay))) - 1;
$today = date('Y-m-d');

layout_header('Kalender', 'calendar');
?>
<div class="page-head">
  <h1>Kalender <span class="sub"><?= e(month_label($month)) ?></span></h1>
  <div class="month-nav">
    <a class="btn btn-sm btn-secondary" href="index.php?page=calendar&month=<?= month_shift($month, -1) . $qsEmp ?>">←</a>
    <a class="btn btn-sm btn-secondary" href="index.php?page=calendar&month=<?= date('Y-m') . $qsEmp ?>">Heute</a>
    <a class="btn btn-sm btn-secondary" href="index.php?page=calendar&month=<?= month_shift($month, 1) . $qsEmp ?>">→</a>
    <a class="btn btn-primary" href="index.php?page=calendar&action=new&month=<?= e($month) ?>">+ Neuer Termin</a>
  </div>
</div>

<div class="card" style="padding:0.9rem 1.4rem;">
  <form method="get" action="index.php" style="display:flex; gap:0.7rem; flex-wrap:wrap; align-items:flex-end;">
    <input type="hidden" name="page" value="calendar">
    <input type="hidden" name="month" value="<?= e($month) ?>">
    <div class="field" style="margin:0; min-width:220px;">
      <label>Aufträge nach Mitarbeiter filtern</label>
      <select name="employee" onchange="this.form.submit()">
        <option value="0">alle Mitarbeiter</option>
        <?php foreach ($employees as $em): ?>
          <option value="<?= (int)$em['id'] ?>" <?= $empFilter === (int)$em['id'] ? 'selected' : '' ?>><?= e(trim($em['first_name'] . ' ' . $em['last_name'])) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <noscript><button class="btn btn-sm btn-secondary" type="submit">Filtern</button></noscript>
    <span class="hint" style="padding-bottom:0.55rem;">Im Kalender erscheinen Termine <em>und</em> alle Aufträge (vergangene, heutige und zukünftige). Auftrag anklicken = Detailansicht.</span>
  </form>
</div>

<div class="card" style="padding:0.9rem 1.4rem; display:flex; gap:0.7rem; flex-wrap:wrap; align-items:center;">
  <strong style="color:var(--anthrazit);">iCal-Export:</strong>
  <a class="btn btn-sm btn-secondary" href="index.php?page=ical&month=<?= e($month) ?>">Monat als .ics</a>
  <a class="btn btn-sm btn-secondary" href="index.php?page=ical">Alle Termine als .ics</a>
  <span class="hint">Die .ics-Datei am iPhone öffnen bzw. per E-Mail/AirDrop übertragen – iOS bietet den Import in den Kalender automatisch an.</span>
</div>

<div class="table-wrap" style="padding:0.8rem;">
  <div class="cal-grid cal-head">
    <?php foreach (['Mo','Di','Mi','Do','Fr','Sa','So'] as $wd): ?><div><?= $wd ?></div><?php endforeach; ?>
  </div>
  <div class="cal-grid">
    <?php for ($i = 0; $i < $startWeekday; $i++): ?><div class="cal-cell cal-empty"></div><?php endfor; ?>
    <?php for ($d = 1; $d <= $daysInMonth; $d++):
        $date = sprintf('%04d-%02d-%02d', $y, $m, $d);
        $isToday = $date === $today;
    ?>
    <div class="cal-cell <?= $isToday ? 'cal-today' : '' ?>">
      <a class="cal-day" href="index.php?page=calendar&action=new&date=<?= $date ?>&month=<?= e($month) ?>" title="Termin am <?= date('d.m.Y', strtotime($date)) ?> anlegen"><?= $d ?></a>
      <?php foreach ($ticketsByDay[$date] ?? [] as $tk):
          $who = trim(($tk['e_first'] ?? '') . ' ' . ($tk['e_last'] ?? ''));
          $cust = $tk['company'] ?: trim(($tk['c_first'] ?? '') . ' ' . ($tk['c_last'] ?? ''));
          $tip = $tk['ticket_number'] . ' – ' . $tk['title'] . ($who ? ' · ' . $who : '') . ($cust ? ' · ' . $cust : '') . ' · Status: ' . str_replace('_', ' ', $tk['status']);
      ?>
        <a class="cal-event cal-ticket <?= $ticketStatusClass($tk['status']) ?>" href="index.php?page=tickets&action=view&id=<?= (int)$tk['id'] ?>" title="<?= e($tip) ?>">
          <?= $tk['time_from'] ? '<span class="cal-time">' . substr($tk['time_from'], 0, 5) . '</span> ' : '' ?>🔧 <?= e(mb_strimwidth($tk['title'], 0, 30, '…')) ?><?= $who ? '<span class="cal-ticket-emp">' . e($who) . '</span>' : '' ?>
        </a>
      <?php endforeach; ?>
      <?php foreach ($byDay[$date] ?? [] as $ev): ?>
        <a class="cal-event" href="index.php?page=calendar&action=edit&id=<?= $ev['id'] ?>&month=<?= e($month) ?>" title="<?= e($ev['title']) ?>">
          <?= $ev['all_day'] ? '' : '<span class="cal-time">' . substr($ev['start_dt'], 11, 5) . '</span> ' ?><?= e(mb_strimwidth($ev['title'], 0, 34, '…')) ?>
        </a>
      <?php endforeach; ?>
    </div>
    <?php endfor; ?>
  </div>
  <div style="display:flex; gap:0.9rem; flex-wrap:wrap; padding:0.6rem 0.4rem 0.2rem; font-size:0.78rem; color:var(--muted,#6b7686);">
    <span><span class="cal-legend cal-ticket-offen"></span> Auftrag offen</span>
    <span><span class="cal-legend cal-ticket-arbeit"></span> in Arbeit</span>
    <span><span class="cal-legend cal-ticket-beendet"></span> beendet</span>
    <span><span class="cal-legend cal-ticket-abgerechnet"></span> abgerechnet</span>
    <span><span class="cal-legend cal-legend-event"></span> Termin</span>
  </div>
</div>

<div class="card">
  <h2>Nächste Termine</h2>
  <?php if (!$upcoming): ?>
    <p class="hint">Keine bevorstehenden Termine.</p>
  <?php else: ?>
  <div class="table-wrap" style="box-shadow:none;">
    <table class="list">
      <thead><tr><th>Datum</th><th>Zeit</th><th>Termin</th><th>Ort</th><th class="actions">Aktionen</th></tr></thead>
      <tbody>
      <?php foreach ($upcoming as $ev): ?>
        <tr>
          <td><?= date('d.m.Y', strtotime($ev['start_dt'])) ?></td>
          <td><?= $ev['all_day'] ? '<span class="badge">ganztägig</span>' : e(substr($ev['start_dt'], 11, 5)) . ($ev['end_dt'] ? '–' . e(substr($ev['end_dt'], 11, 5)) : '') . ' Uhr' ?></td>
          <td><strong><?= e($ev['title']) ?></strong><?php if ($ev['description']): ?><div class="hint"><?= e(mb_strimwidth($ev['description'], 0, 120, '…')) ?></div><?php endif; ?></td>
          <td><?= $ev['location'] ? e($ev['location']) : '<span class="hint">–</span>' ?></td>
          <td class="actions">
            <a class="btn btn-sm btn-secondary" href="index.php?page=calendar&action=edit&id=<?= $ev['id'] ?>&month=<?= e(substr($ev['start_dt'], 0, 7)) ?>">Bearbeiten</a>
            <form method="post" action="index.php?page=calendar&action=delete&id=<?= $ev['id'] ?>&month=<?= e($month) ?>" style="display:inline" onsubmit="return confirm('Termin wirklich löschen?');">
              <?= csrf_field() ?>
              <button type="submit" class="btn btn-sm btn-danger">Löschen</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>
<?php layout_footer(); ?>
