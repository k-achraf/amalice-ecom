import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { join } from 'path'
import * as fs from 'fs'
import { AppModule } from './app.module'

async function bootstrap() {
  // rawBody: true — Nest still parses JSON into req.body as normal, but also
  // preserves the exact raw bytes on req.rawBody. Needed for the DHD webhook
  // (see fulfillment/webhooks.controller.ts): its HMAC signature is computed
  // over the raw request body, and re-serializing the already-parsed JSON
  // isn't guaranteed to byte-for-byte match what DHD actually signed (key
  // order/whitespace can differ), which would make every signature check
  // fail.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })
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
