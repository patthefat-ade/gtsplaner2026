<?php
/** DANGI ERP – PDF-Export (FPDF, lokal, DANGI-CI: Türkis/Anthrazit) */
require_once __DIR__ . '/../lib/fpdf/fpdf.php';

$pdo = db();
$id = (int)($_GET['id'] ?? 0);

$st = $pdo->prepare('SELECT d.*, c.company, c.salutation, c.first_name, c.last_name, c.street, c.zip, c.city, c.country, c.uid FROM documents d JOIN customers c ON c.id = d.customer_id WHERE d.id = ?');
$st->execute([$id]);
$doc = $st->fetch();
if (!$doc) { http_response_code(404); die('Dokument nicht gefunden.'); }

$items = $pdo->prepare('SELECT * FROM document_items WHERE document_id = ? ORDER BY position');
$items->execute([$id]);
$items = $items->fetchAll();

$isInvoice = $doc['doc_type'] === 'invoice';
$isCreditNote = $doc['doc_type'] === 'credit_note';
$labelSg = $isCreditNote ? 'Gutschrift' : ($isInvoice ? 'Rechnung' : 'Angebot');

/* UTF-8 → windows-1252 für FPDF-Standardfonts */
function pdf_txt(?string $s): string {
    return iconv('UTF-8', 'windows-1252//TRANSLIT', (string)$s) ?: '';
}
function pdf_money(float $v): string {
    return number_format($v, 2, ',', '.') . ' ' . chr(128); // €-Zeichen in cp1252
}

/* Farben */
$TUERKIS = [15, 167, 160];
$ANTHRAZIT = [59, 71, 87];
$GRAU = [107, 118, 132];
$LINIE = [221, 227, 233];

class DangiPDF extends FPDF {
    public array $col = [];
    public string $footerText = '';

    function Footer(): void {
        $this->SetY(-28);
        $this->SetDrawColor(221, 227, 233);
        $this->Line(20, $this->GetY(), 190, $this->GetY());
        $this->SetY(-26);
        $this->SetFont('Helvetica', '', 7);
        $this->SetTextColor(107, 118, 132);
        $this->MultiCell(0, 3.2, $this->footerText, 0, 'C');
        $this->SetY(-6);
        $this->SetFont('Helvetica', 'I', 7);
        $this->Cell(0, 4, pdf_txt('Seite ' . $this->PageNo() . '/{nb}'), 0, 0, 'C');
    }
}

$pdf = new DangiPDF('P', 'mm', 'A4');
$footerParts = [];
$line1 = setting('company_name') . ' · ' . setting('company_owner') . ' · ' . trim(setting('company_zip') . ' ' . setting('company_city'));
$footerParts[] = $line1;

if (setting('company_trade')) {
    $footerParts[] = setting('company_trade');
}

$line2 = 'Tel: ' . setting('company_phone') . ' · E-Mail: ' . setting('company_email');
if (setting('company_web')) $line2 .= ' · ' . setting('company_web');
$footerParts[] = $line2;

$line3parts = [];
if (setting('company_iban')) $line3parts[] = 'IBAN: ' . setting('company_iban');
if (setting('company_bic')) $line3parts[] = 'BIC: ' . setting('company_bic');
if (setting('company_bank')) $line3parts[] = setting('company_bank');
if ($line3parts) $footerParts[] = implode(' · ', $line3parts);

$line4parts = [];
if (setting('company_uid')) $line4parts[] = 'UID: ' . setting('company_uid');
if (setting('company_fn')) $line4parts[] = 'FN: ' . setting('company_fn');
if (setting('company_tax_nr')) $line4parts[] = 'StNr: ' . setting('company_tax_nr');
if ($line4parts) $footerParts[] = implode(' · ', $line4parts);

$pdf->footerText = pdf_txt(implode("\n", $footerParts));
$pdf->AliasNbPages();
$pdf->SetAutoPageBreak(true, 35);
$pdf->AddPage();
$pdf->SetMargins(20, 20, 20);

/* ---------- Kopfbereich ---------- */
// Türkise Markenlinie oben
$pdf->SetFillColor(...$TUERKIS);
$pdf->Rect(0, 0, 210, 3.5, 'F');

