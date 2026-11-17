import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { existsSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { DomainError } from '../../common/errors';
import { ENV, type Env } from '../../infrastructure/config/env';

/** Only images: lessons point at diagrams and screenshots, nothing else is served. */
const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * Development only: serves images from the local content folder (CONTENT_SOURCE=local).
 *
 * With GitHub content the web app loads images from raw.githubusercontent.com at the
 * published commit. A local folder has no such URL, so without this endpoint every
 * diagram in a lesson showed as a broken image (bug reported 17/11/2026).
 * Answers 404 when CONTENT_SOURCE is not "local", so it does nothing in production.
 *
 * The web side builds these URLs in apps/web/src/components/markdown/content-url.ts.
 */
@ApiExcludeController()
@Controller('local-content')
export class LocalContentFilesController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get('*')
  serve(@Req() req: Request, @Res() res: Response): void {
    if (this.env.CONTENT_SOURCE !== 'local') throw DomainError.notFound('Content file');

    // Express 4: the part matched by "*" is params[0], already URL-decoded.
    const wanted = (req.params as Record<string, string>)[0] ?? '';
    const type = IMAGE_TYPES[extname(wanted).toLowerCase()];
    const root = resolve(this.env.CONTENT_LOCAL_DIR);
    const file = resolve(root, wanted);
    // SECURITY: never leave the content folder ("..", absolute paths, other drives).
    const inside = relative(root, file);
    const escapes =
      inside === '' || isAbsolute(inside) || inside.split(sep).some((part) => part === '..');
    if (!type || escapes || !existsSync(file) || !statSync(file).isFile()) {
      throw DomainError.notFound('Content file');
    }

    res.setHeader('Content-Type', type);
    // SVG can carry scripts: the browser must treat it as a plain image document.
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(file);
  }
}
