<#
.SYNOPSIS
Runs an OMX implementation team followed by Codex+Claude adversarial audit loops.

.DESCRIPTION
This driver launches a 5-worker implementation team with 3 Codex workers and
2 Claude workers, waits for completion, shuts the team down so OMX can integrate
worker commits, then launches a 2-worker adversarial audit team with one Codex
reviewer and one Claude reviewer.

If either reviewer rejects the result or reports blocking findings, the driver
runs a single-owner Ralph fix pass by default and repeats the audit. Use
-FixMode team only when audit findings are broad and independently fixable. The
loop stops only when both reviewers approve with zero blocking findings, or
MaxAuditRounds is reached.

This script requires an interactive tmux-backed OMX session. It does not start
unless you invoke it directly.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Task,

  [int]$MaxAuditRounds = 5,

  [int]$PollSeconds = 30,

  [string]$ImplementationCliMap = "codex,codex,codex,claude,claude",

  [string]$AuditCliMap = "codex,claude",

  [string]$ArtifactRoot = ".omx/audits/consensus-team",

  [ValidateSet("ralph", "team")]
  [string]$FixMode = "ralph",

  [switch]$RalphNoDeslop,

  [switch]$NoShutdown,

  [switch]$ShowPlan
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $output = & $Command @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  $text = ($output | Out-String).TrimEnd()

  if ($exitCode -ne 0) {
    throw "Command failed ($exitCode): $Command $($Arguments -join ' ')`n$text"
  }

  return $text
}

function Assert-CommandAvailable {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command is not on PATH: $Name"
  }
}

function Get-RepoRoot {
  return (Invoke-Checked -Command "git" -Arguments @("rev-parse", "--show-toplevel")).Trim()
}

function Assert-CleanLeaderWorkspace {
  $status = Invoke-Checked -Command "git" -Arguments @("status", "--short", "--untracked-files=all")
  if ($status.Trim()) {
    throw "Leader workspace is dirty. Commit or stash before launching OMX team worktrees.`n$status"
  }
}

function Get-JsonFromOutput {
  param([Parameter(Mandatory = $true)][string]$Text)

  $jsonLine = ($Text -split "`r?`n" | Where-Object { $_.TrimStart().StartsWith("{") } | Select-Object -Last 1)
  if (-not $jsonLine) {
    throw "Expected JSON output but none was found.`n$Text"
  }

  return $jsonLine | ConvertFrom-Json
}

function ConvertTo-OmxTeamTaskText {
  param([Parameter(Mandatory = $true)][string]$Text)

  return (($Text -split "`r?`n") |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ }) -join " "
}

function Invoke-OmxTeam {
  param(
    [Parameter(Mandatory = $true)][int]$WorkerCount,
    [Parameter(Mandatory = $true)][string]$AgentType,
    [Parameter(Mandatory = $true)][string]$TaskText,
    [Parameter(Mandatory = $true)][string]$CliMap
  )

  $previous = @{
    OMX_TEAM_WORKER_CLI = $env:OMX_TEAM_WORKER_CLI
    OMX_TEAM_WORKER_CLI_MAP = $env:OMX_TEAM_WORKER_CLI_MAP
    OMX_TEAM_DISABLE_HUD = $env:OMX_TEAM_DISABLE_HUD
  }

  try {
    $env:OMX_TEAM_WORKER_CLI = "auto"
    $env:OMX_TEAM_WORKER_CLI_MAP = $CliMap
    if (-not $env:OMX_TEAM_DISABLE_HUD) {
      $env:OMX_TEAM_DISABLE_HUD = "1"
    }

    $teamTaskText = ConvertTo-OmxTeamTaskText -Text $TaskText
    $output = Invoke-Checked -Command "omx" -Arguments @("team", "${WorkerCount}:$AgentType", $teamTaskText)
  }
  finally {
    foreach ($key in $previous.Keys) {
      if ($null -eq $previous[$key]) {
        Remove-Item "env:$key" -ErrorAction SilentlyContinue
      }
      else {
        Set-Item "env:$key" $previous[$key]
      }
    }
  }

  if ($output -notmatch "Team started:\s*(\S+)") {
    throw "Could not parse team name from OMX output.`n$output"
  }

  $teamName = $Matches[1]
  Write-Host "Started team: $teamName"
  return $teamName
}

