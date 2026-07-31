import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import { diskStorage } from 'multer'
import { join, extname } from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'

// Image upload — two modes:
// 1. POST /admin/upload (multipart/form-data) — user picks a file from their computer
// 2. POST /admin/upload-from-url — user pastes a URL, the server downloads it
// Both return { url } pointing at the locally-served /uploads/ path.
// The admin then passes that URL to the existing POST /admin/products/:id/images.

const UPLOADS_DIR = join(process.cwd(), 'uploads')
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif']
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov']
const ALLOWED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]
// Videos are far larger than product photos — the 10 MB image cap would reject
// almost any real clip, so the multer file-size limit is sized for video and
// images just come in well under it.
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_URL_DOWNLOAD = 50 * 1024 * 1024 // 50 MB

@ApiTags('upload')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'OpsManager')
export class UploadController {
  private readonly logger = new Logger(UploadController.name)

  // File upload via multipart/form-data (field name: "file")
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true })
          cb(null, UPLOADS_DIR)
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase()
          if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return cb(new BadRequestException(`File type ${ext} not allowed. Use: ${ALLOWED_EXTENSIONS.join(', ')}`), '')
          }
          const safeName = `${crypto.randomUUID()}${ext}`
          cb(null, safeName)
        }
      }),
      limits: { fileSize: MAX_UPLOAD_SIZE }
    })
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded')
    const url = `/uploads/${file.filename}`
    this.logger.log(`File uploaded: ${file.originalname} → ${url} (${file.size} bytes)`)
    return { url, filename: file.filename, size: file.size }
  }

  // Download a remote image URL to our server
  @Post('upload-from-url')
  async uploadFromUrl(@Body() body: { url: string }) {
    if (!body.url) throw new BadRequestException('URL is required')

    // Validate it's a real URL
    try {
      new URL(body.url)
    } catch {
      throw new BadRequestException('Invalid URL')
    }

    // Fetch the image
    const response = await fetch(body.url, {
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new BadRequestException(`Failed to download: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      throw new BadRequestException(`URL is not an image or video (content-type: ${contentType})`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_URL_DOWNLOAD) {
      throw new BadRequestException(`File too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB, max ${MAX_URL_DOWNLOAD / 1024 / 1024} MB)`)
    }

    // Determine extension from content-type
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'image/avif': '.avif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov'
    }
    const ext = extMap[contentType] ?? (contentType.startsWith('video/') ? '.mp4' : '.jpg')
    const filename = `${crypto.randomUUID()}${ext}`

    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
    fs.writeFileSync(join(UPLOADS_DIR, filename), buffer)

    const url = `/uploads/${filename}`
    this.logger.log(`Image downloaded from ${body.url} → ${url} (${buffer.length} bytes)`)
    return { url, filename, size: buffer.length }
  }
}
