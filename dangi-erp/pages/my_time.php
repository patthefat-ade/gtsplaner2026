<?php
/**
 * DANGI ERP – Meine Zeiten (Mitarbeiter + Chef mit verknüpftem Account)
 * Ein-/Ausstempeln (Anwesenheit), Krankenstand/Amtsweg stempeln,
 * Urlaub von–bis eintragen, eigene Historie der letzten Wochen.
 * CI: Türkis (#0FA7A0), Anthrazit (#3B4757)
 */
$pdo = db();

/* Wer stempelt? Mitarbeiter direkt oder Admin mit verknüpftem Chef-Account */
$empId = 0;
if (current_role() === 'employee') {
    $empId = (int)(current_employee()['id'] ?? 0);
} elseif (current_role() === 'admin') {
    $empId = (int)setting('admin_employee_id', '0');
}
if (!$empId) {
    flash('Kein Mitarbeiter-Account verknüpft. Bitte in den Einstellungen unter „Chef-Account“ einen Mitarbeiter verknüpfen.');
    redirect('index.php?page=dashboard');
}
$st = $pdo->prepare('SELECT * FROM employees WHERE id=?');
$st->execute([$empId]);
$me = $st->fetch();
if (!$me) { flash('Mitarbeiter nicht gefunden.'); redirect('index.php'); }

/* Offene Anwesenheits-Stempelung? */
$openSt = $pdo->prepare("SELECT * FROM time_entries WHERE employee_id=? AND entry_type IN ('anwesenheit','krank','amtsweg') AND clock_in IS NOT NULL AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1");
$openSt->execute([$empId]);
$open = $openSt->fetch();

/* ---------- POST: Einstempeln ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'clock_in') {
    $type = in_array($_POST['entry_type'] ?? '', ['anwesenheit', 'krank', 'amtsweg'], true) ? $_POST['entry_type'] : 'anwesenheit';
    if ($open) {
        flash('Es läuft bereits eine Stempelung seit ' . date('d.m.Y H:i', strtotime($open['clock_in'])) . ' Uhr. Bitte zuerst ausstempeln.');
    } else {
        $pdo->prepare("INSERT INTO time_entries (employee_id, entry_type, clock_in, note, created_by) VALUES (?,?,NOW(),?,?)")
            ->execute([$empId, $type, trim($_POST['note'] ?? '') ?: null, current_role() === 'admin' ? 'admin' : 'employee']);
        $label = ['anwesenheit' => 'Eingestempelt', 'krank' => 'Krankenstand gestempelt', 'amtsweg' => 'Amtsweg gestempelt'][$type];
        flash($label . ' um ' . date('H:i') . ' Uhr.');
    }
    redirect('index.php?page=my_time');
}

/* ---------- POST: Ausstempeln ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'clock_out') {
    if ($open) {
        $pdo->prepare('UPDATE time_entries SET clock_out=NOW() WHERE id=?')->execute([(int)$open['id']]);
        flash('Ausgestempelt um ' . date('H:i') . ' Uhr.');
    } else {
        flash('Keine laufende Stempelung gefunden.');
    }
    redirect('index.php?page=my_time');
}

/* ---------- POST: Urlaub eintragen (von–bis) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'vacation') {
    $from = $_POST['date_from'] ?? '';
    $to   = $_POST['date_to'] ?? '';
    if (!$from || !$to || $to < $from) {
        flash('Bitte einen gültigen Urlaubszeitraum (von–bis) angeben.');
    } else {
        $pdo->prepare("INSERT INTO time_entries (employee_id, entry_type, date_from, date_to, note, created_by) VALUES (?,'urlaub',?,?,?,?)")
            ->execute([$empId, $from, $to, trim($_POST['note'] ?? '') ?: null, current_role() === 'admin' ? 'admin' : 'employee']);
        flash('Urlaub von ' . date('d.m.Y', strtotime($from)) . ' bis ' . date('d.m.Y', strtotime($to)) . ' eingetragen.');
    }
    redirect('index.php?page=my_time');
}

/* Offene Stempelung neu laden (nach POST-Redirects nicht nötig, aber sauber) */
$openSt->execute([$empId]);
$open = $openSt->fetch();

/* Historie: letzte 60 Tage */
$hist = $pdo->prepare("SELECT * FROM time_entries WHERE employee_id=? AND (clock_in >= DATE_SUB(NOW(), INTERVAL 60 DAY) OR date_from >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)) ORDER BY COALESCE(clock_in, date_from) DESC LIMIT 100");
$hist->execute([$empId]);
$entries = $hist->fetchAll();

