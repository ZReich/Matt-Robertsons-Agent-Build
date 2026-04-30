# AI Scrub Validation Workflow (Claude Code subscription path)

## Purpose

Validate AI scrub output quality on 50-100 emails at $0 API spend before
committing to a bulk API run (Phase 13 of the deal-pipeline-and-ai-backfill
plan). The operator (the Claude Code session driver) acts as the model in
place of the real `scrubWithConfiguredProvider`, so the marginal cost is
zero subscription tokens instead of paid Anthropic API tokens.

## Steps

1. **Export a batch:**

   ```bash
   cd full-kit
   set -a && source .env.local && set +a
   node scripts/scrub-export.mjs --limit=25 --runId=batch-001
   ```

   Produces `tmp/scrub-batch-batch-001.jsonl`. Each line is a JSON object:

   ```json
   {
     "queueRowId": "...",
     "communicationId": "...",
     "leaseToken": "...",
     "promptVersion": "...",
     "perEmailPrompt": "...",
     "globalMemory": "...",
     "scrubToolSchema": { ... }
   }
   ```

   The export CLAIMS the queue rows (sets `status=in_flight` with a 5-minute
   lease and a fresh `leaseToken` per row). Either produce a results JSONL
   and run the import within 5 minutes, or wait for the lease to expire
   before re-claiming. The lease is the same fencing primitive the real
   batch loop uses, so this script never loses a row to a parallel worker.

   **Targeting specific rows** (instead of draining the global pending
   queue):

   ```bash
   node scripts/scrub-export.mjs --communicationIds=cm123,cm456 --runId=batch-002
   ```

2. **Process the batch in this Claude Code session:**

   - Read the JSONL.
   - For each row, evaluate the `perEmailPrompt` + `globalMemory` against
     the `scrubToolSchema` and produce a JSON object that would satisfy a
     `record_email_scrub` tool call.
   - Write results to `tmp/scrub-results-batch-001.jsonl`, one JSON line
     per input row:

     ```json
     {
       "queueRowId": "...",
       "communicationId": "...",
       "leaseToken": "...",
       "toolInput": { ... record_email_scrub args ... },
       "modelUsed": "claude-code-opus-4.7"
     }
     ```

   `toolInput` is the same object that would be the `input` of a real
   Anthropic tool_use block — the validator shape is exactly
   `record_email_scrub.input_schema`.

3. **Apply results:**

   ```bash
   node scripts/scrub-import.mjs --runId=batch-001
   ```

   The importer validates each row through `validateScrubToolInput` (strict
   mode by default — pass `--relaxed` to drop bad actions and keep the rest
   of the row), re-binds any `mark-todo-done` actions against fresh
   `loadOpenTodoCandidates` (so prompt-supplied `todoId`s are still
   validated against the live open-todo set the same way the real
   orchestrator does), and commits via `applyScrubResult`. Token counters
   are zeroed because no API call happened. `modelUsed` defaults to
   `claude-code-subscription` if the JSONL omits it.

4. **Hand-grade the output:**

   - Open the affected Communications in the dashboard.
   - Check the resulting `AgentAction` rows in the approval queue.
   - Note any cases where the AI proposed wrong actions, missed obvious
     actions, or hallucinated dates/IDs.
   - Record findings in `docs/ai-scrub-validation/run-<runId>.md`.

5. **Decide:** if quality is good, proceed to Phase 13 (bulk API
   backfill). If not, fix the prompt + bump `PROMPT_VERSION` + re-export.

## Caveats

- **Model mismatch.** The model used here is Opus 4.7 (or whatever Claude
  Code is on), not Haiku 4.5 (the production scrub model). Output quality
  will be HIGHER than production. A "looks fine in Claude Code" result is
  necessary but not sufficient evidence that Haiku will perform —
  optimistic baseline only.

- **No `ScrubApiCall` audit row is written** for the subscription path.
  `applyScrubResult` doesn't write that row; the real provider
  (`claude.ts` / `openai.ts`) does, and we're bypassing both. The `runId`
  in the batch filenames + the commit log are the equivalent audit trail.
  The budget tracker is therefore also bypassed — there's no spend to
  enforce against.

- **`modelUsed` audit metadata.** The `modelUsed` field in the results
  JSONL is recorded into `Communication.metadata.scrub.modelUsed` so we
  can later distinguish subscription-path scrubs from real-provider
  scrubs. `applyScrubResult` ignores it for any control-flow purpose.

- **Cache instrumentation is irrelevant here** — there's no Anthropic
  prompt-cache hit on the subscription path. Cache instrumentation should
  be re-verified before the Phase 13 bulk run.

- **`mark-todo-done` re-binding.** The importer re-runs
  `bindMarkTodoDoneActions` against fresh `openTodos` rather than trusting
  the operator-produced payload. This is intentional defense-in-depth: it
  rejects todoIds that aren't currently open or don't have outbound
  evidence in the thread, the same way the real path does.

- **Lease expiry.** If you take longer than 5 minutes between export and
  import, the queue row's lease expires. The applier will detect this via
  the `leaseToken`-guarded fence and refuse the commit
  (`ScrubFencedOutError`). Re-export rather than trying to force the apply
  through.
