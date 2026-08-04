import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { GoogleSheetsService } from './google-sheets.service'

// Runs the repeatable 'poll' job GoogleSheetsService schedules on boot (see
// its onModuleInit) — pulls manual edits made directly in a connected sheet
// back into the DB. See GoogleSheetsService.pollAllSheets for the actual
// reconciliation logic; this processor is just the BullMQ entry point.
@Processor('google-sheets-sync')
export class GoogleSheetsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(GoogleSheetsSyncProcessor.name)

  constructor(private readonly googleSheets: GoogleSheetsService) {
    super()
  }

  async process(_job: Job): Promise<void> {
    try {
      await this.googleSheets.pollAllSheets()
    } catch (error) {
      // Don't rethrow — this is a repeatable job, not a one-off with a
      // meaningful retry/backoff; a failed cycle should just wait for the
      // next scheduled tick rather than pile up BullMQ retry attempts.
      this.logger.warn(`Google Sheets poll cycle failed: ${(error as Error).message}`)
    }
  }
}
