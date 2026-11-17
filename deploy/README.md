# Deploy Learning Hub lên VPS

Hướng dẫn này dành cho tech lead hiện tại và các thế hệ sau. Làm theo thứ tự, mỗi bước có lệnh kiểm tra. Cài đặt lần đầu mất khoảng 1 giờ; sau đó mỗi lần merge vào `main` là tự deploy.

## Cách hoạt động

```
push / merge vào main
  → CI (.github/workflows/ci.yml): format, typecheck, test, build
  → Deploy (.github/workflows/deploy.yml):
      1. build 2 Docker image (api, web) → đẩy lên GHCR (ghcr.io/hcmute-dsc/…)
      2. SSH vào VPS → docker compose pull → chạy migration → khởi động lại
      3. kiểm tra https://learn.hcmute-dsc.io.vn còn trả lời

Trên VPS (/opt/learning-hub):
  reverse proxy có sẵn (Caddy/Nginx/Traefik, cổng 80/443, HTTPS)
    → 127.0.0.1:3100  web (Next.js)
                        → api:4000 (NestJS, chỉ trong mạng Docker)
                            → db:5432 (PostgreSQL 16, chỉ trong mạng Docker, dữ liệu ở volume)
```

- Mật khẩu và secret chỉ nằm trong `/opt/learning-hub/.env` trên VPS, không nằm trên GitHub.
- API và database không mở cổng ra ngoài. Web chỉ nghe ở `127.0.0.1`, nên chỉ reverse proxy trên VPS gọi được.
- Bước SSH chỉ chạy khi biến `DEPLOY_ENABLED` = `true`. Trước đó workflow chỉ build image.

## Cần chuẩn bị

| Thứ                                        | Ghi chú                     |
| ------------------------------------------ | --------------------------- |
| VPS Ubuntu 22.04/24.04                     | ≥ 2 GB RAM, ≥ 20 GB đĩa     |
| Quyền sửa DNS của `hcmute-dsc.io.vn`       | để tạo bản ghi `learn`      |
| Quyền admin repo `hcmute-dsc/learning-hub` | để thêm secret và biến      |
| Tài khoản GitHub của bạn                   | để tạo OAuth app production |

Trong các lệnh dưới, `VPS_IP` là IP của VPS, `you` là user bạn đang SSH vào.

---

## Bước 1. DNS

Ở nơi quản lý DNS của `hcmute-dsc.io.vn`, thêm bản ghi:

| Type | Name    | Value    |
| ---- | ------- | -------- |
| A    | `learn` | `VPS_IP` |

Kiểm tra (trên máy bạn, có thể phải chờ vài phút):

```bash
nslookup learn.hcmute-dsc.io.vn
```

Kết quả phải là `VPS_IP`.

## Bước 2. Cài Docker trên VPS

SSH vào VPS rồi kiểm tra Docker đã có chưa:

```bash
docker --version && docker compose version
```

Nếu chưa có, cài bản chính thức của Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Cần Docker Compose ≥ 2.20 (lệnh `docker compose`, không phải `docker-compose`).

## Bước 3. Tạo user `deploy`

GitHub Actions sẽ SSH vào VPS bằng user riêng này, không dùng `root` hay user của bạn.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo mkdir -p /opt/learning-hub/backups
sudo chown -R deploy:deploy /opt/learning-hub
```

> User trong nhóm `docker` có quyền gần bằng root trên VPS. Vì vậy chỉ dùng user này cho deploy, và chỉ đăng nhập bằng SSH key.

## Bước 4. Tạo SSH key cho GitHub Actions

Trên **máy của bạn** (không phải VPS):

```bash
ssh-keygen -t ed25519 -N "" -C "learning-hub-deploy" -f learning-hub-deploy
```

Lệnh tạo 2 file: `learning-hub-deploy` (khóa bí mật, cho GitHub) và `learning-hub-deploy.pub` (khóa công khai, cho VPS).

Đưa khóa công khai lên VPS:

```bash
# trên VPS
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy nano /home/deploy/.ssh/authorized_keys   # dán nội dung learning-hub-deploy.pub
sudo chmod 700 /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Kiểm tra từ máy bạn:

```bash
ssh -i learning-hub-deploy deploy@VPS_IP "docker ps"
```

Lấy "host key" của VPS (để GitHub chỉ nói chuyện với đúng VPS này):

```bash
ssh-keyscan -p 22 VPS_IP
```