// Logo oder Textmarke rechts oben
$pdfLogoPath = setting('pdf_logo_path', '');
$logoFile = $pdfLogoPath ? (__DIR__ . '/../' . $pdfLogoPath) : '';
if ($logoFile && file_exists($logoFile)) {
    /* Logo proportional einpassen: max 50mm breit, max 22mm hoch */
    $imgSize = getimagesize($logoFile);
    $maxW = 50; $maxH = 22;
    if ($imgSize) {
        $ratio = $imgSize[0] / $imgSize[1];
        $w = $maxW; $h = $w / $ratio;
        if ($h > $maxH) { $h = $maxH; $w = $h * $ratio; }
    } else {
        $w = $maxW; $h = $maxH;
    }
    $x = 210 - 20 - $w; // rechts mit 20mm Rand
    $pdf->Image($logoFile, $x, 8, $w, $h);
    $pdf->SetY(8 + $h + 2);
    $pdf->SetFont('Helvetica', '', 8);
    $pdf->SetTextColor(...$GRAU);
    $pdf->Cell(0, 4, pdf_txt(trim(setting('company_zip') . ' ' . setting('company_city'))), 0, 1, 'R');
    $pdf->Cell(0, 4, pdf_txt(setting('company_phone') . ' · ' . setting('company_email')), 0, 1, 'R');
} else {
    // Fallback: Firmenname als Wortmarke
    $pdf->SetY(14);
    $pdf->SetFont('Helvetica', 'B', 20);
    $pdf->SetTextColor(...$ANTHRAZIT);
    $pdf->Cell(0, 8, pdf_txt('DANGI'), 0, 1, 'R');
    $pdf->SetFont('Helvetica', '', 8.5);
    $pdf->SetTextColor(...$TUERKIS);
    $pdf->Cell(0, 4, pdf_txt('Hausbetreuung & Reinigungsservice'), 0, 1, 'R');
    $pdf->SetTextColor(...$GRAU);
    $pdf->SetFont('Helvetica', '', 8);
    $pdf->Cell(0, 4, pdf_txt(trim(setting('company_zip') . ' ' . setting('company_city'))), 0, 1, 'R');
    $pdf->Cell(0, 4, pdf_txt(setting('company_phone') . ' · ' . setting('company_email')), 0, 1, 'R');
}

/* ---------- Empfängeradresse ---------- */
$pdf->SetY(40);
$pdf->SetFont('Helvetica', '', 7);
$pdf->SetTextColor(...$GRAU);
$pdf->Cell(0, 3.5, pdf_txt(setting('company_name') . ' · ' . trim(setting('company_zip') . ' ' . setting('company_city'))), 0, 1);
$pdf->Ln(1.5);
$pdf->SetFont('Helvetica', '', 10);
$pdf->SetTextColor(30, 38, 48);
$adr = [];
$name = trim(($doc['company'] ?: '') ?: '');
if ($name) $adr[] = $name;
$person = trim(($doc['salutation'] ? $doc['salutation'] . ' ' : '') . trim($doc['first_name'] . ' ' . $doc['last_name']));
if ($person && $person !== $name) $adr[] = $person;
if ($doc['street']) $adr[] = $doc['street'];
$zc = trim($doc['zip'] . ' ' . $doc['city']);
if ($zc) $adr[] = $zc;
if ($doc['country'] && $doc['country'] !== 'Österreich') $adr[] = $doc['country'];
foreach ($adr as $line) $pdf->Cell(0, 5, pdf_txt($line), 0, 1);

/* ---------- Dokumentkopf ---------- */
$pdf->SetY(78);
$pdf->SetFont('Helvetica', 'B', 16);
$pdf->SetTextColor(...$ANTHRAZIT);
$pdf->Cell(110, 8, pdf_txt($labelSg . ' ' . $doc['doc_number']), 0, 0);

