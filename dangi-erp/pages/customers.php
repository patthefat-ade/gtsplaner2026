<?php
/** DANGI ERP – Kundenverwaltung */
$pdo = db();
$action = $_GET['action'] ?? 'list';
$id = (int)($_GET['id'] ?? 0);

$noteTypes = ['telefonat' => 'Telefonat', 'email' => 'E-Mail', 'vor_ort' => 'Vor-Ort-Termin', 'sonstiges' => 'Sonstiges'];

$allowedExt = ['pdf','doc','docx','xls','xlsx','odt','ods','jpg','jpeg','png','gif','webp','txt','csv','zip'];
$maxUpload  = 15 * 1024 * 1024; // 15 MB
$uploadDir  = __DIR__ . '/../uploads';

/* ---------- Dokumente: Upload ---------- */
if ($action === 'file_upload' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] === UPLOAD_ERR_NO_FILE) {
        flash('Bitte eine Datei auswählen.');
    } elseif ($f['error'] !== UPLOAD_ERR_OK) {
        flash('Upload fehlgeschlagen (Fehlercode ' . (int)$f['error'] . '). Ggf. ist die Datei zu groß.');
    } elseif ($f['size'] > $maxUpload) {
        flash('Datei zu groß (max. 15 MB).');
    } else {
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) {
            flash('Dateityp nicht erlaubt. Erlaubt: ' . implode(', ', $allowedExt));
        } else {
            if (!is_dir($uploadDir)) { mkdir($uploadDir, 0755, true); }
            $stored = 'k' . $id . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
            if (move_uploaded_file($f['tmp_name'], $uploadDir . '/' . $stored)) {
                $st = $pdo->prepare('INSERT INTO customer_files (customer_id, original_name, stored_name, mime_type, size_bytes, note) VALUES (?,?,?,?,?,?)');
                $st->execute([$id, $f['name'], $stored, $f['type'] ?: '', (int)$f['size'], trim($_POST['note'] ?? '')]);
                flash('Dokument hochgeladen.');
            } else {
                flash('Datei konnte nicht gespeichert werden (Schreibrechte des Ordners uploads/ prüfen).');
            }
        }
    }
    redirect('index.php?page=customers&action=edit&id=' . $id . '#dokumente');
}

/* ---------- Dokumente: Download (läuft über index.php, also mit Auth) ---------- */
if ($action === 'file_download') {
    $fid = (int)($_GET['file_id'] ?? 0);
    $st = $pdo->prepare('SELECT * FROM customer_files WHERE id = ?');
    $st->execute([$fid]);
    $file = $st->fetch();
    $path = $file ? $uploadDir . '/' . $file['stored_name'] : '';
    if ($file && is_file($path)) {
        header('Content-Type: ' . ($file['mime_type'] ?: 'application/octet-stream'));
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: attachment; filename="' . rawurlencode($file['original_name']) . '"');
        readfile($path);
        exit;
    }
    flash('Datei nicht gefunden.');
    redirect('index.php?page=customers');
}

/* ---------- Dokumente: Löschen ---------- */
if ($action === 'file_delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $fid = (int)($_GET['file_id'] ?? 0);
    $st = $pdo->prepare('SELECT * FROM customer_files WHERE id = ?');
    $st->execute([$fid]);
    $file = $st->fetch();
    if ($file) {
        $path = $uploadDir . '/' . $file['stored_name'];
        if (is_file($path)) { unlink($path); }
        $pdo->prepare('DELETE FROM customer_files WHERE id = ?')->execute([$fid]);
        flash('Dokument gelöscht.');
        redirect('index.php?page=customers&action=edit&id=' . (int)$file['customer_id'] . '#dokumente');
    }
    redirect('index.php?page=customers');
}

/* ---------- Ansprechpartner: anlegen/aktualisieren ---------- */
if ($action === 'contact_save' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $cid   = (int)($_POST['contact_id'] ?? 0);
    $name  = trim($_POST['c_name'] ?? '');
    $role  = trim($_POST['c_role'] ?? '');
    $phone = trim($_POST['c_phone'] ?? '');
    $email = trim($_POST['c_email'] ?? '');
    $note  = trim($_POST['c_note'] ?? '');
    if ($name === '') {
        flash('Bitte einen Namen für den Ansprechpartner angeben.');
    } elseif ($cid) {
        $st = $pdo->prepare('UPDATE customer_contacts SET name=?, role=?, phone=?, email=?, note=? WHERE id=? AND customer_id=?');
        $st->execute([$name, $role, $phone, $email, $note, $cid, $id]);
        flash('Ansprechpartner aktualisiert.');
    } else {
        $st = $pdo->prepare('INSERT INTO customer_contacts (customer_id, name, role, phone, email, note) VALUES (?,?,?,?,?,?)');
        $st->execute([$id, $name, $role, $phone, $email, $note]);
        flash('Ansprechpartner angelegt.');
    }
    redirect('index.php?page=customers&action=edit&id=' . $id . '#ansprechpartner');
}

