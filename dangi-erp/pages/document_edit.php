<?php
/** DANGI ERP – Angebot/Rechnung erstellen & bearbeiten (mit Positionen) */
$pdo = db();
$id = (int)($_GET['id'] ?? 0);
$isEdit = $id > 0;

if ($isEdit) {
    $st = $pdo->prepare('SELECT * FROM documents WHERE id = ?');
    $st->execute([$id]);
    $doc = $st->fetch();
    if (!$doc) { flash('Dokument nicht gefunden.'); redirect('index.php'); }
    $type = $doc['doc_type'];
} else {
    $type = ($_GET['type'] ?? 'quote') === 'invoice' ? 'invoice' : 'quote';
    $doc = null;
}
$isInvoice = $type === 'invoice';
$isCreditNote = $type === 'credit_note';
$labelSg = $isCreditNote ? 'Gutschrift' : ($isInvoice ? 'Rechnung' : 'Angebot');

/* ---------- Speichern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $customerId = (int)($_POST['customer_id'] ?? 0);
    $docDate    = $_POST['doc_date'] ?: date('Y-m-d');
    $validUntil = $_POST['valid_until'] ?: null;
    $dueDate    = $_POST['due_date'] ?: null;
    $introText  = trim($_POST['intro_text'] ?? '');
    $outroText  = trim($_POST['outro_text'] ?? '');
    $items      = $_POST['items'] ?? [];

    /* Leistungszeitraum (nur Rechnungen) */
    $spType = $_POST['service_period_type'] ?? 'none';
    if (!in_array($spType, ['none', 'frei', 'von_bis', 'letzter_monat', 'dieser_monat'], true)) { $spType = 'none'; }
    if (!$isInvoice) { $spType = 'none'; }
    $spText = null; $spFrom = null; $spTo = null;
    if ($spType === 'frei') {
        $spText = trim($_POST['service_period_text'] ?? '') ?: null;
        if ($spText === null) { $spType = 'none'; }
    } elseif ($spType === 'von_bis') {
        $spFrom = $_POST['service_period_from'] ?: null;
        $spTo   = $_POST['service_period_to'] ?: null;
        if (!$spFrom || !$spTo) { $spType = 'none'; $spFrom = $spTo = null; }
    } elseif ($spType === 'letzter_monat') {
        $spFrom = date('Y-m-01', strtotime('first day of last month'));
        $spTo   = date('Y-m-t', strtotime('last day of last month'));
    } elseif ($spType === 'dieser_monat') {
        $spFrom = date('Y-m-01');
        $spTo   = date('Y-m-t');
    }

    if (!$customerId || !$items) {
        flash('Bitte Kunde wählen und mindestens eine Position anlegen.');
    } else {
        $pdo->beginTransaction();
        try {
            $total = 0.0;
            $clean = [];
            $pos = 1;
            foreach ($items as $it) {
                $title = trim($it['title'] ?? '');
                if ($title === '') continue;
                $qty   = (float)str_replace(',', '.', $it['quantity'] ?? '1');
                $price = (float)str_replace(',', '.', $it['unit_price'] ?? '0');
                $line  = round($qty * $price, 2);
                $total += $line;
                $clean[] = [
                    'service_id'  => ($it['service_id'] ?? '') !== '' ? (int)$it['service_id'] : null,
                    'position'    => $pos++,
                    'title'       => $title,
                    'description' => trim($it['description'] ?? ''),
                    'quantity'    => $qty,
                    'unit'        => trim($it['unit'] ?? 'Pauschale'),
                    'unit_price'  => $price,
                    'line_total'  => $line,
                ];
            }
            if (!$clean) { throw new RuntimeException('Keine gültigen Positionen.'); }

            if ($isEdit) {
                $st = $pdo->prepare('UPDATE documents SET customer_id=?, doc_date=?, valid_until=?, due_date=?, service_period_type=?, service_period_text=?, service_period_from=?, service_period_to=?, intro_text=?, outro_text=?, total_net=? WHERE id=?');
                $st->execute([$customerId, $docDate, $validUntil, $dueDate, $spType, $spText, $spFrom, $spTo, $introText, $outroText, $total, $id]);
                $pdo->prepare('DELETE FROM document_items WHERE document_id=?')->execute([$id]);
                $docId = $id;
            } else {
                $number = next_doc_number($type);
                $st = $pdo->prepare('INSERT INTO documents (doc_type, doc_number, customer_id, doc_date, valid_until, due_date, service_period_type, service_period_text, service_period_from, service_period_to, status, intro_text, outro_text, total_net) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
                $st->execute([$type, $number, $customerId, $docDate, $validUntil, $dueDate, $spType, $spText, $spFrom, $spTo, 'offen', $introText, $outroText, $total]);
                $docId = (int)$pdo->lastInsertId();
            }

            $sti = $pdo->prepare('INSERT INTO document_items (document_id, service_id, position, title, description, quantity, unit, unit_price, line_total) VALUES (?,?,?,?,?,?,?,?,?)');
            foreach ($clean as $c) {
                $sti->execute([$docId, $c['service_id'], $c['position'], $c['title'], $c['description'], $c['quantity'], $c['unit'], $c['unit_price'], $c['line_total']]);
            }

            $pdo->commit();
            flash($labelSg . ' gespeichert.');
            redirect('index.php?page=document_view&id=' . $docId);
        } catch (Throwable $t) {
            $pdo->rollBack();
            flash('Fehler beim Speichern: ' . $t->getMessage());
        }
    }
}

