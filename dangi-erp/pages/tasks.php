<?php
/**
 * DANGI ERP – Aufgaben (To-do-Liste)
 * Dringlichkeit (hoch/mittel/niedrig), Titel, Beschreibung,
 * Status (offen/in Arbeit/erledigt), optionales Zieldatum.
 * CI: Türkis (#0FA7A0), Anthrazit (#3B4757)
 */
$pdo = db();
$action = $_GET['action'] ?? 'list';
$id = (int)($_GET['id'] ?? 0);

$prioLabels   = ['hoch' => 'Hoch', 'mittel' => 'Mittel', 'niedrig' => 'Niedrig'];
$statusLabels = ['offen' => 'Offen', 'in_arbeit' => 'In Arbeit', 'erledigt' => 'Erledigt'];

/* ---------- Aufgabe speichern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === 'new' || $action === 'edit')) {
    $priority    = array_key_exists($_POST['priority'] ?? '', $prioLabels) ? $_POST['priority'] : 'mittel';
    $status      = array_key_exists($_POST['status'] ?? '', $statusLabels) ? $_POST['status'] : 'offen';
    $title       = trim($_POST['title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $dueDate     = trim($_POST['due_date'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) { $dueDate = null; }

    if ($title === '') {
        flash('Bitte einen Titel angeben.');
    } else {
        $doneAt = $status === 'erledigt' ? date('Y-m-d H:i:s') : null;
        if ($action === 'edit' && $id) {
            // done_at nur setzen, wenn Status neu auf erledigt wechselt
            $st = $pdo->prepare('SELECT status, done_at FROM tasks WHERE id = ?');
            $st->execute([$id]);
            $old = $st->fetch();
            if ($old && $old['status'] === 'erledigt' && $status === 'erledigt') { $doneAt = $old['done_at']; }
            $st = $pdo->prepare('UPDATE tasks SET priority=?, title=?, description=?, status=?, due_date=?, done_at=? WHERE id=?');
            $st->execute([$priority, $title, $description, $status, $dueDate, $doneAt, $id]);
            flash('Aufgabe aktualisiert.');
        } else {
            $st = $pdo->prepare('INSERT INTO tasks (priority, title, description, status, due_date, done_at) VALUES (?,?,?,?,?,?)');
            $st->execute([$priority, $title, $description, $status, $dueDate, $doneAt]);
            flash('Aufgabe angelegt.');
        }
        redirect('index.php?page=tasks');
    }
}

/* ---------- Aufgabe löschen ---------- */
if ($action === 'delete' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo->prepare('DELETE FROM tasks WHERE id = ?')->execute([$id]);
    flash('Aufgabe gelöscht.');
    redirect('index.php?page=tasks');
}

/* ---------- Status-Schnellwechsel ---------- */
if ($action === 'status' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $to = $_GET['to'] ?? '';
    if (array_key_exists($to, $statusLabels)) {
        $doneAt = $to === 'erledigt' ? date('Y-m-d H:i:s') : null;
        $pdo->prepare('UPDATE tasks SET status = ?, done_at = ? WHERE id = ?')->execute([$to, $doneAt, $id]);
    }
    redirect('index.php?page=tasks' . (isset($_GET['filter']) ? '&filter=' . urlencode($_GET['filter']) : ''));
}

