<?php
/**
 * DANGI ERP – Inventar (nur Admin)
 * Arbeitsgeräte & Material mit Asset-IDs (INV-0001), Zuweisung an
 * Mitarbeiter, Rückgabe mit Bestätigungspflicht, Historie je Artikel.
 * CI: Türkis (#0FA7A0), Anthrazit (#3B4757)
 */
require_admin();

$pdo    = db();
$action = $_GET['action'] ?? 'list';
$id     = (int)($_GET['id'] ?? 0);

/* Nächste Asset-ID erzeugen und Zähler erhöhen */
function next_asset_id(): string {
    $pdo = db();
    $ownTx = !$pdo->inTransaction();
    if ($ownTx) $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT svalue FROM settings WHERE skey = ? FOR UPDATE');
        $st->execute(['inventory_next']);
        $nr = (int)($st->fetchColumn() ?: 1);
        $prefix = setting('inventory_prefix', 'INV');
        $assetId = $prefix . '-' . str_pad((string)$nr, 4, '0', STR_PAD_LEFT);
        $pdo->prepare('UPDATE settings SET svalue = ? WHERE skey = ?')->execute([(string)($nr + 1), 'inventory_next']);
        if ($ownTx) $pdo->commit();
        return $assetId;
    } catch (Throwable $t) {
        if ($ownTx && $pdo->inTransaction()) $pdo->rollBack();
        throw $t;
    }
}

