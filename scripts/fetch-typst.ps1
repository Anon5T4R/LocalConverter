# Baixa o typst (Windows x86_64) como RESOURCE do Tauri em
# src-tauri\binaries\typst\typst.exe. É o MOTOR DE PDF do pandoc (docx/md → PDF
# sem LaTeX): pandoc chama `--pdf-engine=<este binário>`. Binário único, ~30MB.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/fetch-typst.ps1
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# VERSÃO FIXA + SHA256 (typst 0.15.1). PRA ATUALIZAR: trocar aqui E no .sh.
$tyVersion = "0.15.1"
$tyAsset = "typst-x86_64-pc-windows-msvc.zip"
$tySha256 = "19ce3551153c2fe7ee9fa2f95208310c8f4d3209fedb699e0333faf8913f6736"

$root = Split-Path -Parent $PSScriptRoot
$binDir = Join-Path $root "src-tauri\binaries\typst"
$target = Join-Path $binDir "typst.exe"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

if (Test-Path $target) {
    Write-Host "typst já existe em $target"
    exit 0
}

$url = "https://github.com/typst/typst/releases/download/v$tyVersion/$tyAsset"
Write-Host "Baixando $url ..."
$zip = Join-Path $env:TEMP $tyAsset
Invoke-WebRequest -Uri $url -OutFile $zip

$got = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLower()
if ($got -ne $tySha256) {
    Remove-Item $zip -Force
    throw "SHA256 NAO BATE!`n  esperado: $tySha256`n  recebido: $got"
}
Write-Host "sha256 conferido: $got"

$ext = Join-Path $env:TEMP "typst-extract"
if (Test-Path $ext) { Remove-Item $ext -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $ext -Force
$exe = Get-ChildItem -Path $ext -Recurse -Filter "typst.exe" | Select-Object -First 1
if (-not $exe) { throw "typst.exe não encontrado dentro do zip ($tyVersion)" }
Copy-Item $exe.FullName $target -Force
Remove-Item $zip -Force
Remove-Item $ext -Recurse -Force

Write-Host "Instalado: $target ($tyVersion)"
