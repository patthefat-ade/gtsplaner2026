<?php
/** DANGI ERP – Dokument-Detailansicht + Angebot→Rechnung */
$pdo = db();
$id = (int)($_GET['id'] ?? 0);

$st = $pdo->prepare('SELECT d.*, c.company, c.first_name, c.last_name, c.street, c.zip, c.city, c.email, c.phone FROM documents d JOIN customers c ON c.id = d.customer_id WHERE d.id = ?');
$st->execute([$id]);
$doc = $st->fetch();
if (!$doc) { flash('Dokument nicht gefunden.'); redirect('index.php'); }

$isInvoice = $doc['doc_type'] === 'invoice';
$isCreditNote = $doc['doc_type'] === 'credit_note';
$labelSg = $isCreditNote ? 'Gutschrift' : ($isInvoice ? 'Rechnung' : 'Angebot');

/* ---------- E-Mail senden ---------- */
if (($_POST['do'] ?? '') === 'send_email') {
    csrf_check();
    require_once __DIR__ . '/../lib/mailer.php';

    $toEmail = trim($_POST['email_to'] ?? '');
    $subject = trim($_POST['email_subject'] ?? '');
    $body    = trim($_POST['email_body'] ?? '');

    if (!$toEmail || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        flash('Fehler: Bitte eine gültige E-Mail-Adresse eingeben.');
        redirect('index.php?page=document_view&id=' . $id);
    }

    /* PDF intern erzeugen (in Temp-Datei) */
    ob_start();
    $_GET['id'] = $id;
    $_GET['output_mode'] = 'string'; // Signal an pdf.php: PDF als String zurückgeben
    include __DIR__ . '/pdf.php';
    $pdfContent = ob_get_clean();

    $tmpFile = tempnam(sys_get_temp_dir(), 'dangi_pdf_');
    file_put_contents($tmpFile, $pdfContent);

    $pdfName = $labelSg . '_' . preg_replace('/[^A-Za-z0-9\-_]/', '_', $doc['doc_number']) . '.pdf';
    $toName  = customer_display_name($doc);

    $result = send_document_email($toEmail, $toName, $subject, $body, $tmpFile, $pdfName, $doc);
    unlink($tmpFile);

    if ($result === true) {
        flash($labelSg . ' wurde erfolgreich an ' . $toEmail . ' gesendet.');
        /* Rechnung automatisch auf "versendet" setzen wenn noch "offen" */
        if ($doc['doc_type'] === 'invoice' && $doc['status'] === 'offen') {
            $pdo->prepare("UPDATE documents SET status='versendet' WHERE id=?")->execute([$id]);
        }
    } else {
        flash('Fehler beim Senden: ' . $result);
    }
    redirect('index.php?page=document_view&id=' . $id);
}

/* ---------- Angebot → Rechnung ---------- */
if (($_GET['action'] ?? '') === 'to_invoice' && !$isInvoice && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo->beginTransaction();
    try {
        $number = next_doc_number('invoice');
        $dueDate = date('Y-m-d', strtotime('+' . (int)setting('invoice_due_days', '14') . ' days'));
        $sti = $pdo->prepare('INSERT INTO documents (doc_type, doc_number, customer_id, source_quote_id, doc_date, due_date, status, intro_text, outro_text, total_net) VALUES (?,?,?,?,?,?,?,?,?,?)');
        $sti->execute(['invoice', $number, $doc['customer_id'], $doc['id'], date('Y-m-d'), $dueDate, 'offen', setting('invoice_intro'), setting('invoice_outro'), $doc['total_net']]);
        $invoiceId = (int)$pdo->lastInsertId();

        $items = $pdo->prepare('SELECT * FROM document_items WHERE document_id = ? ORDER BY position');
        $items->execute([$doc['id']]);
        $ins = $pdo->prepare('INSERT INTO document_items (document_id, service_id, position, title, description, quantity, unit, unit_price, line_total) VALUES (?,?,?,?,?,?,?,?,?)');
        foreach ($items as $it) {
            $ins->execute([$invoiceId, $it['service_id'], $it['position'], $it['title'], $it['description'], $it['quantity'], $it['unit'], $it['unit_price'], $it['line_total']]);
        }

        // Angebot als angenommen markieren
        $pdo->prepare("UPDATE documents SET status='angenommen' WHERE id=?")->execute([$doc['id']]);

        $pdo->commit();
        flash('Rechnung ' . $number . ' aus Angebot ' . $doc['doc_number'] . ' erstellt.');
        redirect('index.php?page=document_view&id=' . $invoiceId);
    } catch (Throwable $t) {
        $pdo->rollBack();
        flash('Fehler: ' . $t->getMessage());
        redirect('index.php?page=document_view&id=' . $id);
    }
}

