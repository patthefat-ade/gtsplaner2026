<?php
/**
 * DANGI ERP – E-Mail-Versand via PHPMailer
 * Sendet ein Dokument-PDF als Anhang mit schönem HTML-Template.
 */
require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

/**
 * Sendet ein Dokument per E-Mail.
 *
 * @param string $toEmail    Empfänger-E-Mail
 * @param string $toName     Empfänger-Name
 * @param string $subject    Betreff
 * @param string $bodyText   Freitext-Nachricht (wird ins HTML-Template eingebettet)
 * @param string $pdfPath    Pfad zur temporären PDF-Datei
 * @param string $pdfName    Dateiname des Anhangs (z. B. Rechnung_RE-2026-0001.pdf)
 * @param array  $doc        Dokument-Array (für Template-Variablen)
 * @return true|string       true bei Erfolg, Fehlermeldung als String bei Fehler
 */
function send_document_email(string $toEmail, string $toName, string $subject, string $bodyText, string $pdfPath, string $pdfName, array $doc) {
    $host = setting('smtp_host');
    $port = (int)(setting('smtp_port', '587') ?: 587);
    $user = setting('smtp_user');
    $pass = setting('smtp_pass');
    $fromName  = setting('smtp_from_name') ?: setting('company_name', 'DANGI ERP');
    $fromEmail = setting('smtp_from_email') ?: setting('company_email');

    if (!$host || !$user || !$pass || !$fromEmail) {
        return 'SMTP ist nicht konfiguriert. Bitte unter Einstellungen → E-Mail-Versand die SMTP-Daten hinterlegen.';
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = $host;
        $mail->SMTPAuth   = true;
        $mail->Username   = $user;
        $mail->Password   = $pass;
        $mail->SMTPSecure = $port === 465 ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $port;
        $mail->CharSet    = 'UTF-8';

        $mail->setFrom($fromEmail, $fromName);
        $mail->addAddress($toEmail, $toName);
        $mail->addReplyTo($fromEmail, $fromName);

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = build_email_html($subject, $bodyText, $doc);
        $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $bodyText));

        $mail->addAttachment($pdfPath, $pdfName, 'base64', 'application/pdf');

        $mail->send();
        return true;
    } catch (MailException $e) {
        return 'E-Mail-Fehler: ' . $mail->ErrorInfo;
    }
}

/**
 * Erzeugt das HTML-E-Mail-Template im DANGI-CI (Türkis/Anthrazit).
 */
function build_email_html(string $subject, string $bodyText, array $doc): string {
    $company = htmlspecialchars(setting('company_name', 'DANGI'), ENT_QUOTES, 'UTF-8');
    $phone   = htmlspecialchars(setting('company_phone'), ENT_QUOTES, 'UTF-8');
    $email   = htmlspecialchars(setting('company_email'), ENT_QUOTES, 'UTF-8');
    $web     = htmlspecialchars(setting('company_web'), ENT_QUOTES, 'UTF-8');
    $bodyHtml = nl2br(htmlspecialchars($bodyText, ENT_QUOTES, 'UTF-8'));
    $docNumber = htmlspecialchars($doc['doc_number'] ?? '', ENT_QUOTES, 'UTF-8');
    $isInvoice = ($doc['doc_type'] ?? '') === 'invoice';
    $labelSg = $isInvoice ? 'Rechnung' : 'Angebot';

    return <<<HTML
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
  <!-- Header -->
  <tr><td style="background:#0FA7A0;padding:24px 32px;text-align:center">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">{$company}</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px">Hausbetreuung &amp; Reinigungsservice</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px 32px 24px">
    <h2 style="margin:0 0 16px;color:#3B4757;font-size:18px;font-weight:600">{$labelSg} {$docNumber}</h2>
    <div style="color:#4a5568;font-size:15px;line-height:1.6">{$bodyHtml}</div>
    <div style="margin-top:24px;padding:16px;background:#f0faf9;border-left:4px solid #0FA7A0;border-radius:6px">
      <p style="margin:0;color:#3B4757;font-size:14px"><strong>📎 Im Anhang:</strong> {$labelSg} {$docNumber} als PDF</p>
    </div>
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e8ecf0">
    <p style="margin:0;color:#6B7684;font-size:12px;line-height:1.5;text-align:center">
      {$company}<br>
      Tel: {$phone} · E-Mail: <a href="mailto:{$email}" style="color:#0FA7A0;text-decoration:none">{$email}</a>
      · <a href="{$web}" style="color:#0FA7A0;text-decoration:none">{$web}</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
HTML;
}
