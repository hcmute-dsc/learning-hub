# Pester 5 tests for deploy/offsite-pull.ps1 (naming, pruning, git-repo guard).
# Run: pwsh -NoProfile -Command "Invoke-Pester deploy/test -Output Detailed"
BeforeAll {
  . (Join-Path $PSScriptRoot '..' 'offsite-pull.ps1')
}

Describe 'Test-CopyName' {
  It 'accepts a copy name' {
    Test-CopyName 'learning_hub-20261102-193000.sql.gz.age' | Should -BeTrue
  }
  It 'rejects <_>' -ForEach @(
    'learning_hub-20261102-193000.sql.gz',
    'learning_hub-20261102-193000.sql.gz.age.part',
    '../learning_hub-20261102-193000.sql.gz.age',
    'pull.log',
    'learning_hub-2026110-193000.sql.gz.age'
  ) {
    Test-CopyName $_ | Should -BeFalse
  }
}

Describe 'Get-PruneList' {
  BeforeAll {
    $names = @(
      'learning_hub-20261026-193000.sql.gz.age',
      'pull.log',
      'learning_hub-20261102-193000.sql.gz.age',
      'learning_hub-20261012-193000.sql.gz.age',
      'learning_hub-20261019-193000.sql.gz.age',
      'learning_hub-20261005-193000.sql.gz.age.part'
    )
  }
  It 'returns the oldest copies beyond Keep' {
    Get-PruneList $names 2 | Should -Be @(
      'learning_hub-20261019-193000.sql.gz.age',
      'learning_hub-20261012-193000.sql.gz.age'
    )
  }
  It 'returns nothing when there are Keep copies or fewer' {
    @(Get-PruneList $names 4).Count | Should -Be 0
    @(Get-PruneList $names 12).Count | Should -Be 0
  }
  It 'never returns files that are not copies' {
    Get-PruneList $names 1 | Should -Not -Contain 'pull.log'
    Get-PruneList $names 1 | Should -Not -Contain 'learning_hub-20261005-193000.sql.gz.age.part'
  }
  It 'refuses Keep below 1' {
    { Get-PruneList $names 0 } | Should -Throw
  }
}

Describe 'Test-AgeFile' {
  It 'accepts a file with the age header' {
    $f = Join-Path $TestDrive 'a.age'
    [IO.File]::WriteAllBytes($f, [Text.Encoding]::ASCII.GetBytes("age-encryption.org/v1`n-> X25519 abc`n"))
    Test-AgeFile $f | Should -BeTrue
  }
  It 'rejects an error message or empty download' {
    $f = Join-Path $TestDrive 'b.age'
    Set-Content -LiteralPath $f -Value 'offsite-serve: bad file name'
    Test-AgeFile $f | Should -BeFalse
    $e = Join-Path $TestDrive 'empty.age'
    New-Item -ItemType File -Path $e | Out-Null
    Test-AgeFile $e | Should -BeFalse
    Test-AgeFile (Join-Path $TestDrive 'missing.age') | Should -BeFalse
  }
}

Describe 'Test-InsideGitRepo' {
  It 'is true for a folder inside a repo' {
    $repo = Join-Path $TestDrive 'repo'
    New-Item -ItemType Directory -Path (Join-Path $repo '.git') -Force | Out-Null
    Test-InsideGitRepo (Join-Path $repo 'backups') | Should -BeTrue
  }
  It 'is false for a folder outside every repo' {
    Test-InsideGitRepo (Join-Path $TestDrive 'outside\backups') | Should -BeFalse
  }
}
