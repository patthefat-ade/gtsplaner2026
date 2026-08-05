<?php
/**
 * DANGI ERP – Zeiterfassung (nur Admin)
 * Alle Stempelungen und Abwesenheiten aller Mitarbeiter:
 * Filter nach Mitarbeiter/Art/Zeitraum, manuell anlegen, korrigieren, löschen.
 * CI: Türkis (#0FA7A0), Anthrazit (#3B4757)
 */
require_admin();
$pdo = db();

/* ---------- POST: Buchung manuell anlegen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'add_entry') {
    $eid  = (int)($_POST['employee_id'] ?? 0);
    $type = in_array($_POST['entry_type'] ?? '', ['anwesenheit', 'krank', 'amtsweg', 'urlaub'], true) ? $_POST['entry_type'] : 'anwesenheit';
    $note = trim($_POST['note'] ?? '') ?: null;
    if (!$eid) {
        flash('Bitte einen Mitarbeiter auswählen.');
    } elseif ($type === 'urlaub') {
        $from = $_POST['date_from'] ?? ''; $to = $_POST['date_to'] ?? '';
        if (!$from || !$to || $to < $from) { flash('Bitte einen gültigen Urlaubszeitraum angeben.'); }
        else {
            $pdo->prepare("INSERT INTO time_entries (employee_id, entry_type, date_from, date_to, note, created_by) VALUES (?,'urlaub',?,?,?,'admin')")
                ->execute([$eid, $from, $to, $note]);
            flash('Urlaub eingetragen.');
        }
    } else {
        $in  = $_POST['clock_in'] ?? ''; $out = $_POST['clock_out'] ?? '';
        if (!$in) { flash('Bitte mindestens „Von“ angeben.'); }
        elseif ($out && $out <= $in) { flash('„Bis“ muss nach „Von“ liegen.'); }
        else {
            $pdo->prepare("INSERT INTO time_entries (employee_id, entry_type, clock_in, clock_out, note, created_by) VALUES (?,?,?,?,?,'admin')")
                ->execute([$eid, $type, str_replace('T', ' ', $in) . (strlen($in) === 16 ? ':00' : ''), $out ? str_replace('T', ' ', $out) . (strlen($out) === 16 ? ':00' : '') : null, $note]);
            flash('Buchung angelegt.');
        }
    }
    redirect('index.php?page=timeclock');
}

/* ---------- POST: Buchung korrigieren (Zeiten) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'update_entry') {
    $id = (int)$_POST['id'];
    $st = $pdo->prepare('SELECT * FROM time_entries WHERE id=?');
    $st->execute([$id]);
    if ($en = $st->fetch()) {
        if ($en['entry_type'] === 'urlaub') {
            $from = $_POST['date_from'] ?? ''; $to = $_POST['date_to'] ?? '';
            if ($from && $to && $to >= $from) {
                $pdo->prepare('UPDATE time_entries SET date_from=?, date_to=?, note=? WHERE id=?')
                    ->execute([$from, $to, trim($_POST['note'] ?? '') ?: null, $id]);
                flash('Urlaub aktualisiert.');
            } else { flash('Ungültiger Zeitraum.'); }
        } else {
            $in = $_POST['clock_in'] ?? ''; $out = $_POST['clock_out'] ?? '';
            if ($in && (!$out || $out > $in)) {
                $pdo->prepare('UPDATE time_entries SET clock_in=?, clock_out=?, note=? WHERE id=?')
                    ->execute([str_replace('T', ' ', $in) . (strlen($in) === 16 ? ':00' : ''), $out ? str_replace('T', ' ', $out) . (strlen($out) === 16 ? ':00' : '') : null, trim($_POST['note'] ?? '') ?: null, $id]);
                flash('Buchung aktualisiert.');
            } else { flash('Ungültige Zeiten.'); }
        }
    }
    redirect('index.php?page=timeclock' . (isset($_POST['back']) ? '&' . $_POST['back'] : ''));
}

/* ---------- POST: Buchung löschen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'delete_entry') {
    $pdo->prepare('DELETE FROM time_entries WHERE id=?')->execute([(int)$_POST['id']]);
    flash('Buchung gelöscht.');
    redirect('index.php?page=timeclock');
}

/* ---------- Filter ---------- */
$fEmp  = (int)($_GET['employee'] ?? 0);
$fType = $_GET['type'] ?? '';
$fFrom = $_GET['from'] ?? date('Y-m-01');
$fTo   = $_GET['to'] ?? date('Y-m-t');

$sql = "SELECT t.*, e.first_name, e.last_name FROM time_entries t
        JOIN employees e ON e.id = t.employee_id
        WHERE (
          (t.clock_in IS NOT NULL AND DATE(t.clock_in) BETWEEN ? AND ?)
          OR (t.date_from IS NOT NULL AND t.date_from <= ? AND t.date_to >= ?)
        )";
