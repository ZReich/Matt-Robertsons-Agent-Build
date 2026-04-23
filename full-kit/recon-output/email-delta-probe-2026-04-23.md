# Email Delta Probe - 2026-04-23

## Scope

Investigated why `syncEmails` only ingested about 100 messages per folder from Microsoft Graph message delta during 7-day and 90-day bootstraps.

Probe script:

- `full-kit/scripts/probe-email-delta.ts`

Commands used:

- Compiled the probe with local TypeScript into `.omx/tmp/probe-email-delta-build`.
- Ran `node ../.omx/tmp/probe-email-delta-build/scripts/probe-email-delta.js --daysBack=90 --maxPages=4 --includeGuidDelta`.
- Ran `node ../.omx/tmp/probe-email-delta-build/scripts/probe-email-delta.js --daysBack=90 --maxPages=12 --variants=currentTop --folders=inbox,sentitems`.

## Evidence

The 90-day non-delta count probe against Inbox returned `@odata.count = 20440` with a matching `receivedDateTime ge 2026-01-23...` filter. This falsifies the small-mailbox hypothesis.

Folder probes:

| Folder | Well-known ID resolved | Total items | Notes |
| --- | --- | ---: | --- |
| Inbox | `AQMk...IBDAAAAA==` | 141198 | Tree walk found the same ID for display name `Inbox`. |
| Sent Items | `AQMk...IBCQAAAA==` | 15338 | Tree walk found the same ID for display name `Sent Items`. |

Using the GUIDs directly with the no-`$top` delta variant returned the same parent folder IDs and continued pagination, so well-known-name vs GUID semantics are not the root cause.

Current production-shaped delta query, with `$top=100` and no `odata.maxpagesize` preference:

| Folder | Pages observed | Values per data page | Final page |
| --- | ---: | ---: | --- |
| Inbox | 11 | 10 x 10 pages | Page 11: `value=[]`, `@odata.deltaLink`, no `@odata.nextLink` |
| Sent Items | 11 | 10 x 10 pages | Page 11: `value=[]`, `@odata.deltaLink`, no `@odata.nextLink` |

This confirms `$top=100` capped the delta round at 100 total messages. Graph used a default page size of 10, emitted 10 data pages, then returned a delta link.

No-`$top` delta query with `Prefer: outlook.body-content-type="text", odata.maxpagesize=100`:

| Folder identifier | Pages observed | Values per page | Continuation |
| --- | ---: | ---: | --- |
| `inbox` | 4 | 100 | Still had `@odata.nextLink` at page 4 |
| `sentitems` | 4 | 100 | Still had `@odata.nextLink` at page 4 |
| Inbox GUID | 4 | 100 | Still had `@odata.nextLink` at page 4 |
| Sent Items GUID | 4 | 100 | Still had `@odata.nextLink` at page 4 |

## Conclusion

The fitting hypothesis is `$top` misuse. In this mailbox, Graph treats `$top=100` on `/messages/delta` as a total cap for the delta round, not as the intended page size. The fix is to remove `$top` from the initial delta URL and request page size through `Prefer: odata.maxpagesize=100`.

This is not a delta-link-as-continuation issue: Microsoft Graph documentation says a `@odata.deltaLink` means the current change-tracking round is complete. The observed bad run completed only because `$top=100` defined that round as 100 messages.

## Remaining Risk

Microsoft's message delta documentation states that applying `$filter` to message delta returns only up to 5000 messages. The fix here removes the accidental 100-message cap and restores proper pagination, but a separate bootstrap strategy may be needed if the product must ingest all 20440 currently matching 90-day Inbox messages in one historical load.
