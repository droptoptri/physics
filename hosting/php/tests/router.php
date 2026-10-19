<?php
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if (str_starts_with($path,'/api/')) { require __DIR__.'/public/api/index.php';return true; }
if (in_array($path,['/admin','/setup'],true)) { require __DIR__.'/public'.$path.'.php';return true; }
if (in_array($path,['/ksk','/geo','/privacy','/cabinet'],true)) { readfile(__DIR__.'/public/index.html');return true; }
if (str_starts_with($path,'/.') || str_starts_with($path,'/sgt-private') || str_starts_with($path,'/var/')) {http_response_code(404);return true;}
return false;
