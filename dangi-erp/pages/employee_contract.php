<?php
/**
 * DANGI ERP – Arbeitsvertrag-Download (nur Admin)
 * Liefert die hochgeladene Vertragsdatei geschützt aus.
 */
require_admin();

$id = (int)($_GET['id'] ?? 0);
$st = db()->prepare('SELECT contract_file, first_name, last_name FROM employees WHERE id=?');
$st->execute([$id]);
$emp = $st->fetch();
if (!$emp || !$emp['contract_file']) {
    flash('Kein Vertrag hinterlegt.');
    redirect('index.php?page=employees');
}
$path = realpath(__DIR__ . '/../uploads/contracts/' . $emp['contract_file']);
$base = realpath(__DIR__ . '/../uploads/contracts');
if (!$path || !$base || strpos($path, $base) !== 0 || !is_file($path)) {
    flash('Vertragsdatei nicht gefunden.');
    redirect('index.php?page=employees');
}
$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$mime = match ($ext) {
    'pdf'          => 'application/pdf',
    'jpg', 'jpeg'  => 'image/jpeg',
    'png'          => 'image/png',
    'webp'         => 'image/webp',
    'doc'          => 'application/msword',
    'docx'         => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    default        => 'application/octet-stream',
};
$dlName = 'Arbeitsvertrag_' . preg_replace('/[^A-Za-z0-9]+/', '_', trim($emp['first_name'] . '_' . $emp['last_name'])) . '.' . $ext;
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: attachment; filename="' . $dlName . '"');
header('X-Content-Type-Options: nosniff');
readfile($path);
exit;

