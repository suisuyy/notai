param(
    [int]$Port = 5500,
    [string]$HostName = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

function Get-ContentType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".css" { return "text/css; charset=utf-8" }
        ".js" { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png" { return "image/png" }
        ".jpg" { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".gif" { return "image/gif" }
        ".svg" { return "image/svg+xml" }
        ".ico" { return "image/x-icon" }
        ".webp" { return "image/webp" }
        ".txt" { return "text/plain; charset=utf-8" }
        default { return "application/octet-stream" }
    }
}

function Send-FileResponse($Response, [string]$FilePath) {
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    $Response.StatusCode = 200
    $Response.ContentType = Get-ContentType $FilePath
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Send-TextResponse($Response, [int]$StatusCode, [string]$Text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "text/plain; charset=utf-8"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

$root = (Get-Location).Path
$listener = [System.Net.HttpListener]::new()
$prefix = "http://${HostName}:${Port}/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Serving with SPA fallback at $prefix"
Write-Host "Root: $root"
Write-Host "Press Ctrl+C to stop."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $rawPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
            if ([string]::IsNullOrWhiteSpace($rawPath)) {
                $rawPath = "/"
            }

            $relativePath = $rawPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))

            if (-not $candidatePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
                Send-TextResponse $response 403 "Forbidden"
                continue
            }

            if ($rawPath -eq "/") {
                $indexPath = Join-Path $root "index.html"
                if (Test-Path -LiteralPath $indexPath -PathType Leaf) {
                    Send-FileResponse $response $indexPath
                } else {
                    Send-TextResponse $response 404 "index.html not found"
                }
                continue
            }

            if (Test-Path -LiteralPath $candidatePath -PathType Leaf) {
                Send-FileResponse $response $candidatePath
                continue
            }

            if (Test-Path -LiteralPath $candidatePath -PathType Container) {
                $indexInDir = Join-Path $candidatePath "index.html"
                if (Test-Path -LiteralPath $indexInDir -PathType Leaf) {
                    Send-FileResponse $response $indexInDir
                    continue
                }
            }

            $lastSegment = [System.IO.Path]::GetFileName($rawPath.TrimEnd("/"))
            $looksLikeRoute = -not $lastSegment.Contains(".")

            if ($looksLikeRoute) {
                $spaEntry = Join-Path $root "index.html"
                if (Test-Path -LiteralPath $spaEntry -PathType Leaf) {
                    Send-FileResponse $response $spaEntry
                } else {
                    Send-TextResponse $response 404 "index.html not found"
                }
                continue
            }

            Send-TextResponse $response 404 "Not Found"
        } catch {
            Send-TextResponse $response 500 "Server error: $($_.Exception.Message)"
        } finally {
            $response.OutputStream.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
