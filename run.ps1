param(
    [int]$Port = 5500,
    [string]$HostName = "127.0.0.1"
)

& "$PSScriptRoot\spa_server.ps1" -Port $Port -HostName $HostName