$params = [$fFrom, $fTo, $fTo, $fFrom];
if ($fEmp) { $sql .= ' AND t.employee_id = ?'; $params[] = $fEmp; }
if (in_array($fType, ['anwesenheit', 'krank', 'amtsweg', 'urlaub'], true)) { $sql .= ' AND t.entry_type = ?'; $params[] = $fType; }
$sql .= ' ORDER BY COALESCE(t.clock_in, t.date_from) DESC';
$st = $pdo->prepare($sql);
$st->execute($params);
$entries = $st->fetchAll();

/* Summen je Mitarbeiter (Anwesenheit im Zeitraum) */
$sumSql = "SELECT t.employee_id, e.first_name, e.last_name,
        SUM(TIMESTAMPDIFF(MINUTE, t.clock_in, t.clock_out))/60 AS hours
      FROM time_entries t JOIN employees e ON e.id=t.employee_id
      WHERE t.entry_type='anwesenheit' AND t.clock_out IS NOT NULL AND DATE(t.clock_in) BETWEEN ? AND ?"
      . ($fEmp ? ' AND t.employee_id = ' . $fEmp : '') .
      " GROUP BY t.employee_id, e.first_name, e.last_name ORDER BY e.last_name";
$sumSt = $pdo->prepare($sumSql);
$sumSt->execute([$fFrom, $fTo]);
$sums = $sumSt->fetchAll();

$employees = $pdo->query('SELECT id, first_name, last_name FROM employees WHERE is_active=1 ORDER BY last_name')->fetchAll();

$typeBadge = function (string $t): string {
    return match ($t) {
        'anwesenheit' => '<span class="badge badge-success">Anwesenheit</span>',
        'krank'       => '<span class="badge badge-warning">Krankenstand</span>',
        'amtsweg'     => '<span class="badge badge-info">Amtsweg</span>',
        'urlaub'      => '<span class="badge badge-quote">Urlaub</span>',
        default       => e($t),
    };
};

layout_header('Zeiterfassung', 'timeclock');
?>
<div class="page-head">
  <h1>Zeiterfassung <span class="sub">Anwesenheit & Abwesenheiten</span></h1>
</div>

<div class="card" style="padding:0.9rem 1.4rem;">
  <form method="get" action="index.php" style="display:flex; gap:0.7rem; flex-wrap:wrap; align-items:flex-end;">
    <input type="hidden" name="page" value="timeclock">
    <div class="field" style="margin:0; min-width:180px;"><label>Mitarbeiter</label>
      <select name="employee" onchange="this.form.submit()">
        <option value="0">alle</option>
        <?php foreach ($employees as $em): ?>
          <option value="<?= (int)$em['id'] ?>" <?= $fEmp === (int)$em['id'] ? 'selected' : '' ?>><?= e(trim($em['first_name'] . ' ' . $em['last_name'])) ?></option>
        <?php endforeach; ?>
      </select></div>
    <div class="field" style="margin:0; min-width:160px;"><label>Art</label>
      <select name="type" onchange="this.form.submit()">
        <option value="">alle</option>
        <option value="anwesenheit" <?= $fType === 'anwesenheit' ? 'selected' : '' ?>>Anwesenheit</option>
        <option value="krank" <?= $fType === 'krank' ? 'selected' : '' ?>>Krankenstand</option>
        <option value="amtsweg" <?= $fType === 'amtsweg' ? 'selected' : '' ?>>Amtsweg</option>
        <option value="urlaub" <?= $fType === 'urlaub' ? 'selected' : '' ?>>Urlaub</option>
      </select></div>
    <div class="field" style="margin:0;"><label>Von</label>
      <input type="date" name="from" value="<?= e($fFrom) ?>" onchange="this.form.submit()"></div>
    <div class="field" style="margin:0;"><label>Bis</label>
      <input type="date" name="to" value="<?= e($fTo) ?>" onchange="this.form.submit()"></div>
    <noscript><button class="btn btn-sm btn-secondary" type="submit">Filtern</button></noscript>
  </form>
</div>

<?php if ($sums): ?>
<div class="card">
  <h2 class="subform-title">Anwesenheit im Zeitraum (Summe)</h2>
  <div class="table-wrap" style="box-shadow:none;">
    <table class="list">
      <thead><tr><th>Mitarbeiter</th><th>Gestempelte Stunden</th></tr></thead>
      <tbody>
      <?php foreach ($sums as $s): ?>
        <tr><td><strong><?= e(trim($s['first_name'] . ' ' . $s['last_name'])) ?></strong></td>
            <td><?= number_format((float)$s['hours'], 2, ',', '.') ?> Std.</td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php endif; ?>