/* ---------- Ansprechpartner: Rechnungsempfänger setzen ---------- */
if ($action === 'contact_billing' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $cid = (int)($_GET['contact_id'] ?? 0);
    $st = $pdo->prepare('SELECT is_billing FROM customer_contacts WHERE id = ? AND customer_id = ?');
    $st->execute([$cid, $id]);
    $wasBilling = (int)$st->fetchColumn();
    $pdo->prepare('UPDATE customer_contacts SET is_billing = 0 WHERE customer_id = ?')->execute([$id]);
    if ($cid && !$wasBilling) {
        $pdo->prepare('UPDATE customer_contacts SET is_billing = 1 WHERE id = ? AND customer_id = ?')->execute([$cid, $id]);
        flash('Rechnungsempfänger festgelegt.');
    } else {
        flash('Markierung als Rechnungsempfänger entfernt.');
    }
    redirect('index.php?page=customers&action=edit&id=' . $id . '#ansprechpartner');
}

/* ---------- Ansprechpartner: löschen ---------- */
if ($action === 'contact_delete' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $cid = (int)($_GET['contact_id'] ?? 0);
    $pdo->prepare('DELETE FROM customer_contacts WHERE id = ? AND customer_id = ?')->execute([$cid, $id]);
    flash('Ansprechpartner gelöscht.');
    redirect('index.php?page=customers&action=edit&id=' . $id . '#ansprechpartner');
}

/* ---------- Kostenstellen: anlegen/aktualisieren ---------- */
if ($action === 'costcenter_save' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $kid  = (int)($_POST['cc_id'] ?? 0);
    $code = trim($_POST['cc_code'] ?? '');
    $name = trim($_POST['cc_name'] ?? '');
    $note = trim($_POST['cc_note'] ?? '');
    $contactId = (int)($_POST['cc_contact_id'] ?? 0) ?: null;
    if ($contactId) { /* Ansprechpartner muss zum Kunden gehören */
        $chk = $pdo->prepare('SELECT COUNT(*) FROM customer_contacts WHERE id = ? AND customer_id = ?');
        $chk->execute([$contactId, $id]);
        if (!(int)$chk->fetchColumn()) { $contactId = null; }
    }
    if ($name === '') {
        flash('Bitte eine Bezeichnung für die Kostenstelle angeben.');
    } elseif ($kid) {
        $st = $pdo->prepare('UPDATE customer_cost_centers SET code=?, name=?, note=?, contact_id=? WHERE id=? AND customer_id=?');
        $st->execute([$code, $name, $note, $contactId, $kid, $id]);
        flash('Kostenstelle aktualisiert.');
    } else {
        $st = $pdo->prepare('INSERT INTO customer_cost_centers (customer_id, code, name, note, contact_id) VALUES (?,?,?,?,?)');
        $st->execute([$id, $code, $name, $note, $contactId]);
        flash('Kostenstelle angelegt.');
    }
    redirect('index.php?page=customers&action=edit&id=' . $id . '#kostenstellen');
}

/* ---------- Kostenstellen: löschen ---------- */
if ($action === 'costcenter_delete' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $kid = (int)($_GET['cc_id'] ?? 0);
    $pdo->prepare('DELETE FROM customer_cost_centers WHERE id = ? AND customer_id = ?')->execute([$kid, $id]);
    flash('Kostenstelle gelöscht.');
    redirect('index.php?page=customers&action=edit&id=' . $id . '#kostenstellen');
}

/* ---------- Standorte: anlegen/aktualisieren ---------- */
if ($action === 'location_save' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $lid    = (int)($_POST['loc_id'] ?? 0);
    $name   = trim($_POST['loc_name'] ?? '');
    $street = trim($_POST['loc_street'] ?? '');
    $zip    = trim($_POST['loc_zip'] ?? '');
    $city   = trim($_POST['loc_city'] ?? '');
    $note   = trim($_POST['loc_note'] ?? '');
    if ($name === '') {
        flash('Bitte eine Bezeichnung für den Standort angeben.');
    } elseif ($lid) {
        $st = $pdo->prepare('UPDATE customer_locations SET name=?, street=?, zip=?, city=?, note=? WHERE id=? AND customer_id=?');
        $st->execute([$name, $street, $zip, $city, $note, $lid, $id]);
        flash('Standort aktualisiert.');
    } else {
        $st = $pdo->prepare('INSERT INTO customer_locations (customer_id, name, street, zip, city, note) VALUES (?,?,?,?,?,?)');
        $st->execute([$id, $name, $street, $zip, $city, $note]);
        flash('Standort angelegt.');
    }
    redirect('index.php?page=customers&action=edit&id=' . $id . '#standorte');
}

