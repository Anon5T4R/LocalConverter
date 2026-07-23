# Baixa o pandoc (Windows x86_64) como RESOURCE do Tauri em
# src-tauri\binaries\pandoc\pandoc.exe (mesma pegada do ffmpeg deste app).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/fetch-pandoc.ps1
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ---------------------------------------------------------------------------
# VERSÃO FIXA + SHA256 (espelhados no Local-runtimes v1, iguais aos do
# LocalOffice). Versão de pandoc pode MUDAR o resultado da conversão; nada de
# `latest`. PRA ATUALIZAR: trocar aqui E no fetch-pandoc.sh — a MESMA versão.
# ---------------------------------------------------------------------------
$pdVersion = "3.10"
$pdAsset = "pandoc-3.10-windows-x86_64.zip"
$pdSha256 = "bb808d00fd58762299d64582a9b4c3e4b106cd929e62c5f19bcdcb496f1e54ae"

$root = Split-Path -Parent $PSScriptRoot
$binDir = Join-Path $root "src-tauri\binaries\pandoc"
$target = Join-Path $binDir "pandoc.exe"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

if (Test-Path $target) {
    Write-Host "pandoc já existe em $target"
    exit 0
}

$url = "https://github.com/Anon5T4R/Local-runtimes/releases/download/v1/$pdAsset"
Write-Host "Baixando $url ..."
$zip = Join-Path $env:TEMP $pdAsset
Invoke-WebRequest -Uri $url -OutFile $zip

# Confere ANTES de extrair: binário adulterado não chega a ser descompactado.
$got = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLower()
if ($got -ne $pdSha256) {
    Remove-Item $zip -Force
    throw "SHA256 NAO BATE!`n  esperado: $pdSha256`n  recebido: $got`nDownload corrompido ou adulterado. Nada foi instalado."
}
Write-Host "sha256 conferido: $got"

$ext = Join-Path $env:TEMP "pandoc-extract"
if (Test-Path $ext) { Remove-Item $ext -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $ext -Force
$exe = Get-ChildItem -Path $ext -Recurse -Filter "pandoc.exe" | Select-Object -First 1
if (-not $exe) { throw "pandoc.exe não encontrado dentro do zip ($pdVersion)" }
Copy-Item $exe.FullName $target -Force
Remove-Item $zip -Force
Remove-Item $ext -Recurse -Force

Write-Host "Instalado: $target ($pdVersion)"
