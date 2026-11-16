import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogWriter } from './catalog.writer';
import { TracksController } from './tracks.controller';

@Module({
  controllers: [TracksController],
  providers: [CatalogService, CatalogWriter],
  exports: [CatalogService, CatalogWriter],
})
export class CatalogModule {}
