import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  notificationSettingsUpdateSchema,
  unsubscribeSchema,
  type NotificationSettingsUpdate,
  type UnsubscribeInput,
} from '@hub/shared';
import { AuthUser, CurrentUser, Public } from '../../../common/auth.decorators';
import { ZodPipe } from '../../../common/zod';
import { DigestService } from '../digest/digest.service';
import { InboxService } from './inbox.service';

/** The signed-in member's bell and email-digest choice (learning-hub#49). */
@ApiTags('me')
@Controller('me/notifications')
export class InboxController {
  constructor(
    private readonly inbox: InboxService,
    private readonly digest: DigestService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.inbox.list(user.id);
  }

  /** Small answer for the header badge, which asks on every page view. */
  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.inbox.unreadCount(user.id).then((count) => ({ data: { count } }));
  }

  @Post('read-all')
  @HttpCode(204)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.inbox.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(204)
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.inbox.markRead(user.id, id);
  }

  @Get('settings')
  settings(@CurrentUser() user: AuthUser) {
    return this.digest.settings(user.id).then((data) => ({ data }));
  }

  @Put('settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(notificationSettingsUpdateSchema)) body: NotificationSettingsUpdate,
  ) {
    return this.digest.updateSettings(user.id, body.emailDigest).then((data) => ({ data }));
  }
}

/**
 * "Tắt email tóm tắt" link from the digest. Public because the member may not be signed
 * in on that device; the 256-bit token in the link is the credential. The web page
 * /unsubscribe asks for a click first, so mail scanners that open links change nothing.
 */
@ApiTags('notifications')
@Controller('notifications')
export class UnsubscribeController {
  constructor(private readonly digest: DigestService) {}

  @Post('unsubscribe')
  @Public()
  @HttpCode(204)
  unsubscribe(@Body(new ZodPipe(unsubscribeSchema)) body: UnsubscribeInput) {
    return this.digest.unsubscribe(body.token);
  }
}
