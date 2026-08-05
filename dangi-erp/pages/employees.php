<?php
/**
 * DANGI ERP – Mitarbeiterverwaltung (nur Admin)
 * CI: Türkis (#0FA7A0), Anthrazit (#3B4757)
 */
require_admin();

$action = $_GET['action'] ?? 'list';
$id     = (int)($_GET['id'] ?? 0);

/* ---------- POST: Speichern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'save_employee') {
    $eid       = (int)($_POST['id'] ?? 0);
    $username  = trim($_POST['username'] ?? '');
    $first     = trim($_POST['first_name'] ?? '');
    $last      = trim($_POST['last_name'] ?? '');
    $phone     = trim($_POST['phone'] ?? '');
    $email     = trim($_POST['email'] ?? '');
    $active    = isset($_POST['is_active']) ? 1 : 0;
    $password  = $_POST['password'] ?? '';
    $num = fn(string $k): float => (float)str_replace(',', '.', $_POST[$k] ?? '0');
    $hMon = $num('hours_mon'); $hTue = $num('hours_tue'); $hWed = $num('hours_wed');
    $hThu = $num('hours_thu'); $hFri = $num('hours_fri'); $hSat = $num('hours_sat'); $hSun = $num('hours_sun');
    $weekly = $hMon + $hTue + $hWed + $hThu + $hFri + $hSat + $hSun;
    $gross  = $num('gross_salary');
    $anc    = $num('ancillary_pct');

    if ($username === '' || $last === '') {
        flash('Bitte Benutzername und Nachname angeben.');
        redirect('index.php?page=employees&action=' . ($eid ? 'edit&id=' . $eid : 'new'));
    }
    if (strtolower($username) === 'admin') {
        flash('Der Benutzername "admin" ist reserviert.');
        redirect('index.php?page=employees&action=' . ($eid ? 'edit&id=' . $eid : 'new'));
    }

    // Benutzername eindeutig?
    $st = db()->prepare('SELECT id FROM employees WHERE username = ? AND id <> ?');
    $st->execute([$username, $eid]);
    if ($st->fetch()) {
        flash('Dieser Benutzername ist bereits vergeben.');
        redirect('index.php?page=employees&action=' . ($eid ? 'edit&id=' . $eid : 'new'));
    }

    if ($eid) {
        $sql = 'UPDATE employees SET username=?, first_name=?, last_name=?, phone=?, email=?, is_active=?,
                weekly_hours=?, hours_mon=?, hours_tue=?, hours_wed=?, hours_thu=?, hours_fri=?, hours_sat=?, hours_sun=?,
                gross_salary=?, ancillary_pct=? WHERE id=?';
        db()->prepare($sql)->execute([$username, $first, $last, $phone, $email, $active,
            $weekly, $hMon, $hTue, $hWed, $hThu, $hFri, $hSat, $hSun, $gross, $anc, $eid]);
        if ($password !== '') {
            db()->prepare('UPDATE employees SET password_hash=? WHERE id=?')
               ->execute([password_hash($password, PASSWORD_DEFAULT), $eid]);
        }
    } else {
        if ($password === '') {
            flash('Bitte ein Passwort für den neuen Mitarbeiter vergeben.');
            redirect('index.php?page=employees&action=new');
        }
        db()->prepare('INSERT INTO employees (username, password_hash, first_name, last_name, phone, email, is_active,
                weekly_hours, hours_mon, hours_tue, hours_wed, hours_thu, hours_fri, hours_sat, hours_sun, gross_salary, ancillary_pct)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
           ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $first, $last, $phone, $email, $active,
                $weekly, $hMon, $hTue, $hWed, $hThu, $hFri, $hSat, $hSun, $gross, $anc]);
        $eid = (int)db()->lastInsertId();
    }

    /* Arbeitsvertrag hochladen (optional) */
    if (!empty($_FILES['contract']['name']) && $_FILES['contract']['error'] === UPLOAD_ERR_OK) {
        $allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'];
        $ext = strtolower(pathinfo($_FILES['contract']['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $allowed, true)) {
            flash('Vertrag: Dateityp nicht erlaubt (PDF, JPG, PNG, WEBP, DOC, DOCX).');
        } elseif ($_FILES['contract']['size'] > 15 * 1024 * 1024) {
            flash('Vertrag: Datei größer als 15 MB.');
        } else {
            $dir = __DIR__ . '/../uploads/contracts';
            if (!is_dir($dir)) { mkdir($dir, 0775, true); }
            $fname = 'vertrag_emp' . $eid . '_' . date('Ymd_His') . '.' . $ext;
            if (move_uploaded_file($_FILES['contract']['tmp_name'], $dir . '/' . $fname)) {
                // alte Datei entfernen
                $st = db()->prepare('SELECT contract_file FROM employees WHERE id=?');
                $st->execute([$eid]);
                if ($old = $st->fetchColumn()) { @unlink($dir . '/' . $old); }
                db()->prepare('UPDATE employees SET contract_file=? WHERE id=?')->execute([$fname, $eid]);
            } else {
                flash('Vertrag konnte nicht gespeichert werden.');
            }
        }
    }
    flash('Mitarbeiter gespeichert.');
    redirect('index.php?page=employees');
}

/* ---------- POST: Vertrag löschen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'delete_contract') {
    $eid = (int)$_POST['id'];
    $st = db()->prepare('SELECT contract_file FROM employees WHERE id=?');
    $st->execute([$eid]);
    if ($f = $st->fetchColumn()) {
        @unlink(__DIR__ . '/../uploads/contracts/' . $f);
        db()->prepare('UPDATE employees SET contract_file=NULL WHERE id=?')->execute([$eid]);
        flash('Arbeitsvertrag gelöscht.');
    }
    redirect('index.php?page=employees&action=edit&id=' . $eid);
}

/* ---------- POST: Löschen ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'delete_employee') {
    db()->prepare('DELETE FROM employees WHERE id=?')->execute([(int)$_POST['id']]);
    flash('Mitarbeiter gelöscht. Zugewiesene Aufträge bleiben erhalten (ohne Zuweisung).');
    redirect('index.php?page=employees');
}

/* ---------- Ansicht: Formular ---------- */
if ($action === 'new' || $action === 'edit') {
    $emp = ['id'=>0,'username'=>'','first_name'=>'','last_name'=>'','phone'=>'','email'=>'','is_active'=>1,
            'contract_file'=>null,'weekly_hours'=>0,'hours_mon'=>0,'hours_tue'=>0,'hours_wed'=>0,'hours_thu'=>0,
            'hours_fri'=>0,'hours_sat'=>0,'hours_sun'=>0,'gross_salary'=>0,'ancillary_pct'=>30];
    if ($action === 'edit' && $id) {
        $st = db()->prepare('SELECT * FROM employees WHERE id=?');
        $st->execute([$id]);
        $emp = $st->fetch() ?: $emp;
    }
    $deNum = fn($v, int $dec = 2): string => number_format((float)$v, $dec, ',', '');
    /* Kalkulation: Kosten/Std = (Brutto + LNK) / Monatsstunden × 1,15; Mindestsatz = × 1,12 */
    $monthlyHours = (float)$emp['weekly_hours'] * 4.33;
    $costPerHour = 0.0; $minRate = 0.0;
    if ($monthlyHours > 0 && (float)$emp['gross_salary'] > 0) {
        $totalCost = (float)$emp['gross_salary'] * (1 + (float)$emp['ancillary_pct'] / 100);
        $costPerHour = $totalCost / $monthlyHours * 1.15;
        $minRate = $costPerHour * 1.12;
    }
    layout_header($emp['id'] ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter anlegen', 'employees');
    ?>
    <div class="page-head">
      <h1><?= $emp['id'] ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter' ?></h1>
      <a class="btn btn-secondary" href="index.php?page=employees">Zurück zur Liste</a>
    </div>
    <div class="card">
      <form method="post" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="save_employee">
        <input type="hidden" name="id" value="<?= (int)$emp['id'] ?>">
        <div class="grid-2">
          <div class="field"><label>Vorname</label><input type="text" name="first_name" value="<?= e($emp['first_name']) ?>"></div>
          <div class="field"><label>Nachname *</label><input type="text" name="last_name" value="<?= e($emp['last_name']) ?>" required></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Telefon</label><input type="text" name="phone" value="<?= e($emp['phone']) ?>"></div>
          <div class="field"><label>E-Mail</label><input type="email" name="email" value="<?= e($emp['email']) ?>"></div>
        </div>
        <hr style="border:none;border-top:1px solid var(--grau-linie);margin:1rem 0">
        <div class="grid-2">
          <div class="field"><label>Benutzername (für Login) *</label><input type="text" name="username" value="<?= e($emp['username']) ?>" required autocomplete="off"></div>
          <div class="field">
            <label><?= $emp['id'] ? 'Neues Passwort (leer = unverändert)' : 'Passwort *' ?></label>
            <input type="password" name="password" autocomplete="new-password" <?= $emp['id'] ? '' : 'required' ?>>
          </div>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:0.5rem;font-weight:400">
            <input type="checkbox" name="is_active" <?= $emp['is_active'] ? 'checked' : '' ?> style="width:auto"> Aktiv (kann sich anmelden)
          </label>
        </div>

        <hr style="border:none;border-top:1px solid var(--grau-linie);margin:1rem 0">
        <h2 class="subform-title">Arbeitszeit & Verteilung auf Wochentage (Stunden)</h2>
        <div style="display:grid; grid-template-columns:repeat(7, minmax(70px,1fr)); gap:0.5rem;">
          <?php
            $days = ['hours_mon' => 'Mo', 'hours_tue' => 'Di', 'hours_wed' => 'Mi', 'hours_thu' => 'Do',
                     'hours_fri' => 'Fr', 'hours_sat' => 'Sa', 'hours_sun' => 'So'];
            foreach ($days as $k => $lbl): ?>
            <div class="field" style="margin:0;"><label><?= $lbl ?></label>
              <input type="text" name="<?= $k ?>" class="wh-day" value="<?= $deNum($emp[$k]) ?>" inputmode="decimal"></div>
          <?php endforeach; ?>
        </div>
        <p class="hint" style="margin-top:0.4rem">Wochenarbeitszeit gesamt: <strong id="wh-total"><?= $deNum($emp['weekly_hours']) ?></strong> Std. (wird automatisch aus den Wochentagen summiert)</p>

        <hr style="border:none;border-top:1px solid var(--grau-linie);margin:1rem 0">
        <h2 class="subform-title">Lohnkosten & Kalkulation</h2>
        <div class="grid-2">
          <div class="field"><label>Bruttolohn / Monat (€)</label>
            <input type="text" name="gross_salary" id="calc-gross" value="<?= $deNum($emp['gross_salary']) ?>" inputmode="decimal"></div>
          <div class="field"><label>Lohnnebenkosten (%)</label>
            <input type="text" name="ancillary_pct" id="calc-anc" value="<?= $deNum($emp['ancillary_pct']) ?>" inputmode="decimal">
            <span class="hint">Dienstgeberabgaben in Österreich meist ca. 29–31 %.</span></div>
        </div>
        <div class="alert alert-success" id="calc-box" style="<?= $minRate > 0 ? '' : 'display:none;' ?> margin-bottom:0.8rem">
          <strong>Kalkulations-Richtwert:</strong><br>
          Kosten pro Stunde (inkl. 15 % Gemeinkosten): <strong id="calc-cost"><?= $deNum($costPerHour) ?> €</strong><br>
          Minimal zu verrechnender Stundensatz (+ 12 % Gewinn): <strong id="calc-min"><?= $deNum($minRate) ?> €</strong> netto
          <div class="hint" style="margin-top:0.3rem">Formel: (Brutto + Lohnnebenkosten) ÷ Monatsstunden (Wochenstunden × 4,33) × 1,15 Gemeinkosten × 1,12 Gewinn</div>
        </div>

        <hr style="border:none;border-top:1px solid var(--grau-linie);margin:1rem 0">
        <h2 class="subform-title">Arbeitsvertrag</h2>
        <?php if (!empty($emp['contract_file'])): ?>
          <p style="margin-bottom:0.6rem">
            <a class="btn btn-sm btn-secondary" href="index.php?page=employee_contract&id=<?= (int)$emp['id'] ?>">📄 Vertrag herunterladen</a>
            <span class="hint"><?= e($emp['contract_file']) ?></span>
          </p>
        <?php endif; ?>
        <div class="field"><label><?= !empty($emp['contract_file']) ? 'Neuen Vertrag hochladen (ersetzt den bestehenden)' : 'Vertrag hochladen (PDF, JPG, PNG, DOC – max. 15 MB)' ?></label>
          <input type="file" name="contract" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"></div>

        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Speichern</button>
        </div>
      </form>
      <?php if (!empty($emp['contract_file'])): ?>
      <form method="post" style="margin-top:0.5rem" onsubmit="return confirm('Arbeitsvertrag wirklich löschen?')">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="delete_contract">
        <input type="hidden" name="id" value="<?= (int)$emp['id'] ?>">
        <button class="btn btn-sm btn-danger" type="submit">Vertrag löschen</button>
      </form>
      <?php endif; ?>
    </div>
    <script>
    (function(){
      function num(v){ var n = parseFloat(String(v||'0').replace(',','.')); return isNaN(n) ? 0 : n; }
      function de(n){ return n.toLocaleString('de-AT',{minimumFractionDigits:2, maximumFractionDigits:2}); }
      var days = document.querySelectorAll('.wh-day');
      var gross = document.getElementById('calc-gross');
      var anc = document.getElementById('calc-anc');
      function recalc(){
        var week = 0;
        days.forEach(function(i){ week += num(i.value); });
        document.getElementById('wh-total').textContent = de(week);
        var g = num(gross.value), a = num(anc.value);
        var box = document.getElementById('calc-box');
        if (week > 0 && g > 0) {
          var cost = g * (1 + a/100) / (week * 4.33) * 1.15;
          document.getElementById('calc-cost').textContent = de(cost) + ' €';
          document.getElementById('calc-min').textContent = de(cost * 1.12) + ' €';
          box.style.display = '';
        } else { box.style.display = 'none'; }
      }
      days.forEach(function(i){ i.addEventListener('input', recalc); });
      gross.addEventListener('input', recalc);
      anc.addEventListener('input', recalc);
    })();
    </script>
    <?php
    layout_footer();
    return;
}

/* ---------- Ansicht: Liste ---------- */
$rows = db()->query('SELECT e.*,
    (SELECT COUNT(*) FROM tickets t WHERE t.employee_id = e.id AND t.status IN ("offen","in_arbeit")) AS open_tickets
  FROM employees e ORDER BY e.last_name, e.first_name')->fetchAll();

layout_header('Mitarbeiter', 'employees');
?>
<div class="page-head">
  <h1>Mitarbeiter</h1>
  <a class="btn btn-primary" href="index.php?page=employees&action=new">+ Mitarbeiter anlegen</a>
</div>
<div class="card">
  <?php if (!$rows): ?>
    <p class="hint">Noch keine Mitarbeiter angelegt. Mitarbeiter können sich mit Benutzername und Passwort anmelden und sehen ihre zugewiesenen Aufträge unter „Mein Tag".</p>
  <?php else: ?>
  <div class="table-wrap">
    <table class="list">
      <thead><tr><th>Name</th><th>Benutzername</th><th>Kontakt</th><th>Wochenstd.</th><th>Mindestsatz</th><th>Status</th><th>Offene Aufträge</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($rows as $r): ?>
        <?php
          $mh = (float)$r['weekly_hours'] * 4.33;
          $mr = ($mh > 0 && (float)$r['gross_salary'] > 0)
              ? (float)$r['gross_salary'] * (1 + (float)$r['ancillary_pct'] / 100) / $mh * 1.15 * 1.12 : 0;
        ?>
        <tr>
          <td><strong><?= e(trim($r['first_name'] . ' ' . $r['last_name'])) ?></strong></td>
          <td><?= e($r['username']) ?></td>
          <td><?= e($r['phone']) ?><?= $r['phone'] && $r['email'] ? ' · ' : '' ?><?= e($r['email']) ?></td>
          <td><?= (float)$r['weekly_hours'] > 0 ? number_format((float)$r['weekly_hours'], 2, ',', '.') . ' Std.' : '<span class="hint">–</span>' ?></td>
          <td><?= $mr > 0 ? number_format($mr, 2, ',', '.') . ' €' : '<span class="hint">–</span>' ?></td>
          <td><?= $r['is_active'] ? '<span class="badge badge-success">aktiv</span>' : '<span class="badge badge-muted">inaktiv</span>' ?></td>
          <td><?= (int)$r['open_tickets'] ?></td>
          <td style="text-align:right;white-space:nowrap">
            <a class="btn btn-sm btn-secondary" href="index.php?page=tickets&employee=<?= (int)$r['id'] ?>">Aufträge</a>
            <?php if ($r['contract_file']): ?><a class="btn btn-sm btn-secondary" href="index.php?page=employee_contract&id=<?= (int)$r['id'] ?>">Vertrag</a><?php endif; ?>
            <a class="btn btn-sm btn-secondary" href="index.php?page=employees&action=edit&id=<?= (int)$r['id'] ?>">Bearbeiten</a>
            <form method="post" style="display:inline" onsubmit="return confirm('Mitarbeiter wirklich löschen?')">
              <?= csrf_field() ?>
              <input type="hidden" name="do" value="delete_employee">
              <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
              <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>
<?php layout_footer(); ?>
