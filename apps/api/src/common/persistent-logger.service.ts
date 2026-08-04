import { ConsoleLogger, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

// Registered app-wide via main.ts's `app.useLogger()` — once set that way,
// NestJS routes every `new Logger(context).warn/error()` call anywhere in
// the codebase (every feature module already does this, e.g.
// `private readonly logger = new Logger(OrdersService.name)`) through this
// SAME instance, tagging the call's context automatically. Extending
// ConsoleLogger means stdout/PM2's own log files keep getting every line
// exactly as before — this only ADDS a DB copy of warn/error lines so ops
// staff can see them from the admin dashboard (see ServerLog's Prisma
// comment) without SSH access, not a replacement for the console output.
@Injectable()
export class PersistentLogger extends ConsoleLogger {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message, ...optionalParams)
    this.persist('Warn', message, optionalParams)
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams)
    this.persist('Error', message, optionalParams)
  }

  // Nest's per-instance Logger methods append `this.context` as the LAST
  // optionalParams entry; .error() calls that also pass a stack trace put
  // it as the FIRST optionalParams entry (i.e. `error(message, trace,
  // context)`). Best-effort parsing — this only feeds an admin log viewer,
  // not anything correctness-sensitive, so a misparsed edge case just shows
  // up as a slightly-off context/trace rather than breaking anything.
  private persist(level: 'Warn' | 'Error', message: unknown, optionalParams: unknown[]): void {
    const context = typeof optionalParams.at(-1) === 'string' ? (optionalParams.at(-1) as string) : null
    const traceCandidate = level === 'Error' && optionalParams.length > 1 ? optionalParams[0] : null
    const trace = typeof traceCandidate === 'string' ? traceCandidate : null

    // Fire-and-forget, and deliberately swallow any failure completely —
    // logging must never itself throw (that would recurse straight back
    // into this same method) or block whatever code path just logged.
    this.prisma.serverLog
      .create({
        data: {
          level,
          context,
          message: typeof message === 'string' ? message : JSON.stringify(message),
          trace
        }
      })
      .then(() => {
        // Cheap unbounded-growth guard with no scheduler/cron dependency —
        // a 1-in-50 chance per write to prune anything older than 30 days.
        // This isn't an audit trail (see ServerLog's Prisma comment), so
        // aging old rows out is fine.
        if (Math.random() < 0.02) {
          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          this.prisma.serverLog.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {})
        }
      })
      .catch(() => {})
  }
}
