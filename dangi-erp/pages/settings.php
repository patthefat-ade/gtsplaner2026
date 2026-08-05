<?php
/** DANGI ERP – Einstellungen: Präfixe, Nummernkreise, Firmendaten, Standardtexte */
$pdo = db();

$keys = [
    'quote_prefix', 'invoice_prefix', 'credit_note_prefix', 'quote_next', 'invoice_next', 'credit_note_next', 'number_format',
    'quote_valid_days', 'invoice_due_days',
    'company_name', 'company_owner', 'company_street', 'company_zip', 'company_city',
    'company_phone', 'company_email', 'company_web',
    'company_iban', 'company_bic', 'company_bank',
    'company_uid', 'company_fn', 'company_tax_nr', 'company_trade',
    'tax_note',
    'quote_intro', 'quote_outro', 'invoice_intro', 'invoice_outro',
    'admin_employee_id',
    'default_hourly_rate',
    'nav_icon_color',
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    /* --- Chef-Benutzerkonto: Benutzername + Passwort ändern --- */
    if (($_POST['do'] ?? '') === 'chef_account') {
        $newUser = trim($_POST['chef_username'] ?? '');
        $pwNew   = $_POST['chef_pw_new'] ?? '';
        $pwNew2  = $_POST['chef_pw_new2'] ?? '';
        $pwCur   = $_POST['chef_pw_current'] ?? '';

        if ($newUser === '' || !preg_match('/^[a-zA-Z0-9._-]{2,40}$/', $newUser)) {
            flash('Fehler: Benutzername muss 2–40 Zeichen lang sein (Buchstaben, Zahlen, . _ -).');
            redirect('index.php?page=settings');
        }
        /* Kollision mit Mitarbeiter-Benutzernamen vermeiden */
        $st = db()->prepare('SELECT COUNT(*) FROM employees WHERE LOWER(username) = LOWER(?)');
        $st->execute([$newUser]);
        if ((int)$st->fetchColumn() > 0) {
            flash('Fehler: Dieser Benutzername ist bereits von einem Mitarbeiter belegt.');
            redirect('index.php?page=settings');
        }
        save_setting('chef_username', $newUser);

        if ($pwNew !== '' || $pwNew2 !== '') {
            $curHash = setting('chef_password_hash', '');
            /* Wenn bereits ein Chef-Passwort existiert, muss das aktuelle bestätigt werden */
            $curOk = $curHash === ''
                ? (APP_PASSWORD === '' || hash_equals(APP_PASSWORD, $pwCur))
                : password_verify($pwCur, $curHash);
            if (!$curOk) {
                flash('Fehler: Das aktuelle Passwort ist nicht korrekt – Passwort wurde nicht geändert.');
                redirect('index.php?page=settings');
            }
            if (strlen($pwNew) < 8) {
                flash('Fehler: Das neue Passwort muss mindestens 8 Zeichen lang sein.');
                redirect('index.php?page=settings');
            }
            if ($pwNew !== $pwNew2) {
                flash('Fehler: Die Passwort-Wiederholung stimmt nicht überein.');
                redirect('index.php?page=settings');
            }
            save_setting('chef_password_hash', password_hash($pwNew, PASSWORD_DEFAULT));
            flash('Chef-Konto gespeichert. Das neue Passwort gilt ab der nächsten Anmeldung.');
        } else {
            flash('Chef-Konto gespeichert.');
        }
        redirect('index.php?page=settings');
    }

    /* --- Menü-Sichtbarkeit speichern --- */
    if (($_POST['do'] ?? '') === 'nav_visibility') {
        $allChef = ['dashboard','quotes','invoices','services','planning','customers',
                    'tickets','calendar','tasks','inventory','employees','timeclock',
                    'my_day','my_time','my_inventory'];
        $allEmp  = ['my_time','my_inventory'];
        $visChef = (array)($_POST['vis_chef'] ?? []);
        $visEmp  = (array)($_POST['vis_employee'] ?? []);
        $hiddenChef = array_values(array_diff($allChef, array_map('strval', $visChef)));
        $hiddenEmp  = array_values(array_diff($allEmp, array_map('strval', $visEmp)));
        save_setting('nav_visibility_chef', json_encode($hiddenChef));
        save_setting('nav_visibility_employee', json_encode($hiddenEmp));
        flash('Menü-Sichtbarkeit gespeichert.');
        redirect('index.php?page=settings');
    }

    /* --- Logo-Upload (PDF + Menü) --- */
    if (($_POST['do'] ?? '') === 'upload_logo') {
        csrf_check();
        $logoType = $_POST['logo_type'] ?? '';
        $allowed = ['pdf_logo', 'menu_logo'];
        if (!in_array($logoType, $allowed)) {
            flash('Fehler: Ungültiger Logo-Typ.');
            redirect('index.php?page=settings');
        }
        $file = $_FILES['logo_file'] ?? null;
        if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
            flash('Fehler: Keine Datei hochgeladen.');
            redirect('index.php?page=settings');
        }
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'])) {
            flash('Fehler: Nur PNG, JPG, GIF oder WebP erlaubt.');
            redirect('index.php?page=settings');
        }
        if ($file['size'] > 5 * 1024 * 1024) {
            flash('Fehler: Datei zu groß (max. 5 MB).');
            redirect('index.php?page=settings');
        }
        $uploadDir = __DIR__ . '/../uploads/logos/';
        if (!is_dir($uploadDir)) { mkdir($uploadDir, 0755, true); }
        $oldPath = setting($logoType . '_path', '');
        if ($oldPath && file_exists(__DIR__ . '/../' . $oldPath)) {
            unlink(__DIR__ . '/../' . $oldPath);
        }
        $filename = $logoType . '_' . time() . '.' . $ext;
        $dest = $uploadDir . $filename;
        move_uploaded_file($file['tmp_name'], $dest);
        save_setting($logoType . '_path', 'uploads/logos/' . $filename);
        $label = $logoType === 'pdf_logo' ? 'PDF-Logo' : 'Menü-Logo';
        flash($label . ' erfolgreich hochgeladen.');
        redirect('index.php?page=settings');
    }

    /* --- Logo löschen --- */
    if (($_POST['do'] ?? '') === 'delete_logo') {
        csrf_check();
        $logoType = $_POST['logo_type'] ?? '';
        $allowed = ['pdf_logo', 'menu_logo'];
        if (in_array($logoType, $allowed)) {
            $oldPath = setting($logoType . '_path', '');
            if ($oldPath && file_exists(__DIR__ . '/../' . $oldPath)) {
                unlink(__DIR__ . '/../' . $oldPath);
            }
            save_setting($logoType . '_path', '');
            flash('Logo entfernt.');
        }
        redirect('index.php?page=settings');
    }

    /* --- SMTP-Einstellungen speichern --- */
    if (($_POST['do'] ?? '') === 'smtp_settings') {
        $smtpKeys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email'];
        foreach ($smtpKeys as $sk) {
            save_setting($sk, trim($_POST[$sk] ?? ''));
        }
        flash('SMTP-Einstellungen gespeichert.');
        redirect('index.php?page=settings');
    }

    foreach ($keys as $k) {
        if (isset($_POST[$k])) {
            $val = trim($_POST[$k]);
            if ($k === 'nav_icon_color') {
                /* Nur gültige Hex-Farben zulassen, sonst Standard Weiß */
                if (!preg_match('/^#[0-9a-fA-F]{6}$/', $val)) { $val = '#FFFFFF'; }
                $val = strtoupper($val);
            }
            save_setting($k, $val);
        }
    }
    flash('Einstellungen gespeichert.');
    redirect('index.php?page=settings');
}

