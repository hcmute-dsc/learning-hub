<#
.SYNOPSIS
Pull the weekly encrypted database copies from the VPS to this machine
(deploy/README.md, "Chép bản sao lưu ra ngoài VPS").

.DESCRIPTION
Runs on the tech lead's Windows machine, weekly, from Task Scheduler. It asks the VPS
for the list of encrypted copies (offsite-serve.sh), downloads the ones it does not have
yet, checks each one is an age file, and keeps the newest -Keep copies in -Dest.
The copies stay encrypted: this script never needs the age private key.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\offsite-pull.ps1 -Dest D:\repos\learning-hub-backups
#>
[CmdletBinding()]
param(
  # Host in ~/.ssh/config that uses the restricted backup-pull key.
  [string]$HostAlias = 'learnhub-backup',
  # Folder for the copies. Must not be inside a git repository.
  [string]$Dest = (Join-Path $HOME 'learning-hub-backups'),
  # How many weekly copies to keep on this machine (12 = about 3 months).
  [int]$Keep = 12
)

$ErrorActionPreference = 'Stop'
$CopyPattern = '^learning_hub-\d{8}-\d{6}\.sql\.gz\.age$'

function Test-CopyName([string]$Name) {
  return $Name -match $CopyPattern
}

# Names sort by their UTC timestamp. Returns the names to delete so the newest $Keep stay.
# Files that are not copies (pull.log, notes) are never returned.
function Get-PruneList([string[]]$Names, [int]$Keep) {
  if ($Keep -lt 1) { throw "Keep must be at least 1, got $Keep" }
  $copies = @($Names | Where-Object { Test-CopyName $_ } | Sort-Object -Descending)
  if ($copies.Count -le $Keep) { return @() }
  return @($copies[$Keep..($copies.Count - 1)])
}

# An age file starts with the line "age-encryption.org/v1".
function Test-AgeFile([string]$Path) {
  $magic = 'age-encryption.org/v1'
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  $buf = New-Object byte[] $magic.Length
  $fs = [IO.File]::OpenRead($Path)
  try { $n = $fs.Read($buf, 0, $buf.Length) } finally { $fs.Dispose() }
  return ($n -eq $buf.Length) -and ([Text.Encoding]::ASCII.GetString($buf) -eq $magic)
}

# True if $Path or one of its parents holds a .git folder or file: a copy there
# could end up in a commit of a public repo.
function Test-InsideGitRepo([string]$Path) {
  $dir = [IO.Path]::GetFullPath($Path)
  while ($dir) {
    if (Test-Path -LiteralPath (Join-Path $dir '.git')) { return $true }
    $parent = [IO.Path]::GetDirectoryName($dir)
    if ($parent -eq $dir) { break }
    $dir = $parent
  }
  return $false
}

function Write-Log([string]$Message) {
  $line = '{0} {1}' -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'), $Message
  Write-Output $line
  Add-Content -LiteralPath (Join-Path $Dest 'pull.log') -Value $line -Encoding ascii
}

function Invoke-Pull {
  if ($HostAlias -notmatch '^[\w.-]+$') { throw "HostAlias '$HostAlias' must be a plain Host name from ~/.ssh/config" }
  if (Test-InsideGitRepo $Dest) { throw "Dest '$Dest' is inside a git repository: choose a folder outside every repo" }
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null

  try {
    $remote = @(& ssh -T -o BatchMode=yes $HostAlias list)
    if ($LASTEXITCODE -ne 0) { throw "ssh $HostAlias list failed (exit $LASTEXITCODE)" }
    $remote = @($remote | Where-Object { Test-CopyName $_ })
    if ($remote.Count -eq 0) { throw 'the VPS has no encrypted copy yet: has offsite-export.sh run?' }

    $new = 0
    foreach ($name in $remote) {
      $path = Join-Path $Dest $name
      if (Test-Path -LiteralPath $path) { continue }
      $part = "$path.part"
      # cmd's ">" writes the bytes as they are; PowerShell 5 would re-encode them.
      cmd /c "ssh -T -o BatchMode=yes $HostAlias get $name > `"$part`""
      if ($LASTEXITCODE -ne 0 -or -not (Test-AgeFile $part)) {
        Remove-Item -LiteralPath $part -ErrorAction SilentlyContinue
        throw "download of $name failed"
      }
      Move-Item -LiteralPath $part -Destination $path
      $new++
    }

    $local = @(Get-ChildItem -LiteralPath $Dest -File | ForEach-Object { $_.Name })
    $pruned = @(Get-PruneList $local $Keep)
    foreach ($old in $pruned) { Remove-Item -LiteralPath (Join-Path $Dest $old) }
    $kept = @($local | Where-Object { Test-CopyName $_ }).Count - $pruned.Count
    Write-Log "pull ok: $new new, $($pruned.Count) pruned, $kept kept in $Dest"
  } catch {
    Write-Log "pull FAILED: $($_.Exception.Message)"
    exit 1
  }
}

# Dot-sourcing (the Pester tests) only loads the functions.
if ($MyInvocation.InvocationName -ne '.') { Invoke-Pull }