Giữ lại kết quả, dùng ở Bước 7.

## Bước 5. Tạo GitHub OAuth app cho production

Không dùng lại OAuth app của localhost. Vào https://github.com/organizations/hcmute-dsc/settings/applications (hoặc Settings → Developer settings → OAuth Apps của bạn) → **New OAuth App**:

| Ô                          | Giá trị                                                      |
| -------------------------- | ------------------------------------------------------------ |
| Application name           | `DSC Learning Hub`                                           |
| Homepage URL               | `https://learn.hcmute-dsc.io.vn`                             |
| Authorization callback URL | `https://learn.hcmute-dsc.io.vn/api/v1/auth/github/callback` |

Tạo xong, bấm **Generate a new client secret**. Giữ lại Client ID và Client secret cho Bước 6.

## Bước 6. Tạo file `.env` trên VPS

```bash
# trên VPS
sudo -u deploy nano /opt/learning-hub/.env
```

Dán nội dung của [`deploy/.env.example`](.env.example) rồi sửa:

- `POSTGRES_PASSWORD`: tạo bằng `openssl rand -hex 24`. Thay **cả hai chỗ** `change-me` (dòng `POSTGRES_PASSWORD` và trong `DATABASE_URL`) bằng cùng một mật khẩu.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: từ Bước 5.
- `BOOTSTRAP_ADMIN_GITHUB_LOGIN`: login GitHub của tech lead.

Khóa quyền đọc:

```bash
sudo chmod 600 /opt/learning-hub/.env && sudo chown deploy:deploy /opt/learning-hub/.env
```

## Bước 7. Secret và biến trên GitHub

Repo `hcmute-dsc/learning-hub` → **Settings → Environments → New environment** tên `production`. Trong environment này, thêm **secrets**:

| Secret            | Giá trị                                                   |
| ----------------- | --------------------------------------------------------- |
| `VPS_HOST`        | `VPS_IP` (hoặc tên miền của VPS)                          |
| `VPS_USER`        | `deploy`                                                  |
| `VPS_PORT`        | cổng SSH, bỏ qua nếu là `22`                              |
| `VPS_SSH_KEY`     | toàn bộ nội dung file `learning-hub-deploy` (khóa bí mật) |
| `VPS_KNOWN_HOSTS` | kết quả `ssh-keyscan` ở Bước 4                            |

Sau đó xóa file `learning-hub-deploy` trên máy bạn (GitHub đã giữ nó).

Chưa bật biến `DEPLOY_ENABLED` vội; làm Bước 8 trước.

## Bước 8. Reverse proxy

VPS đã có reverse proxy trên cổng 80/443, nên chỉ cần thêm một "site" trỏ tới `127.0.0.1:3100`. Chọn file mẫu đúng loại:

- Caddy: [`proxy/Caddyfile.example`](proxy/Caddyfile.example)
- Nginx: [`proxy/nginx.conf.example`](proxy/nginx.conf.example) (HTTPS bằng `certbot --nginx`)
- Traefik: [`proxy/traefik-dynamic.yml.example`](proxy/traefik-dynamic.yml.example)

Nếu proxy chạy **trong Docker**, `127.0.0.1` là chính container proxy, nên phải dùng `host.docker.internal:3100` (xem ghi chú trong file mẫu).

Proxy phải gửi header `X-Forwarded-For` (cả 3 mẫu đều có): API giới hạn số request theo IP của từng thành viên.

## Bước 9. Deploy lần đầu

1. Repo → **Settings → Secrets and variables → Actions → Variables** → thêm `DEPLOY_ENABLED` = `true`.
2. **Actions → Deploy → Run workflow** (nhánh `main`).
3. Chờ job xanh. Job cuối gọi `https://learn.hcmute-dsc.io.vn` để kiểm tra.

Kiểm tra trên VPS:

```bash
cd /opt/learning-hub
docker compose -f docker-compose.prod.yml ps        # db, api, web: running (healthy); migrate: exited (0)
docker compose -f docker-compose.prod.yml logs --tail 50 api
```

## Bước 10. Đưa nội dung lên

Database production lúc đầu chưa có bài học. Đồng bộ và publish nội dung từ repo `learning-hub-content`:

```bash
cd /opt/learning-hub
docker compose -f docker-compose.prod.yml run --rm api node dist/cli/content-sync.js --publish
```

Rồi mở https://learn.hcmute-dsc.io.vn, đăng nhập bằng GitHub của tech lead (tự thành admin), vào **Quản trị** để thêm danh sách email thành viên.

