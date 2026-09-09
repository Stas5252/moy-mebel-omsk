$PORT = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$PORT/")
$listener.Start()

Write-Host "=================================================="
Write-Host " Server running: http://localhost:$PORT/"
Write-Host " Main:           http://localhost:$PORT/index.html"
Write-Host " Furniture:      http://localhost:$PORT/mebel.html"
Write-Host " Cutting:        http://localhost:$PORT/raspil.html"
Write-Host "=================================================="

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".webp" = "image/webp"
    ".gif"  = "image/gif"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
    ".otf"  = "font/otf"
    ".mp4"  = "video/mp4"
    ".txt"  = "text/plain; charset=utf-8"
    ".xml"  = "application/xml; charset=utf-8"
}

$root = (Get-Location).Path

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        try {
            $res.Headers.Add("Access-Control-Allow-Origin", "*")
            $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

            if ($req.HttpMethod -eq "OPTIONS") {
                $res.StatusCode = 200
                $res.Close()
                continue
            }

            $rawPath = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

            if ($req.HttpMethod -eq "POST" -and ($rawPath -eq "/send.php" -or $rawPath.EndsWith("send.php"))) {
                $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()

                $leadsDir = Join-Path $root "leads"
                if (-not (Test-Path $leadsDir)) {
                    New-Item -ItemType Directory -Path $leadsDir -Force | Out-Null
                }
                $t = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
                $leadFile = Join-Path $leadsDir "$($t)_lead.txt"
                [System.IO.File]::WriteAllText($leadFile, $body, [System.Text.Encoding]::UTF8)
                Write-Host "New lead recorded: $leadFile"

                $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"msg":"Success"}')
                $res.ContentType = "application/json; charset=utf-8"
                $res.ContentLength64 = $jsonBytes.Length
                $res.StatusCode = 200
                $res.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
                $res.Close()
                continue
            }

            if ($rawPath -eq "/" -or $rawPath -eq "") {
                $rel = "index.html"
            } else {
                $rel = $rawPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            }

            $target = Join-Path $root $rel
            if (-not (Test-Path $target) -and (Test-Path "$target.html")) {
                $target = "$target.html"
            }

            if (Test-Path $target -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($target).ToLower()
                $mime = $mimeTypes[$ext]
                if (-not $mime) { $mime = "application/octet-stream" }
                $res.ContentType = $mime
                $res.StatusCode = 200
                $bytes = [System.IO.File]::ReadAllBytes($target)
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $notFoundPath = Join-Path $root "404.html"
                if (Test-Path $notFoundPath) {
                    $res.StatusCode = 404
                    $res.ContentType = "text/html; charset=utf-8"
                    $bytes = [System.IO.File]::ReadAllBytes($notFoundPath)
                    $res.ContentLength64 = $bytes.Length
                    $res.OutputStream.Write($bytes, 0, $bytes.Length)
                } else {
                    $res.StatusCode = 404
                    $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                    $res.ContentLength64 = $err.Length
                    $res.OutputStream.Write($err, 0, $err.Length)
                }
            }
        } catch {
            Write-Host "Error serving request: $_"
        } finally {
            $res.Close()
        }
    }
} finally {
    $listener.Stop()
}
