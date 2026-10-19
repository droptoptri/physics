<?php
declare(strict_types=1);
require dirname(__DIR__).'/sgt-private/bootstrap.php';
security_headers();
$requirements=['PHP 8.3 или новее'=>PHP_VERSION_ID>=80300,'PDO MySQL'=>extension_loaded('pdo_mysql'),'Fileinfo'=>extension_loaded('fileinfo'),'Mbstring'=>extension_loaded('mbstring'),'OpenSSL'=>extension_loaded('openssl'),'Почтовая библиотека'=>is_file(private_dir().'/vendor/autoload.php'),'Запись в закрытую папку'=>is_writable(private_dir())];
$ready=!in_array(false,$requirements,true);$done=config()!==null;$error='';$success=false;$configSaved=false;
if ($_SERVER['REQUEST_METHOD']==='POST' && !$done) {
    $lock=fopen(private_dir().'/install.lock','c');
    try {
        if (!$ready)throw new RuntimeException('Сначала устраните пункты проверки окружения.');
        check_csrf($_POST['csrf'] ?? '');
        if (!$lock || !flock($lock,LOCK_EX))throw new RuntimeException('Не удалось начать настройку.');
        if (config())throw new RuntimeException('Настройка уже завершена.');
        $key=trim((string)@file_get_contents(private_dir().'/install-password.txt'));
        if (strlen($key)<20 || strlen($key)>200 || str_contains($key,'ЗАМЕНИТЕ') || str_contains($key,'REPLACE'))throw new RuntimeException('Создайте install-password.txt с вашим уникальным установочным паролем длиной не менее 20 символов.');
        $rateFile=private_dir().'/setup-'.hash_hmac('sha256',$_SERVER['REMOTE_ADDR'] ?? 'unknown',secret()).'.json';
        $rate=fopen($rateFile,'c+');if(!$rate)throw new RuntimeException('Не удалось проверить лимит попыток.');
        flock($rate,LOCK_EX);$attempt=json_decode(stream_get_contents($rate),true) ?: ['start'=>time(),'count'=>0];
        if ($attempt['start']<time()-900)$attempt=['start'=>time(),'count'=>0];
        $limited=$attempt['count']>=5;$attempt['count']++;ftruncate($rate,0);rewind($rate);fwrite($rate,json_encode($attempt));flock($rate,LOCK_UN);fclose($rate);
        if ($limited || !is_string($_POST['install_password'] ?? null) || !hash_equals($key,$_POST['install_password']))throw new RuntimeException('Неверный установочный пароль или превышен лимит попыток.');
        $settings=['db_host'=>clean_text($_POST['db_host'] ?? '',1,200),'db_name'=>clean_text($_POST['db_name'] ?? '',1,120),'db_user'=>clean_text($_POST['db_user'] ?? '',1,120),'db_password'=>clean_text($_POST['db_password'] ?? '',1,512),'smtp_host'=>'','smtp_port'=>465,'smtp_secure'=>true,'smtp_user'=>'','smtp_password'=>'','smtp_from'=>''];
        $email=email_value($_POST['admin_email'] ?? null);$password=password_value($_POST['admin_password'] ?? null);
        if (($_POST['consent'] ?? '')!=='yes')throw new RuntimeException('Подтвердите создание служебной учётной записи.');
        require private_dir().'/schema.php';$db=connect_database($settings);install_schema($db);
        if ((int)$db->query('SELECT COUNT(*) FROM sgt_users')->fetchColumn()!==0)throw new RuntimeException('В этой базе уже есть учётные записи СГТ. Выберите новую базу или восстановите её конфигурацию.');
        $db->beginTransaction();
        $statement=$db->prepare('INSERT INTO sgt_users(email,company,name,password_hash,approved,is_admin,consent_version) VALUES(?,?,?,?,1,1,?)');
        $statement->execute([$email,'СГТ-Холдинг','Администратор',password_digest($password),'admin-setup']);
        save_config($settings);$configSaved=true;$db->commit();
        @unlink(private_dir().'/install-password.txt');$success=true;$done=true;
    } catch(Throwable $problem) {
        if (isset($db) && $db->inTransaction())$db->rollBack();
        if($configSaved && !$success)@unlink(private_dir().'/config.json');
        $error=$problem instanceof PDOException ? 'Не удалось подключиться к базе или создать таблицы. Проверьте имя сервера, базу, пользователя и пароль в панели хостинга.' : ($problem instanceof RuntimeException || $problem instanceof InvalidArgumentException ? $problem->getMessage() : 'Не удалось выполнить операцию. Проверьте поля формы.');
        error_log('SGT setup: '.$problem::class);
    } finally { if($lock){flock($lock,LOCK_UN);fclose($lock);} }
}
$csrf=$ready ? csrf_token() : '';
?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Настройка СГТ-Холдинг</title><link rel="icon" href="/brand/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/admin.css"></head><body><header><strong>СГТ · Настройка сайта</strong><a href="/">На главную</a></header><main>
<?php if($done): ?><section><h1><?= $success ? 'Сайт настроен' : 'Первичная настройка уже завершена' ?></h1><p>Партнёрский кабинет подключён к базе. Почтовая доставка настраивается в панели администратора.</p><a class="button" href="/admin">Войти в панель администратора</a></section>
<?php else: ?><h1>Установка на Хост-0</h1><p>Для продолжения нужен установочный пароль из закрытой папки. Этот экран не создаёт учётную запись без него.</p>
<?php if($error): ?><p class="error" role="alert"><?= escaped($error) ?></p><?php endif; ?>
<section><h2>Проверка хостинга</h2><ul><?php foreach($requirements as $name=>$ok): ?><li><?= $ok?'Готово':'Нужно исправить' ?> · <?= escaped($name) ?></li><?php endforeach; ?></ul></section>
<?php if($ready): ?><form method="post" class="panel" autocomplete="off"><input type="hidden" name="csrf" value="<?= escaped($csrf) ?>"><h2>Защита установки</h2><label>Установочный пароль<input type="password" name="install_password" required minlength="20" maxlength="200" autocomplete="off"></label><h2>База из панели REG.RU</h2><div class="grid"><label>Сервер базы<input name="db_host" required value="localhost"></label><label>Имя базы<input name="db_name" required maxlength="120"></label><label>Пользователь базы<input name="db_user" required maxlength="120"></label><label>Пароль базы<input type="password" name="db_password" required autocomplete="off"></label></div><h2>Ваш администратор</h2><p class="small">Адрес и пароль для управления партнёрами и тендерами. Общедоступных паролей по умолчанию нет.</p><div class="grid"><label>Email администратора<input name="admin_email" type="email" required autocomplete="username"></label><label>Новый пароль администратора<input name="admin_password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label></div><label class="check"><input type="checkbox" name="consent" value="yes" required><span>Создаю служебную учётную запись для управления сайтом и ознакомлен с <a href="/privacy">обработкой данных</a>.</span></label><button>Завершить установку</button></form><?php endif; ?>
<?php endif; ?></main></body></html>