$pdf->SetFont('Helvetica', '', 9);
$pdf->SetTextColor(...$GRAU);
$metaX = 130;
$pdf->SetXY($metaX, 76);
$pdf->Cell(30, 5, pdf_txt('Datum:'), 0, 0);
$pdf->SetTextColor(30, 38, 48);
$pdf->Cell(0, 5, pdf_txt(dmy($doc['doc_date'])), 0, 1, 'R');
/* Gutschrift-Referenz */
if ($isCreditNote && $doc['source_invoice_id']) {
    $refSt = db()->prepare('SELECT doc_number FROM documents WHERE id = ?');
    $refSt->execute([$doc['source_invoice_id']]);
    $refNum = $refSt->fetchColumn();
    if ($refNum) {
        $pdf->SetFont('Helvetica', '', 9);
        $pdf->SetXY(120, $pdf->GetY() + 2);
        $pdf->Cell(70, 5, 'Gutschrift zu: ' . $refNum, 0, 1, 'R');
    }
}
if ($isInvoice && $doc['due_date']) {
    $pdf->SetX($metaX);
    $pdf->SetTextColor(...$GRAU);
    $pdf->Cell(30, 5, pdf_txt('Zahlbar bis:'), 0, 0);
    $pdf->SetTextColor(30, 38, 48);
    $pdf->Cell(0, 5, pdf_txt(dmy($doc['due_date'])), 0, 1, 'R');
}
if ($isInvoice && ($spLabel = service_period_label($doc)) !== '') {
    $pdf->SetX($metaX);
    $pdf->SetTextColor(...$GRAU);
    $pdf->Cell(34, 5, pdf_txt('Leistungszeitraum:'), 0, 0);
    $pdf->SetTextColor(30, 38, 48);
    $pdf->Cell(0, 5, pdf_txt($spLabel), 0, 1, 'R');
}
if (!$isInvoice && $doc['valid_until']) {
    $pdf->SetX($metaX);
    $pdf->SetTextColor(...$GRAU);
    $pdf->Cell(30, 5, pdf_txt('Gültig bis:'), 0, 0);
    $pdf->SetTextColor(30, 38, 48);
    $pdf->Cell(0, 5, pdf_txt(dmy($doc['valid_until'])), 0, 1, 'R');
}
if ($doc['uid']) {
    $pdf->SetX($metaX);
    $pdf->SetTextColor(...$GRAU);
    $pdf->Cell(30, 5, pdf_txt('UID Kunde:'), 0, 0);
    $pdf->SetTextColor(30, 38, 48);
    $pdf->Cell(0, 5, pdf_txt($doc['uid']), 0, 1, 'R');
}

/* ---------- Anrede + Einleitung ---------- */
$pdf->SetY(96);
$pdf->SetFont('Helvetica', '', 10);
$pdf->SetTextColor(30, 38, 48);
$anrede = 'Sehr geehrte Damen und Herren,';
if ($doc['salutation'] === 'Herr' && $doc['last_name']) $anrede = 'Sehr geehrter Herr ' . $doc['last_name'] . ',';
if ($doc['salutation'] === 'Frau' && $doc['last_name']) $anrede = 'Sehr geehrte Frau ' . $doc['last_name'] . ',';
$pdf->MultiCell(0, 5, pdf_txt($anrede));
if ($doc['intro_text']) {
    $pdf->Ln(1);
    $pdf->MultiCell(0, 5, pdf_txt($doc['intro_text']));
}
$pdf->Ln(4);

/* ---------- Positionstabelle ---------- */
$colW = [12, 78, 18, 22, 20, 20]; // Pos, Leistung, Menge, Einheit, Einzelpreis, Summe

function table_head(DangiPDF $pdf, array $colW, array $TUERKIS): void {
    $pdf->SetFont('Helvetica', 'B', 8.5);
    $pdf->SetFillColor(...$TUERKIS);
    $pdf->SetTextColor(255, 255, 255);
    $pdf->SetDrawColor(...$TUERKIS);
    $pdf->Cell($colW[0], 7, pdf_txt('Pos.'), 1, 0, 'C', true);
    $pdf->Cell($colW[1], 7, pdf_txt('Leistung'), 1, 0, 'L', true);
    $pdf->Cell($colW[2], 7, pdf_txt('Menge'), 1, 0, 'R', true);
    $pdf->Cell($colW[3], 7, pdf_txt('Einheit'), 1, 0, 'L', true);
    $pdf->Cell($colW[4], 7, pdf_txt('Preis'), 1, 0, 'R', true);
    $pdf->Cell($colW[5], 7, pdf_txt('Summe'), 1, 1, 'R', true);
}

table_head($pdf, $colW, $TUERKIS);
$pdf->SetTextColor(30, 38, 48);
$pdf->SetDrawColor(...$LINIE);

