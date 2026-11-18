import type { NotificationSettings } from '@hub/shared';

/** The line under the "Email tóm tắt" switch: what it does, or why it cannot be turned on. */
export function digestHint(settings: NotificationSettings): string {
  if (!settings.emailAvailable) {
    return 'Learning Hub chưa được cấu hình gửi email, nên tạm thời chưa bật được.';
  }
  if (!settings.hasEmail) {
    return 'Tài khoản GitHub của bạn chưa có email công khai hoặc đã xác minh để nhận thư.';
  }
  return 'Khoảng 8 giờ sáng, gửi một email liệt kê thông báo chưa đọc. Không có gì mới thì không gửi.';
}