/* ---------- Standorte: löschen ---------- */
if ($action === 'location_delete' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $lid = (int)($_GET['loc_id'] ?? 0);
    $pdo->prepare('DELETE FROM customer_locations WHERE id = ? AND customer_id = ?')->execute([$lid, $id]);
    flash('Standort gelöscht.');
    redirect('index.php?page=customers&action=edit&id=' . $id . '#standorte');
}

/* ---------- Kontakthistorie: Eintrag anlegen ---------- */
if ($action === 'note_add' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $type = array_key_exists($_POST['note_type'] ?? '', $noteTypes) ? $_POST['note_type'] : 'telefonat';
    $note = trim($_POST['note'] ?? '');
    $contactAt = trim($_POST['contact_at'] ?? '');
    /* datetime-local liefert z. B. 2026-07-27T14:30 */
    if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $contactAt)) {
        $contactAt = str_replace('T', ' ', $contactAt) . ':00';
    } else {
        $contactAt = date('Y-m-d H:i:s');
    }
    if ($note === '') {
        flash('Bitte eine Notiz eingeben.');
    } else {
        $st = $pdo->prepare('INSERT INTO customer_notes (customer_id, note_type, note, contact_at) VALUES (?,?,?,?)');
        $st->execute([$id, $type, $note, $contactAt]);
        flash('Eintrag zur Kontakthistorie hinzugefügt.');
    }
    redirect('index.php?page=customers&action=edit&id=' . $id . '#historie');
}

/* ---------- Kontakthistorie: Eintrag löschen ---------- */
if ($action === 'note_delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $noteId = (int)($_GET['note_id'] ?? 0);
    $st = $pdo->prepare('SELECT customer_id FROM customer_notes WHERE id = ?');
    $st->execute([$noteId]);
    $custId = (int)$st->fetchColumn();
    if ($custId) {
        $pdo->prepare('DELETE FROM customer_notes WHERE id = ?')->execute([$noteId]);
        flash('Eintrag gelöscht.');
    }
    redirect('index.php?page=customers&action=edit&id=' . $custId . '#historie');
}

/* ---------- Speichern ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === 'new' || $action === 'edit')) {
    $data = [
        'company'    => trim($_POST['company'] ?? ''),
        'salutation' => trim($_POST['salutation'] ?? ''),
        'first_name' => trim($_POST['first_name'] ?? ''),
        'last_name'  => trim($_POST['last_name'] ?? ''),
        'street'     => trim($_POST['street'] ?? ''),
        'zip'        => trim($_POST['zip'] ?? ''),
        'city'       => trim($_POST['city'] ?? ''),
        'country'    => trim($_POST['country'] ?? 'Österreich'),
        'email'      => trim($_POST['email'] ?? ''),
        'phone'      => trim($_POST['phone'] ?? ''),
        'uid'        => trim($_POST['uid'] ?? ''),
        'notes'      => trim($_POST['notes'] ?? ''),
    ];
    $rateRaw = trim($_POST['default_hourly_rate'] ?? '');
    $defaultRate = $rateRaw === '' ? null : (float)str_replace(',', '.', $rateRaw);
    if ($data['company'] === '' && $data['last_name'] === '') {
        flash('Bitte Firma oder Nachname angeben.');
    } else {
        if ($action === 'edit' && $id) {
            $st = $pdo->prepare('UPDATE customers SET company=?, salutation=?, first_name=?, last_name=?, street=?, zip=?, city=?, country=?, email=?, phone=?, uid=?, notes=?, default_hourly_rate=? WHERE id=?');
            $st->execute([...array_values($data), $defaultRate, $id]);
            flash('Kunde aktualisiert.');
        } else {
            $st = $pdo->prepare('INSERT INTO customers (company, salutation, first_name, last_name, street, zip, city, country, email, phone, uid, notes, default_hourly_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $st->execute([...array_values($data), $defaultRate]);
            flash('Kunde angelegt.');
        }
        redirect('index.php?page=customers');
    }
}

/* ---------- Löschen ---------- */
if ($action === 'delete' && $id && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $cnt = $pdo->prepare('SELECT COUNT(*) FROM documents WHERE customer_id = ?');
    $cnt->execute([$id]);
    if ((int)$cnt->fetchColumn() > 0) {
        flash('Kunde kann nicht gelöscht werden: Es existieren Angebote oder Rechnungen zu diesem Kunden.');
    } else {
        /* physische Dateien mitlöschen (DB-Einträge kaskadieren) */
        $fs = $pdo->prepare('SELECT stored_name FROM customer_files WHERE customer_id = ?');
        $fs->execute([$id]);
        foreach ($fs->fetchAll() as $row) {
            $p = $uploadDir . '/' . $row['stored_name'];
            if (is_file($p)) { unlink($p); }
        }
        $pdo->prepare('DELETE FROM customers WHERE id = ?')->execute([$id]);
        flash('Kunde gelöscht.');
    }
    redirect('index.php?page=customers');
}

