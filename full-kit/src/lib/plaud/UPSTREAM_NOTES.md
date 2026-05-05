# Plaud upstream API shape

Captured 2026-05-04 from two unofficial reverse-engineered clients.
This file is the source of truth for the Plaud HTTP shapes used by this
integration. The spec at `docs/superpowers/specs/2026-05-04-plaud-integration-design.md`
was written against an older memory note and contained drift; where this
file disagrees with the spec, **this file wins**.

## Sources

- sergivalverde/plaud-toolkit (TypeScript) @ `dd5774b306f1`
  - `packages/core/src/auth.ts`, `client.ts`, `types.ts`
- arbuzmell/plaud-api (Python) @ `1e52c316829a`
  - `src/plaud/_endpoints.py`, `src/plaud/api/recordings.py`,
    `src/plaud/api/transcriptions.py`, `src/plaud/models.py`,
    `tests/conftest.py`

## Region routing

Two regional bases:
- `us` → `https://api.plaud.ai`
- `eu` → `https://api-euc1.plaud.ai`

If a request returns `{ status: -302, data: { domains: { api: "..." } } }`,
the client must switch its base URL to the host returned in `domains.api`
and retry. We always start at the US base.

## Login

- Method: `POST`
- Path: `/auth/access-token`
- Content-Type: `application/x-www-form-urlencoded`
- Body fields: `username` (email goes here, despite the name), `password`
- Response shape:
  ```json
  {
    "status": 0,
    "msg": "ok",
    "access_token": "<JWT>",
    "token_type": "Bearer"
  }
  ```
- Success requires `status === 0` AND a non-empty `access_token`.
- Token is a JWT — `expiresAt` is decoded from the `exp` claim (seconds-since-epoch),
  not returned in the body. We multiply by 1000 for ms.

## DevTools bearer token

Long-lived token copied from the `Authorization` header at web.plaud.ai.
Same JWT shape as a login result, so we treat it as a pre-minted token
with the same `exp` decoding.

## List recordings

- Method: `GET`
- Path: `/file/simple/web`
- Headers: `Authorization: Bearer <token>`
- Query params (all from Python toolkit; TS toolkit omits and gets defaults):
  - `skip`: integer offset (default 0)
  - `limit`: integer page size (default 50; we'll cap at 50)
  - `is_trash`: `0` to exclude trashed
  - `sort_by`: `start_time`
  - `is_desc`: `true` (most recent first)
- Response shape:
  ```json
  {
    "data_file_list": [
      {
        "id": "abc123",
        "filename": "Team Standup",
        "filesize": 4200000,
        "duration": 185000,
        "start_time": 1738900000000,
        "is_trans": 1,
        "is_summary": 1,
        "filetag_id_list": ["tag_work"],
        "is_trash": 0
      }
    ]
  }
  ```
- **Critical:** `duration` is **milliseconds**, not seconds. We must divide by
  1000 when populating `Communication.durationSeconds`.
- `is_trans` and `is_summary` are 1/0 ints (treat truthy/falsy).
- `start_time` is epoch milliseconds.
- **Pagination is offset-based (skip/limit), not cursor-based.** No `since` query
  param exists upstream. Our high-water-mark logic must be client-side: page
  through descending order, stop when we hit a recording with
  `start_time <= sinceMs`.

## Get recording detail (transcript + summary)

Two routes work; we use the batch POST because the Python toolkit confirms it
returns the rich shape including `trans_result` and `ai_content`.

- Method: `POST`
- Path: `/file/list`
- Body (JSON): a JSON array of file IDs, e.g. `["abc123"]`
- Response shape:
  ```json
  {
    "data_file_list": [
      {
        "id": "abc123",
        "filename": "...",
        "duration": 185000,
        "start_time": 1738900000000,
        "filesize": 4200000,
        "is_trans": 1,
        "is_summary": 1,
        "filetag_id_list": ["tag_work"],
        "trans_result": [
          { "speaker": "Alice", "content": "Good morning everyone.",
            "start_time": 0, "end_time": 3000 },
          { "speaker": "Bob", "content": "Morning! Let's start with updates.",
            "start_time": 3100, "end_time": 6000 }
        ],
        "ai_content": "{\"markdown\":\"## Meeting Summary\\n\\n…\"}",
        "summary_list": []
      }
    ]
  }
  ```
- The Python toolkit's `Summary.parse_ai_content` shows `ai_content` may be
  one of: plain markdown, `{"markdown": "..."}`, `{"content": {"markdown": "..."}}`,
  `{"summary": "..."}`, or other JSON. We must mirror that parsing.

## Audio file URL

- Method: `GET`
- Path: `/file/temp-url/{id}`
- Returns presigned S3 URL in `temp_url`. Used by the UI's "Open in Plaud"
  link / future audio playback. Out of scope for v1.

## Speaker labels

`trans_result[i].speaker` is the diarized label. Plaud lets the user rename
speakers via `PATCH /file/{id}` with `{ trans_result: [...] }`. We do not
write back; we only display whatever the user has already set.

## Web app deep-link

The user-facing web app at `https://web.plaud.ai` opens recordings via
the dashboard. Anchored deep-links are not documented in either client.
For the UI's "Open in Plaud" button we'll link to `https://web.plaud.ai/`
and let the user navigate to the recording themselves; verifying a
deeper deep-link is out of scope for v1.

## Differences from the original design spec

Use this list to spot inconsistencies during code review:

| Spec said | Reality |
|---|---|
| `POST /web/login` with JSON `{email,password}` returning `{access_token,expires_at}` | `POST /auth/access-token` with **form-encoded** `username,password` returning `{status,access_token,token_type}`; expiry decoded from JWT |
| `GET /web/recordings?since=...&cursor=...` | `GET /file/simple/web?skip=&limit=&is_trash=0&sort_by=start_time&is_desc=true` (no `since`, no cursor) |
| `GET /web/recordings/{id}/transcript` | `POST /file/list` with body `[id]` |
| `duration` in seconds | `duration` in **milliseconds** |
| `next_cursor` pagination | `skip`/`limit` offset pagination |

## Error shapes

When the API returns a non-`status:0` payload, the body looks like
`{ status: <nonzero>, msg: "<reason>" }`. Our HTTP client treats any
non-2xx HTTP code OR `status !== 0` on a 200 as an error and constructs
`PlaudApiError(httpStatus, endpoint, msg)`.