/* ---------- Daten für das Formular ---------- */
$customers = $pdo->query('SELECT id, company, first_name, last_name, zip, city FROM customers ORDER BY company, last_name')->fetchAll();
$services  = $pdo->query('SELECT id, title, description, unit, unit_price FROM services WHERE active = 1 ORDER BY title')->fetchAll();
$servicesJson = json_encode(array_map(fn($s) => [
    'id' => (int)$s['id'],
    'title' => $s['title'],
    'description' => $s['description'],
    'unit' => $s['unit'],
    'unit_price' => (float)$s['unit_price'],
], $services), JSON_UNESCAPED_UNICODE);

$existingItems = [];
if ($isEdit) {
    $sti = $pdo->prepare('SELECT * FROM document_items WHERE document_id = ? ORDER BY position');
    $sti->execute([$id]);
    $existingItems = $sti->fetchAll();
}

/* Vorbelegungen */
$defaultIntro = $isInvoice ? setting('invoice_intro') : setting('quote_intro');
$defaultOutro = $isInvoice ? setting('invoice_outro') : setting('quote_outro');
$docDate    = $doc['doc_date'] ?? date('Y-m-d');
$validUntil = $doc['valid_until'] ?? date('Y-m-d', strtotime('+' . (int)setting('quote_valid_days', '30') . ' days'));
$dueDate    = $doc['due_date'] ?? date('Y-m-d', strtotime('+' . (int)setting('invoice_due_days', '14') . ' days'));
$spTypeVal  = $doc['service_period_type'] ?? 'none';
$spTextVal  = $doc['service_period_text'] ?? '';
$spFromVal  = $doc['service_period_from'] ?? '';
$spToVal    = $doc['service_period_to'] ?? '';

$navActive = $isCreditNote ? 'credit_notes' : ($isInvoice ? 'invoices' : 'quotes');
layout_header(($isEdit ? $labelSg . ' bearbeiten' : ($isCreditNote ? 'Gutschrift bearbeiten' : ($isInvoice ? 'Neue Rechnung' : 'Neues Angebot'))), $navActive);

if (!$customers): ?>
  <div class="card">
    <h1 style="font-size:1.3rem;margin-bottom:0.6rem">Zuerst einen Kunden anlegen</h1>
    <p>Um ein <?= $labelSg === 'Rechnung' ? 'e Rechnung' : ' Angebot' ?> zu erstellen, wird ein Kunde benötigt.</p>
    <p style="margin-top:1rem"><a class="btn btn-primary" href="index.php?page=customers&action=new">+ Neuer Kunde</a></p>
  </div>
<?php layout_footer(); exit; endif; ?>

<div class="page-head">
  <h1><?= $isEdit ? e($doc['doc_number']) . ' bearbeiten' : ($isInvoice ? 'Neue Rechnung' : 'Neues Angebot') ?></h1>
  <a class="btn btn-secondary" href="index.php?page=documents&type=<?= $type ?>">← Zur Liste</a>
</div>