/* ---------- Formular (neu/bearbeiten) ---------- */
if ($action === 'new' || $action === 'edit') {
    $t = ['priority'=>'mittel','title'=>'','description'=>'','status'=>'offen','due_date'=>''];
    if ($action === 'edit' && $id) {
        $st = $pdo->prepare('SELECT * FROM tasks WHERE id = ?');
        $st->execute([$id]);
        $t = $st->fetch() ?: $t;
    }
    layout_header($action === 'edit' ? 'Aufgabe bearbeiten' : 'Neue Aufgabe', 'tasks');
    ?>
    <div class="page-head">
      <h1><?= $action === 'edit' ? 'Aufgabe bearbeiten' : 'Neue Aufgabe' ?></h1>
      <a class="btn btn-secondary" href="index.php?page=tasks">← Zur Aufgabenliste</a>
    </div>
    <div class="card">
      <form method="post">
        <?= csrf_field() ?>
        <div class="field"><label>Titel *</label>
          <input type="text" name="title" required value="<?= e($t['title']) ?>" placeholder="z. B. Angebot für Hausverwaltung Muster nachfassen"></div>
        <div class="field"><label>Beschreibung</label>
          <textarea name="description" rows="4" placeholder="Details zur Aufgabe (optional)"><?= e($t['description'] ?? '') ?></textarea></div>
        <div class="grid-3">
          <div class="field"><label>Dringlichkeit *</label>
            <select name="priority">
              <?php foreach ($prioLabels as $k => $lbl): ?>
              <option value="<?= $k ?>" <?= $t['priority'] === $k ? 'selected' : '' ?>><?= $lbl ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field"><label>Status *</label>
            <select name="status">
              <?php foreach ($statusLabels as $k => $lbl): ?>
              <option value="<?= $k ?>" <?= $t['status'] === $k ? 'selected' : '' ?>><?= $lbl ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field"><label>Zieldatum (optional)</label>
            <input type="date" name="due_date" value="<?= e($t['due_date'] ?? '') ?>"></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit"><?= $action === 'edit' ? 'Speichern' : 'Aufgabe anlegen' ?></button>
          <a class="btn btn-secondary" href="index.php?page=tasks">Abbrechen</a>
        </div>
      </form>
    </div>
    <?php
    layout_footer();
    return;
}

/* ---------- Liste ---------- */
$filter = $_GET['filter'] ?? 'aktiv';
if (!in_array($filter, ['aktiv', 'alle', 'erledigt'], true)) { $filter = 'aktiv'; }

$where = '';
if ($filter === 'aktiv')    { $where = "WHERE status <> 'erledigt'"; }
if ($filter === 'erledigt') { $where = "WHERE status = 'erledigt'"; }