foreach ($items as $it) {
    // Höhe berechnen: Titel (fett) + optionale Beschreibung
    $pdf->SetFont('Helvetica', 'B', 9);
    $titleLines = max(1, ceil($pdf->GetStringWidth(pdf_txt($it['title'])) / ($colW[1] - 4)));
    $descLines = 0;
    if ($it['description']) {
        $pdf->SetFont('Helvetica', '', 8);
        foreach (explode("\n", $it['description']) as $dl) {
            $descLines += max(1, ceil($pdf->GetStringWidth(pdf_txt($dl)) / ($colW[1] - 4)));
        }
    }
    $h = $titleLines * 4.6 + $descLines * 3.8 + 4;

    // Seitenumbruch
    if ($pdf->GetY() + $h > 265) {
        $pdf->AddPage();
        table_head($pdf, $colW, $TUERKIS);
        $pdf->SetTextColor(30, 38, 48);
        $pdf->SetDrawColor(...$LINIE);
    }

    $y = $pdf->GetY();
    $x = 20;

    // Zellrahmen
    $pdf->Rect($x, $y, array_sum($colW), $h);
    foreach ([$colW[0], $colW[0]+$colW[1], $colW[0]+$colW[1]+$colW[2], $colW[0]+$colW[1]+$colW[2]+$colW[3], $colW[0]+$colW[1]+$colW[2]+$colW[3]+$colW[4]] as $off) {
        $pdf->Line($x + $off, $y, $x + $off, $y + $h);
    }

    // Pos
    $pdf->SetFont('Helvetica', '', 9);
    $pdf->SetXY($x, $y + 2);
    $pdf->Cell($colW[0], 4.6, (string)(int)$it['position'], 0, 0, 'C');

    // Titel + Beschreibung
    $pdf->SetXY($x + $colW[0] + 2, $y + 2);
    $pdf->SetFont('Helvetica', 'B', 9);
    $pdf->MultiCell($colW[1] - 4, 4.6, pdf_txt($it['title']));
    if ($it['description']) {
        $pdf->SetX($x + $colW[0] + 2);
        $pdf->SetFont('Helvetica', '', 8);
        $pdf->SetTextColor(...$GRAU);
        $pdf->MultiCell($colW[1] - 4, 3.8, pdf_txt($it['description']));
        $pdf->SetTextColor(30, 38, 48);
    }

    // Zahlen
    $pdf->SetFont('Helvetica', '', 9);
    $pdf->SetXY($x + $colW[0] + $colW[1], $y + 2);
    $pdf->Cell($colW[2] - 2, 4.6, pdf_txt(number_format((float)$it['quantity'], 2, ',', '.')), 0, 0, 'R');
    $pdf->SetXY($x + $colW[0] + $colW[1] + $colW[2] + 2, $y + 2);
    $pdf->Cell($colW[3] - 2, 4.6, pdf_txt($it['unit']), 0, 0, 'L');
    $pdf->SetXY($x + $colW[0] + $colW[1] + $colW[2] + $colW[3], $y + 2);
    $pdf->Cell($colW[4] - 2, 4.6, pdf_money((float)$it['unit_price']), 0, 0, 'R');
    $pdf->SetFont('Helvetica', 'B', 9);
    $pdf->SetXY($x + $colW[0] + $colW[1] + $colW[2] + $colW[3] + $colW[4], $y + 2);
    $pdf->Cell($colW[5] - 2, 4.6, pdf_money((float)$it['line_total']), 0, 0, 'R');

    $pdf->SetY($y + $h);
}

/* ---------- Gesamtsumme ---------- */
$pdf->Ln(2);
if ($pdf->GetY() > 240) $pdf->AddPage();
$sumX = 20 + $colW[0] + $colW[1] + $colW[2];
$sumW = $colW[3] + $colW[4] + $colW[5];
$pdf->SetX($sumX);
$pdf->SetFillColor(...$ANTHRAZIT);
$pdf->SetTextColor(255, 255, 255);
$pdf->SetFont('Helvetica', 'B', 10);
$pdf->Cell($sumW * 0.55, 9, pdf_txt('Gesamtsumme'), 0, 0, 'L', true);
$pdf->Cell($sumW * 0.45, 9, pdf_money((float)$doc['total_net']), 0, 1, 'R', true);

$pdf->SetTextColor(...$GRAU);
$pdf->SetFont('Helvetica', 'I', 8);
$pdf->SetX($sumX);
$pdf->Cell($sumW, 5, '', 0, 1);
$pdf->SetX(20);
$pdf->MultiCell(0, 4.2, pdf_txt(setting('tax_note')), 0, 'L');

/* ---------- Schlusstext ---------- */
if ($doc['outro_text']) {
    $pdf->Ln(4);
    $pdf->SetFont('Helvetica', '', 10);
    $pdf->SetTextColor(30, 38, 48);
    $pdf->MultiCell(0, 5, pdf_txt($doc['outro_text']));
}
$pdf->Ln(6);
$pdf->SetFont('Helvetica', '', 10);
$pdf->SetTextColor(30, 38, 48);
$pdf->MultiCell(0, 5, pdf_txt("Mit freundlichen Grüßen\n" . str_replace('Inhaber: ', '', setting('company_owner')) . "\n" . setting('company_name')));

/* ---------- Ausgabe ---------- */
$filename = $labelSg . '_' . preg_replace('/[^A-Za-z0-9\-_]/', '_', $doc['doc_number']) . '.pdf';
/* Wenn intern aufgerufen (E-Mail-Versand), PDF als String zurückgeben statt Download */
if (($_GET['output_mode'] ?? '') === 'string') {
    echo $pdf->Output('S', $filename);
    return;
}
$pdf->Output('D', $filename);
exit;
