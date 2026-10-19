<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
require __DIR__.'/bootstrap.php';require __DIR__.'/mail.php';
try { if(!config())throw new RuntimeException('Finish setup first');echo 'Sent: '.flush_mail(5).PHP_EOL; }
catch(Throwable $error) { fwrite(STDERR,'Mail queue unavailable: '.$error::class.PHP_EOL);exit(1); }
