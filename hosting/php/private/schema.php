<?php
declare(strict_types=1);
function install_schema(PDO $db): void {
    $tables=[
        'users' => 'id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,email VARCHAR(254) NOT NULL UNIQUE,company VARCHAR(200) NOT NULL,name VARCHAR(120) NOT NULL,password_hash VARCHAR(255) NOT NULL,approved TINYINT NOT NULL DEFAULT 0,is_admin TINYINT NOT NULL DEFAULT 0,consent_version VARCHAR(32) NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'sessions' => 'token_hash CHAR(64) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,expires_at BIGINT NOT NULL,CONSTRAINT sgt_session_user FOREIGN KEY(user_id) REFERENCES sgt_users(id) ON DELETE CASCADE',
        'tenders' => 'id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,title VARCHAR(200) NOT NULL,category VARCHAR(120) NOT NULL,region VARCHAR(200) NOT NULL,description TEXT NOT NULL,deadline DATE NOT NULL,contact VARCHAR(254) NOT NULL,active TINYINT NOT NULL DEFAULT 1,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'applications' => "id CHAR(36) PRIMARY KEY,company VARCHAR(200) NOT NULL,name VARCHAR(120) NOT NULL,email VARCHAR(254) NOT NULL,inn VARCHAR(12) NOT NULL,message TEXT NOT NULL,filename VARCHAR(64) NOT NULL,consent_version VARCHAR(32) NOT NULL,status VARCHAR(12) NOT NULL DEFAULT 'queued',attempts INT NOT NULL DEFAULT 0,next_attempt BIGINT NOT NULL DEFAULT 0,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,sent_at TIMESTAMP NULL",
        'rate_limits' => 'bucket CHAR(64) PRIMARY KEY,start_at BIGINT NOT NULL,hits INT NOT NULL'
    ];
    foreach($tables as $table=>$columns)$db->exec("CREATE TABLE IF NOT EXISTS sgt_$table ($columns) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
