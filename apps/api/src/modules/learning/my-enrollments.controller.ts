import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { EnrollmentService } from './enrollment.service';

/** The signed-in member's tracks with progress, for `/dashboard` (FRONTEND-DESIGN §3). */
@ApiTags('learning')
@Controller('me/enrollments')
export class MyEnrollmentsController {
  constructor(private readonly enrollments: EnrollmentService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.enrollments.listMine(user.id).then((data) => ({ data }));
  }
}