/* ---------- POST: Artikel speichern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'save_item') {
    $iid   = (int)($_POST['id'] ?? 0);
    $name  = trim($_POST['name'] ?? '');
    $type  = ($_POST['item_type'] ?? 'geraet') === 'material' ? 'material' : 'geraet';
    $qty   = (float)str_replace(',', '.', $_POST['quantity'] ?? '1');
    if ($qty <= 0) $qty = 1;
    $unit  = trim($_POST['unit'] ?? 'Stk.') ?: 'Stk.';
    $note  = trim($_POST['note'] ?? '');
    $active = isset($_POST['is_active']) ? 1 : 0;
    $catId = (int)($_POST['category_id'] ?? 0) ?: null;
    $locId = (int)($_POST['location_id'] ?? 0) ?: null;

    if ($name === '') {
        flash('Bitte eine Bezeichnung angeben.');
        redirect('index.php?page=inventory&action=' . ($iid ? 'edit&id=' . $iid : 'new'));
    }
    if ($iid) {
        $pdo->prepare('UPDATE inventory_items SET name=?, item_type=?, category_id=?, location_id=?, quantity=?, unit=?, note=?, is_active=? WHERE id=?')
            ->execute([$name, $type, $catId, $locId, $qty, $unit, $note, $active, $iid]);
        flash('Artikel gespeichert.');
        redirect('index.php?page=inventory&action=view&id=' . $iid);
    } else {
        $assetId = trim($_POST['asset_id'] ?? '');
        if ($assetId === '') { $assetId = next_asset_id(); }
        $st = $pdo->prepare('SELECT id FROM inventory_items WHERE asset_id = ?');
        $st->execute([$assetId]);
        if ($st->fetch()) {
            flash('Die Asset-ID "' . $assetId . '" ist bereits vergeben.');
            redirect('index.php?page=inventory&action=new');
        }
        $pdo->prepare('INSERT INTO inventory_items (asset_id, name, item_type, category_id, location_id, quantity, unit, note, is_active) VALUES (?,?,?,?,?,?,?,?,?)')
            ->execute([$assetId, $name, $type, $catId, $locId, $qty, $unit, $note, $active]);
        flash('Artikel ' . $assetId . ' angelegt.');
        redirect('index.php?page=inventory');
    }
}

/* ---------- POST: Kategorie anlegen/umbenennen/löschen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'save_category') {
    $cid  = (int)($_POST['category_id'] ?? 0);
    $name = trim($_POST['cat_name'] ?? '');
    if ($name === '') {
        flash('Bitte einen Kategorienamen angeben.');
    } else {
        try {
            if ($cid) {
                $pdo->prepare('UPDATE inventory_categories SET name=? WHERE id=?')->execute([$name, $cid]);
                flash('Kategorie umbenannt.');
            } else {
                $pdo->prepare('INSERT INTO inventory_categories (name) VALUES (?)')->execute([$name]);
                flash('Kategorie „' . $name . '“ angelegt.');
            }
        } catch (PDOException $ex) {
            flash('Eine Kategorie mit diesem Namen existiert bereits.');
        }
    }
    redirect('index.php?page=inventory&action=categories');
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'delete_category') {
    $pdo->prepare('DELETE FROM inventory_categories WHERE id=?')->execute([(int)$_POST['category_id']]);
    flash('Kategorie gelöscht – zugeordnete Artikel bleiben erhalten (ohne Kategorie).');
    redirect('index.php?page=inventory&action=categories');
}

/* ---------- POST: Lagerort anlegen/umbenennen/löschen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'save_location') {
    $lid  = (int)($_POST['location_id'] ?? 0);
    $name = trim($_POST['loc_name'] ?? '');
    $note = trim($_POST['loc_note'] ?? '');
    if ($name === '') {
        flash('Bitte einen Namen für den Lagerort angeben.');
    } else {
        try {
            if ($lid) {
                $pdo->prepare('UPDATE inventory_locations SET name=?, note=? WHERE id=?')->execute([$name, $note ?: null, $lid]);
                flash('Lagerort gespeichert.');
            } else {
                $pdo->prepare('INSERT INTO inventory_locations (name, note) VALUES (?,?)')->execute([$name, $note ?: null]);
                flash('Lagerort „' . $name . '“ angelegt.');
            }
        } catch (PDOException $ex) {
            flash('Ein Lagerort mit diesem Namen existiert bereits.');
        }
    }
    redirect('index.php?page=inventory&action=locations');
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'delete_location') {
    $pdo->prepare('DELETE FROM inventory_locations WHERE id=?')->execute([(int)$_POST['location_id']]);
    flash('Lagerort gelöscht – zugeordnete Artikel bleiben erhalten (ohne Lagerort).');
    redirect('index.php?page=inventory&action=locations');
}

/* ---------- POST: Artikel löschen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'delete_item') {
    $pdo->prepare('DELETE FROM inventory_items WHERE id=?')->execute([(int)$_POST['id']]);
    flash('Artikel samt Historie gelöscht.');
    redirect('index.php?page=inventory');
}

/* ---------- POST: An Mitarbeiter ausgeben ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'assign') {
    $iid  = (int)$_POST['item_id'];
    $eid  = (int)$_POST['employee_id'];
    $note = trim($_POST['assigned_note'] ?? '');
    // Bereits offen ausgegeben?
    $st = $pdo->prepare("SELECT id FROM inventory_assignments WHERE item_id=? AND status<>'zurueck' LIMIT 1");
    $st->execute([$iid]);
    if ($st->fetch()) {
        flash('Dieser Artikel ist bereits ausgegeben. Bitte zuerst die Rückgabe bestätigen.');
    } elseif (!$eid) {
        flash('Bitte einen Mitarbeiter auswählen.');
    } else {
        $pdo->prepare('INSERT INTO inventory_assignments (item_id, employee_id, assigned_note) VALUES (?,?,?)')
            ->execute([$iid, $eid, $note]);
        flash('Artikel ausgegeben.');
    }
    redirect('index.php?page=inventory&action=view&id=' . $iid);
}

/* ---------- POST: Rückgabe buchen (Admin, direkt) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'report_return_admin') {
    $aid = (int)$_POST['assignment_id'];
    $st = $pdo->prepare("SELECT * FROM inventory_assignments WHERE id=? AND status='ausgegeben'");
    $st->execute([$aid]);
    if ($a = $st->fetch()) {
        $pdo->prepare("UPDATE inventory_assignments SET status='rueckgabe_gemeldet', return_reported_at=NOW(), return_note=? WHERE id=?")
            ->execute([trim($_POST['return_note'] ?? 'durch Verwaltung erfasst'), $aid]);
        flash('Rückgabe erfasst – bitte unten bestätigen, sobald der Artikel geprüft ist.');
        redirect('index.php?page=inventory&action=view&id=' . (int)$a['item_id']);
    }
    redirect('index.php?page=inventory');
}

/* ---------- POST: Rückgabe bestätigen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'confirm_return') {
    $aid = (int)$_POST['assignment_id'];
    $st = $pdo->prepare("SELECT * FROM inventory_assignments WHERE id=? AND status='rueckgabe_gemeldet'");
    $st->execute([$aid]);
    if ($a = $st->fetch()) {
        $pdo->prepare("UPDATE inventory_assignments SET status='zurueck', confirmed_at=NOW() WHERE id=?")->execute([$aid]);
        flash('Rückgabe bestätigt – Artikel ist wieder im Lager.');
        redirect('index.php?page=inventory&action=view&id=' . (int)$a['item_id']);
    }
    redirect('index.php?page=inventory');
}

$typeBadge = function (string $t): string {
    return $t === 'material'
        ? '<span class="badge badge-info">Material</span>'
        : '<span class="badge badge-quote">Gerät</span>';
};
$assignmentBadge = function (?string $s): string {
    return match ($s) {
        'ausgegeben'         => '<span class="badge badge-warning">ausgegeben</span>',
        'rueckgabe_gemeldet' => '<span class="badge badge-info">Rückgabe gemeldet</span>',
        'zurueck', null      => '<span class="badge badge-success">im Lager</span>',
        default              => e((string)$s),
    };
};

/* ---------- Ansicht: Formular ---------- */
if ($action === 'new' || $action === 'edit') {
    $item = ['id'=>0,'asset_id'=>'','name'=>'','item_type'=>'geraet','category_id'=>null,'location_id'=>null,'quantity'=>'1','unit'=>'Stk.','note'=>'','is_active'=>1];
    if ($action === 'edit' && $id) {
        $st = $pdo->prepare('SELECT * FROM inventory_items WHERE id=?');
        $st->execute([$id]);
        $item = $st->fetch() ?: $item;
    }
    $cats = $pdo->query('SELECT id, name FROM inventory_categories ORDER BY name')->fetchAll();
    $locs = $pdo->query('SELECT id, name FROM inventory_locations ORDER BY name')->fetchAll();
    layout_header($action === 'edit' ? 'Artikel bearbeiten' : 'Neuer Artikel', 'inventory');
    ?>
    <div class="page-head">
      <h1><?= $action === 'edit' ? 'Artikel bearbeiten' : 'Neuer Inventar-Artikel' ?></h1>
      <a class="btn btn-secondary" href="index.php?page=inventory">← Zum Inventar</a>
    </div>
    <div class="card">
      <form method="post" action="index.php?page=inventory">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="save_item">
        <input type="hidden" name="id" value="<?= (int)$item['id'] ?>">
        <div class="grid-2">
          <div class="field"><label>Asset-ID</label>
            <?php if ($action === 'edit'): ?>
              <input type="text" value="<?= e($item['asset_id']) ?>" disabled>
              <span class="hint">Die Asset-ID kann nachträglich nicht geändert werden.</span>
            <?php else: ?>
              <input type="text" name="asset_id" value="" placeholder="leer lassen = automatisch (<?= e(setting('inventory_prefix', 'INV')) ?>-<?= str_pad(setting('inventory_next', '1'), 4, '0', STR_PAD_LEFT) ?>)">
              <span class="hint">Leer lassen für automatische Nummer oder eigene ID eingeben (z. B. vorhandene Gerätenummer).</span>
            <?php endif; ?>
          </div>
          <div class="field"><label>Bezeichnung *</label>
            <input type="text" name="name" required value="<?= e($item['name']) ?>" placeholder="z. B. Rasenmäher Honda HRX, Schaufel, Rindenmulch 70 l"></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Typ</label>
            <select name="item_type">
              <option value="geraet" <?= $item['item_type'] === 'geraet' ? 'selected' : '' ?>>Arbeitsgerät</option>
              <option value="material" <?= $item['item_type'] === 'material' ? 'selected' : '' ?>>Material / Verbrauch</option>
            </select></div>
          <div class="field"><label>Menge</label>
            <input type="text" name="quantity" value="<?= e(rtrim(rtrim(number_format((float)$item['quantity'], 2, ',', ''), '0'), ',')) ?>"></div>
          <div class="field"><label>Einheit</label>
            <input type="text" name="unit" value="<?= e($item['unit']) ?>" placeholder="Stk., Sack, l, kg …"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Kategorie</label>
            <select name="category_id">
              <option value="">– keine Kategorie –</option>
              <?php foreach ($cats as $c): ?>
                <option value="<?= (int)$c['id'] ?>" <?= ($item['category_id'] ?? 0) == $c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option>
              <?php endforeach; ?>
            </select>
            <span class="hint">Kategorien verwalten: Inventar → „Kategorien“.</span></div>
          <div class="field"><label>Lagerort (wenn nicht bei Mitarbeiter)</label>
            <select name="location_id">
              <option value="">– kein Lagerort –</option>
              <?php foreach ($locs as $l): ?>
                <option value="<?= (int)$l['id'] ?>" <?= ($item['location_id'] ?? 0) == $l['id'] ? 'selected' : '' ?>><?= e($l['name']) ?></option>
              <?php endforeach; ?>
            </select>
            <span class="hint">Lagerorte verwalten: Inventar → „Lagerorte“.</span></div>
        </div>
        <div class="field"><label>Notiz (optional)</label>
          <textarea name="note" rows="2" placeholder="z. B. Seriennummer, Zustand, Lagerort"><?= e($item['note'] ?? '') ?></textarea></div>
        <div class="field" style="flex-direction:row; align-items:center; gap:0.5rem;">
          <input type="checkbox" name="is_active" id="inv-active" <?= $item['is_active'] ? 'checked' : '' ?> style="width:auto;">
          <label for="inv-active" style="margin:0;">aktiv (im Bestand)</label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit"><?= $action === 'edit' ? 'Speichern' : 'Artikel anlegen' ?></button>
          <a class="btn btn-secondary" href="index.php?page=inventory">Abbrechen</a>
        </div>
      </form>
    </div>
    <?php
    layout_footer();
    return;
}