layout_header('Einstellungen', 'settings');

$allEmployees = $pdo->query('SELECT id, first_name, last_name, is_active FROM employees ORDER BY last_name, first_name')->fetchAll();
$adminEmpId = (int)setting('admin_employee_id', '0');

/* Beispielnummer erzeugen (ohne Zähler zu erhöhen) */
$example = str_replace(
    ['{PREFIX}', '{YEAR}', '{NR4}', '{NR}'],
    [setting('quote_prefix', 'AN'), date('Y'), str_pad(setting('quote_next', '1'), 4, '0', STR_PAD_LEFT), setting('quote_next', '1')],
    setting('number_format', '{PREFIX}-{YEAR}-{NR4}')
);
?>
<div class="page-head">
  <h1>Einstellungen</h1>
</div>

<form method="post">
  <?= csrf_field() ?>

  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Nummernkreise</h2>
    <div class="grid-2">
      <div class="field"><label>Präfix Angebote</label>
        <input type="text" name="quote_prefix" value="<?= e(setting('quote_prefix', 'AN')) ?>">
        <span class="hint">z. B. AN → AN-<?= date('Y') ?>-0001</span></div>
      <div class="field"><label>Präfix Rechnungen</label>
        <input type="text" name="invoice_prefix" value="<?= e(setting('invoice_prefix', 'RE')) ?>">
        <span class="hint">z. B. RE → RE-<?= date('Y') ?>-0001</span></div>
      <div class="field"><label>Präfix Gutschriften</label>
        <input type="text" name="credit_note_prefix" value="<?= e(setting('credit_note_prefix', 'GS')) ?>">
        <span class="hint">z. B. GS → GS-<?= date('Y') ?>-0001</span></div>
    </div>
    <div class="grid-3">
      <div class="field"><label>Nächste Angebotsnummer</label>
        <input type="number" min="1" name="quote_next" value="<?= e(setting('quote_next', '1')) ?>"></div>
      <div class="field"><label>Nächste Rechnungsnummer</label>
        <input type="number" min="1" name="invoice_next" value="<?= e(setting('invoice_next', '1')) ?>"></div>
      <div class="field"><label>Nächste Gutschriftnummer</label>
        <input type="number" min="1" name="credit_note_next" value="<?= e(setting('credit_note_next', '1')) ?>"></div>
      <div class="field"><label>Nummernformat</label>
        <input type="text" name="number_format" value="<?= e(setting('number_format', '{PREFIX}-{YEAR}-{NR4}')) ?>">
        <span class="hint">Platzhalter: {PREFIX}, {YEAR}, {NR4}, {NR} – Beispiel: <?= e($example) ?></span></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Angebot gültig (Tage)</label>
        <input type="number" min="1" name="quote_valid_days" value="<?= e(setting('quote_valid_days', '30')) ?>"></div>
      <div class="field"><label>Zahlungsziel Rechnung (Tage)</label>
        <input type="number" min="1" name="invoice_due_days" value="<?= e(setting('invoice_due_days', '14')) ?>"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Globaler Standardstundensatz (€ netto)</label>
        <input type="text" name="default_hourly_rate" value="<?= e(setting('default_hourly_rate')) ?>" inputmode="decimal" placeholder="z. B. 38,50">
        <span class="hint">Wird als Vorschlag verwendet, wenn weder beim Auftrag noch beim Kunden ein Stundensatz hinterlegt ist.</span></div>
    </div>
  </div>

  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Firmendaten (erscheinen im PDF)</h2>
    <div class="grid-2">
      <div class="field"><label>Firmenname</label><input type="text" name="company_name" value="<?= e(setting('company_name')) ?>"></div>
      <div class="field"><label>Inhaber</label><input type="text" name="company_owner" value="<?= e(setting('company_owner')) ?>"></div>
    </div>
    <div class="grid-3">
      <div class="field"><label>Straße</label><input type="text" name="company_street" value="<?= e(setting('company_street')) ?>"></div>
      <div class="field"><label>PLZ</label><input type="text" name="company_zip" value="<?= e(setting('company_zip')) ?>"></div>
      <div class="field"><label>Ort</label><input type="text" name="company_city" value="<?= e(setting('company_city')) ?>"></div>
    </div>
    <div class="grid-3">
      <div class="field"><label>Telefon</label><input type="text" name="company_phone" value="<?= e(setting('company_phone')) ?>"></div>
      <div class="field"><label>E-Mail</label><input type="text" name="company_email" value="<?= e(setting('company_email')) ?>"></div>
      <div class="field"><label>Website</label><input type="text" name="company_web" value="<?= e(setting('company_web')) ?>"></div>
    </div>
    <div class="grid-3">
      <div class="field"><label>IBAN</label><input type="text" name="company_iban" value="<?= e(setting('company_iban')) ?>"></div>
      <div class="field"><label>BIC</label><input type="text" name="company_bic" value="<?= e(setting('company_bic')) ?>"></div>
      <div class="field"><label>Bank</label><input type="text" name="company_bank" value="<?= e(setting('company_bank')) ?>"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>UID-Nummer</label><input type="text" name="company_uid" value="<?= e(setting('company_uid')) ?>" placeholder="z. B. ATU12345678"></div>
      <div class="field"><label>Firmenbuchnummer</label><input type="text" name="company_fn" value="<?= e(setting('company_fn')) ?>" placeholder="z. B. FN 123456 a"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Steuernummer</label><input type="text" name="company_tax_nr" value="<?= e(setting('company_tax_nr')) ?>" placeholder="z. B. 12 345/6789"></div>
      <div class="field"><label>Gewerbebezeichnung</label><input type="text" name="company_trade" value="<?= e(setting('company_trade')) ?>" placeholder="z. B. Hausbetreuung & Reinigung"></div>
    </div>
    <div class="field"><label>Steuerhinweis</label>
      <input type="text" name="tax_note" value="<?= e(setting('tax_note')) ?>">
      <span class="hint">Erscheint unter der Gesamtsumme in Angeboten und Rechnungen.</span></div>
  </div>

  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Standardtexte</h2>
    <div class="grid-2">
      <div class="field"><label>Einleitung Angebot</label><textarea name="quote_intro" rows="2"><?= e(setting('quote_intro')) ?></textarea></div>
      <div class="field"><label>Schlusstext Angebot</label><textarea name="quote_outro" rows="2"><?= e(setting('quote_outro')) ?></textarea></div>
      <div class="field"><label>Einleitung Rechnung</label><textarea name="invoice_intro" rows="2"><?= e(setting('invoice_intro')) ?></textarea></div>
      <div class="field"><label>Schlusstext Rechnung</label><textarea name="invoice_outro" rows="2"><?= e(setting('invoice_outro')) ?></textarea></div>
    </div>
  </div>

  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Corporate Design</h2>
    <div class="grid-2">
      <div class="field"><label>Icon-Farbe im Menü</label>
        <div style="display:flex;align-items:center;gap:0.6rem">
          <input type="color" name="nav_icon_color" value="<?= e(preg_match('/^#[0-9a-fA-F]{6}$/', setting('nav_icon_color', '#FFFFFF')) ? strtoupper(setting('nav_icon_color', '#FFFFFF')) : '#FFFFFF') ?>" style="width:52px;height:38px;padding:2px;border:1px solid var(--border,#d6dbe3);border-radius:8px;background:#fff;cursor:pointer">
          <code style="font-size:0.85rem"><?= e(strtoupper(setting('nav_icon_color', '#FFFFFF'))) ?></code>
        </div>
        <span class="hint">Farbe der Symbole in der Navigation (Standard: Weiß). Die Menü-Icons übernehmen die gewählte Farbe sofort nach dem Speichern – z. B. Türkis <strong>#0FA7A0</strong> passend zum Corporate Design.</span></div>
    </div>
  </div>

  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Chef-Account (selbst mitarbeiten)</h2>
