import { Module } from '@nestjs/common';
import { ContentSourceModule } from '../../integrations/content-source.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [CatalogModule, ContentSourceModule],
  controllers: [AdminContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
