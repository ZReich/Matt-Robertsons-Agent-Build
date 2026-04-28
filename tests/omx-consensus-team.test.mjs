import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const script = readFileSync(new URL('../scripts/omx-consensus-team.ps1', import.meta.url), 'utf8');

test('implementation prompt preserves the requested task and team execution contract', () => {
  assert.match(script, /function\s+New-ImplementationPrompt\b/);
  assert.match(script, /1\. Coverage ledger data API lane:/);
  assert.match(script, /2\. Scrub context prompt schema lane:/);
  assert.match(script, /3\. Agent action todo resolution lane:/);
  assert.match(script, /4\. Agent UI and candidate coverage lane:/);
  assert.doesNotMatch(script, /5\. Contact candidate coverage lane:/);
  assert.match(script, /workers 1-2 are Codex and workers 3-4 are Claude/);
  assert.match(script, /Run relevant lint\/typecheck\/tests before reporting completion/);
  assert.match(script, /Commit worker changes before marking tasks complete/);
  assert.match(script, /Audit baseline for later review: \$BaselineRef/);
});

test('implementation team size follows the configured CLI map', () => {
  assert.match(script, /\$ImplementationCliMap\s*=\s*"codex,codex,claude,claude"/);
  assert.match(script, /function\s+Get-CliMapWorkerCount\b/);
  assert.match(script, /\$implementationWorkerCount\s*=\s*Get-CliMapWorkerCount -CliMap \$ImplementationCliMap/);
  assert.match(script, /Invoke-OmxTeam -WorkerCount \$implementationWorkerCount -AgentType "executor"/);
  assert.doesNotMatch(script, /Invoke-OmxTeam -WorkerCount 5 -AgentType "executor"/);
});

test('team invocation compacts multiline prompts before calling omx team', () => {
  assert.match(script, /function\s+ConvertTo-OmxTeamTaskText\b/);
  assert.match(script, /\$teamTaskText\s*=\s*ConvertTo-OmxTeamTaskText -Text \$TaskText/);
  assert.match(script, /"omx" -Arguments @\("team", "\$\{WorkerCount\}:\$AgentType", \$teamTaskText\)/);
});

test('audit prompt requires machine-readable dual-reviewer verdicts', () => {
  assert.match(script, /function\s+New-AuditPrompt\b/);
  assert.match(script, /1\. Codex adversarial audit lane:/);
  assert.match(script, /2\. Claude adversarial audit lane:/);
  assert.match(script, /codex-verdict\.json/);
  assert.match(script, /claude-verdict\.json/);
  assert.match(script, /Write valid JSON only\. Do not wrap it in markdown\./);
  assert.match(script, /"verdict": "approve-or-reject"/);
  assert.match(script, /"blocking_findings": \[/);
  assert.match(script, /Approval is allowed only when there are zero blocking findings\./);
});

test('fix prompt carries both reviewer verdicts and requires regression coverage', () => {
  assert.match(script, /function\s+New-FixPrompt\b/);
  assert.match(script, /Fix every blocking finding from both reviewers\./);
  assert.match(script, /Treat this as a single-owner fix pass/);
  assert.match(script, /Add or update tests where the finding needs regression coverage\./);
  assert.match(script, /Codex audit verdict:/);
  assert.match(script, /Claude audit verdict:/);
});

test('team invocation restores OMX launch environment after worker launch', () => {
  assert.match(script, /\$previous\s*=\s*@\{/);
  assert.match(script, /OMX_TEAM_WORKER_CLI/);
  assert.match(script, /OMX_TEAM_WORKER_CLI_MAP/);
  assert.match(script, /OMX_TEAM_DISABLE_HUD/);
  assert.match(script, /finally\s*\{/);
  assert.match(script, /Remove-Item\s+"env:\$key"/);
  assert.match(script, /Set-Item\s+"env:\$key"\s+\$previous\[\$key\]/);
});

test('consensus approval requires both reviewers to approve with no blocking findings', () => {
  assert.match(script, /function\s+Test-ConsensusApproved\b/);
  assert.match(script, /\$CodexVerdict\.verdict\s+-eq\s+"approve"/);
  assert.match(script, /\$ClaudeVerdict\.verdict\s+-eq\s+"approve"/);
  assert.match(script, /Get-BlockingCount -Verdict \$CodexVerdict\) -eq 0/);
  assert.match(script, /Get-BlockingCount -Verdict \$ClaudeVerdict\) -eq 0/);
});