</form>

<div class="card">
  <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Logos</h2>
  <div class="grid-2">
    <!-- PDF-Logo -->
    <div class="field">
      <label>PDF-Logo (rechts oben auf Rechnungen/Angeboten)</label>
      <?php $pdfLogo = setting('pdf_logo_path', ''); ?>
      <?php if ($pdfLogo && file_exists(__DIR__ . '/../' . $pdfLogo)): ?>
        <div style="margin-bottom:0.5rem;padding:0.5rem;background:#f8f9fa;border-radius:8px;display:inline-block">
          <img src="<?= e($pdfLogo) ?>" alt="PDF-Logo" style="max-height:60px;max-width:200px">
        </div>
        <form method="post" style="display:inline">
          <?= csrf_field() ?>
          <input type="hidden" name="do" value="delete_logo">
          <input type="hidden" name="logo_type" value="pdf_logo">
          <button type="submit" class="btn btn-secondary" style="font-size:0.8rem;padding:0.3rem 0.6rem" onclick="return confirm('Logo wirklich entfernen?')">Entfernen</button>
        </form>
      <?php endif; ?>
      <form method="post" enctype="multipart/form-data" style="margin-top:0.4rem">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="upload_logo">
        <input type="hidden" name="logo_type" value="pdf_logo">
        <input type="file" name="logo_file" accept=".png,.jpg,.jpeg,.gif,.webp" style="margin-bottom:0.4rem">
        <button type="submit" class="btn btn-primary" style="font-size:0.85rem;padding:0.4rem 0.8rem">Hochladen</button>
      </form>
      <span class="hint">PNG empfohlen (transparent). Max. 5 MB.</span>
    </div>
    <!-- Menü-Logo -->
    <div class="field">
      <label>Menü-Logo (Header-Leiste)</label>
      <?php $menuLogo = setting('menu_logo_path', ''); ?>
      <?php if ($menuLogo && file_exists(__DIR__ . '/../' . $menuLogo)): ?>
        <div style="margin-bottom:0.5rem;padding:0.5rem;background:var(--anthrazit,#3b4757);border-radius:8px;display:inline-block">
          <img src="<?= e($menuLogo) ?>" alt="Menü-Logo" style="max-height:40px;max-width:180px">
        </div>
        <form method="post" style="display:inline">
          <?= csrf_field() ?>
          <input type="hidden" name="do" value="delete_logo">
          <input type="hidden" name="logo_type" value="menu_logo">
          <button type="submit" class="btn btn-secondary" style="font-size:0.8rem;padding:0.3rem 0.6rem" onclick="return confirm('Logo wirklich entfernen?')">Entfernen</button>
        </form>
      <?php endif; ?>
      <form method="post" enctype="multipart/form-data" style="margin-top:0.4rem">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="upload_logo">
        <input type="hidden" name="logo_type" value="menu_logo">
        <input type="file" name="logo_file" accept=".png,.jpg,.jpeg,.gif,.webp" style="margin-bottom:0.4rem">
        <button type="submit" class="btn btn-primary" style="font-size:0.85rem;padding:0.4rem 0.8rem">Hochladen</button>
      </form>
      <span class="hint">Wird proportional (nicht verzerrt) in die Kopfleiste eingepasst. Max. 5 MB.</span>
    </div>
  </div>
