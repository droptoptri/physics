<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/sgt-private/bootstrap.php';
security_headers();
try {
    installed_or_fail();
    $path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);$method=$_SERVER['REQUEST_METHOD'];
    if ($method==='GET' && $path==='/api/health') { query('SELECT 1');json_response(['ok'=>true]); }
    if ($method==='GET' && $path==='/api/config')json_response(['mailEnabled'=>mail_enabled(),'recipient'=>RECIPIENT]);
    if ($method==='GET' && $path==='/api/csrf')json_response(['token'=>csrf_token()]);
    if (!in_array($method,['GET','HEAD','OPTIONS'],true))check_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($method==='GET' && $path==='/api/auth/me') { $user=current_user();json_response(['user'=>$user ? public_user($user) : null]); }
    if ($method==='POST' && in_array($path,['/api/auth/register','/api/auth/login'],true)) {
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0)>20480)fail('Слишком большой запрос.',413);
        $input=file_get_contents('php://input',false,null,0,20481);
        if(strlen($input)>20480)fail('Слишком большой запрос.',413);
        $data=json_decode($input,true,32,JSON_THROW_ON_ERROR);
        if (!is_array($data))fail('Проверьте поля формы.');
        if ($path==='/api/auth/login') { $user=authenticate($data);sign_in((int)$user['id']);json_response(['user'=>public_user($user)]); }
        rate_limit('auth',900,30);
        $email=email_value($data['email'] ?? null);$password=password_value($data['password'] ?? null);
        $company=clean_text($data['company'] ?? null,2,200);$name=clean_text($data['name'] ?? null,2,120);
        if (($data['consent'] ?? false)!==true)fail('Подтвердите согласие на обработку данных.');
        try { query('INSERT INTO sgt_users(email,company,name,password_hash,consent_version) VALUES(?,?,?,?,?)',[$email,$company,$name,password_digest($password),CONSENT]); }
        catch(PDOException $error) { if ($error->getCode()==='23000')fail('Этот адрес уже зарегистрирован.',409);throw $error; }
        $id=(int)database()->lastInsertId();sign_in($id);
        json_response(['user'=>public_user(query('SELECT * FROM sgt_users WHERE id=?',[$id])->fetch())],201);
    }
    if ($method==='POST' && $path==='/api/auth/logout') { sign_out();json_response(['ok'=>true]); }
    if ($method==='GET' && $path==='/api/tenders') {
        $user=current_user();if (!$user)fail('Войдите в личный кабинет.',401);if (!(int)$user['approved'])fail('Доступ откроется после подтверждения компании.',403);
        $rows=query('SELECT id,title,category,region,description,deadline,contact FROM sgt_tenders WHERE active=1 AND deadline>=CURRENT_DATE ORDER BY deadline')->fetchAll();
        foreach($rows as &$row)$row['id']=(int)$row['id'];unset($row);json_response(['tenders'=>$rows]);
    }
    if ($method==='POST' && $path==='/api/applications') {
        rate_limit('application',3600,10);
        $company=clean_text($_POST['company'] ?? null,2,200);$name=clean_text($_POST['name'] ?? null,2,120);$email=email_value($_POST['email'] ?? null);
        $inn=clean_text($_POST['inn'] ?? '',0,12);$message=clean_text($_POST['message'] ?? '',0,3000);
        if ($inn!=='' && !preg_match('/^(?:[0-9]{10}|[0-9]{12})$/D',$inn))fail('Проверьте ИНН.');
        if (($_POST['consent'] ?? '')!=='true' || ($_POST['website'] ?? '')!=='')fail('Подтвердите согласие и проверьте форму.');
        $file=$_FILES['questionnaire'] ?? null;
        if (!$file || !is_string($file['name'] ?? null) || ($file['error'] ?? UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK || (int)$file['size']>10*1024*1024 || (int)$file['size']===0 || !is_uploaded_file($file['tmp_name']))fail('Загрузите один файл DOCX или PDF размером до 10 МБ.');
        $extension=strtolower(pathinfo($file['name'],PATHINFO_EXTENSION));$type=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $allowed=['docx'=>'application/vnd.openxmlformats-officedocument.wordprocessingml.document','pdf'=>'application/pdf'];
        if (!isset($allowed[$extension]) || $type!==$allowed[$extension])fail('Содержимое файла не соответствует формату DOCX или PDF.');
        $id=uuid();$filename=$id.'.'.$extension;$destination=file_path($filename);
        if (!is_dir(dirname($destination)) && !mkdir(dirname($destination),0700,true))throw new RuntimeException('Cannot create private upload directory');
        if (!move_uploaded_file($file['tmp_name'],$destination))throw new RuntimeException('Cannot store attachment');
        chmod($destination,0600);
        try { query('INSERT INTO sgt_applications(id,company,name,email,inn,message,filename,consent_version) VALUES(?,?,?,?,?,?,?,?)',[$id,$company,$name,$email,$inn,$message,$filename,CONSENT]); }
        catch(Throwable $error) { unlink($destination);throw $error; }
        json_response(['id'=>$id,'status'=>'queued','mailEnabled'=>mail_enabled()],202);
    }
    fail('Запрос не найден.',404);
} catch(InvalidArgumentException|JsonException $error) { fail($error instanceof JsonException ? 'Проверьте поля формы.' : $error->getMessage()); }
catch(Throwable $error) { error_log('SGT API failed: '.$error::class.' code '.$error->getCode());fail('Не удалось выполнить запрос. Попробуйте позже.',500); }