/* ---------- Rechnung → Gutschrift ---------- */
if (($_GET['action'] ?? '') === 'to_credit_note' && $isInvoice && $_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $pdo->beginTransaction();
    try {
        $cnNumber = next_doc_number('credit_note');
        $sti = $pdo->prepare('INSERT INTO documents (doc_type, doc_number, customer_id, source_invoice_id, doc_date, status, intro_text, outro_text, total_net) VALUES (?,?,?,?,?,?,?,?,?)');
        $introText = 'Gutschrift zu Rechnung ' . $doc['doc_number'];
        $sti->execute(['credit_note', $cnNumber, $doc['customer_id'], $doc['id'], date('Y-m-d'), 'offen', $introText, '', $doc['total_net']]);
        $cnId = (int)$pdo->lastInsertId();

        /* Positionen kopieren (gleiche Beträge – Gutschrift wird als Negativdokument verstanden) */
        $origItems = $pdo->prepare('SELECT * FROM document_items WHERE document_id = ? ORDER BY position');
        $origItems->execute([$doc['id']]);
        $ins = $pdo->prepare('INSERT INTO document_items (document_id, service_id, position, title, description, quantity, unit, unit_price, line_total) VALUES (?,?,?,?,?,?,?,?,?)');
        foreach ($origItems as $it) {
            $ins->execute([$cnId, $it['service_id'], $it['position'], $it['title'], $it['description'], $it['quantity'], $it['unit'], $it['unit_price'], $it['line_total']]);
        }

        /* Rechnung als gutgeschrieben markieren */
        $pdo->prepare("UPDATE documents SET status='gutgeschrieben' WHERE id=?")->execute([$doc['id']]);

        $pdo->commit();
        flash('Gutschrift ' . $cnNumber . ' zu Rechnung ' . $doc['doc_number'] . ' erstellt.');
        redirect('index.php?page=document_view&id=' . $cnId);
    } catch (Throwable $t) {
        $pdo->rollBack();
        flash('Fehler: ' . $t->getMessage());
        redirect('index.php?page=document_view&id=' . $id);
    }
}

$items = $pdo->prepare('SELECT * FROM document_items WHERE document_id = ? ORDER BY position');
$items->execute([$id]);
$items = $items->fetchAll();

/* Verknüpfte Rechnung(en) zu diesem Angebot */
$linkedInvoices = [];
if (!$isInvoice) {
    $li = $pdo->prepare("SELECT id, doc_number, status FROM documents WHERE source_quote_id = ? AND doc_type='invoice'");
    $li->execute([$id]);
    $linkedInvoices = $li->fetchAll();
}

/* Ursprungsangebot bei Rechnung */
$sourceQuote = null;
if ($isInvoice && $doc['source_quote_id']) {
    $sq = $pdo->prepare('SELECT id, doc_number FROM documents WHERE id = ?');
    $sq->execute([$doc['source_quote_id']]);
    $sourceQuote = $sq->fetch();
}

/* Verknüpfte Gutschrift(en) zu dieser Rechnung */
$linkedCreditNotes = [];
if ($isInvoice) {
    $cn = $pdo->prepare("SELECT id, doc_number, status FROM documents WHERE source_invoice_id = ? AND doc_type='credit_note'");
    $cn->execute([$id]);
    $linkedCreditNotes = $cn->fetchAll();
}

/* Ursprungsrechnung bei Gutschrift */
$sourceInvoice = null;
if ($isCreditNote && $doc['source_invoice_id']) {
    $si = $pdo->prepare('SELECT id, doc_number FROM documents WHERE id = ?');
    $si->execute([$doc['source_invoice_id']]);
    $sourceInvoice = $si->fetch();
}

