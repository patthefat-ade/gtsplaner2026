<?php
/**
 * DANGI ERP – Aufträge/Tickets (nur Admin)
 * Zuweisung an Mitarbeiter, Kunde + Standort, Termin; Detail mit Zeiten,
 * Fotos, Bericht und optionaler Rechnungsübernahme.
 */
require_admin();

$action = $_GET['action'] ?? 'list';
$id     = (int)($_GET['id'] ?? 0);

/* ---------- Geocoding (Nominatim, serverseitig, gecacht in tickets.lat/lng) ---------- */
function geocode_address(string $street, string $zip, string $city): ?array {
    $q = trim("$street, $zip $city, Österreich");
    if (trim($street . $zip . $city) === '') return null;
    $url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' . urlencode($q);
    $ctx = stream_context_create(['http' => [
        'header' => "User-Agent: DANGI-ERP/1.0 (info@dangi.at)\r\n",
        'timeout' => 6,
    ]]);
    $res = @file_get_contents($url, false, $ctx);
    if ($res === false) return null;
    $data = json_decode($res, true);
    if (!is_array($data) || empty($data[0]['lat'])) return null;
    return ['lat' => (float)$data[0]['lat'], 'lng' => (float)$data[0]['lon']];
}

/* ---------- POST: Speichern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'save_ticket') {
    $tid    = (int)($_POST['id'] ?? 0);
    $title  = trim($_POST['title'] ?? '');
    $desc   = trim($_POST['description'] ?? '');
    $cust   = (int)($_POST['customer_id'] ?? 0) ?: null;
    $loc    = (int)($_POST['location_id'] ?? 0) ?: null;
    $street = trim($_POST['address_street'] ?? '');
    $zip    = trim($_POST['address_zip'] ?? '');
    $city   = trim($_POST['address_city'] ?? '');
    $emp    = (int)($_POST['employee_id'] ?? 0) ?: null;
    $date   = $_POST['work_date'] ?? date('Y-m-d');
    $from   = ($_POST['time_from'] ?? '') !== '' ? $_POST['time_from'] : null;
    $to     = ($_POST['time_to'] ?? '') !== '' ? $_POST['time_to'] : null;
    $rateRaw = trim($_POST['hourly_rate'] ?? '');
    $tRate  = $rateRaw === '' ? null : (float)str_replace(',', '.', $rateRaw);

    if ($title === '' || $date === '') {
        flash('Bitte mindestens Titel und Datum angeben.');
        redirect('index.php?page=tickets&action=' . ($tid ? 'edit&id=' . $tid : 'new'));
    }

    // Standort gewählt → Adresse daraus übernehmen, falls Felder leer
    if ($loc && $street === '') {
        $st = db()->prepare('SELECT street, zip, city FROM customer_locations WHERE id=?');
        $st->execute([$loc]);
        if ($l = $st->fetch()) { $street = $l['street']; $zip = $l['zip']; $city = $l['city']; }
    }

    // Geocoding nur wenn Adresse neu/geändert
    $lat = null; $lng = null; $needGeo = true;
    if ($tid) {
        $st = db()->prepare('SELECT address_street, address_zip, address_city, lat, lng FROM tickets WHERE id=?');
        $st->execute([$tid]);
        if ($old = $st->fetch()) {
            if ($old['address_street'] === $street && $old['address_zip'] === $zip && $old['address_city'] === $city && $old['lat'] !== null) {
                $lat = $old['lat']; $lng = $old['lng']; $needGeo = false;
            }
        }
    }
    if ($needGeo) {
        $geo = geocode_address($street, $zip, $city);
        if ($geo) { $lat = $geo['lat']; $lng = $geo['lng']; }
    }

    if ($tid) {
        db()->prepare('UPDATE tickets SET title=?, description=?, customer_id=?, location_id=?, address_street=?, address_zip=?, address_city=?, lat=?, lng=?, employee_id=?, work_date=?, time_from=?, time_to=?, hourly_rate=? WHERE id=?')
           ->execute([$title, $desc, $cust, $loc, $street, $zip, $city, $lat, $lng, $emp, $date, $from, $to, $tRate, $tid]);
        flash('Auftrag gespeichert.');
        redirect('index.php?page=tickets&action=view&id=' . $tid);
    } else {
        // Ticketnummer aus eigenem Nummernkreis
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('SELECT svalue FROM settings WHERE skey = ? FOR UPDATE');
            $st->execute(['ticket_next']);
            $nr = (int)($st->fetchColumn() ?: 1);
            $prefix = setting('ticket_prefix', 'TK');
            $number = $prefix . '-' . date('Y') . '-' . str_pad((string)$nr, 4, '0', STR_PAD_LEFT);
            $pdo->prepare('UPDATE settings SET svalue=? WHERE skey=?')->execute([(string)($nr + 1), 'ticket_next']);
            $pdo->prepare('INSERT INTO tickets (ticket_number, title, description, customer_id, location_id, address_street, address_zip, address_city, lat, lng, employee_id, work_date, time_from, time_to, hourly_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
                ->execute([$number, $title, $desc, $cust, $loc, $street, $zip, $city, $lat, $lng, $emp, $date, $from, $to, $tRate]);
            $newId = (int)$pdo->lastInsertId();
            $pdo->commit();
        } catch (Throwable $t) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $t;
        }
        flash('Auftrag ' . $number . ' angelegt.');
        redirect('index.php?page=tickets&action=view&id=' . $newId);
    }
}

/* ---------- POST: Löschen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'delete_ticket') {
    $tid = (int)$_POST['id'];
    // Fotos vom Datenträger entfernen
    $st = db()->prepare('SELECT stored_name FROM ticket_photos WHERE ticket_id=?');
    $st->execute([$tid]);
    foreach ($st->fetchAll() as $p) {
        $f = __DIR__ . '/../uploads/tickets/' . $p['stored_name'];
        if (is_file($f)) @unlink($f);
    }
    db()->prepare('DELETE FROM tickets WHERE id=?')->execute([$tid]);
    flash('Auftrag gelöscht.');
    redirect('index.php?page=tickets');
}

/* ---------- POST: Status durch Admin ändern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'admin_status') {
    $tid = (int)$_POST['id'];
    $new = $_POST['status'] ?? '';
    if (in_array($new, ['offen','in_arbeit','beendet'], true)) {
        db()->prepare('UPDATE tickets SET status=? WHERE id=?')->execute([$new, $tid]);
        flash('Status geändert.');
    }
    redirect('index.php?page=tickets&action=view&id=' . $tid);
}

/* ---------- POST: In Rechnung übernehmen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'to_invoice') {
    $tid  = (int)$_POST['id'];
    $rate = (float)str_replace(',', '.', $_POST['hourly_rate'] ?? '0');

    $st = db()->prepare('SELECT t.*, (SELECT COALESCE(SUM(hours),0) FROM ticket_times x WHERE x.ticket_id=t.id) AS total_hours FROM tickets t WHERE t.id=?');
    $st->execute([$tid]);
    $t = $st->fetch();

    if (!$t) { flash('Auftrag nicht gefunden.'); redirect('index.php?page=tickets'); }
    if ($t['status'] !== 'beendet') { flash('Nur beendete Aufträge können übernommen werden.'); redirect('index.php?page=tickets&action=view&id=' . $tid); }
    if (!$t['customer_id']) { flash('Dem Auftrag ist kein Kunde zugeordnet.'); redirect('index.php?page=tickets&action=view&id=' . $tid); }
    if ((float)$t['total_hours'] <= 0) { flash('Keine gebuchten Zeiten vorhanden.'); redirect('index.php?page=tickets&action=view&id=' . $tid); }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $number = next_doc_number('invoice');
        $dueDays = (int)(setting('invoice_due_days', '14') ?: 14);
        $pdo->prepare("INSERT INTO documents (doc_type, doc_number, customer_id, doc_date, due_date, service_period_type, service_period_from, service_period_to, status, intro_text, outro_text) VALUES ('invoice', ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), 'von_bis', ?, ?, 'offen', ?, ?)")
            ->execute([$number, $t['customer_id'], $dueDays, $t['work_date'], $t['work_date'], setting('invoice_intro', ''), setting('invoice_outro', '')]);
        $invId = (int)$pdo->lastInsertId();

        $descLines = [];
        if ($t['work_report']) $descLines[] = $t['work_report'];
        $descLines[] = 'Auftrag ' . $t['ticket_number'] . ' am ' . date('d.m.Y', strtotime($t['work_date']))
                     . ($t['address_street'] ? ', ' . $t['address_street'] . ', ' . $t['address_zip'] . ' ' . $t['address_city'] : '');
        $lineTotal = round((float)$t['total_hours'] * $rate, 2);
        $pdo->prepare('INSERT INTO document_items (document_id, position, title, description, quantity, unit, unit_price, line_total) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([$invId, 1, $t['title'], implode("\n", $descLines), $t['total_hours'], 'Std.', $rate, $lineTotal]);
        $pdo->prepare('UPDATE documents SET total_net=? WHERE id=?')->execute([$lineTotal, $invId]);
        $pdo->prepare("UPDATE tickets SET status='abgerechnet', invoice_id=? WHERE id=?")->execute([$invId, $tid]);
        $pdo->commit();
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $ex;
    }
    flash('Rechnung ' . $number . ' aus Auftrag erstellt.');
    redirect('index.php?page=document_view&id=' . $invId);
}

$statusBadge = function (string $s): string {
    return match ($s) {
        'offen'       => '<span class="badge badge-muted">offen</span>',
        'in_arbeit'   => '<span class="badge badge-warning">in Arbeit</span>',
        'beendet'     => '<span class="badge badge-success">beendet</span>',
        'abgerechnet' => '<span class="badge badge-info">abgerechnet</span>',
        default       => e($s),
    };
};

/* ---------- Ansicht: Formular ---------- */
if ($action === 'new' || $action === 'edit') {
    $t = ['id'=>0,'title'=>'','description'=>'','customer_id'=>null,'location_id'=>null,'address_street'=>'','address_zip'=>'','address_city'=>'','employee_id'=>null,'work_date'=>date('Y-m-d'),'time_from'=>'','time_to'=>'','hourly_rate'=>null];
    if ($action === 'edit' && $id) {
        $st = db()->prepare('SELECT * FROM tickets WHERE id=?');
        $st->execute([$id]);
        $t = $st->fetch() ?: $t;
    }
    $customers = db()->query('SELECT id, company, first_name, last_name, default_hourly_rate FROM customers ORDER BY company, last_name')->fetchAll();
    $employees = db()->query('SELECT id, first_name, last_name, weekly_hours, gross_salary, ancillary_pct FROM employees WHERE is_active=1 ORDER BY last_name')->fetchAll();
    $locations = db()->query('SELECT id, customer_id, name AS label, street, zip, city FROM customer_locations ORDER BY name')->fetchAll();
    $globalRate = setting('default_hourly_rate', '');

    layout_header($t['id'] ? 'Auftrag bearbeiten' : 'Auftrag anlegen', 'tickets');
    ?>
    <div class="page-head">
      <h1><?= $t['id'] ? 'Auftrag bearbeiten' : 'Neuer Auftrag' ?></h1>
      <a class="btn btn-secondary" href="index.php?page=tickets">Zurück zur Liste</a>
    </div>
    <div class="card">
      <form method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="save_ticket">
        <input type="hidden" name="id" value="<?= (int)$t['id'] ?>">
        <div class="field"><label>Titel *</label><input type="text" name="title" value="<?= e($t['title']) ?>" required placeholder="z. B. Stiegenhausreinigung Wohnanlage Parkweg"></div>
        <div class="field"><label>Beschreibung / Arbeitsanweisung</label><textarea name="description" rows="3"><?= e($t['description'] ?? '') ?></textarea></div>
        <div class="grid-2">
          <div class="field">
            <label>Kunde</label>
            <select name="customer_id" id="ticket-customer">
              <option value="">– kein Kunde –</option>
              <?php foreach ($customers as $c): ?>
                <option value="<?= (int)$c['id'] ?>" <?= $t['customer_id'] == $c['id'] ? 'selected' : '' ?>><?= e(customer_display_name($c)) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field">
            <label>Standort des Kunden (optional, füllt Adresse)</label>
            <select name="location_id" id="ticket-location" data-selected="<?= (int)($t['location_id'] ?? 0) ?>">
              <option value="">– Standort wählen –</option>
              <?php foreach ($locations as $l): ?>
                <option value="<?= (int)$l['id'] ?>" data-customer="<?= (int)$l['customer_id'] ?>" data-street="<?= e($l['street']) ?>" data-zip="<?= e($l['zip']) ?>" data-city="<?= e($l['city']) ?>" <?= ($t['location_id'] ?? 0) == $l['id'] ? 'selected' : '' ?>>
                  <?= e($l['label'] ?: ($l['street'] . ', ' . $l['city'])) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Straße</label><input type="text" name="address_street" id="addr-street" value="<?= e($t['address_street']) ?>"></div>
          <div class="field"><label>PLZ</label><input type="text" name="address_zip" id="addr-zip" value="<?= e($t['address_zip']) ?>"></div>
          <div class="field"><label>Ort</label><input type="text" name="address_city" id="addr-city" value="<?= e($t['address_city']) ?>"></div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label>Mitarbeiter</label>
            <select name="employee_id">
              <option value="">– nicht zugewiesen –</option>
              <?php foreach ($employees as $emp): ?>
                <option value="<?= (int)$emp['id'] ?>" <?= $t['employee_id'] == $emp['id'] ? 'selected' : '' ?>><?= e(trim($emp['first_name'] . ' ' . $emp['last_name'])) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field"><label>Datum *</label><input type="date" name="work_date" value="<?= e($t['work_date']) ?>" required></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Geplant von</label><input type="time" name="time_from" value="<?= e(substr((string)$t['time_from'], 0, 5)) ?>"></div>
          <div class="field"><label>Geplant bis</label><input type="time" name="time_to" value="<?= e(substr((string)$t['time_to'], 0, 5)) ?>"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Stundensatz für diesen Auftrag (€ netto, optional)</label>
            <input type="text" name="hourly_rate" id="ticket-rate" value="<?= $t['hourly_rate'] !== null && $t['hourly_rate'] !== '' ? number_format((float)$t['hourly_rate'], 2, ',', '') : '' ?>" inputmode="decimal" placeholder="leer = Kundensatz bzw. globaler Satz">
            <span class="hint" id="rate-hint"></span></div>
          <div class="field"><label>&nbsp;</label>
            <span class="hint" id="min-rate-hint" style="display:block;padding-top:0.55rem"></span></div>
        </div>
        <p class="hint">Die Adresse wird beim Speichern automatisch geocodiert (OpenStreetMap), damit der Mitarbeiter die Karte sieht.</p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Speichern</button></div>
      </form>
    </div>
    <script>
    (function(){
      var cust = document.getElementById('ticket-customer'),
          loc  = document.getElementById('ticket-location');
      var custRates = <?= json_encode(array_column($customers, 'default_hourly_rate', 'id')) ?>;
      var globalRate = <?= json_encode($globalRate !== '' ? (float)str_replace(',', '.', $globalRate) : null) ?>;
      var minRates = <?= json_encode((function () use ($employees) {
          $out = [];
          foreach ($employees as $e2) {
              $mh = (float)$e2['weekly_hours'] * 4.33;
              $out[(string)$e2['id']] = ($mh > 0 && (float)$e2['gross_salary'] > 0)
                  ? round((float)$e2['gross_salary'] * (1 + (float)$e2['ancillary_pct'] / 100) / $mh * 1.15 * 1.12, 2) : null;
          }
          return $out;
      })()) ?>;
      var empSel = document.querySelector('select[name="employee_id"]');
      function deNum(n){ return n.toLocaleString('de-AT',{minimumFractionDigits:2, maximumFractionDigits:2}); }
      function updateRateHints(){
        var hint = document.getElementById('rate-hint');
        var r = cust.value && custRates[cust.value] != null ? parseFloat(custRates[cust.value]) : null;
        if (r != null) { hint.textContent = 'Kundensatz: ' + deNum(r) + ' € netto (wird verwendet, wenn leer)'; }
        else if (globalRate != null) { hint.textContent = 'Globaler Standardsatz: ' + deNum(globalRate) + ' € netto (wird verwendet, wenn leer)'; }
        else { hint.textContent = 'Kein Standardsatz hinterlegt – Satz angeben oder beim Kunden/in den Einstellungen pflegen.'; }
        var mh = document.getElementById('min-rate-hint');
        var mr = empSel && empSel.value ? minRates[empSel.value] : null;
        mh.textContent = mr != null ? 'Richtwert Mindestsatz für gewählten Mitarbeiter: ' + deNum(mr) + ' € netto (Kosten + 15 % GK + 12 % Gewinn)' : '';
      }
      cust.addEventListener('change', updateRateHints);
      if (empSel) empSel.addEventListener('change', updateRateHints);
      updateRateHints();
      function filterLocations(){
        var cid = cust.value;
        Array.prototype.forEach.call(loc.options, function(o){
          if (!o.value) return;
          o.hidden = cid !== '' && o.getAttribute('data-customer') !== cid;
        });
        var sel = loc.options[loc.selectedIndex];
        if (sel && sel.hidden) loc.value = '';
      }
      cust.addEventListener('change', filterLocations);
      filterLocations();
      loc.addEventListener('change', function(){
        var o = loc.options[loc.selectedIndex];
        if (o && o.value) {
          document.getElementById('addr-street').value = o.getAttribute('data-street') || '';
          document.getElementById('addr-zip').value    = o.getAttribute('data-zip') || '';
          document.getElementById('addr-city').value   = o.getAttribute('data-city') || '';
        }
      });
    })();
    </script>
    <?php
    layout_footer();
    return;
}

