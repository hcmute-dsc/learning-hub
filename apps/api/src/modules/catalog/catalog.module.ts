import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { TracksController } from './tracks.controller';

@Module({
  controllers: [TracksController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