/* ---------- Formular ---------- */
if ($action === 'new' || $action === 'edit') {
    $c = ['company'=>'','salutation'=>'','first_name'=>'','last_name'=>'','street'=>'','zip'=>'','city'=>'','country'=>'Österreich','email'=>'','phone'=>'','uid'=>'','notes'=>''];
    if ($action === 'edit' && $id) {
        $st = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
        $st->execute([$id]);
        $c = $st->fetch() ?: $c;
    }
    layout_header($action === 'edit' ? 'Kunde bearbeiten' : 'Neuer Kunde', 'customers');
    $notes = [];
    $contacts = $costCenters = $locations = $files = [];
    $editContact = $editCC = $editLoc = null;
    if ($action === 'edit' && $id) {
        $st = $pdo->prepare('SELECT * FROM customer_notes WHERE customer_id = ? ORDER BY contact_at DESC, id DESC');
        $st->execute([$id]);
        $notes = $st->fetchAll();
        $st = $pdo->prepare('SELECT * FROM customer_contacts WHERE customer_id = ? ORDER BY is_billing DESC, name');
        $st->execute([$id]);
        $contacts = $st->fetchAll();
        $st = $pdo->prepare('SELECT cc.*, ct.name AS contact_name FROM customer_cost_centers cc LEFT JOIN customer_contacts ct ON ct.id = cc.contact_id WHERE cc.customer_id = ? ORDER BY cc.code, cc.name');
        $st->execute([$id]);
        $costCenters = $st->fetchAll();
        $st = $pdo->prepare('SELECT * FROM customer_locations WHERE customer_id = ? ORDER BY name');
        $st->execute([$id]);
        $locations = $st->fetchAll();
        $st = $pdo->prepare('SELECT * FROM customer_files WHERE customer_id = ? ORDER BY uploaded_at DESC, id DESC');
        $st->execute([$id]);
        $files = $st->fetchAll();
        /* Bearbeiten-Modus für Unterlisten via GET-Parameter */
        foreach ($contacts as $row) { if ($row['id'] == (int)($_GET['edit_contact'] ?? 0)) { $editContact = $row; } }
        foreach ($costCenters as $row) { if ($row['id'] == (int)($_GET['edit_cc'] ?? 0)) { $editCC = $row; } }
        foreach ($locations as $row) { if ($row['id'] == (int)($_GET['edit_loc'] ?? 0)) { $editLoc = $row; } }
    }
    ?>
    <div class="page-head">
      <h1><?= $action === 'edit' ? 'Kunde bearbeiten' : 'Neuer Kunde' ?></h1>
      <a class="btn btn-secondary" href="index.php?page=customers">← Zur Liste</a>
    </div>
    <div class="card">
      <form method="post">
        <?= csrf_field() ?>
        <div class="grid-2">
          <div class="field"><label>Firma</label><input type="text" name="company" value="<?= e($c['company']) ?>"></div>
          <div class="field"><label>UID-Nummer</label><input type="text" name="uid" value="<?= e($c['uid']) ?>"></div>
          <div class="field"><label>Standardstundensatz (€ netto)</label>
            <input type="text" name="default_hourly_rate" value="<?= isset($c['default_hourly_rate']) && $c['default_hourly_rate'] !== null && $c['default_hourly_rate'] !== '' ? number_format((float)$c['default_hourly_rate'], 2, ',', '') : '' ?>" inputmode="decimal" placeholder="z. B. 42,00">
            <span class="hint">Vorschlag für Aufträge und Rechnungen dieses Kunden. Leer = globaler Satz aus den Einstellungen.</span></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Anrede</label>
            <select name="salutation">
              <?php foreach (['', 'Herr', 'Frau', 'Familie', 'Firma'] as $s): ?>
                <option value="<?= $s ?>" <?= $c['salutation'] === $s ? 'selected' : '' ?>><?= $s ?: '–' ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field"><label>Vorname</label><input type="text" name="first_name" value="<?= e($c['first_name']) ?>"></div>
          <div class="field"><label>Nachname</label><input type="text" name="last_name" value="<?= e($c['last_name']) ?>"></div>
        </div>
        <div class="field"><label>Straße & Hausnummer</label><input type="text" name="street" value="<?= e($c['street']) ?>"></div>
        <div class="grid-3">
          <div class="field"><label>PLZ</label><input type="text" name="zip" value="<?= e($c['zip']) ?>"></div>
          <div class="field"><label>Ort</label><input type="text" name="city" value="<?= e($c['city']) ?>"></div>
          <div class="field"><label>Land</label><input type="text" name="country" value="<?= e($c['country']) ?>"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>E-Mail</label><input type="email" name="email" value="<?= e($c['email']) ?>"></div>
          <div class="field"><label>Telefon</label><input type="text" name="phone" value="<?= e($c['phone']) ?>"></div>
        </div>
        <div class="field"><label>Notizen</label><textarea name="notes"><?= e($c['notes']) ?></textarea></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Speichern</button>
          <a class="btn btn-secondary" href="index.php?page=customers">Abbrechen</a>
        </div>
      </form>
    </div>

    <?php if ($action === 'edit' && $id): ?>

    <div class="card" id="ansprechpartner">
      <h2>Ansprechpartner <span class="sub">(<?= count($contacts) ?>)</span></h2>

      <?php if (!$contacts): ?>
        <p class="hint">Noch keine Ansprechpartner hinterlegt.</p>
      <?php else: ?>
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>Rechnungsempf.</th><th>Name</th><th>Funktion</th><th>Kontakt</th><th class="actions">Aktionen</th></tr></thead>
          <tbody>
          <?php foreach ($contacts as $ct): ?>
            <tr>
              <td>
                <form method="post" action="index.php?page=customers&action=contact_billing&id=<?= $id ?>&contact_id=<?= $ct['id'] ?>" style="display:inline">
                  <?= csrf_field() ?>
                  <button type="submit" class="paid-toggle <?= $ct['is_billing'] ? 'is-paid' : '' ?>"
                          title="<?= $ct['is_billing'] ? 'Ist Rechnungsempfänger – Klick entfernt die Markierung' : 'Als Rechnungsempfänger festlegen' ?>">✓</button>
                </form>
                <?php if ($ct['is_billing']): ?><span class="badge badge-billing">Rechnungsempfänger</span><?php endif; ?>
              </td>
              <td><strong><?= e($ct['name']) ?></strong><?php if ($ct['note']): ?><br><span class="hint"><?= e($ct['note']) ?></span><?php endif; ?></td>
              <td><?= $ct['role'] !== '' ? e($ct['role']) : '<span class="hint">–</span>' ?></td>
              <td><?= e($ct['email']) ?><br><?= e($ct['phone']) ?></td>
              <td class="actions">
                <a class="btn btn-sm btn-secondary" href="index.php?page=customers&action=edit&id=<?= $id ?>&edit_contact=<?= $ct['id'] ?>#ansprechpartner">Bearbeiten</a>
                <form method="post" action="index.php?page=customers&action=contact_delete&id=<?= $id ?>&contact_id=<?= $ct['id'] ?>" style="display:inline"
                      onsubmit="return confirm('Ansprechpartner wirklich löschen? Zuordnungen bei Kostenstellen werden entfernt.')">
                  <?= csrf_field() ?>
                  <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <?php endif; ?>

      <h3 class="subform-title"><?= $editContact ? 'Ansprechpartner bearbeiten' : 'Neuen Ansprechpartner anlegen' ?></h3>
      <form method="post" action="index.php?page=customers&action=contact_save&id=<?= $id ?>">
        <?= csrf_field() ?>
        <input type="hidden" name="contact_id" value="<?= $editContact ? (int)$editContact['id'] : 0 ?>">
        <div class="grid-2">
          <div class="field"><label>Name *</label><input type="text" name="c_name" required value="<?= e($editContact['name'] ?? '') ?>"></div>
          <div class="field"><label>Funktion / Position</label><input type="text" name="c_role" placeholder="z. B. Hausverwaltung, Buchhaltung" value="<?= e($editContact['role'] ?? '') ?>"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Telefon</label><input type="text" name="c_phone" value="<?= e($editContact['phone'] ?? '') ?>"></div>
          <div class="field"><label>E-Mail</label><input type="email" name="c_email" value="<?= e($editContact['email'] ?? '') ?>"></div>
        </div>
        <div class="field"><label>Notiz</label><input type="text" name="c_note" value="<?= e($editContact['note'] ?? '') ?>"></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit"><?= $editContact ? 'Speichern' : '+ Ansprechpartner anlegen' ?></button>
          <?php if ($editContact): ?><a class="btn btn-secondary" href="index.php?page=customers&action=edit&id=<?= $id ?>#ansprechpartner">Abbrechen</a><?php endif; ?>
        </div>
      </form>
    </div>

    <div class="card" id="kostenstellen">
      <h2>Kostenstellen <span class="sub">(<?= count($costCenters) ?>)</span></h2>

      <?php if (!$costCenters): ?>
        <p class="hint">Noch keine Kostenstellen hinterlegt.</p>
      <?php else: ?>
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>Nr.</th><th>Bezeichnung</th><th>Ansprechpartner</th><th class="actions">Aktionen</th></tr></thead>
          <tbody>
          <?php foreach ($costCenters as $cc): ?>
            <tr>
              <td><?= $cc['code'] !== '' ? e($cc['code']) : '<span class="hint">–</span>' ?></td>
              <td><strong><?= e($cc['name']) ?></strong><?php if ($cc['note']): ?><br><span class="hint"><?= e($cc['note']) ?></span><?php endif; ?></td>
              <td><?= $cc['contact_name'] ? e($cc['contact_name']) : '<span class="hint">–</span>' ?></td>
              <td class="actions">
                <a class="btn btn-sm btn-secondary" href="index.php?page=customers&action=edit&id=<?= $id ?>&edit_cc=<?= $cc['id'] ?>#kostenstellen">Bearbeiten</a>
                <form method="post" action="index.php?page=customers&action=costcenter_delete&id=<?= $id ?>&cc_id=<?= $cc['id'] ?>" style="display:inline"
                      onsubmit="return confirm('Kostenstelle wirklich löschen?')">
                  <?= csrf_field() ?>
                  <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <?php endif; ?>

      <h3 class="subform-title"><?= $editCC ? 'Kostenstelle bearbeiten' : 'Neue Kostenstelle anlegen' ?></h3>
      <form method="post" action="index.php?page=customers&action=costcenter_save&id=<?= $id ?>">
        <?= csrf_field() ?>
        <input type="hidden" name="cc_id" value="<?= $editCC ? (int)$editCC['id'] : 0 ?>">
        <div class="grid-3">
          <div class="field"><label>Kostenstellen-Nr.</label><input type="text" name="cc_code" placeholder="z. B. KST-100" value="<?= e($editCC['code'] ?? '') ?>"></div>
          <div class="field"><label>Bezeichnung *</label><input type="text" name="cc_name" required placeholder="z. B. Objekt Bahnhofstraße" value="<?= e($editCC['name'] ?? '') ?>"></div>
          <div class="field"><label>Ansprechpartner (optional)</label>
            <select name="cc_contact_id">
              <option value="0">– kein Ansprechpartner –</option>
              <?php foreach ($contacts as $ct): ?>
                <option value="<?= $ct['id'] ?>" <?= ($editCC && $editCC['contact_id'] == $ct['id']) ? 'selected' : '' ?>><?= e($ct['name']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="field"><label>Notiz</label><input type="text" name="cc_note" value="<?= e($editCC['note'] ?? '') ?>"></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit"><?= $editCC ? 'Speichern' : '+ Kostenstelle anlegen' ?></button>
          <?php if ($editCC): ?><a class="btn btn-secondary" href="index.php?page=customers&action=edit&id=<?= $id ?>#kostenstellen">Abbrechen</a><?php endif; ?>
        </div>
      </form>
      <?php if (!$contacts): ?><p class="hint">Tipp: Lege zuerst Ansprechpartner an, um sie hier einer Kostenstelle zuordnen zu können.</p><?php endif; ?>
    </div>

    <div class="card" id="standorte">
      <h2>Standorte <span class="sub">(<?= count($locations) ?>)</span></h2>

      <?php if (!$locations): ?>
        <p class="hint">Noch keine Standorte hinterlegt.</p>
      <?php else: ?>
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>Bezeichnung</th><th>Adresse</th><th class="actions">Aktionen</th></tr></thead>
          <tbody>
          <?php foreach ($locations as $lo): ?>
            <tr>
              <td><strong><?= e($lo['name']) ?></strong><?php if ($lo['note']): ?><br><span class="hint"><?= e($lo['note']) ?></span><?php endif; ?></td>
              <td><?= e($lo['street']) ?><br><?= e(trim($lo['zip'] . ' ' . $lo['city'])) ?></td>
              <td class="actions">
                <a class="btn btn-sm btn-secondary" href="index.php?page=customers&action=edit&id=<?= $id ?>&edit_loc=<?= $lo['id'] ?>#standorte">Bearbeiten</a>
                <form method="post" action="index.php?page=customers&action=location_delete&id=<?= $id ?>&loc_id=<?= $lo['id'] ?>" style="display:inline"
                      onsubmit="return confirm('Standort wirklich löschen?')">
                  <?= csrf_field() ?>
                  <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <?php endif; ?>

      <h3 class="subform-title"><?= $editLoc ? 'Standort bearbeiten' : 'Neuen Standort anlegen' ?></h3>
      <form method="post" action="index.php?page=customers&action=location_save&id=<?= $id ?>">
        <?= csrf_field() ?>
        <input type="hidden" name="loc_id" value="<?= $editLoc ? (int)$editLoc['id'] : 0 ?>">
        <div class="grid-2">
          <div class="field"><label>Bezeichnung *</label><input type="text" name="loc_name" required placeholder="z. B. Zentrale, Filiale Süd, Wohnanlage Parkweg" value="<?= e($editLoc['name'] ?? '') ?>"></div>
          <div class="field"><label>Straße & Hausnummer</label><input type="text" name="loc_street" value="<?= e($editLoc['street'] ?? '') ?>"></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>PLZ</label><input type="text" name="loc_zip" value="<?= e($editLoc['zip'] ?? '') ?>"></div>
          <div class="field"><label>Ort</label><input type="text" name="loc_city" value="<?= e($editLoc['city'] ?? '') ?>"></div>
          <div class="field"><label>Notiz</label><input type="text" name="loc_note" value="<?= e($editLoc['note'] ?? '') ?>"></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit"><?= $editLoc ? 'Speichern' : '+ Standort anlegen' ?></button>
          <?php if ($editLoc): ?><a class="btn btn-secondary" href="index.php?page=customers&action=edit&id=<?= $id ?>#standorte">Abbrechen</a><?php endif; ?>
        </div>
      </form>
    </div>

    <div class="card" id="dokumente">
      <h2>Dokumente <span class="sub">(<?= count($files) ?>)</span></h2>

      <?php if (!$files): ?>
        <p class="hint">Noch keine Dokumente hochgeladen. Hier kannst du Verträge, Pläne oder sonstige Unterlagen zum Kunden ablegen.</p>
      <?php else: ?>
      <div class="table-wrap">
        <table class="list">
          <thead><tr><th>Datei</th><th>Notiz</th><th>Größe</th><th>Hochgeladen</th><th class="actions">Aktionen</th></tr></thead>
          <tbody>
          <?php foreach ($files as $fl): ?>
            <tr>
              <td><strong><?= e($fl['original_name']) ?></strong></td>
              <td><?= $fl['note'] !== '' ? e($fl['note']) : '<span class="hint">–</span>' ?></td>
              <td><?= $fl['size_bytes'] >= 1048576 ? number_format($fl['size_bytes']/1048576, 1, ',', '.') . ' MB' : number_format(max(1, round($fl['size_bytes']/1024)), 0, ',', '.') . ' KB' ?></td>
              <td><?= date('d.m.Y H:i', strtotime($fl['uploaded_at'])) ?></td>
              <td class="actions">
                <a class="btn btn-sm btn-secondary" href="index.php?page=customers&action=file_download&file_id=<?= $fl['id'] ?>">Herunterladen</a>
                <form method="post" action="index.php?page=customers&action=file_delete&file_id=<?= $fl['id'] ?>" style="display:inline"
                      onsubmit="return confirm('Dokument wirklich löschen?')">
                  <?= csrf_field() ?>
                  <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <?php endif; ?>

      <h3 class="subform-title">Dokument hochladen</h3>
      <form method="post" action="index.php?page=customers&action=file_upload&id=<?= $id ?>" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <div class="grid-2">
          <div class="field"><label>Datei * <span class="hint">(max. 15 MB – PDF, Office, Bilder, ZIP)</span></label>
            <input type="file" name="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.zip"></div>
          <div class="field"><label>Notiz</label><input type="text" name="note" placeholder="z. B. Betreuungsvertrag 2026"></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Hochladen</button>
        </div>
      </form>
    </div>

    <div class="card" id="historie">
      <h2>Kontakthistorie <span class="sub">(<?= count($notes) ?> <?= count($notes) === 1 ? 'Eintrag' : 'Einträge' ?>)</span></h2>

      <form method="post" action="index.php?page=customers&action=note_add&id=<?= $id ?>" class="note-form">
        <?= csrf_field() ?>
        <div class="grid-3">
          <div class="field"><label>Art des Kontakts</label>
            <select name="note_type">
              <?php foreach ($noteTypes as $k => $lbl): ?>
                <option value="<?= $k ?>"><?= $lbl ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field"><label>Datum & Uhrzeit</label>
            <input type="datetime-local" name="contact_at" value="<?= date('Y-m-d\TH:i') ?>"></div>
          <div class="field" style="justify-content:flex-end;">
            <label>&nbsp;</label>
            <button class="btn btn-primary" type="submit">+ Eintrag hinzufügen</button>
          </div>
        </div>
        <div class="field"><label>Notiz *</label>
          <textarea name="note" rows="3" required placeholder="z. B. Telefonat: Kunde wünscht zusätzliches Angebot für Winterdienst ab November …"></textarea></div>
      </form>

      <?php if (!$notes): ?>
        <p class="hint">Noch keine Einträge. Halte hier Telefonate, E-Mails und Termine mit diesem Kunden fest.</p>
      <?php else: ?>
      <div class="timeline">
        <?php foreach ($notes as $n): ?>
        <div class="timeline-item">
          <div class="timeline-dot type-<?= $n['note_type'] ?>"></div>
          <div class="timeline-body">
            <div class="timeline-meta">
              <span class="badge note-<?= $n['note_type'] ?>"><?= $noteTypes[$n['note_type']] ?? $n['note_type'] ?></span>
              <strong><?= date('d.m.Y', strtotime($n['contact_at'])) ?></strong>
              <span class="hint"><?= date('H:i', strtotime($n['contact_at'])) ?> Uhr</span>
              <form method="post" action="index.php?page=customers&action=note_delete&note_id=<?= $n['id'] ?>"
                    style="display:inline;margin-left:auto;" onsubmit="return confirm('Eintrag wirklich löschen?')">
                <?= csrf_field() ?>
                <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
              </form>
            </div>
            <div class="timeline-note"><?= nl2br(e($n['note'])) ?></div>
          </div>
        </div>
        <?php endforeach; ?>
      </div>
      <?php endif; ?>
    </div>
    <?php endif; ?>
    <?php
    layout_footer();
    exit;
}

/* ---------- Liste ---------- */
$q = trim($_GET['q'] ?? '');
if ($q !== '') {
    $st = $pdo->prepare("SELECT c.*, (SELECT COUNT(*) FROM customer_notes n WHERE n.customer_id = c.id) AS note_count FROM customers c WHERE c.company LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.city LIKE ? ORDER BY c.company, c.last_name");
    $like = '%' . $q . '%';
    $st->execute([$like, $like, $like, $like]);
    $customers = $st->fetchAll();
} else {
    $customers = $pdo->query('SELECT c.*, (SELECT COUNT(*) FROM customer_notes n WHERE n.customer_id = c.id) AS note_count FROM customers c ORDER BY c.company, c.last_name')->fetchAll();
}

layout_header('Kunden', 'customers');
?>
<div class="page-head">
  <h1>Kunden <span class="sub">(<?= count($customers) ?>)</span></h1>
  <a class="btn btn-primary" href="index.php?page=customers&action=new">+ Neuer Kunde</a>
</div>

<form method="get" class="card" style="padding:0.9rem 1.4rem">
  <input type="hidden" name="page" value="customers">
  <div style="display:flex;gap:0.7rem;align-items:center">
    <input type="text" name="q" value="<?= e($q) ?>" placeholder="Suchen nach Name, Firma oder Ort …"
           style="flex:1;padding:0.55rem 0.75rem;border:1px solid var(--grau-linie);border-radius:8px;font-family:var(--font)">
    <button class="btn btn-secondary" type="submit">Suchen</button>
  </div>
</form>

<?php if (!$customers): ?>
  <div class="card"><p class="hint">Keine Kunden gefunden.</p></div>
<?php else: ?>
<div class="table-wrap">
  <table class="list">
    <thead><tr><th>Name / Firma</th><th>Adresse</th><th>Kontakt</th><th>Historie</th><th class="actions">Aktionen</th></tr></thead>
    <tbody>
    <?php foreach ($customers as $c): ?>
      <tr>
        <td><strong><?= e(customer_display_name($c)) ?></strong>
          <?php if ($c['company'] && ($c['first_name'] || $c['last_name'])): ?>
            <br><span class="hint"><?= e(trim($c['first_name'] . ' ' . $c['last_name'])) ?></span>
          <?php endif; ?>
        </td>
        <td><?= e($c['street']) ?><br><?= e(trim($c['zip'] . ' ' . $c['city'])) ?></td>
        <td><?= e($c['email']) ?><br><?= e($c['phone']) ?></td>
        <td>
          <?php if ((int)$c['note_count'] > 0): ?>
            <a class="badge note-count" href="index.php?page=customers&action=edit&id=<?= $c['id'] ?>#historie" title="Kontakthistorie ansehen"><?= (int)$c['note_count'] ?> <?= (int)$c['note_count'] === 1 ? 'Eintrag' : 'Einträge' ?></a>
          <?php else: ?><span class="hint">–</span><?php endif; ?>
        </td>
        <td class="actions">
          <a class="btn btn-sm btn-secondary" href="index.php?page=customers&action=edit&id=<?= $c['id'] ?>">Bearbeiten</a>
          <form method="post" action="index.php?page=customers&action=delete&id=<?= $c['id'] ?>" style="display:inline"
                onsubmit="return confirm('Kunde wirklich löschen?')">
            <?= csrf_field() ?>
            <button class="btn btn-sm btn-danger" type="submit">Löschen</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>
<?php layout_footer(); ?>
