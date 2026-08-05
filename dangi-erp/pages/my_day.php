<?php
/**
 * DANGI ERP – Mein Tag (Mitarbeiter-Tagesansicht)
 * Zeigt alle Aufträge des angemeldeten Mitarbeiters für einen Tag,
 * chronologisch mit Uhrzeit, Kunde, Adresse und Status.
 */
$emp = working_employee();
$isAdminView = is_admin();
if (!$emp) {
    if ($isAdminView) {
        // Chef hat noch keinen eigenen Mitarbeiter-Account verknüpft
        layout_header('Meine Aufträge', 'my_day');
        echo '<div class="page-head"><h1>Meine Aufträge</h1></div>';
        echo '<div class="card"><p>Damit du als Chef selbst Aufträge abarbeiten kannst, brauchst du einen eigenen Mitarbeiter-Eintrag, dem Aufträge zugewiesen werden.</p>';
        echo '<p style="margin-top:0.6rem">So geht’s: <strong>1.</strong> Unter <a href="index.php?page=employees">Mitarbeiter</a> einen Eintrag für dich anlegen (falls noch nicht vorhanden). <strong>2.</strong> Unter <a href="index.php?page=settings">Einstellungen</a> im Bereich „Chef-Account“ deinen Mitarbeiter-Eintrag auswählen.</p></div>';
        layout_footer();
        return;
    }
    redirect('index.php?page=login');
}

$date = $_GET['date'] ?? date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = date('Y-m-d');
$prev = date('Y-m-d', strtotime($date . ' -1 day'));
$next = date('Y-m-d', strtotime($date . ' +1 day'));

$st = db()->prepare('SELECT t.*, c.company, c.first_name AS c_first, c.last_name AS c_last,
    (SELECT COUNT(*) FROM ticket_photos p WHERE p.ticket_id=t.id) AS photo_count,
    (SELECT COALESCE(SUM(hours),0) FROM ticket_times x WHERE x.ticket_id=t.id) AS total_hours
  FROM tickets t LEFT JOIN customers c ON c.id=t.customer_id
  WHERE t.employee_id=? AND t.work_date=?
  ORDER BY t.time_from IS NULL, t.time_from');
$st->execute([(int)$emp['id'], $date]);
$rows = $st->fetchAll();

// Blockierendes Ticket (in Arbeit oder beendet ohne Zeitbuchung)?
$blk = db()->prepare("SELECT t.id, t.ticket_number, t.status FROM tickets t
  WHERE t.employee_id=? AND (t.status='in_arbeit'
     OR (t.status='beendet' AND NOT EXISTS (SELECT 1 FROM ticket_times x WHERE x.ticket_id=t.id)))
  ORDER BY t.status='in_arbeit' DESC LIMIT 1");
$blk->execute([(int)$emp['id']]);
$blocking = $blk->fetch();

$wd = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][(int)date('w', strtotime($date))];

$statusBadge = function (string $s): string {
    return match ($s) {
        'offen'       => '<span class="badge badge-muted">offen</span>',
        'in_arbeit'   => '<span class="badge badge-warning">in Arbeit</span>',
        'beendet'     => '<span class="badge badge-success">beendet</span>',
        'abgerechnet' => '<span class="badge badge-info">abgerechnet</span>',
        default       => e($s),
    };
};

layout_header('Mein Tag', 'my_day');
?>
<div class="page-head">
  <h1><?= $isAdminView ? 'Meine Aufträge' : 'Mein Tag' ?> – <?= e(trim($emp['first_name'] . ' ' . $emp['last_name'])) ?></h1>
</div>

<div class="card">
  <div class="month-nav">
    <a class="btn btn-sm btn-secondary" href="index.php?page=my_day&date=<?= $prev ?>">← Vortag</a>
    <strong><?= $wd ?>, <?= dmy($date) ?><?= $date === date('Y-m-d') ? ' (heute)' : '' ?></strong>
    <a class="btn btn-sm btn-secondary" href="index.php?page=my_day&date=<?= $next ?>">Folgetag →</a>
    <?php if ($date !== date('Y-m-d')): ?>
      <a class="btn btn-sm btn-secondary" href="index.php?page=my_day">Heute</a>
    <?php endif; ?>
  </div>

  <?php if ($blocking): ?>
    <div class="alert <?= $blocking['status'] === 'in_arbeit' ? 'alert-success' : 'alert-error' ?>" style="margin-top:0.8rem">
      <?php if ($blocking['status'] === 'in_arbeit'): ?>
        Du arbeitest gerade an Auftrag <strong><?= e($blocking['ticket_number']) ?></strong>.
        <a href="index.php?page=ticket_view&id=<?= (int)$blocking['id'] ?>">Zum Auftrag →</a>
      <?php else: ?>
        Auftrag <strong><?= e($blocking['ticket_number']) ?></strong> ist beendet, aber die Zeit ist noch nicht gebucht.
        Bitte zuerst die Zeit eintragen, bevor du den nächsten Auftrag startest.
        <a href="index.php?page=ticket_view&id=<?= (int)$blocking['id'] ?>">Zeit buchen →</a>
      <?php endif; ?>
    </div>
  <?php endif; ?>
</div>

<?php if (!$rows): ?>
  <div class="card"><p class="hint">Keine Aufträge für diesen Tag. Erhol dich gut oder wirf einen Blick auf den Folgetag!</p></div>
<?php else: ?>
  <?php foreach ($rows as $r): ?>
    <a class="card day-ticket" href="index.php?page=ticket_view&id=<?= (int)$r['id'] ?>">
      <div class="day-ticket-time">
        <?= $r['time_from'] ? '<strong>' . substr($r['time_from'],0,5) . '</strong>' . ($r['time_to'] ? '<span>–' . substr($r['time_to'],0,5) . '</span>' : '') : '<strong>–</strong>' ?>
      </div>
      <div class="day-ticket-body">
        <div class="day-ticket-head">
          <strong><?= e($r['title']) ?></strong>
          <?= $statusBadge($r['status']) ?>
        </div>
        <div class="day-ticket-meta">
          <?= e($r['ticket_number']) ?>
          <?php if ($r['customer_id']): ?> · <?= e($r['company'] ?: trim($r['c_first'] . ' ' . $r['c_last'])) ?><?php endif; ?>
          <?php if ($r['address_street']): ?> · <?= e($r['address_street'] . ', ' . $r['address_zip'] . ' ' . $r['address_city']) ?><?php endif; ?>
        </div>
        <?php if ((float)$r['total_hours'] > 0 || (int)$r['photo_count'] > 0): ?>
        <div class="day-ticket-meta">
          <?= (float)$r['total_hours'] > 0 ? number_format((float)$r['total_hours'],2,',','.') . ' Std. gebucht' : '' ?>
          <?= (float)$r['total_hours'] > 0 && (int)$r['photo_count'] > 0 ? ' · ' : '' ?>
          <?= (int)$r['photo_count'] > 0 ? (int)$r['photo_count'] . ' Foto(s)' : '' ?>
        </div>
        <?php endif; ?>
      </div>
      <div class="day-ticket-arrow">→</div>
    </a>
  <?php endforeach; ?>
<?php endif; ?>
<?php layout_footer(); ?>