</div>

<form method="post">
  <?= csrf_field() ?>
  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Chef-Account (selbst mitarbeiten)</h2>
    <div class="field">
      <label>Eigener Mitarbeiter-Eintrag des Chefs</label>
      <select name="admin_employee_id">
        <option value="0">– nicht verknüpft –</option>
        <?php foreach ($allEmployees as $ae): ?>
          <option value="<?= (int)$ae['id'] ?>" <?= $adminEmpId === (int)$ae['id'] ? 'selected' : '' ?>>
            <?= e(trim($ae['first_name'] . ' ' . $ae['last_name'])) ?><?= $ae['is_active'] ? '' : ' (inaktiv)' ?>
          </option>
        <?php endforeach; ?>
      </select>
      <span class="hint">Wird hier ein Mitarbeiter-Eintrag verknüpft, sieht der Chef unter „Meine Aufträge“ seine eigenen zugewiesenen Aufträge und kann sie wie ein Mitarbeiter abarbeiten (starten, Fotos, Bericht, Zeit buchen). Dazu einfach unter „Mitarbeiter“ einen Eintrag für den Chef anlegen und Aufträge darauf zuweisen.</span>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">Einstellungen speichern</button>
    </div>
  </div>
</form>

<form method="post">
  <?= csrf_field() ?>
  <input type="hidden" name="do" value="chef_account">
  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Benutzerkonto Chef (Anmeldung)</h2>
    <div class="grid-2">
      <div class="field"><label>Chef-Benutzername</label>
        <input type="text" name="chef_username" value="<?= e(setting('chef_username', 'chef')) ?>" autocomplete="off">
        <span class="hint">Für die Anmeldung als Chef (zusätzlich funktionieren „admin“ und ein leeres Benutzernamen-Feld).</span></div>
    </div>
    <div class="grid-3">
      <div class="field"><label>Aktuelles Passwort</label>
        <input type="password" name="chef_pw_current" autocomplete="current-password">
        <span class="hint"><?= setting('chef_password_hash', '') === '' ? 'Noch kein Chef-Passwort gesetzt – aktuell gilt das Passwort aus config.php (hier eingeben).' : 'Zum Ändern des Passworts erforderlich.' ?></span></div>
      <div class="field"><label>Neues Passwort</label>
        <input type="password" name="chef_pw_new" autocomplete="new-password">
        <span class="hint">Mindestens 8 Zeichen. Leer lassen, wenn nur der Benutzername geändert werden soll.</span></div>
      <div class="field"><label>Neues Passwort wiederholen</label>
        <input type="password" name="chef_pw_new2" autocomplete="new-password"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">Chef-Konto speichern</button>
    </div>
  </div>
