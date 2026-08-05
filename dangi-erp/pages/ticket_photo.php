<?php
/**
 * DANGI ERP – Ticketfoto-Auslieferung (auth-geprüft)
 * Admin sieht alle Fotos, Mitarbeiter nur Fotos eigener Tickets.
 */
$id = (int)($_GET['id'] ?? 0);
$st = db()->prepare('SELECT p.*, t.employee_id FROM ticket_photos p JOIN tickets t ON t.id = p.ticket_id WHERE p.id=?');
$st->execute([$id]);
$p = $st->fetch();

$emp = current_employee();
if (!$p) { http_response_code(404); exit('Nicht gefunden'); }
// Admin darf alles; Mitarbeiter nur Fotos von Tickets, die ihm zugewiesen sind
if (!is_admin()) {
    if (!$emp || (int)$p['employee_id'] !== (int)$emp['id']) {
        // employee_id am Foto kann abweichen – entscheidend ist die Ticket-Zuweisung
        $chk = db()->prepare('SELECT 1 FROM tickets WHERE id=? AND employee_id=?');
        $chk->execute([(int)$p['ticket_id'], (int)($emp['id'] ?? 0)]);
        if (!$chk->fetch()) { http_response_code(403); exit('Kein Zugriff'); }
    }
}

$file = __DIR__ . '/../uploads/tickets/' . $p['stored_name'];
if (!is_file($file)) { http_response_code(404); exit('Datei fehlt'); }

header('Content-Type: ' . ($p['mime_type'] ?: 'application/octet-stream'));
header('Content-Length: ' . filesize($file));
header('Content-Disposition: inline; filename="' . rawurlencode($p['original_name']) . '"');
header('Cache-Control: private, max-age=86400');
readfile($file);
exit;
