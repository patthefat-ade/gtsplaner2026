<?php
/**
 * DANGI ERP – Planrechnung
 * Monatlich wiederkehrende und einmalige Kosten/Einnahmen,
 * gezahlt/erhalten-Markierung pro Monat, automatischer Monatssaldo.
 * CI: Türkis (#0FA7A0), Anthrazit (#3B4757)
 */
$pdo = db();
$action = $_GET['action'] ?? 'list';
$id = (int)($_GET['id'] ?? 0);

/* Aktueller Monat (YYYY-MM), über ?month=… wählbar */
$month = $_GET['month'] ?? date('Y-m');
if (!preg_match('/^\d{4}-\d{2}$/', $month)) { $month = date('Y-m'); }

function month_label(string $ym): string {
    $names = [1=>'Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    [$y, $m] = explode('-', $ym);
    return ($names[(int)$m] ?? $m) . ' ' . $y;
}
function month_shift(string $ym, int $delta): string {
    [$y, $m] = explode('-', $ym);
    $t = mktime(12, 0, 0, (int)$m + $delta, 1, (int)$y);
    return date('Y-m', $t);
}

/* ---------- Posten speichern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === 'new' || $action === 'edit')) {
    $kind       = ($_POST['kind'] ?? 'expense') === 'income' ? 'income' : 'expense';
    $recurrence = ($_POST['recurrence'] ?? 'once') === 'recurring' ? 'recurring' : 'once';
    $title      = trim($_POST['title'] ?? '');
    $amount     = (float)str_replace(',', '.', str_replace('.', '', $_POST['amount'] ?? '0'));
    $startMonth = $_POST['start_month'] ?? $month;
    $endMonth   = trim($_POST['end_month'] ?? '');
    $notes      = trim($_POST['notes'] ?? '');

    if (!preg_match('/^\d{4}-\d{2}$/', $startMonth)) { $startMonth = date('Y-m'); }
    if ($recurrence === 'once' || !preg_match('/^\d{4}-\d{2}$/', $endMonth)) { $endMonth = null; }

    if ($title === '' || $amount <= 0) {
        flash('Bitte Titel und einen Betrag größer 0 angeben.');
    } else {
        if ($action === 'edit' && $id) {
            $st = $pdo->prepare('UPDATE plan_items SET kind=?, recurrence=?, title=?, amount=?, start_month=?, end_month=?, notes=? WHERE id=?');
            $st->execute([$kind, $recurrence, $title, $amount, $startMonth, $endMonth, $notes, $id]);
            flash('Posten aktualisiert.');
        } else {
            $st = $pdo->prepare('INSERT INTO plan_items (kind, recurrence, title, amount, start_month, end_month, notes) VALUES (?,?,?,?,?,?,?)');
            $st->execute([$kind, $recurrence, $title, $amount, $startMonth, $endMonth, $notes]);
            flash('Posten angelegt.');
        }
        redirect('index.php?page=planning&month=' . urlencode($startMonth));
    }
}

/* ---------- Posten löschen ---------- */
if ($action === 'delete' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo->prepare('DELETE FROM plan_items WHERE id = ?')->execute([$id]);
    flash('Posten gelöscht.');
    redirect('index.php?page=planning&month=' . urlencode($month));
}

/* ---------- Gezahlt/erhalten umschalten ---------- */
if ($action === 'toggle' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $st = $pdo->prepare('SELECT paid FROM plan_payments WHERE plan_item_id = ? AND month = ?');
    $st->execute([$id, $month]);
    $row = $st->fetch();
    if ($row) {
        $newPaid = ((int)$row['paid']) ? 0 : 1;
        $pdo->prepare('UPDATE plan_payments SET paid = ?, paid_at = ? WHERE plan_item_id = ? AND month = ?')
            ->execute([$newPaid, $newPaid ? date('Y-m-d') : null, $id, $month]);
    } else {
        $pdo->prepare('INSERT INTO plan_payments (plan_item_id, month, paid, paid_at) VALUES (?,?,1,CURDATE())')
            ->execute([$id, $month]);
    }
    redirect('index.php?page=planning&month=' . urlencode($month));
}

/* ---------- Formular (neu/bearbeiten) ---------- */
if ($action === 'new' || $action === 'edit') {
    $p = ['kind'=>$_GET['kind'] ?? 'expense','recurrence'=>'once','title'=>'','amount'=>'0.00','start_month'=>$month,'end_month'=>'','notes'=>''];
    if ($action === 'edit' && $id) {
        $st = $pdo->prepare('SELECT * FROM plan_items WHERE id = ?');
        $st->execute([$id]);
        $p = $st->fetch() ?: $p;
    }
    layout_header($action === 'edit' ? 'Posten bearbeiten' : 'Neuer Posten', 'planning');
    ?>
    <div class="page-head">
      <h1><?= $action === 'edit' ? 'Posten bearbeiten' : 'Neuer Posten' ?></h1>
      <a class="btn btn-secondary" href="index.php?page=planning&month=<?= e($month) ?>">← Zur Planrechnung</a>
    </div>
    <div class="card">
      <form method="post">
        <?= csrf_field() ?>
        <div class="grid-3">
          <div class="field"><label>Art *</label>
            <select name="kind">
              <option value="expense" <?= $p['kind'] === 'expense' ? 'selected' : '' ?>>Kosten (Ausgabe)</option>
              <option value="income" <?= $p['kind'] === 'income' ? 'selected' : '' ?>>Einnahme</option>
            </select>
          </div>
          <div class="field"><label>Rhythmus *</label>
            <select name="recurrence" id="plan-recurrence">
              <option value="once" <?= $p['recurrence'] === 'once' ? 'selected' : '' ?>>einmalig (nur ein Monat)</option>
              <option value="recurring" <?= $p['recurrence'] === 'recurring' ? 'selected' : '' ?>>monatlich wiederkehrend</option>
            </select>
          </div>
          <div class="field"><label>Betrag (€) *</label>
            <input type="text" inputmode="decimal" name="amount" required value="<?= number_format((float)$p['amount'], 2, ',', '') ?>"></div>
        </div>
        <div class="field"><label>Titel *</label><input type="text" name="title" required value="<?= e($p['title']) ?>" placeholder="z. B. Kfz-Versicherung, Wartungsvertrag Hausverwaltung X"></div>
        <div class="grid-3">
          <div class="field"><label>Monat bzw. Startmonat *</label>
            <input type="month" name="start_month" required value="<?= e($p['start_month']) ?>">
            <span class="hint">Einmalig: betroffener Monat. Wiederkehrend: erster Monat.</span>
          </div>
          <div class="field" id="plan-end-field"><label>Endmonat (optional)</label>
            <input type="month" name="end_month" value="<?= e($p['end_month'] ?? '') ?>">
            <span class="hint">Nur bei wiederkehrend. Leer = unbefristet.</span>
          </div>
        </div>
        <div class="field"><label>Notiz</label><textarea name="notes" rows="3"><?= e($p['notes'] ?? '') ?></textarea></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Speichern</button>
          <a class="btn btn-secondary" href="index.php?page=planning&month=<?= e($month) ?>">Abbrechen</a>
        </div>
      </form>
    </div>
    <script>
    (function(){
      var rec = document.getElementById('plan-recurrence');
      var endF = document.getElementById('plan-end-field');
      function upd(){ endF.style.display = rec.value === 'recurring' ? '' : 'none'; }
      rec.addEventListener('change', upd); upd();
    })();
    </script>
    <?php
    layout_footer();
    exit;
}

/* ---------- Monatsansicht ---------- */
/* Posten, die im gewählten Monat aktiv sind */
$st = $pdo->prepare(
    "SELECT pi.*, pp.paid, pp.paid_at
       FROM plan_items pi
       LEFT JOIN plan_payments pp ON pp.plan_item_id = pi.id AND pp.month = :m
      WHERE (pi.recurrence = 'once' AND pi.start_month = :m)
         OR (pi.recurrence = 'recurring' AND pi.start_month <= :m AND (pi.end_month IS NULL OR pi.end_month >= :m))
      ORDER BY pi.kind, pi.recurrence DESC, pi.title"
);
$st->execute(['m' => $month]);
$items = $st->fetchAll();

$incomes  = array_values(array_filter($items, fn($i) => $i['kind'] === 'income'));
$expenses = array_values(array_filter($items, fn($i) => $i['kind'] === 'expense'));

$sumPlan = fn(array $arr) => array_sum(array_map(fn($i) => (float)$i['amount'], $arr));
$sumPaid = fn(array $arr) => array_sum(array_map(fn($i) => !empty($i['paid']) ? (float)$i['amount'] : 0.0, $arr));

$planIncome  = $sumPlan($incomes);   $paidIncome  = $sumPaid($incomes);
$planExpense = $sumPlan($expenses);  $paidExpense = $sumPaid($expenses);
$planSaldo   = $planIncome - $planExpense;
$istSaldo    = $paidIncome - $paidExpense;

/* Jahresübersicht: 12 Monate des Jahres des gewählten Monats */
$year = substr($month, 0, 4);
$yearRows = [];
for ($m = 1; $m <= 12; $m++) {
    $ym = sprintf('%s-%02d', $year, $m);
    $st = $pdo->prepare(
        "SELECT pi.kind, pi.amount, pp.paid
           FROM plan_items pi
           LEFT JOIN plan_payments pp ON pp.plan_item_id = pi.id AND pp.month = :m
          WHERE (pi.recurrence = 'once' AND pi.start_month = :m)
             OR (pi.recurrence = 'recurring' AND pi.start_month <= :m AND (pi.end_month IS NULL OR pi.end_month >= :m))"
    );
    $st->execute(['m' => $ym]);
    $rows = $st->fetchAll();
    $pi = 0.0; $pe = 0.0; $ii = 0.0; $ie = 0.0;
    foreach ($rows as $r) {
        $a = (float)$r['amount'];
        if ($r['kind'] === 'income') { $pi += $a; if (!empty($r['paid'])) $ii += $a; }
        else { $pe += $a; if (!empty($r['paid'])) $ie += $a; }
    }
    $yearRows[] = ['ym'=>$ym, 'plan_in'=>$pi, 'plan_out'=>$pe, 'plan_saldo'=>$pi-$pe, 'ist_saldo'=>$ii-$ie];
}

layout_header('Planrechnung', 'planning');

function plan_table(array $rows, string $kindLabel, string $month): void {
    if (!$rows) {
        echo '<p class="hint">Keine ' . e($kindLabel) . ' in diesem Monat.</p>';
        return;
    }
    ?>
    <div class="table-wrap">
      <table class="list">
        <thead><tr><th></th><th>Titel</th><th>Rhythmus</th><th class="num">Betrag</th><th>Status</th><th class="actions">Aktionen</th></tr></thead>
        <tbody>
        <?php foreach ($rows as $i): $isPaid = !empty($i['paid']); ?>
          <tr>
            <td style="width:2.2rem">
              <form method="post" action="index.php?page=planning&action=toggle&id=<?= $i['id'] ?>&month=<?= e($month) ?>">
                <?= csrf_field() ?>
                <button type="submit" class="paid-toggle <?= $isPaid ? 'is-paid' : '' ?>"
                        title="<?= $isPaid ? 'Als offen markieren' : ($i['kind'] === 'income' ? 'Als erhalten markieren' : 'Als gezahlt markieren') ?>">
                  <?= $isPaid ? '✓' : '' ?>
                </button>
              </form>
            </td>
            <td>
              <strong <?= $isPaid ? 'style="text-decoration:line-through;opacity:.65"' : '' ?>><?= e($i['title']) ?></strong>
              <?php if (!empty($i['notes'])): ?><div class="hint"><?= e(mb_strimwidth($i['notes'], 0, 90, '…')) ?></div><?php endif; ?>
            </td>
            <td><?= $i['recurrence'] === 'recurring'
                  ? '<span class="badge badge-offen">monatlich</span>'
                  : '<span class="badge">einmalig</span>' ?></td>
            <td class="num"><strong><?= money((float)$i['amount']) ?></strong></td>
            <td>
              <?php if ($isPaid): ?>
                <span class="badge badge-angenommen"><?= $i['kind'] === 'income' ? 'erhalten' : 'gezahlt' ?><?= $i['paid_at'] ? ' ' . dmy($i['paid_at']) : '' ?></span>
              <?php else: ?>
                <span class="badge badge-abgelehnt">offen</span>
              <?php endif; ?>
            </td>
            <td class="actions">
              <a class="btn btn-sm btn-secondary" href="index.php?page=planning&action=edit&id=<?= $i['id'] ?>&month=<?= e($month) ?>">Bearbeiten</a>
              <form method="post" action="index.php?page=planning&action=delete&id=<?= $i['id'] ?>&month=<?= e($month) ?>" style="display:inline"
                    onsubmit="return confirm('Posten wirklich löschen? Auch die Markierungen aller Monate werden entfernt.')">
                <?= csrf_field() ?>
                <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php
}
?>
<div class="page-head">
  <h1>Planrechnung <span class="sub"><?= e(month_label($month)) ?></span></h1>
  <div class="month-nav">
    <a class="btn btn-secondary btn-sm" href="index.php?page=planning&month=<?= e(month_shift($month, -1)) ?>">←</a>
    <form method="get" action="index.php" style="display:inline-flex;gap:.4rem;align-items:center">
      <input type="hidden" name="page" value="planning">
      <input type="month" name="month" value="<?= e($month) ?>" onchange="this.form.submit()">
    </form>
    <a class="btn btn-secondary btn-sm" href="index.php?page=planning&month=<?= e(month_shift($month, 1)) ?>">→</a>
    <a class="btn btn-secondary btn-sm" href="index.php?page=planning&month=<?= date('Y-m') ?>">Heute</a>
  </div>
</div>

<div class="stats">
  <div class="stat"><span class="stat-label">Einnahmen (Plan / erhalten)</span>
    <span class="stat-value"><?= money($planIncome) ?></span>
    <span class="hint">davon erhalten: <?= money($paidIncome) ?></span></div>
  <div class="stat"><span class="stat-label">Kosten (Plan / gezahlt)</span>
    <span class="stat-value"><?= money($planExpense) ?></span>
    <span class="hint">davon gezahlt: <?= money($paidExpense) ?></span></div>
  <div class="stat"><span class="stat-label">Monatssaldo (Plan)</span>
    <span class="stat-value" style="color:<?= $planSaldo >= 0 ? '#0FA7A0' : '#C0392B' ?>"><?= money($planSaldo) ?></span></div>
  <div class="stat"><span class="stat-label">Monatssaldo (Ist – nur gezahlt/erhalten)</span>
    <span class="stat-value" style="color:<?= $istSaldo >= 0 ? '#0FA7A0' : '#C0392B' ?>"><?= money($istSaldo) ?></span></div>
</div>

<div class="card">
  <div class="page-head" style="margin-bottom:.6rem">
    <h2>Einnahmen</h2>
    <a class="btn btn-primary btn-sm" href="index.php?page=planning&action=new&kind=income&month=<?= e($month) ?>">+ Einnahme</a>
  </div>
  <?php plan_table($incomes, 'Einnahmen', $month); ?>
</div>

<div class="card">
  <div class="page-head" style="margin-bottom:.6rem">
    <h2>Kosten</h2>
    <a class="btn btn-primary btn-sm" href="index.php?page=planning&action=new&kind=expense&month=<?= e($month) ?>">+ Kosten</a>
  </div>
  <?php plan_table($expenses, 'Kosten', $month); ?>
</div>

<div class="card">
  <h2>Jahresübersicht <?= e($year) ?></h2>
  <div class="table-wrap">
    <table class="list">
      <thead><tr><th>Monat</th><th class="num">Einnahmen (Plan)</th><th class="num">Kosten (Plan)</th><th class="num">Saldo (Plan)</th><th class="num">Saldo (Ist)</th></tr></thead>
      <tbody>
      <?php foreach ($yearRows as $r): $cur = $r['ym'] === $month; ?>
        <tr <?= $cur ? 'style="background:rgba(15,167,160,.08)"' : '' ?>>
          <td><a href="index.php?page=planning&month=<?= e($r['ym']) ?>"><?= e(month_label($r['ym'])) ?></a></td>
          <td class="num"><?= money($r['plan_in']) ?></td>
          <td class="num"><?= money($r['plan_out']) ?></td>
          <td class="num" style="color:<?= $r['plan_saldo'] >= 0 ? '#0FA7A0' : '#C0392B' ?>"><strong><?= money($r['plan_saldo']) ?></strong></td>
          <td class="num" style="color:<?= $r['ist_saldo'] == 0 ? '#6B7684' : ($r['ist_saldo'] > 0 ? '#0FA7A0' : '#C0392B') ?>"><?= money($r['ist_saldo']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <p class="hint">Wiederkehrende Posten zählen in jedem Monat von Start- bis Endmonat. „Ist" berücksichtigt nur als gezahlt/erhalten markierte Posten.</p>
</div>
<?php layout_footer(); ?>
