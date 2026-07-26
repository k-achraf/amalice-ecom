import type { NotificationChannel } from '../generated/prisma/client'

// Real SMS/WhatsApp/email vendor wiring is a later task — this interface is
// the seam. Swapping providers means a new class + one binding change in
// notifications.module.ts, not touching NotificationsService or the
// processor.
export interface NotificationProvider {
  send(channel: NotificationChannel, recipient: string, message: string): Promise<void>
}

export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER')
