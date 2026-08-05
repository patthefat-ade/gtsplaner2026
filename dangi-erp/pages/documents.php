<?php
/** DANGI ERP – Dokumentliste (Angebote / Rechnungen) */
$pdo = db();
$typeRaw = $_GET['type'] ?? 'quote';
$type = in_array($typeRaw, ['invoice','credit_note']) ? $typeRaw : 'quote';
$isInvoice = $type === 'invoice';
$isCreditNote = $type === 'credit_note';
$label = $isCreditNote ? 'Gutschriften' : ($isInvoice ? 'Rechnungen' : 'Angebote');
$labelSg = $isCreditNote ? 'Gutschrift' : ($isInvoice ? 'Rechnung' : 'Angebot');

/* ---------- Status ändern ---------- */
if (($_GET['action'] ?? '') === 'status' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = (int)($_GET['id'] ?? 0);
    $allowed = $isCreditNote ? ['offen','erledigt'] : ($isInvoice ? ['offen','versendet','bezahlt','mahnung_1','mahnung_2','mahnung_3','inkasso','anwalt','nicht_einbringbar','storniert','gutgeschrieben'] : ['offen','angenommen','abgelehnt']);
    $status = $_POST['status'] ?? '';
    if ($id && in_array($status, $allowed, true)) {
        $st = $pdo->prepare('UPDATE documents SET status=? WHERE id=? AND doc_type=?');
        $st->execute([$status, $id, $type]);
        flash('Status aktualisiert.');
    }
    redirect('index.php?page=documents&type=' . $type);
}

/* ---------- Mehrfach-Status ändern ---------- */
if (($_GET['action'] ?? '') === 'bulk_status' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $ids = array_map('intval', $_POST['doc_ids'] ?? []);
    $newStatus = $_POST['bulk_status'] ?? '';
    $allowed = $isCreditNote ? ['offen','erledigt'] : ($isInvoice ? ['offen','versendet','bezahlt','mahnung_1','mahnung_2','mahnung_3','inkasso','anwalt','nicht_einbringbar','storniert','gutgeschrieben'] : ['offen','angenommen','abgelehnt']);
    if ($ids && in_array($newStatus, $allowed, true)) {
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge([$newStatus], $ids, [$type]);
        $pdo->prepare("UPDATE documents SET status=? WHERE id IN ($placeholders) AND doc_type=?")->execute($params);
        flash(count($ids) . ' Dokument(e) auf „' . ucfirst(str_replace('_', ' ', $newStatus)) . '" gesetzt.');
    }
    redirect('index.php?page=documents&type=' . $type);
}

/* ---------- Löschen ---------- */
if (($_GET['action'] ?? '') === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id) {
        $pdo->prepare('DELETE FROM documents WHERE id=? AND doc_type=?')->execute([$id, $type]);
        flash($labelSg . ' gelöscht.');
    }
    redirect('index.php?page=documents&type=' . $type);
}