<div class="card">
  <h2 class="subform-title">Buchung manuell anlegen</h2>
  <form method="post" action="index.php?page=timeclock">
    <?= csrf_field() ?>
    <input type="hidden" name="do" value="add_entry">
    <div class="grid-3">
      <div class="field"><label>Mitarbeiter *</label>
        <select name="employee_id" required>
          <option value="">– wählen –</option>
          <?php foreach ($employees as $em): ?>
            <option value="<?= (int)$em['id'] ?>"><?= e(trim($em['first_name'] . ' ' . $em['last_name'])) ?></option>
          <?php endforeach; ?>
        </select></div>
      <div class="field"><label>Art</label>
        <select name="entry_type" id="tc-type">
          <option value="anwesenheit">Anwesenheit</option>
          <option value="krank">Krankenstand</option>
          <option value="amtsweg">Amtsweg</option>
          <option value="urlaub">Urlaub (von–bis)</option>
        </select></div>
      <div class="field"><label>Anmerkung (optional)</label>
        <input type="text" name="note" placeholder="z. B. Nachtrag"></div>
    </div>
    <div class="grid-2 tc-clock">
      <div class="field"><label>Von (Datum + Uhrzeit) *</label>
        <input type="datetime-local" name="clock_in"></div>
      <div class="field"><label>Bis (Datum + Uhrzeit)</label>
        <input type="datetime-local" name="clock_out">
        <span class="hint">Leer lassen = Stempelung läuft noch.</span></div>
    </div>
    <div class="grid-2 tc-vac" style="display:none;">
      <div class="field"><label>Urlaub von *</label>
        <input type="date" name="date_from"></div>
      <div class="field"><label>Urlaub bis *</label>
        <input type="date" name="date_to"></div>
    </div>
    <button class="btn btn-primary" type="submit">Buchung anlegen</button>
  </form>
  <script>
  (function(){
    var sel = document.getElementById('tc-type');
    if (!sel) return;
    sel.addEventListener('change', function(){
      var vac = sel.value === 'urlaub';
      document.querySelector('.tc-clock').style.display = vac ? 'none' : '';
      document.querySelector('.tc-vac').style.display = vac ? '' : 'none';
    });
  })();
  </script>
</div>

<div class="table-wrap">
  <table class="list">
    <thead><tr><th>Mitarbeiter</th><th>Art</th><th>Von</th><th>Bis</th><th>Dauer</th><th>Anmerkung</th><th class="actions">Aktionen</th></tr></thead>
    <tbody>
    <?php if (!$entries): ?>
      <tr><td colspan="7" class="hint" style="text-align:center; padding:1.4rem;">Keine Buchungen im gewählten Zeitraum.</td></tr>
    <?php endif; ?>
    <?php foreach ($entries as $en): ?>
      <tr>
        <td><strong><?= e(trim($en['first_name'] . ' ' . $en['last_name'])) ?></strong>
          <?= $en['created_by'] === 'admin' ? '<div class="hint">durch Verwaltung</div>' : '' ?></td>
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
        <td class="actions">
          <details style="display:inline-block;">
            <summary class="btn btn-sm btn-secondary" style="list-style:none; cursor:pointer;">Korrigieren</summary>
            <form method="post" action="index.php?page=timeclock" style="margin-top:0.5rem; display:flex; gap:0.4rem; flex-wrap:wrap; align-items:flex-end;">
              <?= csrf_field() ?>
              <input type="hidden" name="do" value="update_entry">
              <input type="hidden" name="id" value="<?= (int)$en['id'] ?>">
              <?php if ($en['entry_type'] === 'urlaub'): ?>
                <input type="date" name="date_from" value="<?= e($en['date_from']) ?>">
                <input type="date" name="date_to" value="<?= e($en['date_to']) ?>">
              <?php else: ?>
                <input type="datetime-local" name="clock_in" value="<?= $en['clock_in'] ? date('Y-m-d\TH:i', strtotime($en['clock_in'])) : '' ?>">
                <input type="datetime-local" name="clock_out" value="<?= $en['clock_out'] ? date('Y-m-d\TH:i', strtotime($en['clock_out'])) : '' ?>">
              <?php endif; ?>
              <input type="text" name="note" value="<?= e($en['note'] ?? '') ?>" placeholder="Anmerkung" style="max-width:150px;">
              <button class="btn btn-sm btn-primary" type="submit">Speichern</button>
            </form>
          </details>
          <form method="post" action="index.php?page=timeclock" style="display:inline;" onsubmit="return confirm('Buchung löschen?');">
            <?= csrf_field() ?>
            <input type="hidden" name="do" value="delete_entry">
            <input type="hidden" name="id" value="<?= (int)$en['id'] ?>">
            <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php layout_footer(); ?>

