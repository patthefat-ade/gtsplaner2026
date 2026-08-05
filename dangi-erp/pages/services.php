<?php
/** DANGI ERP – Dienstleistungen (Titel, Beschreibung, Einheit, Preis) */
$pdo = db();
$action = $_GET['action'] ?? 'list';
$id = (int)($_GET['id'] ?? 0);

/* ---------- Speichern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === 'new' || $action === 'edit')) {
    $title = trim($_POST['title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $unit = trim($_POST['unit'] ?? 'Pauschale');
    $price = (float)str_replace(',', '.', str_replace('.', '', $_POST['unit_price'] ?? '0'));
    $active = isset($_POST['active']) ? 1 : 0;

    if ($title === '') {
        flash('Bitte einen Titel angeben.');
    } else {
        if ($action === 'edit' && $id) {
            $st = $pdo->prepare('UPDATE services SET title=?, description=?, unit=?, unit_price=?, active=? WHERE id=?');
            $st->execute([$title, $description, $unit, $price, $active, $id]);
            flash('Dienstleistung aktualisiert.');
        } else {
            $st = $pdo->prepare('INSERT INTO services (title, description, unit, unit_price, active) VALUES (?,?,?,?,?)');
            $st->execute([$title, $description, $unit, $price, $active]);
            flash('Dienstleistung angelegt.');
        }
        redirect('index.php?page=services');
    }
}

/* ---------- Löschen ---------- */
if ($action === 'delete' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo->prepare('DELETE FROM services WHERE id = ?')->execute([$id]);
    flash('Dienstleistung gelöscht. In bestehenden Dokumenten bleiben die Positionen erhalten.');
    redirect('index.php?page=services');
}

/* ---------- Formular ---------- */
if ($action === 'new' || $action === 'edit') {
    $s = ['title'=>'','description'=>'','unit'=>'Pauschale','unit_price'=>'0.00','active'=>1];
    if ($action === 'edit' && $id) {
        $st = $pdo->prepare('SELECT * FROM services WHERE id = ?');
        $st->execute([$id]);
        $s = $st->fetch() ?: $s;
    }
    layout_header($action === 'edit' ? 'Dienstleistung bearbeiten' : 'Neue Dienstleistung', 'services');
    ?>
    <div class="page-head">
      <h1><?= $action === 'edit' ? 'Dienstleistung bearbeiten' : 'Neue Dienstleistung' ?></h1>
      <a class="btn btn-secondary" href="index.php?page=services">← Zur Liste</a>
    </div>
    <div class="card">
      <form method="post">
        <?= csrf_field() ?>
        <div class="field"><label>Titel *</label><input type="text" name="title" required value="<?= e($s['title']) ?>"></div>
        <div class="field"><label>Beschreibung</label><textarea name="description" rows="4"><?= e($s['description']) ?></textarea>
          <span class="hint">Wird bei der Übernahme in Angebote und Rechnungen als Positionsbeschreibung vorausgefüllt.</span>
        </div>
        <div class="grid-3">
          <div class="field"><label>Einheit</label>
            <select name="unit">
              <?php foreach (['Pauschale','Stunde','m²','Stück','Monat','Einsatz','lfm'] as $u): ?>
                <option value="<?= $u ?>" <?= $s['unit'] === $u ? 'selected' : '' ?>><?= $u ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field"><label>Einzelpreis netto (€)</label>
            <input type="text" inputmode="decimal" name="unit_price" value="<?= number_format((float)$s['unit_price'], 2, ',', '') ?>"></div>
          <div class="field"><label>Status</label>
            <label style="display:flex;align-items:center;gap:0.5rem;font-weight:400;padding-top:0.5rem">
              <input type="checkbox" name="active" <?= $s['active'] ? 'checked' : '' ?>> aktiv (in Auswahl sichtbar)
            </label>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Speichern</button>
          <a class="btn btn-secondary" href="index.php?page=services">Abbrechen</a>
        </div>
      </form>
    </div>
    <?php
    layout_footer();
    exit;
}

/* ---------- Liste ---------- */
$services = $pdo->query('SELECT * FROM services ORDER BY active DESC, title')->fetchAll();

layout_header('Dienstleistungen', 'services');
?>
<div class="page-head">
  <h1>Dienstleistungen <span class="sub">(<?= count($services) ?>)</span></h1>
  <a class="btn btn-primary" href="index.php?page=services&action=new">+ Neue Dienstleistung</a>
</div>

<?php if (!$services): ?>
  <div class="card"><p class="hint">Noch keine Dienstleistungen angelegt. Dienstleistungen können mit Titel und Beschreibung angelegt und später direkt in Angebote und Rechnungen übernommen werden.</p></div>
<?php else: ?>
<div class="table-wrap">
  <table class="list">
    <thead><tr><th>Titel</th><th>Beschreibung</th><th>Einheit</th><th class="num">Preis netto</th><th>Status</th><th class="actions">Aktionen</th></tr></thead>
    <tbody>
    <?php foreach ($services as $s): ?>
      <tr>
        <td><strong><?= e($s['title']) ?></strong></td>
        <td class="hint" style="max-width:340px"><?= e(mb_strimwidth($s['description'] ?? '', 0, 110, '…')) ?></td>
        <td><?= e($s['unit']) ?></td>
        <td class="num"><?= money((float)$s['unit_price']) ?></td>
        <td><?= $s['active'] ? '<span class="badge badge-angenommen">aktiv</span>' : '<span class="badge badge-abgelehnt">inaktiv</span>' ?></td>
        <td class="actions">
          <a class="btn btn-sm btn-secondary" href="index.php?page=services&action=edit&id=<?= $s['id'] ?>">Bearbeiten</a>
          <form method="post" action="index.php?page=services&action=delete&id=<?= $s['id'] ?>" style="display:inline"
                onsubmit="return confirm('Dienstleistung wirklich löschen?')">
            <?= csrf_field() ?>
            <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>
<?php layout_footer(); ?>
