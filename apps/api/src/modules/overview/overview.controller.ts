import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth.decorators';
import { OverviewService } from './overview.service';

/** Admin overview: counts for the /admin landing page (INFORMATION-ARCHITECTURE §9). */
@ApiTags('admin')
@Roles('admin')
@Controller('admin/overview')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  get() {
    return this.overview.get().then((data) => ({ data }));
  }
}