/* Wochensumme Anwesenheit (Mo–So aktuelle Woche) */
$sumSt = $pdo->prepare("SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, clock_in, clock_out)),0)/60 FROM time_entries
    WHERE employee_id=? AND entry_type='anwesenheit' AND clock_out IS NOT NULL
    AND YEARWEEK(clock_in, 1) = YEARWEEK(CURDATE(), 1)");
$sumSt->execute([$empId]);
$weekHours = (float)$sumSt->fetchColumn();

$typeBadge = function (string $t): string {
    return match ($t) {
        'anwesenheit' => '<span class="badge badge-success">Anwesenheit</span>',
        'krank'       => '<span class="badge badge-warning">Krankenstand</span>',
        'amtsweg'     => '<span class="badge badge-info">Amtsweg</span>',
        'urlaub'      => '<span class="badge badge-quote">Urlaub</span>',
        default       => e($t),
    };
};

layout_header('Meine Zeiten', 'my_time');
?>
<div class="page-head">
  <h1>Meine Zeiten <span class="sub"><?= e(trim($me['first_name'] . ' ' . $me['last_name'])) ?></span></h1>
</div>

<div class="card">
  <?php if ($open): ?>
    <div class="day-ticket-head" style="margin-bottom:0.6rem">
      <?= $typeBadge($open['entry_type']) ?>
      <span class="badge badge-warning">läuft seit <?= date('d.m.Y H:i', strtotime($open['clock_in'])) ?> Uhr</span>
    </div>
    <form method="post" action="index.php?page=my_time">
      <?= csrf_field() ?>
      <input type="hidden" name="do" value="clock_out">
      <button class="btn btn-primary" type="submit" style="font-size:1.05rem; padding:0.7rem 1.6rem;">■ Jetzt ausstempeln</button>
    </form>
  <?php else: ?>
    <h2 class="subform-title">Einstempeln</h2>
    <form method="post" action="index.php?page=my_time">
      <?= csrf_field() ?>
      <input type="hidden" name="do" value="clock_in">
      <div class="grid-2">
        <div class="field"><label>Art</label>
          <select name="entry_type">
            <option value="anwesenheit">Anwesenheit (Arbeit)</option>
            <option value="krank">Krankenstand</option>
            <option value="amtsweg">Amtsweg</option>
          </select></div>
        <div class="field"><label>Anmerkung (optional)</label>
          <input type="text" name="note" placeholder="z. B. Arzttermin, Gemeindeamt"></div>
      </div>
      <button class="btn btn-primary" type="submit" style="font-size:1.05rem; padding:0.7rem 1.6rem;">▶ Jetzt einstempeln</button>
    </form>
  <?php endif; ?>
  <p class="hint" style="margin-top:0.7rem">Diese Woche gestempelt: <strong><?= number_format($weekHours, 2, ',', '.') ?> Std.</strong>
    <?php if ((float)$me['weekly_hours'] > 0): ?> von <?= number_format((float)$me['weekly_hours'], 2, ',', '.') ?> Std. Wochenarbeitszeit<?php endif; ?></p>
</div>

<div class="card">
  <h2 class="subform-title">Urlaub eintragen</h2>
  <form method="post" action="index.php?page=my_time" style="display:flex; gap:0.7rem; flex-wrap:wrap; align-items:flex-end;">
    <?= csrf_field() ?>
    <input type="hidden" name="do" value="vacation">
    <div class="field" style="margin:0;"><label>Von *</label>
      <input type="date" name="date_from" required></div>
    <div class="field" style="margin:0;"><label>Bis *</label>
      <input type="date" name="date_to" required></div>
    <div class="field" style="margin:0; min-width:220px;"><label>Anmerkung (optional)</label>
      <input type="text" name="note" placeholder="z. B. Sommerurlaub"></div>
    <button class="btn btn-secondary" type="submit">Urlaub eintragen</button>
  </form>
</div>

<div class="card">
  <h2 class="subform-title">Meine Buchungen (letzte 60 Tage)</h2>
  <?php if (!$entries): ?>
    <p class="hint">Noch keine Buchungen vorhanden.</p>
  <?php else: ?>
  <div class="table-wrap" style="box-shadow:none;">
    <table class="list">
      <thead><tr><th>Art</th><th>Von</th><th>Bis</th><th>Dauer</th><th>Anmerkung</th></tr></thead>
      <tbody>
      <?php foreach ($entries as $en): ?>
        <tr>
          <td><?= $typeBadge($en['entry_type']) ?></td>
          <?php if ($en['entry_type'] === 'urlaub'): ?>
            <td><?= date('d.m.Y', strtotime($en['date_from'])) ?></td>
            <td><?= date('d.m.Y', strtotime($en['date_to'])) ?></td>
            <td><?= (int)((strtotime($en['date_to']) - strtotime($en['date_from'])) / 86400) + 1 ?> Tag(e)</td>
          <?php else: ?>
            <td><?= $en['clock_in'] ? date('d.m.Y H:i', strtotime($en['clock_in'])) : '–' ?></td>
            <td><?= $en['clock_out'] ? date('d.m.Y H:i', strtotime($en['clock_out'])) : '<span class="badge badge-warning">läuft</span>' ?></td>
            <td><?= $en['clock_out'] ? number_format((strtotime($en['clock_out']) - strtotime($en['clock_in'])) / 3600, 2, ',', '.') . ' Std.' : '–' ?></td>
          <?php endif; ?>
          <td><?= $en['note'] ? e($en['note']) : '<span class="hint">–</span>' ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>
<?php layout_footer(); ?>