$rows = $pdo->query("SELECT * FROM tasks $where
  ORDER BY FIELD(status,'offen','in_arbeit','erledigt'),
           FIELD(priority,'hoch','mittel','niedrig'),
           (due_date IS NULL), due_date ASC, id DESC")->fetchAll();

$counts = $pdo->query("SELECT
    SUM(status <> 'erledigt') AS aktiv,
    SUM(status = 'erledigt') AS erledigt,
    SUM(status <> 'erledigt' AND due_date IS NOT NULL AND due_date < CURDATE()) AS ueberfaellig,
    COUNT(*) AS gesamt
  FROM tasks")->fetch();

$today = date('Y-m-d');
layout_header('Aufgaben', 'tasks');
?>
<div class="page-head">
  <h1>Aufgaben <span class="sub">To-do-Liste</span></h1>
  <a class="btn btn-primary" href="index.php?page=tasks&action=new">+ Neue Aufgabe</a>
</div>

<div class="stat-grid">
  <div class="stat"><div class="label">Offen / in Arbeit</div><div class="value"><?= (int)$counts['aktiv'] ?></div></div>
  <div class="stat" style="border-left-color:#C0392B"><div class="label">Überfällig</div><div class="value" style="color:#C0392B"><?= (int)$counts['ueberfaellig'] ?></div></div>
  <div class="stat" style="border-left-color:#1E8E5A"><div class="label">Erledigt</div><div class="value"><?= (int)$counts['erledigt'] ?></div></div>
  <div class="stat" style="border-left-color:#3B4757"><div class="label">Gesamt</div><div class="value"><?= (int)$counts['gesamt'] ?></div></div>
</div>

<div class="card" style="padding:0.8rem 1.4rem; display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
  <span class="hint" style="margin-right:0.4rem;">Anzeigen:</span>
  <a class="btn btn-sm <?= $filter === 'aktiv' ? 'btn-primary' : 'btn-secondary' ?>" href="index.php?page=tasks&filter=aktiv">Aktive</a>
  <a class="btn btn-sm <?= $filter === 'erledigt' ? 'btn-primary' : 'btn-secondary' ?>" href="index.php?page=tasks&filter=erledigt">Erledigte</a>
  <a class="btn btn-sm <?= $filter === 'alle' ? 'btn-primary' : 'btn-secondary' ?>" href="index.php?page=tasks&filter=alle">Alle</a>
</div>

<?php if (!$rows): ?>
<div class="card"><p class="hint">Keine Aufgaben in dieser Ansicht. Lege mit „+ Neue Aufgabe" die erste an.</p></div>
<?php else: ?>
<div class="table-wrap">
  <table class="list">
    <thead><tr>
      <th style="width:40px;"></th><th>Aufgabe</th><th>Dringlichkeit</th><th>Zieldatum</th><th>Status</th><th class="actions">Aktionen</th>
    </tr></thead>
    <tbody>
    <?php foreach ($rows as $t):
        $done = $t['status'] === 'erledigt';
        $overdue = !$done && $t['due_date'] && $t['due_date'] < $today;
        $next = $t['status'] === 'offen' ? 'in_arbeit' : ($t['status'] === 'in_arbeit' ? 'erledigt' : 'offen');
    ?>
      <tr>
        <td>
          <form method="post" action="index.php?page=tasks&action=status&id=<?= $t['id'] ?>&to=<?= $done ? 'offen' : 'erledigt' ?>&filter=<?= e($filter) ?>" style="display:inline">
            <?= csrf_field() ?>
            <button type="submit" class="paid-toggle <?= $done ? 'is-paid' : '' ?>" title="<?= $done ? 'Wieder öffnen' : 'Als erledigt markieren' ?>"><?= $done ? '✓' : '' ?></button>
          </form>
        </td>
        <td>
          <strong style="<?= $done ? 'text-decoration:line-through;color:#6B7684;' : '' ?>"><?= e($t['title']) ?></strong>
          <?php if (!empty($t['description'])): ?><div class="hint" style="white-space:pre-line;"><?= e(mb_strimwidth($t['description'], 0, 180, '…')) ?></div><?php endif; ?>
        </td>
        <td><span class="badge prio-<?= $t['priority'] ?>"><?= $prioLabels[$t['priority']] ?></span></td>
        <td>
          <?php if ($t['due_date']): ?>
            <span style="<?= $overdue ? 'color:#C0392B;font-weight:700;' : '' ?>"><?= date('d.m.Y', strtotime($t['due_date'])) ?><?= $overdue ? ' ⚠' : '' ?></span>
          <?php else: ?><span class="hint">–</span><?php endif; ?>
        </td>
        <td><span class="badge status-<?= $t['status'] ?>"><?= $statusLabels[$t['status']] ?></span></td>
        <td class="actions">
          <?php if (!$done): ?>
          <form method="post" action="index.php?page=tasks&action=status&id=<?= $t['id'] ?>&to=<?= $next ?>&filter=<?= e($filter) ?>" style="display:inline">
            <?= csrf_field() ?>
            <button type="submit" class="btn btn-sm btn-secondary"><?= $next === 'in_arbeit' ? '→ In Arbeit' : '→ Erledigt' ?></button>
          </form>
          <?php endif; ?>
          <a class="btn btn-sm btn-secondary" href="index.php?page=tasks&action=edit&id=<?= $t['id'] ?>">Bearbeiten</a>
          <form method="post" action="index.php?page=tasks&action=delete&id=<?= $t['id'] ?>" style="display:inline" onsubmit="return confirm('Aufgabe wirklich löschen?');">
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
<?php layout_footer(); ?>
