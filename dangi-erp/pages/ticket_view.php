<?php
/**
 * DANGI ERP – Auftragsdetail für Mitarbeiter
 * Karte (MapLibre, lokal), Workflow: offen → in Arbeit → (Fotos + Bericht) →
 * beendet → Zeitbuchung im 15-Minuten-Takt → nächster Auftrag startbar.
 */
$emp = current_employee();
$isEmployee = $emp !== null;
if (!$isEmployee && !is_admin()) { redirect('index.php?page=login'); }
// Chef-Modus: Admin mit verknüpftem Mitarbeiter-Account darf eigene Aufträge abarbeiten
if (!$isEmployee && is_admin()) {
    $we = working_employee();
    if ($we !== null) { $emp = $we; }
}

$id = (int)($_GET['id'] ?? 0);
$st = db()->prepare('SELECT t.*, c.company, c.first_name AS c_first, c.last_name AS c_last, c.phone AS c_phone,
    (SELECT COALESCE(SUM(hours),0) FROM ticket_times x WHERE x.ticket_id=t.id) AS total_hours
  FROM tickets t LEFT JOIN customers c ON c.id=t.customer_id WHERE t.id=?');
$st->execute([$id]);
$t = $st->fetch();

if (!$t || ($isEmployee && (int)$t['employee_id'] !== (int)$emp['id'])) {
    flash('Auftrag nicht gefunden.');
    redirect($isEmployee ? 'index.php?page=my_day' : 'index.php?page=tickets');
}

// Arbeitsmodus: echter Mitarbeiter ODER Chef, dem dieser Auftrag selbst zugewiesen ist
$actsAsWorker = $isEmployee || ($emp !== null && (int)$t['employee_id'] === (int)$emp['id']);
$empId = $actsAsWorker ? (int)$emp['id'] : (int)($t['employee_id'] ?? 0);

/* Hilfsfunktionen für Workflow-Sperren */
function has_other_in_work(int $empId, int $exceptTicket): ?array {
    $st = db()->prepare("SELECT id, ticket_number FROM tickets WHERE employee_id=? AND status='in_arbeit' AND id<>? LIMIT 1");
    $st->execute([$empId, $exceptTicket]);
    return $st->fetch() ?: null;
}
function has_unbooked_finished(int $empId, int $exceptTicket): ?array {
    $st = db()->prepare("SELECT t.id, t.ticket_number FROM tickets t
      WHERE t.employee_id=? AND t.status='beendet' AND t.id<>?
        AND NOT EXISTS (SELECT 1 FROM ticket_times x WHERE x.ticket_id=t.id) LIMIT 1");
    $st->execute([$empId, $exceptTicket]);
    return $st->fetch() ?: null;
}

/* ---------- POST: Workflow-Aktionen (nur zugewiesener Mitarbeiter) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $actsAsWorker) {
    $do = $_POST['do'] ?? '';

    if ($do === 'start_ticket' && $t['status'] === 'offen') {
        if ($o = has_other_in_work($empId, $id)) {
            flash('Du hast bereits Auftrag ' . $o['ticket_number'] . ' in Arbeit. Bitte zuerst beenden.');
        } elseif ($o = has_unbooked_finished($empId, $id)) {
            flash('Bitte zuerst die Zeit für Auftrag ' . $o['ticket_number'] . ' buchen, dann kannst du den nächsten starten.');
        } else {
            db()->prepare("UPDATE tickets SET status='in_arbeit', started_at=NOW() WHERE id=?")->execute([$id]);
            flash('Auftrag gestartet – gutes Gelingen!');
        }
        redirect('index.php?page=ticket_view&id=' . $id);
    }

    if ($do === 'upload_photos' && in_array($t['status'], ['in_arbeit','beendet'], true)) {
        $count = 0;
        $allowed = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif','image/heic'=>'heic','image/heif'=>'heic'];
        $dir = __DIR__ . '/../uploads/tickets/';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        foreach (($_FILES['photos']['name'] ?? []) as $i => $name) {
            if (($_FILES['photos']['error'][$i] ?? 1) !== UPLOAD_ERR_OK) continue;
            $tmp  = $_FILES['photos']['tmp_name'][$i];
            $size = (int)$_FILES['photos']['size'][$i];
            if ($size > 10 * 1024 * 1024) { flash('Ein Foto war größer als 10 MB und wurde übersprungen.'); continue; }
            $mime = mime_content_type($tmp) ?: '';
            if (!isset($allowed[$mime])) continue;
            $stored = 'tk' . $id . '_' . bin2hex(random_bytes(8)) . '.' . $allowed[$mime];
            if (move_uploaded_file($tmp, $dir . $stored)) {
                db()->prepare('INSERT INTO ticket_photos (ticket_id, employee_id, stored_name, original_name, mime_type, size_bytes) VALUES (?,?,?,?,?,?)')
                   ->execute([$id, $empId, $stored, $name, $mime, $size]);
                $count++;
            }
        }
        flash($count ? $count . ' Foto(s) hochgeladen.' : 'Keine gültigen Fotos ausgewählt (JPG, PNG, WebP, HEIC bis 10 MB).');
        redirect('index.php?page=ticket_view&id=' . $id);
    }

    if ($do === 'delete_photo' && in_array($t['status'], ['in_arbeit','beendet'], true)) {
        $pid = (int)$_POST['photo_id'];
        $st2 = db()->prepare('SELECT stored_name FROM ticket_photos WHERE id=? AND ticket_id=?');
        $st2->execute([$pid, $id]);
        if ($p = $st2->fetch()) {
            $f = __DIR__ . '/../uploads/tickets/' . $p['stored_name'];
            if (is_file($f)) @unlink($f);
            db()->prepare('DELETE FROM ticket_photos WHERE id=?')->execute([$pid]);
            flash('Foto gelöscht.');
        }
        redirect('index.php?page=ticket_view&id=' . $id);
    }

    if ($do === 'save_report' && in_array($t['status'], ['in_arbeit','beendet'], true)) {
        db()->prepare('UPDATE tickets SET work_report=? WHERE id=?')->execute([trim($_POST['work_report'] ?? ''), $id]);
        flash('Tätigkeitsbeschreibung gespeichert.');
        redirect('index.php?page=ticket_view&id=' . $id);
    }

    if ($do === 'finish_ticket' && $t['status'] === 'in_arbeit') {
        $photoCount = (int)db()->query('SELECT COUNT(*) FROM ticket_photos WHERE ticket_id=' . $id)->fetchColumn();
        $report = trim($_POST['work_report'] ?? $t['work_report'] ?? '');
        if ($report !== '') {
            db()->prepare('UPDATE tickets SET work_report=? WHERE id=?')->execute([$report, $id]);
        }
        if ($photoCount < 1) {
            flash('Bitte zuerst mindestens ein Foto zur Dokumentation hochladen.');
        } elseif ($report === '') {
            flash('Bitte zuerst deine Tätigkeit beschreiben.');
        } else {
            db()->prepare("UPDATE tickets SET status='beendet', finished_at=NOW() WHERE id=?")->execute([$id]);
            flash('Auftrag beendet. Bitte jetzt deine Arbeitszeit buchen.');
        }
        redirect('index.php?page=ticket_view&id=' . $id);
    }

    if ($do === 'book_time' && in_array($t['status'], ['beendet','abgerechnet'], true)) {
        $df = $_POST['date_from'] ?? $t['work_date'];
        $tf = $_POST['time_from'] ?? '';
        $tt = $_POST['time_to'] ?? '';
        $ok = preg_match('/^\d{2}:(00|15|30|45)$/', $tf) && preg_match('/^\d{2}:(00|15|30|45)$/', $tt);
        if (!$ok) {
            flash('Zeiten bitte im 15-Minuten-Takt angeben (z. B. 08:00, 08:15, 08:30, 08:45).');
        } else {
            $from = $df . ' ' . $tf . ':00';
            $to   = $df . ' ' . $tt . ':00';
            if (strtotime($to) <= strtotime($from)) {
                flash('„Bis" muss nach „Von" liegen.');
            } else {
                $hours = (strtotime($to) - strtotime($from)) / 3600;
                db()->prepare('INSERT INTO ticket_times (ticket_id, employee_id, time_from, time_to, hours) VALUES (?,?,?,?,?)')
                   ->execute([$id, $empId, $from, $to, $hours]);
                flash('Zeit gebucht: ' . number_format($hours, 2, ',', '.') . ' Std.');
            }
        }
        redirect('index.php?page=ticket_view&id=' . $id);
    }

    if ($do === 'delete_time' && $t['status'] === 'beendet') {
        db()->prepare('DELETE FROM ticket_times WHERE id=? AND ticket_id=?')->execute([(int)$_POST['time_id'], $id]);
        flash('Zeitbuchung gelöscht.');
        redirect('index.php?page=ticket_view&id=' . $id);
    }
}

/* Daten neu laden nach Aktionen */
$st->execute([$id]);
$t = $st->fetch();
$photos = db()->prepare('SELECT * FROM ticket_photos WHERE ticket_id=? ORDER BY created_at');
$photos->execute([$id]);
$photos = $photos->fetchAll();
$times = db()->prepare('SELECT * FROM ticket_times WHERE ticket_id=? ORDER BY time_from');
$times->execute([$id]);
$times = $times->fetchAll();

$otherInWork     = $empId ? has_other_in_work($empId, $id) : null;
$unbookedOther   = $empId ? has_unbooked_finished($empId, $id) : null;
$canStart        = $t['status'] === 'offen' && !$otherInWork && !$unbookedOther;
$hasCoords       = $t['lat'] !== null && $t['lng'] !== null;
$address         = trim($t['address_street'] . ', ' . $t['address_zip'] . ' ' . $t['address_city'], ', ');

$statusBadge = function (string $s): string {
    return match ($s) {
        'offen'       => '<span class="badge badge-muted">offen</span>',
        'in_arbeit'   => '<span class="badge badge-warning">in Arbeit</span>',
        'beendet'     => '<span class="badge badge-success">beendet</span>',
        'abgerechnet' => '<span class="badge badge-info">abgerechnet</span>',
        default       => e($s),
    };
};

layout_header('Auftrag ' . $t['ticket_number'], $isEmployee ? 'my_day' : 'tickets');
?>
<?php if ($hasCoords): ?><link rel="stylesheet" href="assets/vendor/maplibre-gl.css"><?php endif; ?>

<div class="page-head">
  <h1><?= e($t['ticket_number']) ?> – <?= e($t['title']) ?></h1>
  <a class="btn btn-secondary" href="<?= $isEmployee ? 'index.php?page=my_day&date=' . e($t['work_date']) : 'index.php?page=tickets' ?>">← Zurück</a>
</div>

<div class="card">
  <div class="day-ticket-head" style="margin-bottom:0.6rem">
    <?= $statusBadge($t['status']) ?>
    <span class="hint"><?= dmy($t['work_date']) ?><?= $t['time_from'] ? ' · ' . substr($t['time_from'],0,5) . ($t['time_to'] ? '–' . substr($t['time_to'],0,5) : '') . ' Uhr' : '' ?></span>
  </div>
  <?php if ($t['customer_id']): ?>
    <p><strong>Kunde:</strong> <?= e($t['company'] ?: trim($t['c_first'] . ' ' . $t['c_last'])) ?><?= $t['c_phone'] ? ' · <a href="tel:' . e(preg_replace('/[^0-9+]/', '', $t['c_phone'])) . '">' . e($t['c_phone']) . '</a>' : '' ?></p>
  <?php endif; ?>
  <?php if ($address): ?><p><strong>Adresse:</strong> <?= e($address) ?></p><?php endif; ?>
  <?php if ($t['description']): ?><p style="margin-top:0.5rem"><?= nl2br(e($t['description'])) ?></p><?php endif; ?>

  <?php if ($hasCoords): ?>
    <div id="map" class="ticket-map"></div>
  <?php elseif ($address): ?>
    <p class="hint">Für diese Adresse liegen noch keine Kartenkoordinaten vor.</p>
  <?php endif; ?>
</div>

<?php if ($actsAsWorker): ?>

  <?php if ($t['status'] === 'offen'): ?>
    <div class="card">
      <h2 class="subform-title">Auftrag starten</h2>
      <?php if ($otherInWork): ?>
        <div class="alert alert-error">Du hast Auftrag <strong><?= e($otherInWork['ticket_number']) ?></strong> in Arbeit. Bitte zuerst beenden. <a href="index.php?page=ticket_view&id=<?= (int)$otherInWork['id'] ?>">Dorthin →</a></div>
      <?php elseif ($unbookedOther): ?>
        <div class="alert alert-error">Für Auftrag <strong><?= e($unbookedOther['ticket_number']) ?></strong> fehlt noch die Zeitbuchung. Erst danach kannst du diesen Auftrag starten. <a href="index.php?page=ticket_view&id=<?= (int)$unbookedOther['id'] ?>">Zeit buchen →</a></div>
      <?php else: ?>
        <p class="hint">Wenn du vor Ort bist, stelle den Auftrag auf „In Arbeit".</p>
        <form method="post"><?= csrf_field() ?><input type="hidden" name="do" value="start_ticket">
          <button class="btn btn-primary" type="submit" style="width:100%;padding:0.9rem">▶ Jetzt starten (in Arbeit)</button>
        </form>
      <?php endif; ?>
    </div>
  <?php endif; ?>

  <?php if (in_array($t['status'], ['in_arbeit','beendet'], true)): ?>
    <div class="card">
      <h2 class="subform-title">Fotodokumentation (<?= count($photos) ?>)</h2>
      <?php if ($photos): ?>
        <div class="photo-grid">
          <?php foreach ($photos as $p): ?>
            <div class="photo-item">
              <a href="index.php?page=ticket_photo&id=<?= (int)$p['id'] ?>" target="_blank">
                <img src="index.php?page=ticket_photo&id=<?= (int)$p['id'] ?>" alt="<?= e($p['original_name']) ?>" loading="lazy">
              </a>
              <form method="post" onsubmit="return confirm('Foto löschen?')">
                <?= csrf_field() ?>
                <input type="hidden" name="do" value="delete_photo">
                <input type="hidden" name="photo_id" value="<?= (int)$p['id'] ?>">
                <button class="photo-delete" type="submit" title="Foto löschen">×</button>
              </form>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
      <form method="post" enctype="multipart/form-data" style="margin-top:0.8rem">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="upload_photos">
        <div class="field">
          <label>Fotos hochladen (mehrere möglich, je max. 10 MB)</label>
          <input type="file" name="photos[]" accept="image/*" capture="environment" multiple required>
        </div>
        <button class="btn btn-secondary" type="submit">Fotos hochladen</button>
      </form>
    </div>

    <div class="card">
      <h2 class="subform-title">Tätigkeitsbeschreibung</h2>
      <form method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="<?= $t['status'] === 'in_arbeit' ? 'save_report' : 'save_report' ?>">
        <div class="field">
          <textarea name="work_report" rows="4" placeholder="Was wurde gemacht? z. B. Stiegenhaus gereinigt, Müllraum ausgewaschen, Glasflächen im EG geputzt …"><?= e($t['work_report'] ?? '') ?></textarea>
        </div>
        <button class="btn btn-secondary" type="submit">Beschreibung speichern</button>
      </form>
    </div>
  <?php endif; ?>

  <?php if ($t['status'] === 'in_arbeit'): ?>
    <div class="card">
      <h2 class="subform-title">Auftrag beenden</h2>
      <?php $photoCount = count($photos); $hasReport = trim((string)$t['work_report']) !== ''; ?>
      <p class="hint">Voraussetzungen: mindestens 1 Foto (<?= $photoCount ?> vorhanden<?= $photoCount ? ' ✓' : '' ?>) und eine Tätigkeitsbeschreibung<?= $hasReport ? ' ✓' : '' ?>.</p>
      <form method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="finish_ticket">
        <button class="btn btn-primary" type="submit" style="width:100%;padding:0.9rem" <?= ($photoCount && $hasReport) ? '' : 'disabled title="Bitte zuerst Fotos und Beschreibung erfassen"' ?>>■ Auftrag beenden</button>
      </form>
    </div>
  <?php endif; ?>

  <?php if (in_array($t['status'], ['beendet','abgerechnet'], true)): ?>
    <div class="card">
      <h2 class="subform-title">Arbeitszeit buchen (15-Minuten-Takt)</h2>
      <?php if ($times): ?>
        <div class="table-wrap">
          <table class="list">
            <thead><tr><th>Von</th><th>Bis</th><th>Stunden</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($times as $x): ?>
              <tr>
                <td><?= date('d.m.Y H:i', strtotime($x['time_from'])) ?></td>
                <td><?= date('H:i', strtotime($x['time_to'])) ?></td>
                <td><?= number_format((float)$x['hours'], 2, ',', '.') ?></td>
                <td style="text-align:right">
                  <?php if ($t['status'] === 'beendet'): ?>
                  <form method="post" style="display:inline" onsubmit="return confirm('Zeitbuchung löschen?')">
                    <?= csrf_field() ?>
                    <input type="hidden" name="do" value="delete_time">
                    <input type="hidden" name="time_id" value="<?= (int)$x['id'] ?>">
                    <button class="btn btn-sm btn-danger" type="submit">×</button>
                  </form>
                  <?php endif; ?>
                </td>
              </tr>
            <?php endforeach; ?>
            <tr><td colspan="2" style="text-align:right"><strong>Summe</strong></td><td colspan="2"><strong><?= number_format((float)$t['total_hours'],2,',','.') ?> Std.</strong></td></tr>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
      <?php if ($t['status'] === 'beendet'): ?>
      <form method="post" style="margin-top:0.8rem">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="book_time">
        <div class="grid-3">
          <div class="field"><label>Datum</label><input type="date" name="date_from" value="<?= e($t['work_date']) ?>" required></div>
          <div class="field"><label>Von</label><input type="time" name="time_from" step="900" required></div>
          <div class="field"><label>Bis</label><input type="time" name="time_to" step="900" required></div>
        </div>
        <p class="hint">Nur volle Viertelstunden (…:00, …:15, …:30, …:45).</p>
        <button class="btn btn-primary" type="submit">Zeit buchen</button>
      </form>
      <?php else: ?>
        <p class="hint">Dieser Auftrag ist bereits abgerechnet – Zeiten können nicht mehr geändert werden.</p>
      <?php endif; ?>
    </div>

    <?php if ($t['status'] === 'beendet' && !$times): ?>
      <div class="alert alert-error">Bitte buche deine Arbeitszeit – erst danach kannst du den nächsten Auftrag starten.</div>
    <?php endif; ?>
  <?php endif; ?>

<?php endif; /* actsAsWorker */ ?>

<?php if ($hasCoords): ?>
<script src="assets/vendor/maplibre-gl.js"></script>
<script>
(function(){
  var map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap-Mitwirkende' } },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
    },
    center: [<?= (float)$t['lng'] ?>, <?= (float)$t['lat'] ?>],
    zoom: 15
  });
  map.addControl(new maplibregl.NavigationControl());
  new maplibregl.Marker({ color: '#0FA7A0' }).setLngLat([<?= (float)$t['lng'] ?>, <?= (float)$t['lat'] ?>]).addTo(map);
})();
</script>
<?php endif; ?>
<?php layout_footer(); ?>
