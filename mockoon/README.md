# Atlassian MCP mock server

`atlassian-mcp.json` is a [Mockoon](https://mockoon.com) environment that stands in for a real
`atlassian-mcp` instance during local development. It implements every endpoint
`src/infra/atlassian/{approvals,linking,tokens}.js` calls, using Mockoon's
[data buckets](https://mockoon.com/docs/latest/data-buckets/overview/) to keep state
(created/decided space requests, minted/revoked tokens, linked users) for the life of the running
mock.

The portal never knows the difference: it always makes real HTTP calls via `AtlassianClient`.
"Mock mode" is purely an `ATLASSIAN_MCP_URL` choice, wired up in `compose.yaml` (service
`atlassian-mcp-mock`, image `mockoon/cli`) rather than anything in the portal's own code.

## Running it standalone

```bash
docker run --rm -p 8085:8085 -v "$(pwd)/mockoon:/data:ro" mockoon/cli:latest start --data /data/atlassian-mcp.json --port 8085
curl http://localhost:8085/admin/access-requests -H 'X-User-Id: dev@example.com'
```

Or via `docker compose up atlassian-mcp-mock -d` from the repo root, which does the same thing and
matches what `npm run start:dev` (run outside Docker, against `.env`'s
`ATLASSIAN_MCP_URL=http://localhost:8085`) expects to find.

## Editing

The file is a plain JSON export in Mockoon's environment schema - open it in the
[Mockoon desktop app](https://mockoon.com/download/) ("Open environment") to edit visually, or
hand-edit the JSON directly. Validate a hand-edit before committing:

```bash
npx @mockoon/cli@9 validate --data mockoon/atlassian-mcp.json
```

## Per-product approvals

A space is approved for Jira and for Confluence separately, so a stored request carries a
`products` map rather than a single `status`:

```json
"products": {
  "jira":       { "requested": true, "status": "approved", "reviewerId": "...", "decisionReason": "...", "decidedAt": "..." },
  "confluence": { "requested": true, "status": "pending",  "reviewerId": "",    "decisionReason": "",    "decidedAt": "" }
}
```

`POST /approvals/spaces` takes `products` as an array of the codes the requester ticked
(`["jira", "confluence"]`), and everything they did not ask for is stored as
`{ "requested": false, "status": "not-requested" }`.

`POST /admin/access-requests/{id}/approve` and `/reject` take a **`product`** in the body and
touch only that half of the request, leaving the other exactly as it was. So a 409 from one of
them means *that product* has already been decided - the other half may well still be open, which
is the whole point of deciding them separately. Approving a space for both products is two calls:

```bash
curl -X POST http://localhost:8085/admin/access-requests/mock-req-2/approve \
  -H 'Content-Type: application/json' -H 'X-User-Id: iao.two@defra.gov.uk' \
  -d '{"product":"jira","decisionReason":"No personal data."}'
```

There is no overall `status` field on the wire. The portal derives one from the products it
carries - see `deriveOverallStatus` in `src/services/space-requests.js` - so that a request
approved for Jira and refused for Confluence has exactly one answer everywhere it is shown.

## Design notes, for whoever edits this next

- **Seed data.** The `approvals` data bucket is seeded with five space requests owned by
  `dev@example.com` (kept in step with `mockUser.email` in `src/pages/login/mock-user.js`) and
  `someone.else@defra.gov.uk`. Between them they cover every state
  `deriveOverallStatus` can produce: both products approved (`FLOOD`), both pending (`FARM`), both
  rejected (`WASTE`), Jira approved with Confluence still pending (`AIRQ`, the partially-approved
  case), and a Confluence-only request (`MARINE`, which must not be held open by a Jira decision
  nobody asked for). `tokens` and `linking` start empty: a token list or a connection should only
  ever show what *this* run created.
- **Why the create and decide routes branch instead of computing values inline.** Handlebars has
  no inline conditional, and the `object` helper needs each product's `requested`/`status` pair
  settled before it is called. So `POST /approvals/spaces` branches three ways (jira-only,
  confluence-only, both - the whole space of valid bodies, since the form requires at least one
  box), and each decision route branches on `product`. The alternative - storing the products
  flat and re-assembling the nested JSON in every read route - would have moved the same
  complexity into five places instead of two, and cost the `{{{stringify this}}}` one-liners that
  the read routes are built on.
- **Templating gotchas that shaped these routes** (Mockoon 9.8, may differ in future versions):
  - `data`/`dataRaw` are not interchangeable. `data` renders a value as text (safe to print
    directly with `{{...}}` or `{{{...}}}`); `dataRaw` returns the real value, and is the one to
    use inside `#each`, `#if`, `eq`, `find`, etc. Using `data` where `dataRaw` belongs renders
    empty strings that are still truthy - a `{{#if (data ...)}}` check is always true.
  - A bucket top-level key that itself contains dots (an email, say) works fine as a *bare* key
    (`setData 'set' 'bucket' theDottedKey value`), but breaks as soon as it is used with a
    **path** argument alongside a `.field` suffix (`concat theDottedKey '.field'`) - the dot in
    the key gets parsed as a nesting separator. That is why `approvals`/`tokens` are keyed by a
    generated `{{uuid}}` rather than by the space key or user email directly, and why space-key
    and linked-user lookups go through a plain array (`spaceKeys`, `linking`) scanned with the
    `find` helper instead of an object keyed by the dotted value. Atlassian space keys have no
    dots in them, but the array also answers the question the create route actually asks - "have
    I seen this key before?" - for a key that is not there.
  - `includes` is a *string* helper ("does string A appear in string B"), not `Array.includes`. Use
    `find` for array membership - `{{#if (find (dataRaw 'bucket') needle)}}`. The create route
    reads the submitted `products` array the same way: `{{#if (find (bodyRaw 'products') 'jira')}}`.
  - `setVar` is scoped to the block it is set in: a value set inside `{{#each}}` is visible to
    later iterations of that *same* loop, but is gone the moment the loop closes. It does persist
    across a plain `{{#if}}`/`{{else}}`. Route bodies here that need a "was anything found"
    condition after a scan use the `{{status CODE}}` override pattern instead (set a default status
    before the loop, override it inside the matching branch) rather than a post-loop `getVar`.
  - `{{{stringify this}}}` (triple-stash, not double) turns an object/array into real JSON - handy
    for rendering a bucket record without hand-listing every field. Double-stash HTML-escapes the
    quotes.
  - A helper call immediately followed by a literal `}` (e.g. `{{/if}}}` closing both an `#if` and
    a JSON object) can be misparsed as part of a triple-mustache close. Where that collision shows
    up, a route body here adds a harmless space before the literal brace.
  - `faker 'date.soon'`/`'date.recent'` return `Date` objects, not strings, that will string
    only when Handlebars renders them into text. Stored as a data-bucket field value directly
    (via `object`), they get double-JSON-encoded on read; force a string first with
    `(concat (faker 'date.soon' days=30) '')`. The plain `now` helper does not have this problem -
    it already returns a string.
- **Known simplifications** (all deliberate, in line with this being a manual-QA aid, not a
  faithful `atlassian-mcp` re-implementation - the request/response *contract* itself is exercised
  by the nock-based unit tests in `tests/unit/infra/atlassian/`, not by this mock):
  - `GET /admin/access-requests` always returns every request regardless of status, ignoring any
    query string. Upstream only ever returns pending requests and takes no filters at all; this
    mock is deliberately more permissive so the spaces directory has something to show for every
    status.
  - Timestamps generated by this mock (`createdAt`, `expires_at`, ...) are valid, parseable date
    strings but not strictly ISO 8601 (`now` renders with a numeric UTC offset rather than `Z`).
  - Token secrets/prefixes are realistic-looking (`amcp_` + random alphanumeric) but the prefix is
    generated independently of the full secret, not literally its first 13 characters.