/* ---------- Ansicht: Kategorien verwalten ---------- */
if ($action === 'categories') {
    $cats = $pdo->query('SELECT c.*, (SELECT COUNT(*) FROM inventory_items i WHERE i.category_id=c.id) AS cnt FROM inventory_categories c ORDER BY c.name')->fetchAll();
    layout_header('Inventar-Kategorien', 'inventory');
    ?>
    <div class="page-head">
      <h1>Kategorien <span class="sub">Inventar</span></h1>
      <a class="btn btn-secondary" href="index.php?page=inventory">← Zum Inventar</a>
    </div>
    <div class="card">
      <h2 class="subform-title">Neue Kategorie</h2>
      <form method="post" action="index.php?page=inventory" style="display:flex; gap:0.7rem; flex-wrap:wrap; align-items:flex-end;">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="save_category">
        <div class="field" style="margin:0; min-width:260px;"><label>Name *</label>
          <input type="text" name="cat_name" required placeholder="z. B. Gartengeräte, Werkzeug, Verbrauchsmaterial"></div>
        <button class="btn btn-primary" type="submit">Anlegen</button>
      </form>
    </div>
    <div class="table-wrap">
      <table class="list">
        <thead><tr><th>Name</th><th>Artikel</th><th class="actions">Aktionen</th></tr></thead>
        <tbody>
        <?php if (!$cats): ?>
          <tr><td colspan="3" class="hint" style="text-align:center; padding:1.4rem;">Noch keine Kategorien angelegt.</td></tr>
        <?php endif; ?>
        <?php foreach ($cats as $c): ?>
          <tr>
            <td>
              <form method="post" action="index.php?page=inventory" style="display:flex; gap:0.5rem; align-items:center;">
                <?= csrf_field() ?>
                <input type="hidden" name="do" value="save_category">
                <input type="hidden" name="category_id" value="<?= (int)$c['id'] ?>">
                <input type="text" name="cat_name" value="<?= e($c['name']) ?>" style="max-width:280px;">
                <button class="btn btn-sm btn-secondary" type="submit">Umbenennen</button>
              </form>
            </td>
            <td><a href="index.php?page=inventory&category=<?= (int)$c['id'] ?>"><?= (int)$c['cnt'] ?> Artikel</a></td>
            <td class="actions">
              <form method="post" action="index.php?page=inventory" onsubmit="return confirm('Kategorie „<?= e($c['name']) ?>“ löschen? Artikel bleiben erhalten.');" style="display:inline;">
                <?= csrf_field() ?>
                <input type="hidden" name="do" value="delete_category">
                <input type="hidden" name="category_id" value="<?= (int)$c['id'] ?>">
                <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php
    layout_footer();
    return;
}

