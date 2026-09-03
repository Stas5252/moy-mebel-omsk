<?php
/**
 * Приём заявок с сайта moymebelniy55.ru
 *
 * Отправляет заявку в Telegram и дублирует на почту.
 * Настройки — в config.php (создайте его из config.sample.php).
 *
 * Ответ всегда JSON: {"ok":true} либо {"ok":false,"error":"текст"}
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function reply($ok, $error = null, $code = 200) {
    http_response_code($code);
    echo json_encode(array('ok' => $ok, 'error' => $error), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(false, 'Только POST', 405);
}

$defaultCfg = array(
    'telegram_enabled' => false,
    'telegram_token'   => '',
    'telegram_chat_id' => '',
    'email_enabled'    => true,
    'email_to'         => 'lamarty-raskroy@mail.ru',
    'email_from'       => 'site@moymebelniy55.ru',
    'email_subject'    => 'Заявка с сайта МОЙ МЕБЕЛЬНЫЙ',
    'max_file_mb'      => 20,
    'allowed_ext'      => array('pdf','dxf','dwg','csv','xls','xlsx','doc','docx','jpg','jpeg','png','zip','rar','txt'),
    'allowed_origins'  => array(),
);

$configPath = __DIR__ . '/config.php';
$cfg = file_exists($configPath) ? array_merge($defaultCfg, (array)require $configPath) : $defaultCfg;

// --- Проверка источника запроса ---
if (!empty($cfg['allowed_origins'])) {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    if ($origin !== '' && !in_array($origin, $cfg['allowed_origins'], true)) {
        reply(false, 'Запрос отклонён', 403);
    }
}

// --- Ловушка для ботов: скрытое поле, которое человек не заполняет ---
if (!empty($_POST['website'])) {
    reply(true); // молча «принимаем», но никуда не отправляем
}

// --- Сбор и очистка полей ---
function field($key, $limit = 500) {
    $v = isset($_POST[$key]) ? (string)$_POST[$key] : '';
    $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v));
    if (function_exists('mb_substr')) {
        return mb_substr($v, 0, $limit, 'UTF-8');
    }
    return substr($v, 0, $limit);
}

$name    = field('name', 120);
$phone   = field('phone', 40);
$email   = field('email', 120);
$service = field('service', 120);
$comment = field('comment', 3000);
$page    = field('page', 200);
$cart    = field('cart', 6000);

if ($name === '') {
    reply(false, 'Укажите, как к вам обращаться');
}
$digits = preg_replace('/\D+/', '', $phone);
if (strlen($digits) < 10) {
    reply(false, 'Проверьте номер телефона — нужно не меньше 10 цифр');
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reply(false, 'Проверьте адрес почты');
}

// --- Вложение ---
$file = null;
if (!empty($_FILES['file']['name']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    $maxBytes = ((int)$cfg['max_file_mb']) * 1024 * 1024;
    if ($_FILES['file']['size'] > $maxBytes) {
        reply(false, 'Файл больше ' . $cfg['max_file_mb'] . ' МБ. Пришлите его на ' . $cfg['email_to']);
    }
    $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $cfg['allowed_ext'], true)) {
        reply(false, 'Такой тип файла мы не принимаем');
    }
    if (!is_uploaded_file($_FILES['file']['tmp_name'])) {
        reply(false, 'Файл не загрузился, попробуйте ещё раз');
    }
    $safeName = preg_replace('/[^\p{L}\p{N}\.\-_ ]+/u', '_', basename($_FILES['file']['name']));
    $file = array(
        'tmp'  => $_FILES['file']['tmp_name'],
        'name' => $safeName,
        'size' => $_FILES['file']['size'],
    );
}

// --- Текст заявки ---
$lines = array();
$lines[] = 'Новая заявка с сайта';
$lines[] = 'Имя: ' . $name;
$lines[] = 'Телефон: ' . $phone;
if ($email !== '')   { $lines[] = 'Почта: ' . $email; }
if ($service !== '') { $lines[] = 'Услуга: ' . $service; }
if ($comment !== '') { $lines[] = 'Комментарий: ' . $comment; }
if ($cart !== '')    { $lines[] = "\nРасчёт из калькулятора:\n" . $cart; }
if ($file)           { $lines[] = 'Вложение: ' . $file['name'] . ' (' . round($file['size'] / 1048576, 2) . ' МБ)'; }
$lines[] = '';
$lines[] = 'Страница: ' . ($page !== '' ? $page : '—');
$lines[] = 'Время: ' . date('d.m.Y H:i');
$text = implode("\n", $lines);

// --- Telegram ---
function tgRequest($token, $method, $fields) {
    $url = 'https://api.telegram.org/bot' . $token . '/' . $method;
    $ch = curl_init($url);
    curl_setopt_array($ch, array(
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $fields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
    ));
    $res  = curl_exec($ch);
    $errn = curl_errno($ch);
    curl_close($ch);
    if ($errn) { return false; }
    $json = json_decode($res, true);
    return (is_array($json) && !empty($json['ok']));
}

$telegramOk = false;
if (!empty($cfg['telegram_enabled']) && strpos($cfg['telegram_token'], 'ВСТАВЬТЕ') === false) {
    if (!function_exists('curl_init')) {
        error_log('send.php: на хостинге нет расширения cURL, Telegram недоступен');
    } elseif ($file) {
        $doc = class_exists('CURLFile')
            ? new CURLFile($file['tmp'], 'application/octet-stream', $file['name'])
            : '@' . $file['tmp'];
        $telegramOk = tgRequest($cfg['telegram_token'], 'sendDocument', array(
            'chat_id'  => $cfg['telegram_chat_id'],
            'caption'  => mb_substr($text, 0, 1000, 'UTF-8'),
            'document' => $doc,
        ));
        if (!$telegramOk) {
            // файл не ушёл — отправим хотя бы текст
            $telegramOk = tgRequest($cfg['telegram_token'], 'sendMessage', array(
                'chat_id' => $cfg['telegram_chat_id'],
                'text'    => $text . "\n(вложение не удалось передать — смотрите почту)",
            ));
        }
    } else {
        $telegramOk = tgRequest($cfg['telegram_token'], 'sendMessage', array(
            'chat_id' => $cfg['telegram_chat_id'],
            'text'    => $text,
        ));
    }
}

// --- Почта ---
$mailOk = false;
if (!empty($cfg['email_enabled']) && !empty($cfg['email_to'])) {
    $boundary = '=_' . md5(uniqid('', true));
    $subject  = '=?UTF-8?B?' . base64_encode($cfg['email_subject'] . ' — ' . $name) . '?=';

    $headers  = 'MIME-Version: 1.0' . "\r\n";
    $headers .= 'From: =?UTF-8?B?' . base64_encode('Сайт МОЙ мебельный') . '?= <' . $cfg['email_from'] . '>' . "\r\n";
    if ($email !== '') {
        $headers .= 'Reply-To: ' . $email . "\r\n";
    }
    $headers .= 'Content-Type: multipart/mixed; boundary="' . $boundary . '"' . "\r\n";

    $body  = '--' . $boundary . "\r\n";
    $body .= 'Content-Type: text/plain; charset=UTF-8' . "\r\n";
    $body .= 'Content-Transfer-Encoding: base64' . "\r\n\r\n";
    $body .= chunk_split(base64_encode($text)) . "\r\n";

    if ($file) {
        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Type: application/octet-stream; name="' . $file['name'] . '"' . "\r\n";
        $body .= 'Content-Transfer-Encoding: base64' . "\r\n";
        $body .= 'Content-Disposition: attachment; filename="' . $file['name'] . '"' . "\r\n\r\n";
        $body .= chunk_split(base64_encode(file_get_contents($file['tmp']))) . "\r\n";
    }
    $body .= '--' . $boundary . '--';

    $mailOk = @mail($cfg['email_to'], $subject, $body, $headers);
}

// --- Резервная запись на диск, если оба канала легли ---
if (!$telegramOk && !$mailOk) {
    $dir = __DIR__ . '/leads';
    if (!is_dir($dir)) { @mkdir($dir, 0750, true); }
    @file_put_contents($dir . '/' . date('Y-m-d_His') . '_' . substr(md5($text), 0, 6) . '.txt', $text);
    error_log('send.php: заявка не ушла ни в Telegram, ни на почту — сохранена в /leads');
    reply(false, 'Не получилось отправить заявку. Позвоните, пожалуйста: +7 (3812) 590-650');
}

reply(true);
