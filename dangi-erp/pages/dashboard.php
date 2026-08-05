<?php
/** DANGI ERP – Dashboard */
$pdo = db();

$counts = [
    'customers' => (int)$pdo->query('SELECT COUNT(*) FROM customers')->fetchColumn(),
    'services'  => (int)$pdo->query('SELECT COUNT(*) FROM services WHERE active = 1')->fetchColumn(),
    'quotes'    => (int)$pdo->query("SELECT COUNT(*) FROM documents WHERE doc_type='quote'")->fetchColumn(),
    'invoices'  => (int)$pdo->query("SELECT COUNT(*) FROM documents WHERE doc_type='invoice'")->fetchColumn(),
];
$openInvoices = $pdo->query("SELECT COALESCE(SUM(total_net),0) FROM documents WHERE doc_type='invoice' AND status='offen'")->fetchColumn();

$recent = $pdo->query("
    SELECT d.*, c.company, c.first_name, c.last_name
    FROM documents d JOIN customers c ON c.id = d.customer_id
    ORDER BY d.created_at DESC LIMIT 8
")->fetchAll();

layout_header('Übersicht', 'dashboard');
?>
<div class="page-head">
  <h1>Übersicht</h1>
  <div>
    <a class="btn btn-primary" href="index.php?page=document_edit&type=quote">+ Neues Angebot</a>
    <a class="btn btn-secondary" href="index.php?page=document_edit&type=invoice">+ Neue Rechnung</a>
  </div>
</div>

<div class="stat-grid">
  <div class="stat"><div class="label">Kunden</div><div class="value"><?= $counts['customers'] ?></div></div>
  <div class="stat"><div class="label">Dienstleistungen</div><div class="value"><?= $counts['services'] ?></div></div>
  <div class="stat"><div class="label">Angebote</div><div class="value"><?= $counts['quotes'] ?></div></div>
  <div class="stat"><div class="label">Rechnungen</div><div class="value"><?= $counts['invoices'] ?></div></div>
  <div class="stat"><div class="label">Offene Rechnungssumme</div><div class="value"><?= money((float)$openInvoices) ?></div></div>
</div>

<div class="card">
  <h2 style="margin-bottom:0.9rem;font-size:1.1rem;color:var(--anthrazit)">Zuletzt erstellte Dokumente</h2>
  <?php if (!$recent): ?>
    <p class="hint">Noch keine Dokumente vorhanden. Legen Sie zuerst einen Kunden an und erstellen Sie dann ein Angebot.</p>
  <?php else: ?>
  <div class="table-wrap" style="box-shadow:none">
    <table class="list">
      <thead><tr><th>Nummer</th><th>Typ</th><th>Kunde</th><th>Datum</th><th>Status</th><th class="num">Summe</th></tr></thead>
      <tbody>
      <?php foreach ($recent as $d): ?>
        <tr>
          <td><a href="index.php?page=document_view&id=<?= $d['id'] ?>"><strong><?= e($d['doc_number']) ?></strong></a></td>
          <td><span class="badge badge-<?= $d['doc_type'] ?>"><?= $d['doc_type'] === 'quote' ? 'Angebot' : 'Rechnung' ?></span></td>
          <td><?= e(customer_display_name($d)) ?></td>
          <td><?= dmy($d['doc_date']) ?></td>
          <td><span class="badge badge-<?= e($d['status']) ?>"><?= e(ucfirst($d['status'])) ?></span></td>
          <td class="num"><?= money((float)$d['total_net']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>
<?php layout_footer(); ?>
