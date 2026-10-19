<?php
declare(strict_types=1);
function flush_mail(int $limit=5): int {
    if (!mail_enabled()) return 0;
    require_once __DIR__.'/vendor/autoload.php';
    $lock=fopen(__DIR__.'/mail.lock','c');
    if (!$lock || !flock($lock,LOCK_EX|LOCK_NB)) { if ($lock) fclose($lock); return 0; }
    $sent=0;
    try {
        $c=config();
        $rows=query("SELECT * FROM sgt_applications WHERE status='queued' AND next_attempt<=? ORDER BY created_at LIMIT ".max(1,min($limit,10)),[time()])->fetchAll();
        foreach($rows as $row) {
            try {
                $mail=new PHPMailer\PHPMailer\PHPMailer(true);
                $mail->isSMTP();$mail->Host=$c['smtp_host'];$mail->Port=(int)$c['smtp_port'];
                $mail->SMTPAuth=true;$mail->Username=$c['smtp_user'];$mail->Password=$c['smtp_password'];
                $mail->SMTPSecure=$c['smtp_secure'] ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Timeout=10;$mail->Timelimit=15;$mail->CharSet='UTF-8';$mail->SMTPDebug=0;
                $mail->SMTPOptions=['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false]];
                $mail->setFrom($c['smtp_from'],'СГТ-Холдинг');$mail->addAddress(RECIPIENT);$mail->addReplyTo($row['email'],preg_replace('/[\r\n]+/',' ',$row['name']));
                $mail->Subject='СГТ-КСК: заявка партнёра '.preg_replace('/[\r\n]+/',' ',$row['company']);
                $mail->Body="Новая заявка № {$row['id']}\n\nКомпания: {$row['company']}\nКонтакт: {$row['name']}\nEmail: {$row['email']}\nИНН: {$row['inn']}\nКомментарий: {$row['message']}\nСогласие: {$row['consent_version']}\nПринята: {$row['created_at']}";
                $mail->addAttachment(file_path($row['filename']),'anketa-'.substr($row['id'],0,8).'.'.pathinfo($row['filename'],PATHINFO_EXTENSION));
                $mail->send();
                query("UPDATE sgt_applications SET status='sent',sent_at=CURRENT_TIMESTAMP,attempts=attempts+1 WHERE id=?",[$row['id']]);$sent++;
            } catch(Throwable) {
                $delay=min(86400,60*(2**min((int)$row['attempts'],10)));
                query('UPDATE sgt_applications SET attempts=attempts+1,next_attempt=? WHERE id=?',[time()+$delay,$row['id']]);
                error_log('SGT SMTP delivery failed; application stays queued');
            }
        }
    } finally { flock($lock,LOCK_UN);fclose($lock); }
    return $sent;
}