$navActive = $isCreditNote ? 'credit_notes' : ($isInvoice ? 'invoices' : 'quotes');
layout_header($labelSg . ' ' . $doc['doc_number'], $navActive);
?>
<div class="page-head">
  <h1><?= $labelSg ?> <?= e($doc['doc_number']) ?></h1>
  <div style="display:flex;gap:0.6rem;flex-wrap:wrap">
    <a class="btn btn-primary" href="index.php?page=pdf&id=<?= $doc['id'] ?>" target="_blank">PDF herunterladen</a>
    <?php if (setting('smtp_host')): ?>
      <button class="btn btn-primary" type="button" onclick="document.getElementById('emailModal').style.display='flex'" style="background:#0FA7A0">✉ Per E-Mail senden</button>
    <?php endif; ?>
    <a class="btn btn-secondary" href="index.php?page=document_edit&id=<?= $doc['id'] ?>">Bearbeiten</a>
    <?php if (!$isInvoice): ?>
      <form method="post" action="index.php?page=document_view&id=<?= $doc['id'] ?>&action=to_invoice"
            onsubmit="return confirm('Aus diesem Angebot eine Rechnung erstellen?')">
        <?= csrf_field() ?>
        <button class="btn btn-primary" type="submit" style="background:var(--anthrazit)">→ Rechnung erstellen</button>
      </form>
    <?php endif; ?>
    <?php if ($isInvoice && $doc['status'] !== 'gutgeschrieben' && empty($linkedCreditNotes)): ?>
      <form method="post" action="index.php?page=document_view&id=<?= $doc['id'] ?>&action=to_credit_note"
            onsubmit="return confirm('Aus dieser Rechnung eine Gutschrift erstellen? Die Rechnung wird als gutgeschrieben markiert.')">
        <?= csrf_field() ?>
        <button class="btn btn-primary" type="submit" style="background:#c0392b">↩ Gutschrift erstellen</button>
      </form>
    <?php endif; ?>
    <a class="btn btn-secondary" href="index.php?page=documents&type=<?= $doc['doc_type'] ?>">← Zur Liste</a>
  </div>
</div>

<?php if ($isInvoice && !empty($linkedCreditNotes)): ?>
  <div class="alert" style="background:#fdecea;border-left:4px solid #c0392b;color:#922b21">
    <strong>Gutgeschrieben:</strong>
    <?php foreach ($linkedCreditNotes as $cn): ?>
      <a href="index.php?page=document_view&id=<?= $cn['id'] ?>"><strong><?= e($cn['doc_number']) ?></strong></a>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<?php if ($isCreditNote && $sourceInvoice): ?>
  <div class="alert" style="background:#eaf2f8;border-left:4px solid #2980b9;color:#1a5276">
    <strong>Gutschrift zu Rechnung:</strong>
    <a href="index.php?page=document_view&id=<?= $sourceInvoice['id'] ?>"><strong><?= e($sourceInvoice['doc_number']) ?></strong></a>
  </div>
<?php endif; ?>

<?php if ($linkedInvoices): ?>
  <div class="alert alert-success">
    Zu diesem Angebot wurde bereits erstellt:
    <?php foreach ($linkedInvoices as $li): ?>
      <a href="index.php?page=document_view&id=<?= $li['id'] ?>"><strong><?= e($li['doc_number']) ?></strong></a>
    <?php endforeach; ?>
  </div>
<?php endif; ?>
<?php if ($sourceQuote): ?>
  <div class="alert alert-success">
    Erstellt aus Angebot <a href="index.php?page=document_view&id=<?= $sourceQuote['id'] ?>"><strong><?= e($sourceQuote['doc_number']) ?></strong></a>
  </div>
<?php endif; ?>