/* ---------- Ansicht: Detail ---------- */
if ($action === 'view' && $id) {
    $st = db()->prepare('SELECT t.*, c.company, c.first_name AS c_first, c.last_name AS c_last,
        c.default_hourly_rate AS cust_rate,
        e.first_name AS e_first, e.last_name AS e_last,
        e.weekly_hours AS e_weekly, e.gross_salary AS e_gross, e.ancillary_pct AS e_anc,
        d.doc_number AS invoice_number,
        (SELECT COALESCE(SUM(hours),0) FROM ticket_times x WHERE x.ticket_id=t.id) AS total_hours
      FROM tickets t
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN employees e ON e.id = t.employee_id
      LEFT JOIN documents d ON d.id = t.invoice_id
      WHERE t.id=?');
    $st->execute([$id]);
    $t = $st->fetch();
    if (!$t) { flash('Auftrag nicht gefunden.'); redirect('index.php?page=tickets'); }

    /* Stundensatz-Fallback-Kette: Auftrag → Kunde → global; Richtwert aus Mitarbeiter-Kalkulation */
    $globalRate = (float)str_replace(',', '.', setting('default_hourly_rate', '0'));
    $suggestRate = null; $rateSource = '';
    if ($t['hourly_rate'] !== null && (float)$t['hourly_rate'] > 0) { $suggestRate = (float)$t['hourly_rate']; $rateSource = 'Auftragssatz'; }
    elseif ($t['cust_rate'] !== null && (float)$t['cust_rate'] > 0)  { $suggestRate = (float)$t['cust_rate']; $rateSource = 'Kundensatz'; }
    elseif ($globalRate > 0)                                        { $suggestRate = $globalRate; $rateSource = 'globaler Standardsatz'; }
    $empMonthly = (float)($t['e_weekly'] ?? 0) * 4.33;
    $minRate = ($empMonthly > 0 && (float)($t['e_gross'] ?? 0) > 0)
        ? (float)$t['e_gross'] * (1 + (float)$t['e_anc'] / 100) / $empMonthly * 1.15 * 1.12 : 0;

    $times = db()->prepare('SELECT * FROM ticket_times WHERE ticket_id=? ORDER BY time_from');
    $times->execute([$id]);
    $times = $times->fetchAll();
    $photos = db()->prepare('SELECT * FROM ticket_photos WHERE ticket_id=? ORDER BY created_at');
    $photos->execute([$id]);
    $photos = $photos->fetchAll();

    layout_header('Auftrag ' . $t['ticket_number'], 'tickets');
    ?>
    <div class="page-head">
      <h1><?= e($t['ticket_number']) ?> – <?= e($t['title']) ?></h1>
      <div>
        <a class="btn btn-secondary" href="index.php?page=tickets">Zurück</a>
        <a class="btn btn-secondary" href="index.php?page=tickets&action=edit&id=<?= $id ?>">Bearbeiten</a>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2 class="subform-title">Auftragsdaten</h2>
        <table class="detail-table">
          <tr><th>Status</th><td><?= $statusBadge($t['status']) ?><?= $t['invoice_number'] ? ' · Rechnung ' . e($t['invoice_number']) : '' ?></td></tr>
          <tr><th>Mitarbeiter</th><td><?= $t['e_last'] ? e(trim($t['e_first'] . ' ' . $t['e_last'])) : '<em>nicht zugewiesen</em>' ?></td></tr>
          <tr><th>Kunde</th><td><?= $t['customer_id'] ? '<a href="index.php?page=customers&action=edit&id=' . (int)$t['customer_id'] . '">' . e($t['company'] ?: trim($t['c_first'] . ' ' . $t['c_last'])) . '</a>' : '–' ?></td></tr>
          <tr><th>Adresse</th><td><?= e(trim($t['address_street'] . ', ' . $t['address_zip'] . ' ' . $t['address_city'], ', ')) ?: '–' ?></td></tr>
          <tr><th>Termin</th><td><?= dmy($t['work_date']) ?><?= $t['time_from'] ? ', ' . substr($t['time_from'],0,5) . ($t['time_to'] ? '–' . substr($t['time_to'],0,5) : '') . ' Uhr' : '' ?></td></tr>
          <tr><th>Stundensatz</th><td><?= $suggestRate !== null ? number_format($suggestRate, 2, ',', '.') . ' € netto <span class="hint">(' . $rateSource . ')</span>' : '<em>kein Satz hinterlegt</em>' ?></td></tr>
          <tr><th>Beschreibung</th><td><?= nl2br(e($t['description'] ?? '')) ?: '–' ?></td></tr>
          <tr><th>Gestartet</th><td><?= $t['started_at'] ? date('d.m.Y H:i', strtotime($t['started_at'])) : '–' ?></td></tr>
          <tr><th>Beendet</th><td><?= $t['finished_at'] ? date('d.m.Y H:i', strtotime($t['finished_at'])) : '–' ?></td></tr>
        </table>
        <form method="post" style="margin-top:0.8rem;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
          <?= csrf_field() ?>
          <input type="hidden" name="do" value="admin_status">
          <input type="hidden" name="id" value="<?= $id ?>">
          <label style="font-size:0.85rem;color:var(--text-muted)">Status manuell setzen:</label>
          <select name="status" style="width:auto">
            <option value="offen">offen</option>
            <option value="in_arbeit">in Arbeit</option>
            <option value="beendet">beendet</option>
          </select>
          <button class="btn btn-sm btn-secondary" type="submit">Ändern</button>
        </form>
      </div>

      <div class="card">
        <h2 class="subform-title">Tätigkeitsbericht &amp; Zeiten</h2>
        <p><?= $t['work_report'] ? nl2br(e($t['work_report'])) : '<em>Noch kein Bericht erfasst.</em>' ?></p>
        <?php if ($times): ?>
        <div class="table-wrap">
          <table class="list">
            <thead><tr><th>Von</th><th>Bis</th><th>Stunden</th></tr></thead>
            <tbody>
            <?php foreach ($times as $x): ?>
              <tr>
                <td><?= date('d.m.Y H:i', strtotime($x['time_from'])) ?></td>
                <td><?= date('d.m.Y H:i', strtotime($x['time_to'])) ?></td>
                <td><?= number_format((float)$x['hours'], 2, ',', '.') ?></td>
              </tr>
            <?php endforeach; ?>
            <tr><td colspan="2" style="text-align:right"><strong>Summe</strong></td><td><strong><?= number_format((float)$t['total_hours'], 2, ',', '.') ?> Std.</strong></td></tr>
            </tbody>
          </table>
        </div>
        <?php else: ?><p class="hint">Noch keine Zeiten gebucht.</p><?php endif; ?>

        <?php if ($t['status'] === 'beendet' && $t['customer_id'] && (float)$t['total_hours'] > 0): ?>
          <form method="post" style="margin-top:1rem;padding-top:0.9rem;border-top:1px solid var(--grau-linie);display:flex;gap:0.5rem;align-items:end;flex-wrap:wrap">
            <?= csrf_field() ?>
            <input type="hidden" name="do" value="to_invoice">
            <input type="hidden" name="id" value="<?= $id ?>">
            <div class="field" style="margin:0">
              <label>Stundensatz (€ netto)</label>
              <input type="text" name="hourly_rate" value="<?= $suggestRate !== null ? number_format($suggestRate, 2, ',', '') : '' ?>" style="width:110px" required>
              <?php if ($suggestRate !== null): ?><span class="hint">Vorschlag: <?= e($rateSource) ?></span><?php endif; ?>
            </div>
            <button class="btn btn-primary" type="submit" onclick="return confirm('Rechnung aus diesem Auftrag erstellen?')">In Rechnung übernehmen</button>
          </form>
          <p class="hint" style="margin-top:0.4rem">Erstellt eine neue Rechnung beim Kunden mit <?= number_format((float)$t['total_hours'], 2, ',', '.') ?> Std. – der Auftrag erhält den Status „abgerechnet".
          <?php if ($minRate > 0): ?><br>Richtwert Mindestsatz (Mitarbeiter-Kalkulation): <strong><?= number_format($minRate, 2, ',', '.') ?> € netto</strong><?php endif; ?></p>
        <?php endif; ?>
      </div>
    </div>

    <div class="card">
      <h2 class="subform-title">Fotodokumentation (<?= count($photos) ?>)</h2>
      <?php if ($photos): ?>
        <div class="photo-grid">
          <?php foreach ($photos as $p): ?>
            <a href="index.php?page=ticket_photo&id=<?= (int)$p['id'] ?>" target="_blank" class="photo-item">
              <img src="index.php?page=ticket_photo&id=<?= (int)$p['id'] ?>" alt="<?= e($p['original_name']) ?>" loading="lazy">
            </a>
          <?php endforeach; ?>
        </div>
      <?php else: ?><p class="hint">Noch keine Fotos hochgeladen.</p><?php endif; ?>
    </div>

    <div class="card" style="border-color:#f3c1c1">
      <form method="post" onsubmit="return confirm('Auftrag inkl. Zeiten und Fotos wirklich löschen?')">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="delete_ticket">
        <input type="hidden" name="id" value="<?= $id ?>">
        <button class="btn btn-danger" type="submit">Auftrag löschen</button>
      </form>
    </div>
    <?php
    layout_footer();
    return;
}

/* ---------- Ansicht: Liste ---------- */
$fStatus   = $_GET['status'] ?? '';
$fEmployee = (int)($_GET['employee'] ?? 0);
$fDate     = $_GET['date'] ?? '';

$sql = 'SELECT t.*, c.company, c.first_name AS c_first, c.last_name AS c_last, e.first_name AS e_first, e.last_name AS e_last,
          (SELECT COALESCE(SUM(hours),0) FROM ticket_times x WHERE x.ticket_id=t.id) AS total_hours
        FROM tickets t
        LEFT JOIN customers c ON c.id=t.customer_id
        LEFT JOIN employees e ON e.id=t.employee_id WHERE 1=1';
$args = [];
if ($fStatus !== '' )  { $sql .= ' AND t.status=?';      $args[] = $fStatus; }
if ($fEmployee)        { $sql .= ' AND t.employee_id=?'; $args[] = $fEmployee; }
if ($fDate !== '')     { $sql .= ' AND t.work_date=?';   $args[] = $fDate; }
$sql .= ' ORDER BY t.work_date DESC, t.time_from';
$st = db()->prepare($sql);
$st->execute($args);
$rows = $st->fetchAll();

$employees = db()->query('SELECT id, first_name, last_name FROM employees ORDER BY last_name')->fetchAll();

layout_header('Aufträge', 'tickets');
?>
<div class="page-head">
  <h1>Aufträge</h1>
  <a class="btn btn-primary" href="index.php?page=tickets&action=new">+ Auftrag anlegen</a>
</div>
<div class="card">
  <form method="get" style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:end;margin-bottom:1rem">
    <input type="hidden" name="page" value="tickets">
    <div class="field" style="margin:0"><label>Status</label>
      <select name="status" style="width:auto">
        <option value="">alle</option>
        <?php foreach (['offen','in_arbeit','beendet','abgerechnet'] as $s): ?>
          <option value="<?= $s ?>" <?= $fStatus === $s ? 'selected' : '' ?>><?= str_replace('_',' ',$s) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="field" style="margin:0"><label>Mitarbeiter</label>
      <select name="employee" style="width:auto">
        <option value="0">alle</option>
        <?php foreach ($employees as $emp): ?>
          <option value="<?= (int)$emp['id'] ?>" <?= $fEmployee === (int)$emp['id'] ? 'selected' : '' ?>><?= e(trim($emp['first_name'] . ' ' . $emp['last_name'])) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="field" style="margin:0"><label>Datum</label><input type="date" name="date" value="<?= e($fDate) ?>" style="width:auto"></div>
    <button class="btn btn-sm btn-secondary" type="submit">Filtern</button>
    <a class="btn btn-sm btn-secondary" href="index.php?page=tickets">Zurücksetzen</a>
  </form>

  <?php if (!$rows): ?>
    <p class="hint">Keine Aufträge gefunden. Lege einen Auftrag an und weise ihn einem Mitarbeiter zu – er erscheint dann in dessen Tagesansicht „Mein Tag".</p>
  <?php else: ?>
  <div class="table-wrap">
    <table class="list">
      <thead><tr><th>Nr.</th><th>Titel</th><th>Kunde</th><th>Mitarbeiter</th><th>Termin</th><th>Status</th><th>Std.</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($rows as $r): ?>
        <tr>
          <td><?= e($r['ticket_number']) ?></td>
          <td><a href="index.php?page=tickets&action=view&id=<?= (int)$r['id'] ?>"><strong><?= e($r['title']) ?></strong></a></td>
          <td><?= $r['customer_id'] ? e($r['company'] ?: trim($r['c_first'] . ' ' . $r['c_last'])) : '–' ?></td>
          <td><?= $r['e_last'] ? e(trim($r['e_first'] . ' ' . $r['e_last'])) : '<em>offen</em>' ?></td>
          <td><?= dmy($r['work_date']) ?><?= $r['time_from'] ? ', ' . substr($r['time_from'],0,5) : '' ?></td>
          <td><?= $statusBadge($r['status']) ?></td>
          <td><?= (float)$r['total_hours'] > 0 ? number_format((float)$r['total_hours'], 2, ',', '.') : '–' ?></td>
          <td style="text-align:right"><a class="btn btn-sm btn-secondary" href="index.php?page=tickets&action=view&id=<?= (int)$r['id'] ?>">Details</a></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>
<?php layout_footer(); ?>
