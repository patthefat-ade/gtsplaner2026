<?php
/**
 * DANGI ERP – Meine Geräte (Mitarbeiter & Chef)
 * Zeigt die dem Mitarbeiter ausgegebenen Geräte/Materialien.
 * Rückgabe melden → Status "Rückgabe gemeldet" → Chef bestätigt.
 */
$emp = working_employee();
if (!$emp) {
    if (is_admin()) { redirect('index.php?page=inventory'); }
    redirect('index.php?page=login');
}
$empId = (int)$emp['id'];

/* ---------- POST: Rückgabe melden ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'report_return') {
    $aid = (int)$_POST['assignment_id'];
    $st = db()->prepare("SELECT id FROM inventory_assignments WHERE id=? AND employee_id=? AND status='ausgegeben'");
    $st->execute([$aid, $empId]);
    if ($st->fetch()) {
        db()->prepare("UPDATE inventory_assignments SET status='rueckgabe_gemeldet', return_reported_at=NOW(), return_note=? WHERE id=?")
           ->execute([trim($_POST['return_note'] ?? ''), $aid]);
        flash('Rückgabe gemeldet – die Verwaltung bestätigt die Übernahme.');
    }
    redirect('index.php?page=my_inventory');
}

$st = db()->prepare("SELECT a.*, i.asset_id, i.name, i.item_type, i.quantity, i.unit
  FROM inventory_assignments a JOIN inventory_items i ON i.id=a.item_id
  WHERE a.employee_id=? AND a.status<>'zurueck'
  ORDER BY a.assigned_at DESC");
$st->execute([$empId]);
$rows = $st->fetchAll();

$hist = db()->prepare("SELECT a.*, i.asset_id, i.name FROM inventory_assignments a
  JOIN inventory_items i ON i.id=a.item_id
  WHERE a.employee_id=? AND a.status='zurueck'
  ORDER BY a.confirmed_at DESC LIMIT 10");
$hist->execute([$empId]);
$done = $hist->fetchAll();

layout_header('Meine Geräte', 'my_inventory');
?>
<div class="page-head">
  <h1>Meine Geräte & Material</h1>
  <a class="btn btn-secondary" href="index.php?page=my_day">← Mein Tag</a>
</div>

<?php if (!$rows): ?>
  <div class="card"><p class="hint">Dir ist derzeit nichts ausgegeben.</p></div>
<?php else: ?>
  <?php foreach ($rows as $r): ?>
    <div class="card">
      <div class="day-ticket-head" style="margin-bottom:0.5rem">
        <strong><?= e($r['asset_id']) ?> – <?= e($r['name']) ?></strong>
        <?= $r['status'] === 'ausgegeben'
            ? '<span class="badge badge-warning">bei dir</span>'
            : '<span class="badge badge-info">Rückgabe gemeldet</span>' ?>
      </div>
      <p class="hint">
        <?= e(rtrim(rtrim(number_format((float)$r['quantity'], 2, ',', '.'), '0'), ',')) ?> <?= e($r['unit']) ?>
        · ausgegeben am <?= date('d.m.Y H:i', strtotime($r['assigned_at'])) ?> Uhr
        <?= $r['assigned_note'] ? '· ' . e($r['assigned_note']) : '' ?>
      </p>
      <?php if ($r['status'] === 'ausgegeben'): ?>
        <form method="post" style="margin-top:0.7rem">
          <?= csrf_field() ?>
          <input type="hidden" name="do" value="report_return">
          <input type="hidden" name="assignment_id" value="<?= (int)$r['id'] ?>">
          <div class="field"><label>Anmerkung zur Rückgabe (optional)</label>
            <input type="text" name="return_note" placeholder="z. B. ins Lager gestellt, Tank leer"></div>
          <button class="btn btn-primary" type="submit" onclick="return confirm('Rückgabe von <?= e($r['asset_id']) ?> melden?')">↩ Rückgabe melden</button>
        </form>
      <?php else: ?>
        <p class="hint" style="margin-top:0.5rem">Gemeldet am <?= date('d.m.Y H:i', strtotime($r['return_reported_at'])) ?> Uhr – wartet auf Bestätigung durch die Verwaltung.</p>
      <?php endif; ?>
    </div>
  <?php endforeach; ?>
<?php endif; ?>

<?php if ($done): ?>
<div class="card">
  <h2 class="subform-title">Zuletzt zurückgegeben</h2>
  <div class="table-wrap" style="box-shadow:none;">
    <table class="list">
      <thead><tr><th>Artikel</th><th>Zurückgegeben</th><th>Bestätigt</th></tr></thead>
      <tbody>
      <?php foreach ($done as $d): ?>
        <tr>
          <td><strong><?= e($d['asset_id']) ?></strong> <?= e($d['name']) ?></td>
          <td><?= $d['return_reported_at'] ? date('d.m.Y H:i', strtotime($d['return_reported_at'])) : '–' ?></td>
          <td><?= $d['confirmed_at'] ? date('d.m.Y H:i', strtotime($d['confirmed_at'])) : '–' ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php endif; ?>
<?php layout_footer(); ?>