</form>

<?php
/* Menü-Sichtbarkeit: Anzeige-Labels je Rolle */
$chefMenu = [
    'dashboard' => 'Übersicht', 'quotes' => 'Angebote', 'invoices' => 'Rechnungen',
    'services' => 'Dienstleistungen', 'planning' => 'Planrechnung', 'customers' => 'Kunden',
    'tickets' => 'Aufträge', 'calendar' => 'Kalender', 'tasks' => 'Aufgaben',
    'inventory' => 'Inventar', 'employees' => 'Mitarbeiter', 'timeclock' => 'Zeiterfassung (Admin)',
    'my_day' => 'Meine Aufträge', 'my_time' => 'Meine Zeiten', 'my_inventory' => 'Meine Geräte',
];
$empMenu = [
    'my_time' => 'Zeiterfassung', 'my_inventory' => 'Meine Geräte',
];
$hiddenChefArr = nav_hidden_keys('chef');
$hiddenEmpArr  = nav_hidden_keys('employee');
?>
<form method="post">
  <?= csrf_field() ?>
  <input type="hidden" name="do" value="nav_visibility">
  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">Menü-Sichtbarkeit nach Rolle</h2>
    <div class="grid-2">
      <div class="field">
        <label>Rolle Chef – sichtbare Menüpunkte</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.35rem 1rem;margin-top:0.3rem">
          <?php foreach ($chefMenu as $k => $lbl): ?>
            <label style="display:flex;align-items:center;gap:0.45rem;font-weight:400;cursor:pointer">
              <input type="checkbox" name="vis_chef[]" value="<?= e($k) ?>" <?= in_array($k, $hiddenChefArr, true) ? '' : 'checked' ?>>
              <?= e($lbl) ?>
            </label>
          <?php endforeach; ?>
        </div>
        <span class="hint">„Einstellungen“ und „Abmelden“ sind für den Chef immer sichtbar (Aussperr-Schutz). Ausgeblendete Punkte sind auch per Direktlink gesperrt.</span>
      </div>
      <div class="field">
        <label>Rolle Mitarbeiter – sichtbare Menüpunkte</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.35rem 1rem;margin-top:0.3rem">
          <?php foreach ($empMenu as $k => $lbl): ?>
            <label style="display:flex;align-items:center;gap:0.45rem;font-weight:400;cursor:pointer">
              <input type="checkbox" name="vis_employee[]" value="<?= e($k) ?>" <?= in_array($k, $hiddenEmpArr, true) ? '' : 'checked' ?>>
              <?= e($lbl) ?>
            </label>
          <?php endforeach; ?>
        </div>
        <span class="hint">„Mein Tag“ und „Abmelden“ sind für Mitarbeiter immer sichtbar.</span>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">Menü-Sichtbarkeit speichern</button>
    </div>
  </div>