<form method="post" id="doc-form">
  <?= csrf_field() ?>
  <div class="card">
    <div class="grid-2">
      <div class="field">
        <label>Kunde *</label>
        <select name="customer_id" required>
          <option value="">– Kunde wählen –</option>
          <?php foreach ($customers as $c): ?>
            <option value="<?= $c['id'] ?>" <?= ($doc['customer_id'] ?? 0) == $c['id'] ? 'selected' : '' ?>>
              <?= e(customer_display_name($c)) ?><?= $c['city'] ? ' – ' . e($c['city']) : '' ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label><?= $labelSg ?>sdatum</label>
        <input type="date" name="doc_date" value="<?= e($docDate) ?>">
      </div>
    </div>
    <div class="grid-2">
      <?php if ($isInvoice): ?>
        <div class="field"><label>Zahlbar bis</label><input type="date" name="due_date" value="<?= e($dueDate) ?>"></div>
        <input type="hidden" name="valid_until" value="">
      <?php else: ?>
        <div class="field"><label>Gültig bis</label><input type="date" name="valid_until" value="<?= e($validUntil) ?>"></div>
        <input type="hidden" name="due_date" value="">
      <?php endif; ?>
      <div></div>
    </div>
    <?php if ($isInvoice): ?>
    <div class="grid-2">
      <div class="field">
        <label>Leistungszeitraum</label>
        <select name="service_period_type" id="sp-type">
          <option value="none" <?= $spTypeVal === 'none' ? 'selected' : '' ?>>– kein Leistungszeitraum –</option>
          <option value="frei" <?= $spTypeVal === 'frei' ? 'selected' : '' ?>>Frei (eigener Text)</option>
          <option value="von_bis" <?= $spTypeVal === 'von_bis' ? 'selected' : '' ?>>Von – bis (Kalender)</option>
          <option value="letzter_monat" <?= $spTypeVal === 'letzter_monat' ? 'selected' : '' ?>>Letzter Monat</option>
          <option value="dieser_monat" <?= $spTypeVal === 'dieser_monat' ? 'selected' : '' ?>>Dieser Monat</option>
        </select>
        <span class="hint">Erscheint auf der Rechnung unter dem Datum. „Letzter/Dieser Monat“ wird beim Speichern automatisch als Datum von–bis hinterlegt.</span>
      </div>
      <div>
        <div class="field" id="sp-frei" style="display:none">
          <label>Zeitraum (Freitext)</label>
          <input type="text" name="service_period_text" value="<?= e($spTextVal) ?>" placeholder="z. B. Gartenpflege Sommersaison 2026">
        </div>
        <div id="sp-vonbis" style="display:none">
          <div class="grid-2">
            <div class="field"><label>Von</label><input type="date" name="service_period_from" value="<?= e($spFromVal) ?>"></div>
            <div class="field"><label>Bis</label><input type="date" name="service_period_to" value="<?= e($spToVal) ?>"></div>
          </div>
        </div>
      </div>
    </div>
    <script>
    (function () {
      var sel = document.getElementById('sp-type');
      var frei = document.getElementById('sp-frei');
      var vonbis = document.getElementById('sp-vonbis');
      function upd() {
        frei.style.display   = sel.value === 'frei' ? '' : 'none';
        vonbis.style.display = sel.value === 'von_bis' ? '' : 'none';
      }
      sel.addEventListener('change', upd);
      upd();
    })();
    </script>
    <?php endif; ?>
    <div class="field">
      <label>Einleitungstext</label>
      <textarea name="intro_text" rows="2"><?= e($doc['intro_text'] ?? $defaultIntro) ?></textarea>
    </div>
  </div>

  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Positionen</h2>
    <div style="overflow-x:auto">
      <table id="items-table">
        <thead><tr>
          <th>Leistung</th><th class="col-qty">Menge</th><th class="col-unit">Einheit</th>
          <th class="col-price">Einzelpreis €</th><th class="col-total">Summe</th><th class="col-del"></th>
        </tr></thead>
        <tbody id="items-body">
        <?php $i = 0; foreach ($existingItems as $it): ?>
          <tr class="item-row">
            <td>
              <input type="hidden" name="items[<?= $i ?>][service_id]" value="<?= e((string)$it['service_id']) ?>">
              <input type="text" name="items[<?= $i ?>][title]" class="f-title" required value="<?= e($it['title']) ?>">
              <textarea name="items[<?= $i ?>][description]" class="f-desc"><?= e($it['description']) ?></textarea>
            </td>
            <td class="col-qty"><input type="text" inputmode="decimal" name="items[<?= $i ?>][quantity]" class="f-qty" value="<?= number_format((float)$it['quantity'], 2, ',', '') ?>"></td>
            <td class="col-unit"><input type="text" name="items[<?= $i ?>][unit]" class="f-unit" value="<?= e($it['unit']) ?>"></td>
            <td class="col-price"><input type="text" inputmode="decimal" name="items[<?= $i ?>][unit_price]" class="f-price" value="<?= number_format((float)$it['unit_price'], 2, ',', '') ?>"></td>
            <td class="col-total"><?= money((float)$it['line_total']) ?></td>
            <td class="col-del"><button type="button" class="item-del" title="Position entfernen">×</button></td>
          </tr>
        <?php $i++; endforeach; ?>
        </tbody>
      </table>
    </div>

    <div class="items-toolbar">
      <select id="service-select" style="padding:0.5rem 0.7rem;border:1px solid var(--grau-linie);border-radius:8px;font-family:var(--font);max-width:320px">
        <option value="">– Dienstleistung aus Katalog –</option>
        <?php foreach ($services as $s): ?>
          <option value="<?= $s['id'] ?>"><?= e($s['title']) ?> (<?= money((float)$s['unit_price']) ?>/<?= e($s['unit']) ?>)</option>
        <?php endforeach; ?>
      </select>
      <button type="button" class="btn btn-secondary btn-sm" id="service-add">Übernehmen</button>
      <span class="hint">oder</span>
      <button type="button" class="btn btn-secondary btn-sm" id="item-add">+ Freie Position</button>
    </div>

    <div class="totals-line">
      <span>Gesamtsumme netto:</span>
      <span id="doc-total">0,00 €</span>
    </div>
    <p class="hint" style="text-align:right;margin-top:0.3rem"><?= e(setting('tax_note')) ?></p>
  </div>

  <div class="card">
    <div class="field">
      <label>Schlusstext</label>
      <textarea name="outro_text" rows="2"><?= e($doc['outro_text'] ?? $defaultOutro) ?></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit"><?= $labelSg ?> speichern</button>
      <a class="btn btn-secondary" href="index.php?page=documents&type=<?= $type ?>">Abbrechen</a>
    </div>
  </div>
</form>

<script type="application/json" id="services-data"><?= $servicesJson ?></script>
<?php layout_footer(); ?>
