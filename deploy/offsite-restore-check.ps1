<#
.SYNOPSIS
Monthly restore check of an encrypted offsite copy
(deploy/README.md, offsite copies, monthly restore check).

.DESCRIPTION
On the tech lead's machine (needs age and Docker Desktop): decrypts the newest copy in
-Dest, loads it into a throwaway Postgres 16 container with no network, and prints the
row counts. With -ProdHost it prints the same counts from production to compare.
The decrypted file holds members' emails: it lives in a temp folder and is deleted at
the end, even when the check fails. Production is only read, never changed.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\offsite-restore-check.ps1 -Dest D:\repos\learning-hub-backups -ProdHost learnhub
#>
[CmdletBinding()]
param(
  [string]$Dest = (Join-Path $HOME 'learning-hub-backups'),
  # age private key (identity). Keep it outside every repo; a passphrase-protected key is asked for here.
  [string]$Identity = (Join-Path $HOME '.age\learning-hub-backup.key'),
  # A specific copy to check; default is the newest in -Dest.
  [string]$File,
  # Optional Host in ~/.ssh/config with full access as learnhub (not the restricted pull key).
  [string]$ProdHost
)

$ErrorActionPreference = 'Stop'
$Container = 'lh-offsite-check'
$Query = 'select (select count(*) from users), (select count(*) from submissions), (select count(*) from _prisma_migrations)'

function Invoke-Native([string]$What, [scriptblock]$Command) {
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" }
}

if (-not $File) {
  $File = Get-ChildItem -LiteralPath $Dest -Filter 'learning_hub-*.sql.gz.age' -File |
    Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
  if (-not $File) { throw "no encrypted copy in ${Dest}: run offsite-pull.ps1 first" }
}
if (-not (Test-Path -LiteralPath $Identity)) { throw "age key not found: $Identity" }
Write-Output "Checking $File"

$work = Join-Path ([IO.Path]::GetTempPath()) ("lh-offsite-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
$plain = Join-Path $work 'dump.sql.gz'
try {
  Invoke-Native 'age decrypt' { age -d -i $Identity -o $plain $File }
  Write-Output 'Decrypt OK'

  # cmd /c keeps stderr away from PowerShell 5, which would turn it into a terminating error.
  cmd /c "docker rm -f $Container >nul 2>&1"
  Invoke-Native 'docker run' {
    docker run -d --rm --name $Container --network none `
      -e POSTGRES_PASSWORD=test -e POSTGRES_USER=hub -e POSTGRES_DB=learning_hub postgres:16 | Out-Null
  }
  $ready = $false
  for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
    Start-Sleep -Seconds 2
    cmd /c "docker exec $Container pg_isready -q -U hub -d learning_hub >nul 2>&1"
    $ready = ($LASTEXITCODE -eq 0)
  }
  if (-not $ready) { throw 'the temporary Postgres did not start within 60 s' }

  Invoke-Native 'docker cp' { docker cp $plain "${Container}:/tmp/dump.sql.gz" }
  Invoke-Native 'gzip check' { docker exec $Container gunzip -t /tmp/dump.sql.gz }
  Write-Output 'gzip OK'
  Invoke-Native 'restore' {
    docker exec $Container sh -c 'gunzip -c /tmp/dump.sql.gz | psql -q -v ON_ERROR_STOP=1 -U hub -d learning_hub >/dev/null'
  }
  Write-Output 'Restore OK'

  $copy = docker exec $Container psql -U hub -d learning_hub -At -c $Query
  Write-Output "copy       (users|submissions|migrations): $copy"
  if ($ProdHost) {
    $prod = ssh $ProdHost "cd /opt/learning-hub && docker compose -f docker-compose.prod.yml exec -T db psql -U hub -d learning_hub -At -c '$Query'"
    if ($LASTEXITCODE -ne 0) { Write-Warning "could not read the production counts through ssh $ProdHost" }
    else { Write-Output "production (users|submissions|migrations): $prod" }
  }
  $name = [IO.Path]::GetFileName($File) -replace '\.sql\.gz\.age$', ''
  $today = (Get-Date).ToString('dd/MM/yyyy')
  Write-Output ''
  Write-Output "Row for DEPLOYMENT 5.3: | $today | offsite copy $name (encrypted): restore OK, counts $copy |"
} finally {
  cmd /c "docker rm -f $Container >nul 2>&1"
  Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
