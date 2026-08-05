<?php
/**
 * DANGI ERP – iCal-Export (.ics)
 * Exportiert Termine als iCalendar-Datei, kompatibel mit
 * iOS/Apple Kalender, Google Calendar und Outlook.
 * Optional ?month=YYYY-MM für einen einzelnen Monat.
 */
$pdo = db();

$month = $_GET['month'] ?? '';
if ($month !== '' && !preg_match('/^\d{4}-\d{2}$/', $month)) { $month = ''; }

if ($month !== '') {
    [$y, $m] = array_map('intval', explode('-', $month));
    $first = sprintf('%04d-%02d-01', $y, $m);
    $last  = sprintf('%04d-%02d-%02d', $y, $m, (int)date('t', strtotime($first)));
    $st = $pdo->prepare('SELECT * FROM events WHERE DATE(start_dt) BETWEEN ? AND ? ORDER BY start_dt');
    $st->execute([$first, $last]);
} else {
    $st = $pdo->query('SELECT * FROM events ORDER BY start_dt');
}
$events = $st->fetchAll();

/* iCal-Text escapen (RFC 5545): Backslash, Semikolon, Komma, Zeilenumbrüche */
function ical_escape(string $s): string {
    $s = str_replace('\\', '\\\\', $s);
    $s = str_replace([';', ','], ['\\;', '\\,'], $s);
    $s = str_replace(["\r\n", "\r", "\n"], '\\n', $s);
    return $s;
}
/* Zeilen auf max. 75 Oktette falten (RFC 5545, Fortsetzung mit Leerzeichen) */
function ical_fold(string $line): string {
    $out = '';
    while (strlen($line) > 75) {
        $chunk = substr($line, 0, 75);
        /* UTF-8-Zeichen nicht zerschneiden */
        while ((ord(substr($chunk, -1)) & 0xC0) === 0x80) { $chunk = substr($chunk, 0, -1); }
        $out .= $chunk . "\r\n ";
        $line = substr($line, strlen($chunk));
    }
    return $out . $line;
}

$tz = 'Europe/Vienna';
$now = gmdate('Ymd\THis\Z');

$lines = [];
$lines[] = 'BEGIN:VCALENDAR';
$lines[] = 'VERSION:2.0';
$lines[] = 'PRODID:-//DANGI Hausbetreuung & Reinigung//DANGI ERP//DE';
$lines[] = 'CALSCALE:GREGORIAN';
$lines[] = 'METHOD:PUBLISH';
$lines[] = 'X-WR-CALNAME:DANGI ERP' . ($month !== '' ? ' ' . $month : '');
$lines[] = 'X-WR-TIMEZONE:' . $tz;
/* VTIMEZONE für Europe/Vienna (MEZ/MESZ) – von iOS/Apple Kalender erwartet */
$lines[] = 'BEGIN:VTIMEZONE';
$lines[] = 'TZID:' . $tz;
$lines[] = 'BEGIN:DAYLIGHT';
$lines[] = 'TZOFFSETFROM:+0100';
$lines[] = 'TZOFFSETTO:+0200';
$lines[] = 'TZNAME:MESZ';
$lines[] = 'DTSTART:19700329T020000';
$lines[] = 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU';
$lines[] = 'END:DAYLIGHT';
$lines[] = 'BEGIN:STANDARD';
$lines[] = 'TZOFFSETFROM:+0200';
$lines[] = 'TZOFFSETTO:+0100';
$lines[] = 'TZNAME:MEZ';
$lines[] = 'DTSTART:19701025T030000';
$lines[] = 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU';
$lines[] = 'END:STANDARD';
$lines[] = 'END:VTIMEZONE';

foreach ($events as $ev) {
    $uid = 'dangi-erp-event-' . $ev['id'] . '@erp.dangi.at';
    $lines[] = 'BEGIN:VEVENT';
    $lines[] = 'UID:' . $uid;
    $lines[] = 'DTSTAMP:' . $now;
    if ((int)$ev['all_day'] === 1) {
        $d = substr($ev['start_dt'], 0, 10);
        $lines[] = 'DTSTART;VALUE=DATE:' . str_replace('-', '', $d);
        $lines[] = 'DTEND;VALUE=DATE:' . date('Ymd', strtotime($d . ' +1 day'));
    } else {
        $start = date('Ymd\THis', strtotime($ev['start_dt']));
        $lines[] = 'DTSTART;TZID=' . $tz . ':' . $start;
        $endSrc = $ev['end_dt'] ?: date('Y-m-d H:i:s', strtotime($ev['start_dt'] . ' +1 hour'));
        $lines[] = 'DTEND;TZID=' . $tz . ':' . date('Ymd\THis', strtotime($endSrc));
    }
    $lines[] = 'SUMMARY:' . ical_escape($ev['title']);
    if (!empty($ev['description'])) { $lines[] = 'DESCRIPTION:' . ical_escape($ev['description']); }
    if (!empty($ev['location']))    { $lines[] = 'LOCATION:' . ical_escape($ev['location']); }
    $lines[] = 'END:VEVENT';
}
$lines[] = 'END:VCALENDAR';

$ics = implode("\r\n", array_map('ical_fold', $lines)) . "\r\n";
$filename = 'dangi-termine' . ($month !== '' ? '-' . $month : '') . '.ics';

header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . strlen($ics));
echo $ics;
exit;
