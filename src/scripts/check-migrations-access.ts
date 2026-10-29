import config from '@payload-config'
import { createLocalReq, getAccessResults, getPayload } from 'payload'

const payload = await getPayload({ config })

// A least-privileged admin user. The website template has no roles, so any
// logged-in user stands in for "the lowest role a project defines".
const email = 'viewer@example.com'
let user = (await payload.find({ collection: 'users', where: { email: { equals: email } } })).docs[0]
if (!user) {
  user = await payload.create({ collection: 'users', data: { email, password: 'viewer-password', name: 'Viewer' } })
}

const req = await createLocalReq({ user: { ...user, collection: 'users' } as any }, payload)

// What GET /api/access returns for this user.
const results = await getAccessResults({ req })
const migrations = results.collections['payload-migrations']
console.log('payload-migrations (via getAccessResults, the /api/access endpoint):')
console.log(JSON.stringify(migrations, null, 2))

// The collection's sanitized access functions, called directly.
const collection = payload.config.collections.find((c) => c.slug === 'payload-migrations')!
const direct = Object.fromEntries(
  await Promise.all(
    (['create', 'read', 'update', 'delete'] as const).map(async (op) => [op, await collection.access[op]({ req })]),
  ),
)
console.log('payload-migrations access functions, called directly:', direct)

// A Local API read with access enforced, as this user.
try {
  const found = await payload.find({ collection: 'payload-migrations', overrideAccess: false, user })
  console.log(`payload.find({ overrideAccess: false }) as ${email}: ${found.totalDocs} migration row(s) readable`)
} catch (err) {
  console.log(`payload.find({ overrideAccess: false }) as ${email}: ${(err as Error).message}`)
}

process.exit(0)
