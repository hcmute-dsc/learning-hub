import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { trackListQuerySchema, type TrackListQuery } from '@hub/shared';
import { z } from 'zod';
import { ZodPipe } from '../../common/zod';
import { CatalogService } from './catalog.service';

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);

@ApiTags('catalog')
@Controller('tracks')
export class TracksController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query(new ZodPipe(trackListQuerySchema)) query: TrackListQuery) {
    return this.catalog.listTracks(query);
  }

  @Get(':slug')
  get(@Param('slug', new ZodPipe(slugSchema)) slug: string) {
    return this.catalog.getTrack(slug).then((data) => ({ data }));
  }
}
