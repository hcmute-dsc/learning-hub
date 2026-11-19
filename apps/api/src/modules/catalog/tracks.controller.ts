import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  TRACK_DOC_PAGES,
  trackListQuerySchema,
  type TrackDocPage,
  type TrackListQuery,
} from '@hub/shared';
import { z } from 'zod';
import { ZodPipe } from '../../common/zod';
import { CatalogService } from './catalog.service';

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
const pageSchema = z.enum(TRACK_DOC_PAGES);

@ApiTags('catalog')
@Controller('tracks')
export class TracksController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query(new ZodPipe(trackListQuerySchema)) query: TrackListQuery) {
    return this.catalog.listTracks(query);
  }

  /** Declared before `:slug` so `/tracks/tags` is not read as a track slug. */
  @Get('tags')
  tags() {
    return this.catalog.listTags().then((data) => ({ data }));
  }

  @Get(':slug')
  get(@Param('slug', new ZodPipe(slugSchema)) slug: string) {
    return this.catalog.getTrack(slug).then((data) => ({ data }));
  }

  /** "Cài đặt" (setup) or "Tài liệu thêm" (resources) of a track (learning-hub#44). */
  @Get(':slug/docs/:page')
  doc(
    @Param('slug', new ZodPipe(slugSchema)) slug: string,
    @Param('page', new ZodPipe(pageSchema)) page: TrackDocPage,
  ) {
    return this.catalog.getTrackDoc(slug, page).then((data) => ({ data }));
  }
}
