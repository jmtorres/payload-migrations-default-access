# Payload 3.92: `payload-migrations` gets the default access functions

Minimal reproduction: an **unmodified** `create-payload-app@3.92.1 -t website --db sqlite` scaffold (Payload **3.92.1**). Changes from the scaffold: `src/scripts/check-migrations-access.ts`, an env-switched post-sanitize patch at the bottom of `src/payload.config.ts` (the proposed fix, for comparison), `DATABASE_URL=file:./payload.db` in `.env.example`, `*.db` in `.gitignore`, and this README.

`migrationsCollection` (`packages/payload/src/database/migrations/migrationsCollection.ts`) sets `endpoints: false`, `graphQL: false` and `admin.hidden`, but no `access`. `sanitizeCollection` fills all four operations with `defaultAccess`, which allows any user of the admin collection. The REST route answers 501 and GraphQL is off, so the collection isn't reachable over HTTP, but the access layer says yes to every logged-in user:

- `GET /api/access` (`getAccessResults`) reports `payload-migrations: { create: true, read: true, update: true, delete: true }`.
- A Local API call on the collection with `overrideAccess: false` is allowed for that user.

A project can't close it itself: the collection is pushed during sanitize after plugins have run, so neither a plugin nor a collection override reaches it (payloadcms/payload discussions #15329 and #16461). `payload migrate` and the dev push write the table through the Local API with `overrideAccess` defaulting to `true`, so closing it by default changes no migration flow.

## Run it

```sh
cp .env.example .env
pnpm install
MIGRATIONS_ACCESS=closed pnpm payload migrate                                     # the CLI writes the table with access closed
MIGRATIONS_ACCESS=closed pnpm payload migrate:status                              # … and reads it: initial | batch 1 | Ran Yes
pnpm payload run src/scripts/check-migrations-access.ts                           # default (the bug)
MIGRATIONS_ACCESS=closed pnpm payload run src/scripts/check-migrations-access.ts  # with the proposed fix
```

Run `migrate` before the script: the script's `getPayload` would otherwise dev-push the schema, and `payload migrate` then stops on the data-loss prompt (`--force-accept-warning` is ignored on 3.x, payloadcms/payload#19062).

The script creates `viewer@example.com` (the website template has no roles, so any logged-in user stands in for the least privileged role a project defines), builds a request for that user, and prints what `/api/access` would return, the collection's access functions called directly, and a `payload.find` with access enforced.

## Output

Default (Payload 3.92.1, unmodified):

```
payload-migrations (via getAccessResults, the /api/access endpoint):
{ "fields": true, "create": true, "read": true, "update": true, "delete": true }
payload-migrations access functions, called directly: { create: true, read: true, update: true, delete: true }
payload.find({ overrideAccess: false }) as viewer@example.com: 1 migration row(s) readable
```

With `MIGRATIONS_ACCESS=closed` (the proposed fix applied after sanitize):

```
payload-migrations (via getAccessResults, the /api/access endpoint):
undefined
payload-migrations access functions, called directly: { create: false, read: false, update: false, delete: false }
payload.find({ overrideAccess: false }) as viewer@example.com: You are not allowed to perform this action.
```

`migrate` and `migrate:status` still write and read the table in the `closed` variant (`20261029_164701_initial`, batch 1, Ran: Yes): the CLI goes through the Local API with `overrideAccess: true`, so access functions are never consulted.

## Proposed fix

In `migrationsCollection`:

```ts
access: {
  create: () => false,
  delete: () => false,
  read: () => false,
  update: () => false,
},
```
