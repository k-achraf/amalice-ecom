// Real SMS/WhatsApp wiring is SF-07/SF-12 — this interface is the seam that
// keeps "add a real provider" a new implementation, not a rewrite of
// OtpService or the controller.
export interface OtpProvider {
  send(phone: string, code: string): Promise<void>
}

export const OTP_PROVIDER = Symbol('OTP_PROVIDER')
