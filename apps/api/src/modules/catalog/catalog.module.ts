import { Module } from '@nestjs/common';
import { CatalogReader } from './catalog.reader';
import { CatalogService } from './catalog.service';
import { CatalogWriter } from './catalog.writer';
import { TracksController } from './tracks.controller';

@Module({
  controllers: [TracksController],
  providers: [CatalogService, CatalogReader, CatalogWriter],
  exports: [CatalogService, CatalogReader, CatalogWriter],
})
export class CatalogModule {}