function Wait-OmxTeamTerminal {
  param([Parameter(Mandatory = $true)][string]$TeamName)

  while ($true) {
    $raw = Invoke-Checked -Command "omx" -Arguments @("team", "status", $TeamName, "--json")
    $status = Get-JsonFromOutput -Text $raw

    if ($status.status -eq "missing") {
      throw "Team state disappeared while waiting: $TeamName"
    }

    $tasks = $status.tasks
    $workers = $status.workers
    Write-Host ("team={0} phase={1} tasks p={2} b={3} i={4} c={5} f={6} workers dead={7} non_reporting={8}" -f `
      $TeamName, $status.phase, $tasks.pending, $tasks.blocked, $tasks.in_progress, $tasks.completed, $tasks.failed, $workers.dead, $workers.non_reporting)

    if ($workers.dead -gt 0) {
      throw "Team has dead workers: $TeamName"
    }

    if ($tasks.failed -gt 0) {
      throw "Team has failed tasks: $TeamName"
    }

    if (($tasks.pending + $tasks.blocked + $tasks.in_progress) -eq 0) {
      return $status
    }

    Start-Sleep -Seconds $PollSeconds
  }
}

function Stop-OmxTeam {
  param([Parameter(Mandatory = $true)][string]$TeamName)

  if ($NoShutdown) {
    Write-Host "NoShutdown set; leaving team state/panes active: $TeamName"
    return
  }

  $output = Invoke-Checked -Command "omx" -Arguments @("team", "shutdown", $TeamName)
  Write-Host $output
}

function Invoke-OmxRalphFix {
  param([Parameter(Mandatory = $true)][string]$TaskText)

  $args = @("ralph")
  if ($RalphNoDeslop) {
    $args += "--no-deslop"
  }
  $args += $TaskText

  Write-Host "Starting Ralph fix pass"
  $output = Invoke-Checked -Command "omx" -Arguments $args
  if ($output) {
    Write-Host $output
  }
}

function New-ImplementationPrompt {
  param(
    [Parameter(Mandatory = $true)][string]$TaskText,
    [Parameter(Mandatory = $true)][string]$BaselineRef
  )

  return @"
Implement this approved task using the approved repository conventions: $TaskText

Team staffing is fixed by the launch environment:
- workers 1-3 are Codex
- workers 4-5 are Claude

Execution contract:
- Split the work by independently verifiable slices.
- Keep diffs scoped and reversible.
- Run relevant lint/typecheck/tests before reporting completion.
- Commit worker changes before marking tasks complete; use the repository's Lore commit protocol when creating final semantic commits.
- Do not perform the final adversarial audit yourself. The consensus driver will run a separate Codex+Claude audit after this team is integrated.

Audit baseline for later review: $BaselineRef
"@
}

function New-AuditPrompt {
  param(
    [Parameter(Mandatory = $true)][string]$TaskText,
    [Parameter(Mandatory = $true)][string]$BaselineRef,
    [Parameter(Mandatory = $true)][string]$AuditDir,
    [Parameter(Mandatory = $true)][int]$Round
  )

  $codexPath = Join-Path $AuditDir "codex-verdict.json"
  $claudePath = Join-Path $AuditDir "claude-verdict.json"

  return @"
Run an adversarial audit of the full implementation currently integrated on the leader branch.

Original task:
$TaskText

Review scope:
- Compare the implementation against the original task.
- Inspect the full diff from baseline commit $BaselineRef to HEAD.
- Check tests, lint/typecheck/build evidence, edge cases, regressions, security/privacy risks, and missing acceptance criteria.
- Do not modify source code.
- Treat uncertain but plausible production bugs as blocking until disproven.

Output contract:
- worker-1 is the Codex reviewer and must write: $codexPath
- worker-2 is the Claude reviewer and must write: $claudePath
- Write valid JSON only. Do not wrap it in markdown.

Required JSON schema:
{
  "reviewer": "codex-or-claude",
  "round": $Round,
  "verdict": "approve-or-reject",
  "blocking_findings": [
    {
      "id": "R$Round-001",
      "severity": "critical-or-high-or-medium-or-low",
      "file": "path or null",
      "line": "line number or null",
      "description": "specific problem",
      "required_fix": "specific required fix",
      "verification": "test or inspection needed to prove fixed"
    }
  ],
  "non_blocking_findings": [],
  "tests_reviewed": [],
  "agreement_notes": "short rationale"
}

Approval is allowed only when there are zero blocking findings.
"@
}

function Read-ReviewerVerdict {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Reviewer
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return [pscustomobject]@{
      reviewer = $Reviewer
      verdict = "reject"
      blocking_findings = @([pscustomobject]@{
        id = "missing-$Reviewer-verdict"
        severity = "high"
        file = $Path
        line = $null
        description = "Reviewer did not write the required verdict file."
        required_fix = "Rerun or inspect the audit team."
        verification = "Verdict JSON exists and parses."
      })
    }
  }

  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  }
  catch {
    return [pscustomobject]@{
      reviewer = $Reviewer
      verdict = "reject"
      blocking_findings = @([pscustomobject]@{
        id = "invalid-$Reviewer-verdict"
        severity = "high"
        file = $Path
        line = $null
        description = "Reviewer verdict JSON did not parse: $($_.Exception.Message)"
        required_fix = "Rerun or inspect the audit team."
        verification = "Verdict JSON parses."
      })
    }
  }
}

function Get-BlockingCount {
  param([Parameter(Mandatory = $true)]$Verdict)

  if ($Verdict.PSObject.Properties.Name -notcontains "blocking_findings" -or $null -eq $Verdict.blocking_findings) {
    return 0
  }

  return @($Verdict.blocking_findings).Count
}

function Test-ConsensusApproved {
  param(
    [Parameter(Mandatory = $true)]$CodexVerdict,
    [Parameter(Mandatory = $true)]$ClaudeVerdict
  )

  return (
    $CodexVerdict.verdict -eq "approve" -and
    $ClaudeVerdict.verdict -eq "approve" -and
    (Get-BlockingCount -Verdict $CodexVerdict) -eq 0 -and
    (Get-BlockingCount -Verdict $ClaudeVerdict) -eq 0
  )
}

function New-FixPrompt {
  param(
    [Parameter(Mandatory = $true)][string]$TaskText,
    [Parameter(Mandatory = $true)][string]$AuditDir,
    [Parameter(Mandatory = $true)][int]$Round
  )

  $codexPath = Join-Path $AuditDir "codex-verdict.json"
  $claudePath = Join-Path $AuditDir "claude-verdict.json"
  $codexVerdictText = if (Test-Path -LiteralPath $codexPath) { Get-Content -Raw -LiteralPath $codexPath } else { '{"verdict":"reject","blocking_findings":[{"id":"missing-codex-verdict"}]}' }
  $claudeVerdictText = if (Test-Path -LiteralPath $claudePath) { Get-Content -Raw -LiteralPath $claudePath } else { '{"verdict":"reject","blocking_findings":[{"id":"missing-claude-verdict"}]}' }

  return @"
Fix the blocking findings from adversarial audit round $Round.

Original task:
$TaskText

Codex audit verdict:
$codexVerdictText

Claude audit verdict:
$claudeVerdictText

Fix contract:
- Fix every blocking finding from both reviewers.
- Treat this as a single-owner fix pass: one coherent owner should resolve,
  verify, and commit the complete fix set.
- Do not broaden scope beyond the original task and audit findings.
- Add or update tests where the finding needs regression coverage.
- Run relevant verification before completing.
- Commit changes before marking the fix pass complete; use the repository's
  Lore commit protocol for final semantic commits.
- Report exactly which finding IDs were fixed and the verification evidence.
"@
}

function Write-Plan {
  param([Parameter(Mandatory = $true)][string]$BaselineRef)

  Write-Host "Consensus team plan"
  Write-Host "  baseline: $BaselineRef"
  Write-Host "  implementation team: 5:executor, CLI map $ImplementationCliMap"
  Write-Host "  audit team per round: 2:code-reviewer, CLI map $AuditCliMap"
  Write-Host "  fix mode after rejected audit: $FixMode"
  if ($FixMode -eq "ralph") {
    Write-Host "  ralph deslop pass: $(-not $RalphNoDeslop)"
  }
  Write-Host "  max audit rounds: $MaxAuditRounds"
  Write-Host "  artifacts: $ArtifactRoot/<run-id>/round-<n>/{codex-verdict.json,claude-verdict.json}"
  Write-Host "  shutdown after each team: $(-not $NoShutdown)"
}

Assert-CommandAvailable -Name "git"
Assert-CommandAvailable -Name "omx"
Assert-CommandAvailable -Name "tmux"
Assert-CommandAvailable -Name "claude"
Assert-CommandAvailable -Name "codex"

if (-not $env:TMUX) {
  throw "This driver must be run from inside tmux so OMX can create team panes."
}

$repoRoot = Get-RepoRoot
Set-Location -LiteralPath $repoRoot

$baselineRef = (Invoke-Checked -Command "git" -Arguments @("rev-parse", "HEAD")).Trim()
$runId = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$artifactBase = Join-Path (Join-Path $repoRoot $ArtifactRoot) $runId

Write-Plan -BaselineRef $baselineRef

if ($ShowPlan) {
  return
}

Assert-CleanLeaderWorkspace

New-Item -ItemType Directory -Force -Path $artifactBase | Out-Null

$implementationPrompt = New-ImplementationPrompt -TaskText $Task -BaselineRef $baselineRef
$implementationTeam = Invoke-OmxTeam -WorkerCount 5 -AgentType "executor" -TaskText $implementationPrompt -CliMap $ImplementationCliMap
Wait-OmxTeamTerminal -TeamName $implementationTeam | Out-Null
Stop-OmxTeam -TeamName $implementationTeam

for ($round = 1; $round -le $MaxAuditRounds; $round++) {
  Assert-CleanLeaderWorkspace

  $roundDir = Join-Path $artifactBase "round-$round"
  New-Item -ItemType Directory -Force -Path $roundDir | Out-Null

  $auditPrompt = New-AuditPrompt -TaskText $Task -BaselineRef $baselineRef -AuditDir $roundDir -Round $round
  $auditTeam = Invoke-OmxTeam -WorkerCount 2 -AgentType "code-reviewer" -TaskText $auditPrompt -CliMap $AuditCliMap
  Wait-OmxTeamTerminal -TeamName $auditTeam | Out-Null
  Stop-OmxTeam -TeamName $auditTeam

  $codexVerdict = Read-ReviewerVerdict -Path (Join-Path $roundDir "codex-verdict.json") -Reviewer "codex"
  $claudeVerdict = Read-ReviewerVerdict -Path (Join-Path $roundDir "claude-verdict.json") -Reviewer "claude"
  $codexBlocking = Get-BlockingCount -Verdict $codexVerdict
  $claudeBlocking = Get-BlockingCount -Verdict $claudeVerdict

  Write-Host "audit round ${round}: codex=$($codexVerdict.verdict) blocking=$codexBlocking; claude=$($claudeVerdict.verdict) blocking=$claudeBlocking"

  if (Test-ConsensusApproved -CodexVerdict $codexVerdict -ClaudeVerdict $claudeVerdict) {
    Write-Host "Consensus approved by Codex and Claude after round $round."
    Write-Host "Audit artifacts: $roundDir"
    return
  }

  if ($round -eq $MaxAuditRounds) {
    throw "Consensus was not reached after $MaxAuditRounds audit rounds. Last audit artifacts: $roundDir"
  }

  $fixPrompt = New-FixPrompt -TaskText $Task -AuditDir $roundDir -Round $round
  if ($FixMode -eq "team") {
    $fixTeam = Invoke-OmxTeam -WorkerCount 5 -AgentType "executor" -TaskText $fixPrompt -CliMap $ImplementationCliMap
    Wait-OmxTeamTerminal -TeamName $fixTeam | Out-Null
    Stop-OmxTeam -TeamName $fixTeam
  }
  else {
    Invoke-OmxRalphFix -TaskText $fixPrompt
  }
}