/* ---------- Ansicht: Lagerorte verwalten ---------- */
if ($action === 'locations') {
    $locs = $pdo->query('SELECT l.*, (SELECT COUNT(*) FROM inventory_items i WHERE i.location_id=l.id) AS cnt FROM inventory_locations l ORDER BY l.name')->fetchAll();
    layout_header('Lagerorte', 'inventory');
    ?>
    <div class="page-head">
      <h1>Lagerorte <span class="sub">Inventar</span></h1>
      <a class="btn btn-secondary" href="index.php?page=inventory">← Zum Inventar</a>
    </div>
    <div class="card">
      <h2 class="subform-title">Neuer Lagerort</h2>
      <form method="post" action="index.php?page=inventory" style="display:flex; gap:0.7rem; flex-wrap:wrap; align-items:flex-end;">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="save_location">
        <div class="field" style="margin:0; min-width:220px;"><label>Name *</label>
          <input type="text" name="loc_name" required placeholder="z. B. Garage, Keller, Bus 1"></div>
        <div class="field" style="margin:0; min-width:260px;"><label>Notiz (optional)</label>
          <input type="text" name="loc_note" placeholder="z. B. Regal links, Schlüssel im Büro"></div>
        <button class="btn btn-primary" type="submit">Anlegen</button>
      </form>
    </div>
    <div class="table-wrap">
      <table class="list">
        <thead><tr><th>Name</th><th>Notiz</th><th>Artikel</th><th class="actions">Aktionen</th></tr></thead>
        <tbody>
        <?php if (!$locs): ?>
          <tr><td colspan="4" class="hint" style="text-align:center; padding:1.4rem;">Noch keine Lagerorte angelegt.</td></tr>
        <?php endif; ?>
        <?php foreach ($locs as $l): ?>
          <tr>
            <td>
              <form method="post" action="index.php?page=inventory" style="display:flex; gap:0.5rem; align-items:center;" id="loc-form-<?= (int)$l['id'] ?>">
                <?= csrf_field() ?>
                <input type="hidden" name="do" value="save_location">
                <input type="hidden" name="location_id" value="<?= (int)$l['id'] ?>">
                <input type="text" name="loc_name" value="<?= e($l['name']) ?>" style="max-width:220px;">
                <button class="btn btn-sm btn-secondary" type="submit">Speichern</button>
              </form>
            </td>
            <td><input type="text" name="loc_note" value="<?= e($l['note'] ?? '') ?>" form="loc-form-<?= (int)$l['id'] ?>" style="max-width:260px;"></td>
            <td><a href="index.php?page=inventory&location=<?= (int)$l['id'] ?>"><?= (int)$l['cnt'] ?> Artikel</a></td>
            <td class="actions">
              <form method="post" action="index.php?page=inventory" onsubmit="return confirm('Lagerort „<?= e($l['name']) ?>“ löschen? Artikel bleiben erhalten.');" style="display:inline;">
                <?= csrf_field() ?>
                <input type="hidden" name="do" value="delete_location">
                <input type="hidden" name="location_id" value="<?= (int)$l['id'] ?>">
                <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php
    layout_footer();
    return;
}