$docs = $pdo->prepare("
    SELECT d.*, c.company, c.first_name, c.last_name
    FROM documents d JOIN customers c ON c.id = d.customer_id
    WHERE d.doc_type = ?
    ORDER BY d.doc_date DESC, d.id DESC
");
$docs->execute([$type]);
$docs = $docs->fetchAll();

$invoiceStatuses = ['offen','versendet','bezahlt','mahnung_1','mahnung_2','mahnung_3','inkasso','anwalt','nicht_einbringbar','storniert','gutgeschrieben'];
$invoiceStatusLabels = ['offen'=>'Offen','versendet'=>'Versendet','bezahlt'=>'Bezahlt','mahnung_1'=>'Mahnung 1','mahnung_2'=>'Mahnung 2','mahnung_3'=>'Mahnung 3','inkasso'=>'Inkasso','anwalt'=>'Anwalt','nicht_einbringbar'=>'Nicht einbringbar','storniert'=>'Storniert','gutgeschrieben'=>'Gutgeschrieben'];
$statusOptions = $isCreditNote ? ['offen','erledigt'] : ($isInvoice ? $invoiceStatuses : ['offen','angenommen','abgelehnt']);
$statusLabels = $isInvoice ? $invoiceStatusLabels : array_combine($statusOptions, array_map('ucfirst', $statusOptions));

$navActive = $isCreditNote ? 'credit_notes' : ($isInvoice ? 'invoices' : 'quotes');
layout_header($label, $navActive);
?>
<div class="page-head">
  <h1><?= $label ?> <span class="sub">(<?= count($docs) ?>)</span></h1>
  <?php if (!$isCreditNote): ?>
    <a class="btn btn-primary" href="index.php?page=document_edit&type=<?= $type ?>">+ <?= $isInvoice ? 'Neue Rechnung' : 'Neues Angebot' ?></a>
  <?php endif; ?>
</div>

<?php if (!$docs): ?>
  <div class="card"><p class="hint">Noch keine <?= $label ?> vorhanden.</p></div>
<?php else: ?>

<!-- Filter-Toolbar -->
<div class="card" id="filterBar" style="padding:0.7rem 1rem;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
  <label style="font-size:0.85rem;font-weight:600">Filter:</label>
  <?php if ($isInvoice): ?>
  <select id="filterStatus" style="border:1px solid var(--grau-linie);border-radius:6px;padding:0.25rem 0.5rem;font-size:0.85rem">
    <option value="">Alle Status</option>
    <?php foreach ($invoiceStatuses as $s): ?>
      <option value="<?= $s ?>"><?= $statusLabels[$s] ?></option>
    <?php endforeach; ?>
  </select>
  <?php endif; ?>
  <input type="text" id="filterSearch" placeholder="Kunde oder Rechnungsnr. suchen…"
         style="border:1px solid var(--grau-linie);border-radius:6px;padding:0.25rem 0.6rem;font-size:0.85rem;min-width:200px;font-family:var(--font)">
  <select id="filterZeitraum" style="border:1px solid var(--grau-linie);border-radius:6px;padding:0.25rem 0.5rem;font-size:0.85rem">
    <option value="">Alle Zeiträume</option>
    <option value="heute">Heute</option>
    <option value="woche">Diese Woche</option>
    <option value="monat">Dieser Monat</option>
    <option value="letzter_monat">Letzter Monat</option>
    <option value="custom">Von – Bis</option>
  </select>
  <span id="customDateRange" style="display:none;align-items:center;gap:0.4rem">
    <input type="date" id="filterVon" style="border:1px solid var(--grau-linie);border-radius:6px;padding:0.2rem 0.4rem;font-size:0.85rem;font-family:var(--font)">
    <span style="font-size:0.85rem">–</span>
    <input type="date" id="filterBis" style="border:1px solid var(--grau-linie);border-radius:6px;padding:0.2rem 0.4rem;font-size:0.85rem;font-family:var(--font)">
  </span>
  <span class="hint" id="filterCount"></span>
</div>

<?php if ($isInvoice): ?>
<!-- Bulk-Formular AUSSERHALB der Tabelle – keine verschachtelten Forms -->
<form method="post" action="index.php?page=documents&type=<?= $type ?>&action=bulk_status" id="bulkForm">
  <?= csrf_field() ?>
  <div class="card" style="padding:0.6rem 1rem;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
    <label style="font-size:0.85rem;font-weight:600">Auswahl:</label>
    <select name="bulk_status" style="border:1px solid var(--grau-linie);border-radius:6px;padding:0.25rem 0.5rem;font-size:0.85rem">
      <?php foreach ($invoiceStatuses as $s): if ($s === 'gutgeschrieben') continue; ?>
        <option value="<?= $s ?>"><?= $statusLabels[$s] ?></option>
      <?php endforeach; ?>
    </select>
    <button type="submit" class="btn btn-sm btn-primary" onclick="return confirm('Status für alle ausgewählten Rechnungen ändern?')">Status setzen</button>
    <span class="hint" id="bulkCount">0 ausgewählt</span>
  </div>
  <!-- Versteckte Inputs für ausgewählte IDs werden per JS eingefügt -->
  <div id="bulkIds"></div>
</form>
<?php endif; ?>

<div class="table-wrap">
  <table class="list">
    <thead><tr>
      <?php if ($isInvoice): ?><th style="width:2rem"><input type="checkbox" id="checkAll"></th><?php endif; ?>
      <th>Nummer</th><th>Kunde</th><th>Datum</th>
      <th><?= $isInvoice ? 'Fällig am' : 'Gültig bis' ?></th>
      <th>Status</th><th class="num">Summe netto</th><th class="actions">Aktionen</th>
    </tr></thead>
    <tbody>
    <?php foreach ($docs as $d): ?>
      <tr data-status="<?= e($d['status']) ?>"
          data-kunde="<?= e(strtolower(customer_display_name($d))) ?>"
          data-nummer="<?= e(strtolower($d['doc_number'])) ?>"
          data-datum="<?= e($d['doc_date']) ?>">
        <?php if ($isInvoice): ?><td><input type="checkbox" data-doc-id="<?= $d['id'] ?>" class="doc-check"></td><?php endif; ?>
        <td><a href="index.php?page=document_view&id=<?= $d['id'] ?>"><strong><?= e($d['doc_number']) ?></strong></a>
          <?php if ($d["source_quote_id"]): ?><br><span class="hint">aus Angebot</span><?php endif; ?>
          <?php if ($d["source_invoice_id"] ?? null): ?><br><span class="hint" style="color:#c0392b">zu Rechnung</span><?php endif; ?>
        </td>
        <td><?= e(customer_display_name($d)) ?></td>
        <td><?= dmy($d['doc_date']) ?></td>
        <td><?= dmy($isInvoice ? $d['due_date'] : $d['valid_until']) ?></td>
        <td>
          <form method="post" action="index.php?page=documents&type=<?= $type ?>&action=status&id=<?= $d['id'] ?>">
            <?= csrf_field() ?>
            <select name="status" onchange="this.form.submit()"
                    style="border:1px solid var(--grau-linie);border-radius:6px;padding:0.25rem 0.4rem;font-family:var(--font);font-size:0.85rem">
              <?php foreach ($statusOptions as $s): ?>
                <option value="<?= $s ?>" <?= $d['status'] === $s ? 'selected' : '' ?>><?= $statusLabels[$s] ?? ucfirst(str_replace('_', ' ', $s)) ?></option>
              <?php endforeach; ?>
            </select>
          </form>
        </td>
        <td class="num"><?= money((float)$d['total_net']) ?></td>
        <td class="actions">
          <a class="btn btn-sm btn-secondary" href="index.php?page=document_view&id=<?= $d['id'] ?>">Öffnen</a>
          <a class="btn btn-sm btn-secondary" href="index.php?page=pdf&id=<?= $d['id'] ?>" target="_blank">PDF</a>
          <form method="post" action="index.php?page=documents&type=<?= $type ?>&action=delete&id=<?= $d['id'] ?>" style="display:inline"
                onsubmit="return confirm('<?= $labelSg ?> <?= e($d['doc_number']) ?> wirklich löschen?')">
            <?= csrf_field() ?>
            <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>

<?php if ($isInvoice): ?>
<script>
(function() {
  var checkAll = document.getElementById('checkAll');
  var checks = document.querySelectorAll('.doc-check');
  var bulkIds = document.getElementById('bulkIds');
  var bulkCount = document.getElementById('bulkCount');
  var bulkForm = document.getElementById('bulkForm');

  checkAll.addEventListener('change', function() {
    checks.forEach(function(cb) { cb.checked = checkAll.checked; });
    updateBulkCount();
  });
  checks.forEach(function(cb) { cb.addEventListener('change', updateBulkCount); });

  function updateBulkCount() {
    var n = document.querySelectorAll('.doc-check:checked').length;
    bulkCount.textContent = n + ' ausgewählt';
  }

  /* Vor dem Absenden des Bulk-Formulars: ausgewählte IDs als hidden inputs einfügen */
  bulkForm.addEventListener('submit', function() {
    bulkIds.innerHTML = '';
    document.querySelectorAll('.doc-check:checked').forEach(function(cb) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'doc_ids[]';
      input.value = cb.getAttribute('data-doc-id');
      bulkIds.appendChild(input);
    });
  });
})();
</script>
<?php endif; ?>

