<?php
/**
 * НАСТРОЙКИ ПРИЁМА ЗАЯВОК
 *
 * 1. Скопируйте этот файл рядом и назовите его  config.php
 * 2. Подставьте свои значения вместо ВСТАВЬТЕ_...
 * 3. config.php НЕ попадает в git (он в .gitignore) — токен не утечёт.
 *
 * Где взять значения для Telegram:
 *   TELEGRAM_BOT_TOKEN — напишите @BotFather в Telegram, команда /newbot,
 *                        он выдаст строку вида 1234567890:AAH...
 *   TELEGRAM_CHAT_ID   — добавьте бота в нужный чат (или напишите ему лично),
 *                        затем откройте в браузере:
 *                        https://api.telegram.org/bot<ВАШ_ТОКЕН>/getUpdates
 *                        и найдите "chat":{"id": -1001234567890 ...}
 *                        Для группы id будет отрицательным — это нормально.
 */

return array(

    // ---- Telegram ----
    'telegram_enabled' => true,
    'telegram_token'   => 'ВСТАВЬТЕ_ТОКЕН_БОТА',
    'telegram_chat_id' => 'ВСТАВЬТЕ_CHAT_ID',

    // ---- Дублирование на почту ----
    'email_enabled' => true,
    'email_to'      => 'lamarty-raskroy@mail.ru',
    // Адрес-отправитель должен быть на вашем домене, иначе письма уйдут в спам
    'email_from'    => 'site@moymebelniy55.ru',
    'email_subject' => 'Заявка с сайта moymebelniy55.ru',

    // ---- Ограничения ----
    'max_file_mb'   => 20,
    'allowed_ext'   => array('pdf','dxf','dwg','csv','xls','xlsx','doc','docx','jpg','jpeg','png','zip','rar','txt'),

    // Разрешённый источник запросов (защита от отправки формы с чужих сайтов)
    'allowed_origins' => array('https://moymebelniy55.ru', 'https://www.moymebelniy55.ru'),
);
