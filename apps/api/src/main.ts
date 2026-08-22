import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { join } from 'path'
import * as fs from 'fs'
import * as dns from 'dns'
import { AppModule } from './app.module'
import { PersistentLogger } from './common/persistent-logger.service'

// Node's fetch (undici) races IPv4 and IPv6 for a dual-stack host and uses
// whichever connects first ("Happy Eyeballs") — normally harmless, but
// Gemini's API (generativelanguage.googleapis.com, used by the landing-page
// builder and AI content features) geolocates the CALLING request's IP and
// rejects unsupported regions. Plenty of VPS providers hand out an IPv6
// address whose GeoIP data is stale/wrong even though the same box's IPv4
// address geolocates correctly — so the exact same server, same API key,
// can intermittently get "User location is not supported" depending on
// which address won that race for a given connection. Forcing IPv4-first
// resolution process-wide removes that non-determinism; it's Node's own
// documented flag for this class of problem (equivalent to the CLI's
// --dns-result-order=ipv4first) and has no downside for a server that has
// no reason to prefer IPv6 for outbound calls.
dns.setDefaultResultOrder('ipv4first')

async function bootstrap() {
  // rawBody: true — Nest still parses JSON into req.body as normal, but also
  // preserves the exact raw bytes on req.rawBody. Needed for the DHD webhook
  // (see fulfillment/webhooks.controller.ts): its HMAC signature is computed
  // over the raw request body, and re-serializing the already-parsed JSON
  // isn't guaranteed to byte-for-byte match what DHD actually signed (key
  // order/whitespace can differ), which would make every signature check
  // fail.
  // bufferLogs: true — hold Nest's own bootstrap log lines in memory instead
  // of dropping them, until app.useLogger() below swaps in PersistentLogger.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bufferLogs: true })
  // Every `new Logger(context).warn/error()` call anywhere in the codebase
  // routes through this same instance once set here — see
  // PersistentLogger's own comment for why (persists warn/error to
  // ServerLog for the admin dashboard's Server Logs page, on top of the
  // normal console/PM2 output).
  app.useLogger(app.get(PersistentLogger))
  app.enableCors({
    origin: ['https://amalice.shop', 'https://www.amalice.shop', 'https://admin.amalice.shop'],
    credentials: true
  })

  // Ensure the uploads directory exists, then serve it statically at /uploads.
  // Product images uploaded by the admin (file picker or URL download) land here.
  const uploadsDir = join(process.cwd(), 'uploads')
  fs.mkdirSync(uploadsDir, { recursive: true })
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' })

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Amalice API')
      .setDescription('COD commerce platform — catalog, orders, fulfillment, reconciliation, identity, notifications')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('docs', app, document)
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3333
  await app.listen(port)
  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap')
  if (process.env.NODE_ENV !== 'production') {
    Logger.log(`OpenAPI docs at http://localhost:${port}/docs`, 'Bootstrap')
  }
}

bootstrap()
