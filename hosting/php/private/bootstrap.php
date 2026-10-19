<?php
declare(strict_types=1);

umask(0077);
ini_set('display_errors', '0');
date_default_timezone_set('UTC');
const RECIPIENT = 'antnpk@gmail.com';
const CONSENT = '2026-10-18-v1';
function private_dir(): string { return __DIR__; }
function secure_request(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] ?? '') == 443 || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}
function security_headers(): void {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    header('Cache-Control: no-store');
    if (secure_request()) header('Strict-Transport-Security: max-age=31536000');
}
function json_response(array $data, int $status = 200): never {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit;
}
function fail(string $message, int $status = 400): never { json_response(['error' => $message], $status); }
function secret(): string {
    $file = __DIR__ . '/secret.key';
    if (!is_file($file)) {
        $handle = @fopen($file, 'x');
        if ($handle) { fwrite($handle, bin2hex(random_bytes(32))); fclose($handle); chmod($file,0600); }
    }
    $value = trim((string) @file_get_contents($file));
    if (strlen($value) !== 64) throw new RuntimeException('Private secret is unavailable');
    return $value;
}
function config(): ?array {
    if (!is_file(__DIR__ . '/config.json')) return null;
    return json_decode(file_get_contents(__DIR__ . '/config.json'), true, 512, JSON_THROW_ON_ERROR);
}
function save_config(array $value): void {
    $temporary = __DIR__ . '/config-' . bin2hex(random_bytes(8)) . '.tmp';
    if (file_put_contents($temporary, json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), LOCK_EX) === false) throw new RuntimeException('Cannot save private configuration');
    chmod($temporary,0600);
    if (!rename($temporary, __DIR__ . '/config.json')) { unlink($temporary); throw new RuntimeException('Cannot apply private configuration'); }
}
function connect_database(array $settings): PDO {
    $host = $settings['db_host']; $database = $settings['db_name'];
    if (!preg_match('/^[a-zA-Z0-9_.-]+(?::[0-9]{1,5})?$/D', $host) || !preg_match('/^[a-zA-Z0-9_-]+$/D', $database)) throw new InvalidArgumentException('Invalid database connection settings');
    $hostAndPort = explode(':', $host, 2);
    $dsn = 'mysql:host='.$hostAndPort[0].';dbname='.$database.';charset=utf8mb4'.(isset($hostAndPort[1]) ? ';port='.$hostAndPort[1] : '');
    $db = new PDO($dsn, $settings['db_user'], $settings['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false, PDO::ATTR_TIMEOUT=>5]);
    $db->exec("SET time_zone = '+00:00'");
    return $db;
}
function database(): PDO {
    static $db;
    if (!$db) { $settings = config(); if (!$settings) throw new RuntimeException('Site has not been configured'); $db = connect_database($settings); }
    return $db;
}
function query(string $sql, array $params = []): PDOStatement { $statement=database()->prepare($sql); $statement->execute($params); return $statement; }
function cookie(string $name, string $value, int $expires): void {
    setcookie($name,$value,['expires'=>$expires,'path'=>'/','secure'=>secure_request(),'httponly'=>true,'samesite'=>'Strict']);
}
function csrf_token(): string {
    $existing=$_COOKIE['sgt_csrf'] ?? '';
    if (valid_csrf($existing)) return $existing;
    $token=bin2hex(random_bytes(24)); $signed=$token.'.'.hash_hmac('sha256',$token,secret());
    cookie('sgt_csrf',$signed,time()+3600); return $signed;
}
function valid_csrf(string $token): bool {
    $pieces=explode('.',$token);
    return count($pieces)===2 && preg_match('/^[a-f0-9]{48}$/D',$pieces[0])===1 && preg_match('/^[a-f0-9]{64}$/D',$pieces[1])===1 && hash_equals(hash_hmac('sha256',$pieces[0],secret()),$pieces[1]) && hash_equals($_COOKIE['sgt_csrf'] ?? '',$token);
}
function check_csrf(string $token): void {
    $origin=$_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin!=='' && !in_array($origin,['https://sgt-h.ru','https://cons.sgt-h.ru',getenv('SGT_TEST_ORIGIN') ?: 'https://sgt-h.ru'],true)) fail('Запрос с этого адреса не разрешён.',403);
    if (!valid_csrf($token)) fail('Обновите страницу и повторите отправку.',403);
}
function clean_text(mixed $value,int $min,int $max): string {
    if (!is_string($value)) throw new InvalidArgumentException('Заполните обязательные поля.');
    $value=trim($value);
    if (!mb_check_encoding($value,'UTF-8') || mb_strlen($value)<$min || mb_strlen($value)>$max || str_contains($value,"\0")) throw new InvalidArgumentException('Проверьте длину и содержимое полей.');
    return $value;
}
function email_value(mixed $value): string {
    $email=strtolower(clean_text($value,3,254));
    if (!filter_var($email,FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Проверьте адрес электронной почты.');
    return $email;
}
function password_value(mixed $value): string {
    if (!is_string($value) || !mb_check_encoding($value,'UTF-8') || mb_strlen($value)<12 || mb_strlen($value)>128 || str_contains($value,"\0")) throw new InvalidArgumentException('Пароль должен содержать от 12 до 128 символов.');
    return $value;
}
function password_digest(string $password): string { return password_hash(base64_encode(hash('sha384',$password,true)),PASSWORD_BCRYPT,['cost'=>12]); }
function password_matches(string $password,string $hash): bool { return password_verify(base64_encode(hash('sha384',$password,true)),$hash); }
function public_user(array $user): array { return ['id'=>(int)$user['id'],'name'=>$user['name'],'email'=>$user['email'],'company'=>$user['company'],'approved'=>(int)$user['approved']]; }
function current_user(): ?array {
    $token=$_COOKIE['sgt_session'] ?? '';
    if (!preg_match('/^[a-f0-9]{64}$/D',$token)) return null;
    $user=query('SELECT u.* FROM sgt_users u JOIN sgt_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',[hash('sha256',$token),time()])->fetch();
    return $user ?: null;
}
function sign_in(int $id): void {
    $token=bin2hex(random_bytes(32));
    query('DELETE FROM sgt_sessions WHERE expires_at<=?',[time()]);
    query('INSERT INTO sgt_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash('sha256',$token),$id,time()+7*86400]);
    cookie('sgt_session',$token,time()+7*86400);
}
function sign_out(): void { query('DELETE FROM sgt_sessions WHERE token_hash=?',[hash('sha256',$_COOKIE['sgt_session'] ?? '')]); cookie('sgt_session','',1); }
function rate_limit(string $group,int $seconds,int $max): void {
    $bucket=hash_hmac('sha256',$group.'|'.($_SERVER['REMOTE_ADDR'] ?? 'unknown'),secret());
    $now=time();
    query('INSERT INTO sgt_rate_limits(bucket,start_at,hits) VALUES(?,?,1) ON DUPLICATE KEY UPDATE hits=IF(start_at<?,1,hits+1),start_at=IF(start_at<?,?,start_at)',[$bucket,$now,$now-$seconds,$now-$seconds,$now]);
    if ((int)query('SELECT hits FROM sgt_rate_limits WHERE bucket=?',[$bucket])->fetchColumn()>$max) fail('Слишком много запросов. Повторите позже.',429);
    query('DELETE FROM sgt_rate_limits WHERE start_at<? LIMIT 100',[$now-86400]);
}
function authenticate(array $data): array {
    rate_limit('auth',900,30);
    $email=email_value($data['email'] ?? null); $password=password_value($data['password'] ?? null);
    $user=query('SELECT * FROM sgt_users WHERE email=?',[$email])->fetch();
    // Always perform an expensive password check, including unknown accounts.
    $valid=password_matches($password,$user['password_hash'] ?? '$2y$12$MMj/4DLB1NJKCUKTspYyYe6qnE7OjgFKx3VrYhEfQlcRVj1xKOvNu');
    if (!$user || !$valid) throw new InvalidArgumentException('Неверный email или пароль.');
    return $user;
}
function uuid(): string { $v=random_bytes(16);$v[6]=chr((ord($v[6])&15)|64);$v[8]=chr((ord($v[8])&63)|128);return vsprintf('%s%s-%s-%s-%s-%s%s%s',str_split(bin2hex($v),4)); }
function file_path(string $filename): string {
    if (!preg_match('/^[a-f0-9-]{36}\.(?:docx|pdf)$/D',$filename)) throw new RuntimeException('Invalid private filename');
    return __DIR__.'/uploads/'.$filename;
}
function mail_enabled(): bool { $c=config();return !empty($c['smtp_host']) && !empty($c['smtp_user']) && !empty($c['smtp_password']) && !empty($c['smtp_from']); }
function escaped(mixed $value): string { return htmlspecialchars((string)$value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
function installed_or_fail(): void { if (!config()) fail('Сайт ещё настраивается. Попробуйте позже.',503); }