<div class="card">
  <div class="doc-meta">
    <div class="item"><div class="k">Kunde</div><div class="v"><?= e(customer_display_name($doc)) ?></div>
      <div class="hint"><?= e($doc['street']) ?>, <?= e(trim($doc['zip'] . ' ' . $doc['city'])) ?></div></div>
    <div class="item"><div class="k">Datum</div><div class="v"><?= dmy($doc['doc_date']) ?></div></div>
    <div class="item"><div class="k"><?= $isInvoice ? 'Zahlbar bis' : 'Gültig bis' ?></div>
      <div class="v"><?= dmy($isInvoice ? $doc['due_date'] : $doc['valid_until']) ?: '–' ?></div></div>
    <?php if ($isInvoice && ($spLabel = service_period_label($doc)) !== ''): ?>
    <div class="item"><div class="k">Leistungszeitraum</div><div class="v"><?= e($spLabel) ?></div></div>
    <?php endif; ?>
    <div class="item"><div class="k">Status</div>
      <div class="v"><span class="badge badge-<?= e($doc['status']) ?>"><?= e(ucfirst(str_replace("_", " ", $doc["status"]))) ?></span></div></div>
    <div class="item"><div class="k">Summe netto</div><div class="v"><?= money((float)$doc['total_net']) ?></div></div>
  </div>

  <?php if ($doc['intro_text']): ?><p style="margin-bottom:1rem"><?= nl2br(e($doc['intro_text'])) ?></p><?php endif; ?>

  <div class="table-wrap" style="box-shadow:none">
    <table class="list">
      <thead><tr><th>Pos.</th><th>Leistung</th><th class="num">Menge</th><th>Einheit</th><th class="num">Einzelpreis</th><th class="num">Summe</th></tr></thead>
      <tbody>
      <?php foreach ($items as $it): ?>
        <tr>
          <td><?= (int)$it['position'] ?></td>
          <td><strong><?= e($it['title']) ?></strong>
            <?php if ($it['description']): ?><br><span class="hint"><?= nl2br(e($it['description'])) ?></span><?php endif; ?>
          </td>
          <td class="num"><?= number_format((float)$it['quantity'], 2, ',', '.') ?></td>
          <td><?= e($it['unit']) ?></td>
          <td class="num"><?= money((float)$it['unit_price']) ?></td>
          <td class="num"><?= money((float)$it['line_total']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <div class="totals-line">
    <span>Gesamtsumme netto:</span>
    <span><?= money((float)$doc['total_net']) ?></span>
  </div>
  <p class="hint" style="text-align:right"><?= e(setting('tax_note')) ?></p>

  <?php if ($doc['outro_text']): ?><p style="margin-top:1rem"><?= nl2br(e($doc['outro_text'])) ?></p><?php endif; ?>
</div>
<?php layout_footer(); ?>

<!-- E-Mail-Modal -->
<div id="emailModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;padding:1rem">
  <div style="background:#fff;border-radius:12px;max-width:520px;width:100%;padding:2rem;box-shadow:0 8px 32px rgba(0,0,0,0.18)">
    <h3 style="margin:0 0 1rem;color:var(--anthrazit)"><?= e($labelSg) ?> per E-Mail senden</h3>
    <form method="post">
      <?= csrf_field() ?>
      <input type="hidden" name="do" value="send_email">
      <div class="field" style="margin-bottom:0.8rem">
        <label>Empfänger</label>
        <input type="email" name="email_to" value="<?= e($doc['email'] ?? '') ?>" required placeholder="kunde@beispiel.at">
      </div>
      <div class="field" style="margin-bottom:0.8rem">
        <label>Betreff</label>
        <input type="text" name="email_subject" value="<?= e($labelSg . ' ' . $doc['doc_number'] . ' – ' . setting('company_name')) ?>" required>
      </div>
      <div class="field" style="margin-bottom:1rem">
        <label>Nachricht</label>
        <textarea name="email_body" rows="5" placeholder="Optionaler Begleittext..."><?= e("Sehr geehrte Damen und Herren,\n\nim Anhang übersenden wir Ihnen " . ($isInvoice ? 'unsere Rechnung' : 'unser Angebot') . " " . $doc['doc_number'] . ".\n\nMit freundlichen Grüßen\n" . str_replace('Inhaber: ', '', setting('company_owner')) . "\n" . setting('company_name')) ?></textarea>
      </div>
      <div style="display:flex;gap:0.6rem;justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('emailModal').style.display='none'">Abbrechen</button>
        <button type="submit" class="btn btn-primary" style="background:#0FA7A0">Senden</button>
      </div>
    </form>
  </div>
</div>