/* ---------- Ansicht: Detail mit Zuweisung + Historie ---------- */
if ($action === 'view' && $id) {
    $st = $pdo->prepare('SELECT i.*, c.name AS cat_name, l.name AS loc_name FROM inventory_items i
        LEFT JOIN inventory_categories c ON c.id = i.category_id
        LEFT JOIN inventory_locations l ON l.id = i.location_id
        WHERE i.id=?');
    $st->execute([$id]);
    $item = $st->fetch();
    if (!$item) { flash('Artikel nicht gefunden.'); redirect('index.php?page=inventory'); }

    $cur = $pdo->prepare("SELECT a.*, e.first_name, e.last_name FROM inventory_assignments a
        JOIN employees e ON e.id=a.employee_id WHERE a.item_id=? AND a.status<>'zurueck' LIMIT 1");
    $cur->execute([$id]);
    $current = $cur->fetch();

    $hist = $pdo->prepare('SELECT a.*, e.first_name, e.last_name FROM inventory_assignments a
        JOIN employees e ON e.id=a.employee_id WHERE a.item_id=? ORDER BY a.assigned_at DESC');
    $hist->execute([$id]);
    $history = $hist->fetchAll();

    $employees = $pdo->query('SELECT id, first_name, last_name FROM employees WHERE is_active=1 ORDER BY last_name')->fetchAll();

    layout_header('Inventar ' . $item['asset_id'], 'inventory');
    ?>
    <div class="page-head">
      <h1><?= e($item['asset_id']) ?> – <?= e($item['name']) ?></h1>
      <div>
        <a class="btn btn-secondary" href="index.php?page=inventory&action=edit&id=<?= $id ?>">Bearbeiten</a>
        <a class="btn btn-secondary" href="index.php?page=inventory">← Zum Inventar</a>
      </div>
    </div>

    <div class="card">
      <div class="day-ticket-head" style="margin-bottom:0.6rem">
        <?= $typeBadge($item['item_type']) ?>
        <?= $item['cat_name'] ? '<span class="badge badge-muted">' . e($item['cat_name']) . '</span>' : '' ?>
        <?= $assignmentBadge($current['status'] ?? null) ?>
        <?= $item['is_active'] ? '' : '<span class="badge badge-muted">inaktiv</span>' ?>
      </div>
      <p><strong>Menge:</strong> <?= e(rtrim(rtrim(number_format((float)$item['quantity'], 2, ',', '.'), '0'), ',')) ?> <?= e($item['unit']) ?></p>
      <?php if ($item['note']): ?><p style="margin-top:0.4rem"><strong>Notiz:</strong> <?= nl2br(e($item['note'])) ?></p><?php endif; ?>
      <?php if ($current): ?>
        <p style="margin-top:0.4rem"><strong>Derzeit bei:</strong> <?= e(trim($current['first_name'] . ' ' . $current['last_name'])) ?>
          (seit <?= date('d.m.Y H:i', strtotime($current['assigned_at'])) ?> Uhr)
          <?= $current['assigned_note'] ? '· ' . e($current['assigned_note']) : '' ?></p>
      <?php else: ?>
        <p style="margin-top:0.4rem"><strong>Lagerort:</strong> <?= $item['loc_name'] ? e($item['loc_name']) : '<span class="hint">nicht festgelegt</span>' ?>
          <span class="hint">– Artikel ist im Lager und kann ausgegeben werden.</span></p>
      <?php endif; ?>
    </div>

    <?php if ($current && $current['status'] === 'rueckgabe_gemeldet'): ?>
      <div class="card">
        <h2 class="subform-title">Rückgabe bestätigen</h2>
        <div class="alert alert-success" style="margin-bottom:0.7rem">
          <?= e(trim($current['first_name'] . ' ' . $current['last_name'])) ?> hat die Rückgabe gemeldet
          (<?= date('d.m.Y H:i', strtotime($current['return_reported_at'])) ?> Uhr)<?= $current['return_note'] ? ': „' . e($current['return_note']) . '“' : '.' ?>
        </div>
        <form method="post" action="index.php?page=inventory">
          <?= csrf_field() ?>
          <input type="hidden" name="do" value="confirm_return">
          <input type="hidden" name="assignment_id" value="<?= (int)$current['id'] ?>">
          <button class="btn btn-primary" type="submit">✓ Rückgabe bestätigen (wieder im Lager)</button>
        </form>
      </div>
    <?php elseif ($current && $current['status'] === 'ausgegeben'): ?>
      <div class="card">
        <h2 class="subform-title">Rückgabe erfassen</h2>
        <p class="hint">Normalerweise meldet der Mitarbeiter die Rückgabe selbst („Mein Tag“ → „Meine Geräte“). Die Verwaltung kann sie hier auch direkt erfassen – die Bestätigung ist danach trotzdem erforderlich.</p>
        <form method="post" action="index.php?page=inventory" style="margin-top:0.6rem">
          <?= csrf_field() ?>
          <input type="hidden" name="do" value="report_return_admin">
          <input type="hidden" name="assignment_id" value="<?= (int)$current['id'] ?>">
          <div class="field"><label>Anmerkung (optional)</label>
            <input type="text" name="return_note" placeholder="z. B. abgegeben im Lager, leichter Defekt"></div>
          <button class="btn btn-secondary" type="submit">Rückgabe erfassen</button>
        </form>
      </div>
    <?php elseif ($item['is_active']): ?>
      <div class="card">
        <h2 class="subform-title">An Mitarbeiter ausgeben</h2>
        <form method="post" action="index.php?page=inventory">
          <?= csrf_field() ?>
          <input type="hidden" name="do" value="assign">
          <input type="hidden" name="item_id" value="<?= $id ?>">
          <div class="grid-2">
            <div class="field"><label>Mitarbeiter *</label>
              <select name="employee_id" required>
                <option value="">– wählen –</option>
                <?php foreach ($employees as $em): ?>
                  <option value="<?= (int)$em['id'] ?>"><?= e(trim($em['first_name'] . ' ' . $em['last_name'])) ?></option>
                <?php endforeach; ?>
              </select></div>
            <div class="field"><label>Anmerkung (optional)</label>
              <input type="text" name="assigned_note" placeholder="z. B. für Objekt Musterstraße 1"></div>
          </div>
          <button class="btn btn-primary" type="submit">Ausgeben</button>
        </form>
      </div>
    <?php endif; ?>

    <div class="card">
      <h2 class="subform-title">Historie</h2>
      <?php if (!$history): ?>
        <p class="hint">Noch keine Ausgaben erfasst.</p>
      <?php else: ?>
      <div class="table-wrap" style="box-shadow:none;">
        <table class="list">
          <thead><tr><th>Mitarbeiter</th><th>Ausgegeben</th><th>Rückgabe gemeldet</th><th>Bestätigt</th><th>Status</th></tr></thead>
          <tbody>
          <?php foreach ($history as $h): ?>
            <tr>
              <td><strong><?= e(trim($h['first_name'] . ' ' . $h['last_name'])) ?></strong>
                <?= $h['assigned_note'] ? '<div class="hint">' . e($h['assigned_note']) . '</div>' : '' ?></td>
              <td><?= date('d.m.Y H:i', strtotime($h['assigned_at'])) ?></td>
              <td><?= $h['return_reported_at'] ? date('d.m.Y H:i', strtotime($h['return_reported_at'])) . ($h['return_note'] ? '<div class="hint">' . e($h['return_note']) . '</div>' : '') : '<span class="hint">–</span>' ?></td>
              <td><?= $h['confirmed_at'] ? date('d.m.Y H:i', strtotime($h['confirmed_at'])) : '<span class="hint">–</span>' ?></td>
              <td><?= $assignmentBadge($h['status']) ?></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <?php endif; ?>
    </div>

    <div class="card">
      <h2 class="subform-title">Artikel löschen</h2>
      <form method="post" action="index.php?page=inventory" onsubmit="return confirm('Artikel <?= e($item['asset_id']) ?> samt gesamter Historie löschen?');">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="delete_item">
        <input type="hidden" name="id" value="<?= $id ?>">
        <button class="btn btn-danger" type="submit">Artikel löschen</button>
      </form>
    </div>
    <?php
    layout_footer();
    return;
}

/* ---------- Ansicht: Liste ---------- */
$fStatus = $_GET['status'] ?? '';
$fType   = $_GET['type'] ?? '';
$fEmp    = (int)($_GET['employee'] ?? 0);
$fCat    = (int)($_GET['category'] ?? 0);
$fLoc    = (int)($_GET['location'] ?? 0);

$sql = "SELECT i.*, a.id AS ass_id, a.status AS ass_status, a.assigned_at,
          e.first_name AS e_first, e.last_name AS e_last,
          c.name AS cat_name, l.name AS loc_name
        FROM inventory_items i
        LEFT JOIN inventory_assignments a ON a.item_id = i.id AND a.status <> 'zurueck'
        LEFT JOIN employees e ON e.id = a.employee_id
        LEFT JOIN inventory_categories c ON c.id = i.category_id
        LEFT JOIN inventory_locations l ON l.id = i.location_id
        WHERE 1=1";
$params = [];
if ($fType === 'geraet' || $fType === 'material') { $sql .= ' AND i.item_type = ?'; $params[] = $fType; }
if ($fEmp) { $sql .= ' AND a.employee_id = ?'; $params[] = $fEmp; }
if ($fCat) { $sql .= ' AND i.category_id = ?'; $params[] = $fCat; }
if ($fLoc) { $sql .= ' AND i.location_id = ?'; $params[] = $fLoc; }
if ($fStatus === 'lager')     { $sql .= ' AND a.id IS NULL AND i.is_active = 1'; }
if ($fStatus === 'draussen')  { $sql .= " AND a.status = 'ausgegeben'"; }
if ($fStatus === 'wartet')    { $sql .= " AND a.status = 'rueckgabe_gemeldet'"; }
$sql .= ' ORDER BY i.asset_id';
$st = $pdo->prepare($sql);
$st->execute($params);
$items = $st->fetchAll();

$employees = $pdo->query('SELECT id, first_name, last_name FROM employees ORDER BY last_name')->fetchAll();
$cats = $pdo->query('SELECT id, name FROM inventory_categories ORDER BY name')->fetchAll();
$locs = $pdo->query('SELECT id, name FROM inventory_locations ORDER BY name')->fetchAll();
$pendingCount = (int)$pdo->query("SELECT COUNT(*) FROM inventory_assignments WHERE status='rueckgabe_gemeldet'")->fetchColumn();

layout_header('Inventar', 'inventory');
?>
<div class="page-head">
  <h1>Inventar <span class="sub">Arbeitsgeräte & Material</span></h1>
  <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
    <a class="btn btn-secondary" href="index.php?page=inventory&action=categories">Kategorien</a>
    <a class="btn btn-secondary" href="index.php?page=inventory&action=locations">Lagerorte</a>
    <a class="btn btn-primary" href="index.php?page=inventory&action=new">+ Neuer Artikel</a>
  </div>
</div>

<?php if ($pendingCount): ?>
  <div class="alert alert-success"><?= $pendingCount ?> Rückgabe<?= $pendingCount > 1 ? 'n' : '' ?> wartet<?= $pendingCount > 1 ? 'en' : '' ?> auf Bestätigung – unten gelb markiert bzw. über den Filter „Rückgabe gemeldet“ zu finden.</div>
<?php endif; ?>

<div class="card" style="padding:0.9rem 1.4rem;">
  <form method="get" action="index.php" style="display:flex; gap:0.7rem; flex-wrap:wrap; align-items:flex-end;">
    <input type="hidden" name="page" value="inventory">
    <div class="field" style="margin:0; min-width:160px;"><label>Status</label>
      <select name="status" onchange="this.form.submit()">
        <option value="">alle</option>
        <option value="lager" <?= $fStatus === 'lager' ? 'selected' : '' ?>>im Lager</option>
        <option value="draussen" <?= $fStatus === 'draussen' ? 'selected' : '' ?>>ausgegeben</option>
        <option value="wartet" <?= $fStatus === 'wartet' ? 'selected' : '' ?>>Rückgabe gemeldet</option>
      </select></div>
    <div class="field" style="margin:0; min-width:150px;"><label>Typ</label>
      <select name="type" onchange="this.form.submit()">
        <option value="">alle</option>
        <option value="geraet" <?= $fType === 'geraet' ? 'selected' : '' ?>>Arbeitsgeräte</option>
        <option value="material" <?= $fType === 'material' ? 'selected' : '' ?>>Material</option>
      </select></div>
    <div class="field" style="margin:0; min-width:170px;"><label>Kategorie</label>
      <select name="category" onchange="this.form.submit()">
        <option value="0">alle</option>
        <?php foreach ($cats as $c): ?>
          <option value="<?= (int)$c['id'] ?>" <?= $fCat === (int)$c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option>
        <?php endforeach; ?>
      </select></div>
    <div class="field" style="margin:0; min-width:170px;"><label>Lagerort</label>
      <select name="location" onchange="this.form.submit()">
        <option value="0">alle</option>
        <?php foreach ($locs as $l): ?>
          <option value="<?= (int)$l['id'] ?>" <?= $fLoc === (int)$l['id'] ? 'selected' : '' ?>><?= e($l['name']) ?></option>
        <?php endforeach; ?>
      </select></div>
    <div class="field" style="margin:0; min-width:190px;"><label>Mitarbeiter</label>
      <select name="employee" onchange="this.form.submit()">
        <option value="0">alle</option>
        <?php foreach ($employees as $em): ?>
          <option value="<?= (int)$em['id'] ?>" <?= $fEmp === (int)$em['id'] ? 'selected' : '' ?>><?= e(trim($em['first_name'] . ' ' . $em['last_name'])) ?></option>
        <?php endforeach; ?>
      </select></div>
    <noscript><button class="btn btn-sm btn-secondary" type="submit">Filtern</button></noscript>
  </form>
</div>

<div class="table-wrap">
  <table class="list">
    <thead><tr><th>Asset-ID</th><th>Bezeichnung</th><th>Typ</th><th>Menge</th><th>Wo / bei wem</th><th>Status</th><th class="actions">Aktionen</th></tr></thead>
    <tbody>
    <?php if (!$items): ?>
      <tr><td colspan="7" class="hint" style="text-align:center; padding:1.4rem;">Keine Artikel gefunden. Über „+ Neuer Artikel“ das erste Gerät oder Material anlegen.</td></tr>
    <?php endif; ?>
    <?php foreach ($items as $it): ?>
      <tr>
        <td><strong><?= e($it['asset_id']) ?></strong></td>
        <td><?= e($it['name']) ?><?= $it['cat_name'] ? ' <span class="badge badge-muted">' . e($it['cat_name']) . '</span>' : '' ?><?= $it['is_active'] ? '' : ' <span class="badge badge-muted">inaktiv</span>' ?></td>
        <td><?= $typeBadge($it['item_type']) ?></td>
        <td><?= e(rtrim(rtrim(number_format((float)$it['quantity'], 2, ',', '.'), '0'), ',')) ?> <?= e($it['unit']) ?></td>
        <td><?= $it['ass_id']
            ? e(trim($it['e_first'] . ' ' . $it['e_last'])) . ' <span class="hint">(seit ' . date('d.m.', strtotime($it['assigned_at'])) . ')</span>'
            : ($it['loc_name'] ? e($it['loc_name']) : '<span class="hint">Lager</span>') ?></td>
        <td><?= $assignmentBadge($it['ass_status']) ?></td>
        <td class="actions">
          <a class="btn btn-sm btn-secondary" href="index.php?page=inventory&action=view&id=<?= (int)$it['id'] ?>">Öffnen</a>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php layout_footer(); ?>
