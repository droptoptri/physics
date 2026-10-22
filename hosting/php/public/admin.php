<?php
declare(strict_types=1);
require dirname(__DIR__).'/sgt-private/bootstrap.php';
security_headers();
if(!config()){header('Location: /setup',true,302);exit;}
$error='';$notice='';$user=current_user();
try {
    if($_SERVER['REQUEST_METHOD']==='POST'){
        check_csrf($_POST['csrf'] ?? '');
        $action=$_POST['action'] ?? '';
        if($action==='login'){
            $candidate=authenticate($_POST);
            if(!(int)$candidate['is_admin'])throw new RuntimeException('Эта учётная запись не имеет доступа к управлению.');
            sign_in((int)$candidate['id']);header('Location: /admin',true,303);exit;
        }
        if(!$user || !(int)$user['is_admin'])throw new RuntimeException('Войдите как администратор.');
        if($action==='logout'){sign_out();header('Location: /admin',true,303);exit;}
        $id=filter_var($_POST['id'] ?? null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]) ?: 0;
        if(in_array($action,['approve','revoke','delete_user','reset_password'],true)){
            $target=query('SELECT * FROM sgt_users WHERE id=?',[$id])->fetch();
            if(!$target || (int)$target['is_admin'])throw new RuntimeException('Выберите учётную запись партнёра.');
            if($action==='approve')query('UPDATE sgt_users SET approved=1 WHERE id=?',[$id]);
            if($action==='revoke'){query('UPDATE sgt_users SET approved=0 WHERE id=?',[$id]);query('DELETE FROM sgt_sessions WHERE user_id=?',[$id]);}
            if($action==='reset_password'){query('UPDATE sgt_users SET password_hash=? WHERE id=?',[password_digest(password_value($_POST['new_password'] ?? null)),$id]);query('DELETE FROM sgt_sessions WHERE user_id=?',[$id]);}
            if($action==='delete_user')query('DELETE FROM sgt_users WHERE id=?',[$id]);
            $notice='Настройки партнёра сохранены.';
        }elseif($action==='add_tender'){
            $title=clean_text($_POST['title'] ?? null,3,200);$category=clean_text($_POST['category'] ?? null,2,120);$region=clean_text($_POST['region'] ?? null,2,200);$description=clean_text($_POST['description'] ?? null,10,10000);$contact=email_value($_POST['contact'] ?? null);
            $deadline=clean_text($_POST['deadline'] ?? null,10,10);$date=DateTimeImmutable::createFromFormat('!Y-m-d',$deadline);
            if(!$date || $date->format('Y-m-d')!==$deadline || $deadline<gmdate('Y-m-d'))throw new RuntimeException('Укажите действительную будущую дату окончания.');
            query('INSERT INTO sgt_tenders(title,category,region,description,deadline,contact) VALUES(?,?,?,?,?,?)',[$title,$category,$region,$description,$deadline,$contact]);$notice='Предложение опубликовано для подтверждённых партнёров.';
        }elseif($action==='close_tender'){query('UPDATE sgt_tenders SET active=0 WHERE id=?',[$id]);$notice='Предложение закрыто.';
        }elseif($action==='delete_application'){
            $row=query('SELECT filename FROM sgt_applications WHERE id=?',[$_POST['application_id'] ?? ''])->fetch();
            if($row){query('DELETE FROM sgt_applications WHERE id=?',[$_POST['application_id']]);@unlink(file_path($row['filename']));}$notice='Заявка и файл удалены из сайта. Удаление ранее отправленного письма выполняется отдельно в почтовом ящике.';
        }elseif($action==='save_smtp'){
            $settings=config();$host=clean_text($_POST['smtp_host'] ?? '',1,200);
            if(!preg_match('/^[a-zA-Z0-9.-]+$/D',$host))throw new RuntimeException('Укажите имя SMTP-сервера без протокола и пути.');
            $port=(int)($_POST['smtp_port'] ?? 0);if(!in_array($port,[465,587],true))throw new RuntimeException('Выберите порт 465 или 587.');
            $settings['smtp_host']=$host;$settings['smtp_port']=$port;$settings['smtp_secure']=$port===465;$settings['smtp_user']=clean_text($_POST['smtp_user'] ?? '',1,254);$settings['smtp_from']=email_value($_POST['smtp_from'] ?? null);
            if(($_POST['smtp_password'] ?? '')!=='')$settings['smtp_password']=clean_text($_POST['smtp_password'],1,512);
            if(empty($settings['smtp_password']))throw new RuntimeException('Укажите пароль приложения для SMTP.');
            save_config($settings);$notice='Почтовые настройки сохранены. Проверьте доставку тестовой анкеты.';
        }elseif($action==='send_queue'){
            if(!mail_enabled())throw new RuntimeException('Сначала сохраните SMTP-настройки.');
            query("UPDATE sgt_applications SET next_attempt=0 WHERE status='queued'");require private_dir().'/mail.php';$sent=flush_mail(3);$notice="Отправлено писем: $sent. Остальные заявки остаются в очереди; статус показан в таблице.";
        }elseif($action==='change_password'){
            $old=password_value($_POST['old_password'] ?? null);if(!password_matches($old,$user['password_hash']))throw new RuntimeException('Текущий пароль неверен.');
            query('UPDATE sgt_users SET password_hash=? WHERE id=?',[password_digest(password_value($_POST['new_password'] ?? null)),$user['id']]);query('DELETE FROM sgt_sessions WHERE user_id=?',[$user['id']]);sign_in((int)$user['id']);header('Location: /admin',true,303);exit;
        }else throw new RuntimeException('Неизвестное действие.');
    }
}catch(Throwable $problem){$error=$problem instanceof PDOException ? 'Не удалось сохранить изменение. Проверьте подключение к базе.' : ($problem instanceof RuntimeException || $problem instanceof InvalidArgumentException ? $problem->getMessage() : 'Не удалось выполнить операцию. Проверьте поля формы.');error_log('SGT admin action: '.$problem::class);}
$user=current_user();$admin=$user && (int)$user['is_admin'];
if(isset($_GET['download'])){
    if(!$admin){http_response_code(404);exit;}
    $row=query('SELECT filename FROM sgt_applications WHERE id=?',[$_GET['download']])->fetch();
    if(!$row || !is_file(file_path($row['filename']))){http_response_code(404);exit;}
    header('Content-Type: application/octet-stream');header('Content-Disposition: attachment; filename="anketa-'.$row['filename'].'"');header('Content-Length: '.filesize(file_path($row['filename'])));readfile(file_path($row['filename']));exit;
}
$csrf=csrf_token();
function hidden_action(string $action,string $csrf,int $id=0): void { echo '<input type="hidden" name="csrf" value="'.escaped($csrf).'"><input type="hidden" name="action" value="'.escaped($action).'"><input type="hidden" name="id" value="'.$id.'">'; }
?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Управление — СГТ-Холдинг</title><link rel="icon" href="/brand/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/admin.css"></head><body><header><strong>СГТ · Управление</strong><?php if($admin): ?><form method="post"><?php hidden_action('logout',$csrf); ?><button class="logout">Выйти</button></form><?php else: ?><a href="/">На главную</a><?php endif; ?></header><main>
<?php if($error): ?><p class="error" role="alert"><?= escaped($error) ?></p><?php endif; ?><?php if($notice): ?><p class="notice" role="status"><?= escaped($notice) ?></p><?php endif; ?>
<?php if(!$admin): ?><form class="panel narrow" method="post"><?php hidden_action('login',$csrf); ?><h1>Вход администратора</h1><label>Электронная почта<input name="email" type="email" required autocomplete="username"></label><label>Пароль<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="current-password"></label><button>Войти</button></form>
<?php else: ?>
<h1>Партнёры и предложения</h1><nav><a href="#partners">Партнёры</a><a href="#tenders">Тендеры</a><a href="#applications">Анкеты</a><a href="#mail">Почта</a><a href="#account">Мой пароль</a><a href="/cabinet">Кабинет партнёра</a></nav>
<section id="partners"><h2>Партнёры</h2><p class="small">Новые аккаунты ожидают подтверждения. Удаление необратимо; для временного ограничения используйте отзыв доступа.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Список партнёров"><table><thead><tr><th>Компания / контакт</th><th>Статус</th><th>Действия</th></tr></thead><tbody>
<?php foreach(query('SELECT * FROM sgt_users WHERE is_admin=0 ORDER BY id DESC LIMIT 200')->fetchAll() as $partner): ?><tr><td><strong><?= escaped($partner['company']) ?></strong><p><?= escaped($partner['name']) ?><br><?= escaped($partner['email']) ?></p><p class="small">Согласие: <?= escaped($partner['consent_version']) ?> · <?= escaped($partner['created_at']) ?> UTC</p></td><td><?= (int)$partner['approved']?'Подтверждён':'Ожидает проверки' ?></td><td><form method="post"><?php hidden_action((int)$partner['approved']?'revoke':'approve',$csrf,(int)$partner['id']); ?><button><?= (int)$partner['approved']?'Отозвать доступ':'Подтвердить' ?></button></form><details><summary>Смена пароля / удаление</summary><form method="post"><?php hidden_action('reset_password',$csrf,(int)$partner['id']); ?><label>Новый пароль<input name="new_password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><button class="secondary">Сменить пароль партнёра</button></form><form method="post"><?php hidden_action('delete_user',$csrf,(int)$partner['id']); ?><label class="check"><input type="checkbox" required><span>Подтверждаю удаление аккаунта</span></label><button class="danger">Удалить аккаунт</button></form></details></td></tr><?php endforeach; ?>
</tbody></table></div></section>
<section id="tenders"><h2>Тендеры</h2><div class="table-wrap" tabindex="0" role="region" aria-label="Список тендеров"><table><thead><tr><th>Предложение</th><th>Срок и статус</th><th>Действия</th></tr></thead><tbody><?php foreach(query('SELECT * FROM sgt_tenders ORDER BY id DESC LIMIT 200')->fetchAll() as $tender): ?><tr><td><?= escaped($tender['title']) ?><p><?= escaped($tender['category'].' · '.$tender['region']) ?></p></td><td><?= escaped($tender['deadline']) ?> · <?= (int)$tender['active']?'Опубликован':'Закрыт' ?></td><td><?php if((int)$tender['active']): ?><form method="post"><?php hidden_action('close_tender',$csrf,(int)$tender['id']); ?><button class="secondary">Закрыть предложение</button></form><?php endif; ?></td></tr><?php endforeach; ?></tbody></table></div><details><summary>Добавить предложение</summary><form method="post"><?php hidden_action('add_tender',$csrf); ?><label>Название<input name="title" required minlength="3" maxlength="200"></label><div class="grid"><label>Направление<input name="category" required maxlength="120"></label><label>Регион<input name="region" required maxlength="200"></label><label>Приём откликов до<input name="deadline" type="date" required min="<?= gmdate('Y-m-d') ?>"></label><label>Email координатора<input name="contact" type="email" required></label></div><label>Описание<textarea name="description" required minlength="10" maxlength="10000"></textarea></label><button>Опубликовать предложение</button></form></details></section>
<section id="applications"><h2>Анкеты партнёров</h2><p class="small">Письмо считается отправленным после подтверждения SMTP-сервера. Доставку во «Входящие» проверяйте в почтовом ящике. На экране показаны последние 200 заявок.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Список анкет"><table><thead><tr><th>Компания</th><th>Обращение</th><th>Доставка</th><th>Файл / удаление</th></tr></thead><tbody><?php foreach(query('SELECT * FROM sgt_applications ORDER BY created_at DESC LIMIT 200')->fetchAll() as $application): ?><tr><td><strong><?= escaped($application['company']) ?></strong><p><?= escaped($application['name'].' · '.$application['email']) ?><br>ИНН: <?= escaped($application['inn']) ?></p></td><td><p><?= escaped($application['message']) ?></p><p><?= escaped($application['created_at']) ?> UTC · <?= escaped(substr($application['id'],0,8)) ?></p><p class="small">Согласие: <?= escaped($application['consent_version']) ?></p></td><td><?= $application['status']==='sent'?'Отправлено':'В очереди' ?><p>Попыток: <?= (int)$application['attempts'] ?></p></td><td><a href="/admin?download=<?= escaped($application['id']) ?>">Скачать анкету</a><details><summary>Удалить заявку</summary><form method="post"><?php hidden_action('delete_application',$csrf); ?><input type="hidden" name="application_id" value="<?= escaped($application['id']) ?>"><label class="check"><input type="checkbox" required><span>Подтверждаю удаление заявки и файла</span></label><button class="danger">Удалить заявку и файл</button></form></details></td></tr><?php endforeach; ?></tbody></table></div></section>
<section id="mail"><h2>Почта</h2><p>Получатель анкет: <strong><?= RECIPIENT ?></strong>. <?= mail_enabled()?'SMTP настроен.':'SMTP ещё не подключён; анкеты сохраняются в очереди.' ?></p><form method="post"><?php hidden_action('send_queue',$csrf); ?><button class="secondary">Отправить очередь</button></form><p class="small">Кнопка выполняет до трёх попыток за один запрос. Для автоматической доставки настройте задание cron каждую минуту по инструкции.</p><?php $settings=config(); ?><details><summary>Настроить SMTP</summary><form method="post" autocomplete="off"><?php hidden_action('save_smtp',$csrf); ?><div class="grid"><label>SMTP-сервер<input name="smtp_host" required value="<?= escaped($settings['smtp_host']) ?>"></label><label>Порт<select name="smtp_port"><option value="465" <?= (int)$settings['smtp_port']===465?'selected':'' ?>>465 · TLS</option><option value="587" <?= (int)$settings['smtp_port']===587?'selected':'' ?>>587 · STARTTLS</option></select></label><label>Логин SMTP<input name="smtp_user" required value="<?= escaped($settings['smtp_user']) ?>" autocomplete="off"></label><label>Email отправителя<input name="smtp_from" type="email" required value="<?= escaped($settings['smtp_from']) ?>"></label><label>Пароль приложения<input name="smtp_password" type="password" autocomplete="new-password" placeholder="Оставьте пустым, чтобы сохранить текущий"></label></div><button>Сохранить SMTP</button></form></details></section>
<section id="account"><h2>Мой пароль</h2><form method="post"><?php hidden_action('change_password',$csrf); ?><div class="grid"><label>Текущий пароль<input name="old_password" type="password" required autocomplete="current-password"></label><label>Новый пароль<input name="new_password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label></div><button>Сменить мой пароль</button></form></section>
<?php endif; ?></main></body></html>
