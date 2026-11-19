import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  certificateRevokeSchema,
  certificateVisibilitySchema,
  type CertificateRevokeInput,
  type CertificateVisibilityInput,
} from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { CertificatesService } from './certificates.service';

/** A code is at most 24 characters; a longer value is rejected before any work. */
const codePipe = new ZodPipe(z.string().max(64));

/** Same rule as MembersController (GitHub login). */
const loginPipe = new ZodPipe(
  z
    .string()
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/)
    .max(39),
);

/**
 * Public verification link (PRD F19): anyone with the code, no sign-in. Shows the
 * name, track, dates and content commit only (CertificateView, never an email).
 */
@ApiTags('certificates')
@Controller('certificates')
export class PublicCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get(':code')
  @Public()
  verify(@Param('code', codePipe) code: string) {
    return this.certificates.verify(code).then((data) => ({ data }));
  }
}

/** The member's own certificates (/settings) and hiding one from the profile. */
@ApiTags('certificates')
@Controller('me/certificates')
export class MyCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.certificates.listMine(user.id).then((data) => ({ data }));
  }

  @Patch(':code')
  setVisibility(
    @CurrentUser() user: AuthUser,
    @Param('code', codePipe) code: string,
    @Body(new ZodPipe(certificateVisibilitySchema)) body: CertificateVisibilityInput,
  ) {
    return this.certificates.setHidden(user.id, code, body.hidden).then((data) => ({ data }));
  }
}

/** Certificates on a member profile (/u/:login), signed-in approved members only. */
@ApiTags('certificates')
@Controller('members/:login/certificates')
export class MemberCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  list(@CurrentUser() viewer: AuthUser, @Param('login', loginPipe) login: string) {
    return this.certificates.forProfile(viewer.id, login).then((data) => ({ data }));
  }
}

/** Admin list and revoke (audited). */
@ApiTags('admin')
@Controller('admin/certificates')
export class AdminCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @Roles('admin')
  list() {
    return this.certificates.listForAdmin().then((data) => ({ data }));
  }

  @Post(':code/revoke')
  @Roles('admin')
  revoke(
    @CurrentUser() actor: AuthUser,
    @Param('code', codePipe) code: string,
    @Body(new ZodPipe(certificateRevokeSchema)) body: CertificateRevokeInput,
  ) {
    return this.certificates.revoke(actor.id, code, body.reason).then((data) => ({ data }));
  }
}
