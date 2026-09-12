# Baixa os utils do libgourou (Windows x86_64) como RESOURCE do Tauri em
# src-tauri\binaries\libgourou\. O libgourou é o motor do ACSM do
# LocalConverter (adept_activate / acsmdownloader / adept_remove) — roda como
# PROCESSO SEPARADO via std::process::Command, nunca linkado (lib LGPL-3.0,
# utils BSD-3-Clause).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/fetch-libgourou.ps1
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ---------------------------------------------------------------------------
# VERSÃO FIXA + SHA256 (libgourou 0.8.10). PRA ATUALIZAR: trocar aqui E no .sh.
#
# O Windows NÃO tem binário oficial do libgourou — nós buildamos com MinGW
# (make CROSS=x86_64-w64-mingw32- BUILD_UTILS=1 STATIC_UTILS=1) e publicamos no
# espelho Anon5T4R/Local-runtimes. Enquanto esse build+upload não existir, o
# sha256 fica PENDENTE e este script se recusa a baixar (política sem fallback:
# espelho cai → build falha alto — ver docs/planos/espelho-de-binarios.md).
# ---------------------------------------------------------------------------
$lgVersion = "0.8.10"
$lgAsset = "libgourou_utils-$lgVersion-windows-x64.zip"
$lgSha256 = "5a3610f979c95b35e455661303b57333ed17094a5719051acc096eff7e88b9b9"  # build nosso (MinGW) no espelho

# Tag da release do espelho que hospeda o artefato (decisão do João; o
# Local-runtimes usa uma release por "conjunto": v1, v2...). Trocar aqui E no .sh.
$mirrorTag = "v1"  # release do espelho que publica o libgourou

$root = Split-Path -Parent $PSScriptRoot
$binDir = Join-Path $root "src-tauri\binaries\libgourou"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

# Guarda: os três utils já instalados → não refaz o download.
$utils = @("adept_activate.exe", "acsmdownloader.exe", "adept_remove.exe")
$missing = @($utils | Where-Object { -not (Test-Path (Join-Path $binDir $_)) })
if ($missing.Count -eq 0) {
    Write-Host "libgourou já existe em $binDir"
    exit 0
}

# Portão de supply-chain: sha256 ainda não fixado = build/upload do espelho não
# aconteceu. NÃO baixa nada — nunca baixar sem conferir.
if ($lgSha256 -eq "PENDENTE") {
    throw "sha256 do libgourou ainda é PENDENTE. Falta buildar (MinGW) e publicar o asset no espelho Anon5T4R/Local-runtimes (release $mirrorTag), depois preencher `$lgSha256 no topo deste script e no fetch-libgourou.sh."
}

$url = "https://github.com/Anon5T4R/Local-runtimes/releases/download/$mirrorTag/$lgAsset"
Write-Host "Baixando $url ..."
$zip = Join-Path $env:TEMP $lgAsset
Invoke-WebRequest -Uri $url -OutFile $zip

# Confere ANTES de extrair: binário adulterado não chega a ser descompactado.
$got = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLower()
if ($got -ne $lgSha256) {
    Remove-Item $zip -Force
    throw "SHA256 NAO BATE!`n  esperado: $lgSha256`n  recebido: $got`nDownload corrompido ou adulterado. Nada foi instalado."
}
Write-Host "sha256 conferido: $got"

$ext = Join-Path $env:TEMP "libgourou-extract"
if (Test-Path $ext) { Remove-Item $ext -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $ext -Force
Remove-Item $zip -Force

# Copia os utils (+ DLLs, se o build deixar alguma — STATIC_UTILS=1 elimina as
# do libgourou, mas as deps dinâmicas libcurl/openssl/libzip/pugixml podem sobrar).
foreach ($bin in $utils) {
    $hit = Get-ChildItem -Path $ext -Recurse -Filter $bin | Select-Object -First 1
    if (-not $hit) { throw "$bin não encontrado dentro do zip ($lgVersion)" }
    Copy-Item $hit.FullName -Destination (Join-Path $binDir $bin) -Force
}
Get-ChildItem -Path $ext -Recurse -Filter "*.dll" | ForEach-Object {
    Copy-Item $_.FullName -Destination (Join-Path $binDir $_.Name) -Force
}
# CA bundle do libcurl/OpenSSL (o msys2 nao usa o cert store do Windows).
Get-ChildItem -Path $ext -Recurse -Filter "*.crt" | ForEach-Object {
    Copy-Item $_.FullName -Destination (Join-Path $binDir "ca-bundle.crt") -Force
}

# O placeholder.txt versionado (glob de resources vazio quebra o bundler) fica
# como está — este script só escreve dentro de binaries\libgourou\.
Remove-Item $ext -Recurse -Force
Write-Host "Instalado em $binDir ($lgVersion)"