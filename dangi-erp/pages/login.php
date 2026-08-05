<?php
/**
 * DANGI ERP – Anmeldung
 * Einheitliche Login-Maske für beide Rollen:
 *  - Chef: Benutzername des Chef-Kontos (Einstellungen, Standard "chef";
 *    auch "admin" oder leeres Feld werden akzeptiert) + Chef-Passwort.
 *    Solange in den Einstellungen kein Chef-Passwort gesetzt wurde, gilt
 *    weiterhin das APP_PASSWORD aus config.php (Abwärtskompatibilität).
 *  - Mitarbeiter: persönlicher Benutzername + Passwort (employees-Tabelle).
 */
$error = '';

if (($_GET['action'] ?? '') === 'logout') {
    session_destroy();
    header('Location: index.php?page=login');
    exit;
}

if (current_role() !== 'guest' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect(current_role() === 'employee' ? 'index.php?page=my_day' : 'index.php');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    /* Einfache Bremse gegen Durchprobieren */
    $_SESSION['login_attempts'] = (int)($_SESSION['login_attempts'] ?? 0);
    if ($_SESSION['login_attempts'] >= 5) {
        sleep(2);
    }

    $chefUsername = strtolower(setting('chef_username', 'chef'));
    $chefHash     = setting('chef_password_hash', '');
    $isChefLogin  = $username === ''
        || in_array(strtolower($username), ['admin', $chefUsername], true);

    if (!$isChefLogin) {
        $st = db()->prepare('SELECT * FROM employees WHERE username = ? AND is_active = 1');
        $st->execute([$username]);
        $emp = $st->fetch();
        if ($emp && password_verify($password, $emp['password_hash'])) {
            session_regenerate_id(true);
            unset($_SESSION['authed']);
            unset($_SESSION['login_attempts']);
            $_SESSION['employee_id'] = (int)$emp['id'];
            redirect('index.php?page=my_day');
        }
        $_SESSION['login_attempts']++;
        usleep(400000);
        $error = 'Benutzername oder Passwort falsch.';
    } else {
        $ok = false;
        if ($chefHash !== '') {
            /* Chef-Passwort aus den Einstellungen (empfohlen) */
            $ok = password_verify($password, $chefHash);
        } elseif (APP_PASSWORD !== '') {
            /* Fallback: Passwort aus config.php, solange keines gesetzt ist */
            $ok = hash_equals(APP_PASSWORD, $password);
        }
        if ($ok) {
            session_regenerate_id(true);
            unset($_SESSION['employee_id']);
            unset($_SESSION['login_attempts']);
            $_SESSION['authed'] = true;
            redirect('index.php');
        }
        $_SESSION['login_attempts']++;
        usleep(400000);
        $error = ($chefHash === '' && APP_PASSWORD === '')
            ? 'Admin-Anmeldung: Bitte APP_PASSWORD in config.php setzen oder Benutzername eines Mitarbeiters verwenden.'
            : 'Benutzername oder Passwort falsch.';
    }
}

layout_header('Anmeldung');
$chefUser = setting('chef_username', 'chef');
?>
<div class="card login-box">
  <h1 style="font-size:1.3rem;color:var(--anthrazit);margin-bottom:1rem">DANGI ERP – Anmeldung</h1>
  <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>
  <form method="post">
    <?= csrf_field() ?>
    <div class="field">
      <label>Benutzername</label>
      <input type="text" name="username" autofocus autocomplete="username" placeholder="Benutzername">
    </div>
    <div class="field">
      <label>Passwort</label>
      <input type="password" name="password" autocomplete="current-password" required>
    </div>
    <button class="btn btn-primary" type="submit" style="width:100%">Anmelden</button>
  </form>
  <p class="hint" style="margin-top:0.9rem">Mitarbeiter: mit persönlichem Benutzernamen anmelden.<br>Chef/Verwaltung: Benutzername „<?= e($chefUser) ?>“ (oder leer lassen) und Chef-Passwort eingeben.<br>Passwort vergessen? Mitarbeiter wenden sich an den Chef – dieser kann Passwörter unter „Mitarbeiter“ neu setzen.</p>
</div>
<?php layout_footer(); ?>