## Bước 11. Sao lưu hằng ngày

```bash
sudo -u deploy crontab -e
```

Thêm dòng (2:30 sáng giờ UTC, giữ 14 ngày):

```
30 2 * * * /opt/learning-hub/backup.sh >> /opt/learning-hub/backups/backup.log 2>&1
```

Chạy thử ngay: `sudo -u deploy /opt/learning-hub/backup.sh`.

Bản sao lưu chỉ nằm trên VPS. Nên định kỳ chép về máy khác (ví dụ `scp deploy@VPS_IP:/opt/learning-hub/backups/*.sql.gz .`), vì hỏng VPS là mất cả hai.

---

## Việc thường ngày

| Việc                            | Cách làm                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| Deploy phiên bản mới            | Merge vào `main`. Xong.                                     |
| Deploy lại (sau khi sửa `.env`) | Actions → Deploy → Run workflow                             |
| Xem log                         | `docker compose -f docker-compose.prod.yml logs -f api web` |
| Cập nhật nội dung               | lệnh ở Bước 10 (hoặc trang quản trị nội dung khi có)        |
| Quay về phiên bản cũ            | xem dưới                                                    |
| Tạm tắt deploy tự động          | đổi biến `DEPLOY_ENABLED` thành `false`                     |

### Quay về phiên bản cũ

Mỗi image có tag là mã commit, và dòng `IMAGE_TAG=` trong `.env` cho biết phiên bản đang chạy. Cách đơn giản nhất: revert commit lỗi trên `main`; CI và Deploy tự chạy lại với code cũ.

Làm tay trên VPS (image cũ còn trên máy nếu chưa bị dọn; nếu không phải `docker login ghcr.io` bằng token có quyền `read:packages`):

```bash
cd /opt/learning-hub
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<mã commit 40 ký tự>/' .env
docker compose -f docker-compose.prod.yml up -d
```

Migration không tự quay ngược. Nếu phiên bản lỗi đã đổi database, khôi phục từ bản sao lưu.

### Khôi phục database từ bản sao lưu

```bash
cd /opt/learning-hub
docker compose -f docker-compose.prod.yml stop web api
docker compose -f docker-compose.prod.yml exec -T db psql -U hub -d postgres \
  -c "DROP DATABASE learning_hub WITH (FORCE);" -c "CREATE DATABASE learning_hub OWNER hub;"
gunzip -c backups/learning_hub-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U hub -d learning_hub
docker compose -f docker-compose.prod.yml up -d
```

## Lỗi thường gặp

| Hiện tượng                                                 | Nguyên nhân hay gặp                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Job "Copy compose file" báo `Host key verification failed` | `VPS_KNOWN_HOSTS` sai hoặc VPS được cài lại: chạy lại `ssh-keyscan`                                 |
| `Permission denied (publickey)`                            | khóa công khai chưa nằm trong `/home/deploy/.ssh/authorized_keys`, hoặc sai quyền file              |
| `migrate` thoát với lỗi                                    | xem `docker compose -f docker-compose.prod.yml logs migrate`; thường do `DATABASE_URL` sai mật khẩu |
| Trang báo 502 Bad Gateway                                  | web chưa chạy (`ps`), hoặc proxy chạy trong Docker mà vẫn trỏ `127.0.0.1`                           |
| Đăng nhập GitHub báo `redirect_uri` sai                    | Callback URL của OAuth app phải đúng `https://learn.hcmute-dsc.io.vn/api/v1/auth/github/callback`   |
| Đăng nhập xong vẫn bị đá ra                                | site phải chạy HTTPS: cookie `__Host-sid` chỉ dùng được qua HTTPS                                   |
| Lỗi 403 "Origin" khi bấm nút                               | `WEB_ORIGIN` trong `.env` phải đúng `https://learn.hcmute-dsc.io.vn` (không có `/` cuối)            |

## Bàn giao cho tech lead mới

1. Thêm SSH key của người mới vào user của họ trên VPS (không chia sẻ khóa `deploy`).
2. Chuyển quyền admin repo và org GitHub; chuyển quyền DNS nếu cần.
3. Chuyển OAuth app sang org hoặc tạo lại (đổi `GITHUB_CLIENT_*` trong `.env`, rồi chạy lại Deploy).
4. Tạo SSH key deploy mới (Bước 4, 7), xóa khóa cũ khỏi `authorized_keys`.