<!-- Filter-Script (clientseitig) -->
<script>
(function() {
  var rows = document.querySelectorAll('.list tbody tr');
  var filterStatus = document.getElementById('filterStatus');
  var filterSearch = document.getElementById('filterSearch');
  var filterZeitraum = document.getElementById('filterZeitraum');
  var filterVon = document.getElementById('filterVon');
  var filterBis = document.getElementById('filterBis');
  var customRange = document.getElementById('customDateRange');
  var filterCount = document.getElementById('filterCount');

  function parseDE(str) {
    // Datum im Format YYYY-MM-DD (aus data-datum)
    if (!str) return null;
    var d = new Date(str + 'T00:00:00');
    return isNaN(d) ? null : d;
  }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function getZeitraumRange(val) {
    var now = new Date();
    var today = startOfDay(now);
    var von, bis;
    switch (val) {
      case 'heute':
        von = bis = today;
        break;
      case 'woche':
        var dow = today.getDay() || 7; // Montag=1
        von = new Date(today); von.setDate(today.getDate() - (dow - 1));
        bis = new Date(von); bis.setDate(von.getDate() + 6);
        break;
      case 'monat':
        von = new Date(today.getFullYear(), today.getMonth(), 1);
        bis = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'letzter_monat':
        von = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        bis = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'custom':
        von = filterVon.value ? startOfDay(new Date(filterVon.value)) : null;
        bis = filterBis.value ? startOfDay(new Date(filterBis.value)) : null;
        break;
      default:
        return null;
    }
    return { von: von, bis: bis };
  }

  function applyFilters() {
    var statusVal = filterStatus ? filterStatus.value : '';
    var searchVal = filterSearch.value.toLowerCase().trim();
    var zeitraumVal = filterZeitraum.value;
    var range = getZeitraumRange(zeitraumVal);
    var visible = 0;

    // Custom-Datumsfelder ein-/ausblenden
    customRange.style.display = zeitraumVal === 'custom' ? 'flex' : 'none';

    rows.forEach(function(row) {
      var show = true;

      // Status-Filter
      if (statusVal && row.getAttribute('data-status') !== statusVal) {
        show = false;
      }

      // Suchfeld (Kunde oder Nummer)
      if (show && searchVal) {
        var kunde = row.getAttribute('data-kunde') || '';
        var nummer = row.getAttribute('data-nummer') || '';
        if (kunde.indexOf(searchVal) === -1 && nummer.indexOf(searchVal) === -1) {
          show = false;
        }
      }

      // Zeitraum-Filter
      if (show && range) {
        var datum = parseDE(row.getAttribute('data-datum'));
        if (datum) {
          if (range.von && datum < range.von) show = false;
          if (range.bis && datum > range.bis) show = false;
        } else {
          show = false;
        }
      }

      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    filterCount.textContent = visible + ' von ' + rows.length + ' angezeigt';
  }

  // Event-Listener
  if (filterStatus) filterStatus.addEventListener('change', applyFilters);
  filterSearch.addEventListener('input', applyFilters);
  filterZeitraum.addEventListener('change', applyFilters);
  filterVon.addEventListener('change', applyFilters);
  filterBis.addEventListener('change', applyFilters);

  // Initial
  applyFilters();
})();
</script>

<?php endif; ?>
<?php layout_footer(); ?>
