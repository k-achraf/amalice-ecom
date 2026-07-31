import 'dotenv/config'
import * as bcrypt from 'bcrypt'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, AdminRoleName } from '../src/generated/prisma/client'

// One-off CLI for provisioning the very first admin account (or any
// account) outside the app itself — the /admin/users endpoint requires an
// existing SuperAdmin JWT to call it, which is a chicken-and-egg problem on
// a fresh production database that has no admins yet and was never seeded
// with the seed.ts dev fixtures (correctly so — see DEPLOYMENT.md's warning
// against running seed.ts in production).
//
// Usage: pnpm --filter api create-admin -- <email> <password> [role]
//   role defaults to SuperAdmin; must be one of AdminRoleName's values.
// Upserts by email, so rerunning with the same email just resets the
// password/role rather than failing on a duplicate.

async function main() {
  // pnpm forwards the "--" separator itself into argv on some versions
  // instead of stripping it, which would otherwise shift every arg over
  // one slot (email landing in the "--" position).
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const [email, password, roleArg] = args
  if (!email || !password) {
    console.error('Usage: pnpm --filter api create-admin -- <email> <password> [role]')
    console.error(`Roles: ${Object.values(AdminRoleName).join(', ')} (default: SuperAdmin)`)
    process.exit(1)
  }
  const roleName = (roleArg ?? 'SuperAdmin') as AdminRoleName
  if (!Object.values(AdminRoleName).includes(roleName)) {
    console.error(`Invalid role "${roleArg}". Must be one of: ${Object.values(AdminRoleName).join(', ')}`)
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  try {
    const role = await prisma.role.upsert({ where: { name: roleName }, update: {}, create: { name: roleName } })
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash, roleId: role.id, active: true },
      create: { email, passwordHash, roleId: role.id, active: true }
    })
    console.log(`✓ Admin account ready: ${user.email} (${roleName})`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