</form>

<form method="post">
  <?= csrf_field() ?>
  <input type="hidden" name="do" value="smtp_settings">
  <div class="card">
    <h2 style="font-size:1.05rem;color:var(--anthrazit);margin-bottom:0.9rem">E-Mail-Versand (SMTP)</h2>
    <p class="hint" style="margin-bottom:0.8rem">Konfigurieren Sie hier den SMTP-Server für den direkten PDF-Versand an Kunden. Lassen Sie die Felder leer, um den E-Mail-Versand zu deaktivieren.</p>
    <div class="grid-2">
      <div class="field"><label>SMTP-Server</label><input type="text" name="smtp_host" value="<?= e(setting('smtp_host')) ?>" placeholder="z. B. mail.your-server.de"></div>
      <div class="field"><label>SMTP-Port</label><input type="text" name="smtp_port" value="<?= e(setting('smtp_port', '587')) ?>" placeholder="587 (STARTTLS) oder 465 (SSL)"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>SMTP-Benutzername</label><input type="text" name="smtp_user" value="<?= e(setting('smtp_user')) ?>" autocomplete="off"></div>
      <div class="field"><label>SMTP-Passwort</label><input type="password" name="smtp_pass" value="<?= e(setting('smtp_pass')) ?>" autocomplete="off"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Absender-Name</label><input type="text" name="smtp_from_name" value="<?= e(setting('smtp_from_name')) ?>" placeholder="z. B. DANGI Hausbetreuung"></div>
      <div class="field"><label>Absender-E-Mail</label><input type="text" name="smtp_from_email" value="<?= e(setting('smtp_from_email')) ?>" placeholder="z. B. info@dangi.at"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">SMTP-Einstellungen speichern</button>
    </div>
  </div>
</form>
<?php layout_footer(); ?>
