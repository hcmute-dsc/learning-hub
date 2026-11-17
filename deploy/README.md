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

Người dùng → Cloudflare → Traefik trên VPS (container `traefik`, mạng `edge`, HTTPS)
  → web (Next.js, nằm trong mạng `edge` và mạng riêng của Learning Hub)
      → learning-hub-api:4000 (NestJS, chỉ trong mạng riêng; tên riêng để không trùng site khác trên `edge`)
          → db:5432 (PostgreSQL 16, chỉ trong mạng riêng, dữ liệu ở volume)
```

- VPS của CLB đã có Traefik dùng chung cho nhiều site. Traefik tự nhận Learning Hub qua các `labels` của container `web` trong [`docker-compose.prod.yml`](docker-compose.prod.yml) và tự lấy chứng chỉ HTTPS (Let's Encrypt qua Cloudflare). Không cần sửa cấu hình Traefik.
- Mật khẩu và secret chỉ nằm trong `/opt/learning-hub/.env` trên VPS, không nằm trên GitHub.
- Không mở cổng nào trên VPS. API và database không nằm trong mạng `edge`, nên các site khác trên VPS không gọi được.
- Bước SSH chỉ chạy khi biến `DEPLOY_ENABLED` = `true`. Trước đó workflow chỉ build image.

## Cần chuẩn bị

| Thứ                                                  | Ghi chú                                       |
| ---------------------------------------------------- | --------------------------------------------- |
| VPS Ubuntu 22.04/24.04                               | ≥ 2 GB RAM, ≥ 20 GB đĩa, có Docker và Traefik |
| Quyền sửa DNS của `hcmute-dsc.io.vn` trên Cloudflare | để tạo bản ghi `learn`                        |
| Quyền admin repo `hcmute-dsc/learning-hub`           | để thêm secret và biến                        |
| Tài khoản GitHub của bạn                             | để tạo OAuth app production                   |

Trong các lệnh dưới, `VPS_IP` là IP của VPS, `you` là user bạn đang SSH vào.

---

## Bước 1. DNS

Cloudflare → zone `hcmute-dsc.io.vn` → **DNS → Records → Add record**:

| Type | Name    | IPv4 address | Proxy status          |
| ---- | ------- | ------------ | --------------------- |
| A    | `learn` | `VPS_IP`     | Proxied (đám mây cam) |

Làm giống bản ghi `club-day` đã có. Nếu chọn **DNS only** (đám mây xám) thì đặt `TRUST_PROXY_HOPS=1` ở Bước 6.

Kiểm tra (trên máy bạn, có thể phải chờ vài phút):

```bash
nslookup learn.hcmute-dsc.io.vn
```

Có kết quả là được (với Proxied, IP trả về là IP của Cloudflare, không phải `VPS_IP`).

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

## Bước 3. Tạo user `learnhub`

GitHub Actions sẽ SSH vào VPS bằng user riêng này, không dùng `root` hay user của bạn.

```bash
sudo adduser --disabled-password --gecos "" learnhub
sudo usermod -aG docker learnhub
sudo mkdir -p /opt/learning-hub/backups
sudo chown -R learnhub:learnhub /opt/learning-hub
```

> User trong nhóm `docker` có quyền gần bằng root trên VPS. Vì vậy chỉ dùng user này cho deploy, và chỉ đăng nhập bằng SSH key.

## Bước 4. Tạo SSH key cho GitHub Actions

Trên **máy của bạn** (không phải VPS):

```bash
ssh-keygen -t ed25519 -N "" -C "learning-hub-deploy" -f learning-hub-deploy
```

Lệnh tạo 2 file: `learning-hub-deploy` (khóa bí mật, cho GitHub) và `learning-hub-deploy.pub` (khóa công khai, cho VPS).

> **Trên Windows (PowerShell):** chạy trong thư mục `$HOME\.ssh` (không chạy trong thư mục repo nào) và bỏ `-N ""`, rồi bấm Enter 2 lần khi được hỏi passphrase:
>
> ```powershell
> cd $HOME\.ssh
> ssh-keygen -t ed25519 -C "learning-hub-deploy" -f learning-hub-deploy
> ```
>
> Lý do: PowerShell truyền `-N '""'` thành passphrase là 2 dấu ngoặc kép, nên khóa có passphrase và GitHub Actions không dùng được (triệu chứng: `ssh -v` báo `Server accepts key` rồi vẫn `Permission denied`). Nếu Windows báo `UNPROTECTED PRIVATE KEY FILE`, chỉ để tài khoản của bạn có quyền đọc: `icacls KEY /inheritance:r /grant:r "$(whoami):F"`. Dùng `whoami` (dạng `MÁY\user`), vì khi máy và user trùng tên, chỉ ghi tên user sẽ cấp quyền nhầm cho máy.

Đưa khóa công khai lên VPS:

```bash
# trên VPS
sudo -u learnhub mkdir -p /home/learnhub/.ssh
sudo -u learnhub nano /home/learnhub/.ssh/authorized_keys   # dán nội dung learning-hub-deploy.pub
sudo chmod 700 /home/learnhub/.ssh && sudo chmod 600 /home/learnhub/.ssh/authorized_keys
```

Kiểm tra từ máy bạn:

```bash
ssh -i learning-hub-deploy learnhub@VPS_IP "docker ps"
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
sudo -u learnhub nano /opt/learning-hub/.env
```

Dán nội dung của [`deploy/.env.example`](.env.example) rồi sửa:

- `POSTGRES_PASSWORD`: tạo bằng `openssl rand -hex 24`. Thay **cả hai chỗ** `change-me` (dòng `POSTGRES_PASSWORD` và trong `DATABASE_URL`) bằng cùng một mật khẩu.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: từ Bước 5.
- `BOOTSTRAP_ADMIN_GITHUB_LOGIN`: login GitHub của tech lead.
- `TRUST_PROXY_HOPS`: `2` nếu bản ghi DNS là Proxied (đám mây cam), `1` nếu DNS only.

Khóa quyền đọc:

```bash
sudo chmod 600 /opt/learning-hub/.env && sudo chown learnhub:learnhub /opt/learning-hub/.env
```

## Bước 7. Secret và biến trên GitHub

Repo `hcmute-dsc/learning-hub` → **Settings → Environments → New environment** tên `production`. Trong environment này, thêm **secrets**:

| Secret            | Giá trị                                                   |
| ----------------- | --------------------------------------------------------- |
| `VPS_HOST`        | `VPS_IP` (hoặc tên miền của VPS)                          |
| `VPS_USER`        | `learnhub`                                                |
| `VPS_PORT`        | cổng SSH, bỏ qua nếu là `22`                              |
| `VPS_SSH_KEY`     | toàn bộ nội dung file `learning-hub-deploy` (khóa bí mật) |
| `VPS_KNOWN_HOSTS` | kết quả `ssh-keyscan` ở Bước 4                            |

Sau đó xóa file `learning-hub-deploy` trên máy bạn (GitHub đã giữ nó).

Chưa bật biến `DEPLOY_ENABLED` vội; làm Bước 8 trước.

## Bước 8. Kiểm tra Traefik

Không cần sửa gì ở Traefik. Chỉ kiểm tra mạng `edge` có tồn tại (container `web` sẽ gia nhập mạng này):

```bash
docker network ls --filter name=^edge$
```

Phải thấy một dòng `edge`. Các tên Learning Hub dùng (mạng `edge`, entry point `websecure`, cert resolver `letsencrypt`) khớp với cấu hình Traefik hiện tại của VPS; nếu sau này Traefik đổi tên, sửa các `labels` trong `docker-compose.prod.yml`.

> VPS không có Traefik? Xóa `labels` và mạng `edge` của service `web`, thêm `ports: ['127.0.0.1:3100:3000']`, rồi trỏ reverse proxy tới đó: mẫu cho [Caddy](proxy/Caddyfile.example) và [Nginx](proxy/nginx.conf.example).

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
sudo -u learnhub crontab -e
```

Thêm dòng (2:30 sáng giờ UTC, giữ 14 ngày):

```
30 2 * * * /opt/learning-hub/backup.sh >> /opt/learning-hub/backups/backup.log 2>&1
```

Chạy thử ngay: `sudo -u learnhub /opt/learning-hub/backup.sh`.

Bản sao lưu chỉ nằm trên VPS. Nên định kỳ chép về máy khác (ví dụ `scp learnhub@VPS_IP:/opt/learning-hub/backups/*.sql.gz .`), vì hỏng VPS là mất cả hai.

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

| Hiện tượng                                                 | Nguyên nhân hay gặp                                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Job "Copy compose file" báo `Host key verification failed` | `VPS_KNOWN_HOSTS` sai hoặc VPS được cài lại: chạy lại `ssh-keyscan`                                         |
| `Permission denied (publickey)`                            | khóa công khai chưa nằm trong `/home/learnhub/.ssh/authorized_keys`, hoặc sai quyền file                    |
| `migrate` thoát với lỗi                                    | xem `docker compose -f docker-compose.prod.yml logs migrate`; thường do `DATABASE_URL` sai mật khẩu         |
| Trang báo 404 hoặc bị chuyển về trang khác                 | Traefik chưa thấy container `web`: kiểm tra `ps` (web healthy?) và `docker logs traefik --tail 50`          |
| Trang báo 502/504                                          | web chưa sẵn sàng, hoặc `web` không nằm trong mạng `edge` (`docker inspect learning-hub-web-1`)             |
| Chứng chỉ HTTPS lỗi                                        | xem `docker logs traefik` (dòng `acme`); token Cloudflare của Traefik phải có quyền zone `hcmute-dsc.io.vn` |
| Mọi thành viên bị báo "quá nhiều request" cùng lúc         | `TRUST_PROXY_HOPS` sai: `2` khi Cloudflare Proxied, `1` khi DNS only                                        |
| Đăng nhập GitHub báo `redirect_uri` sai                    | Callback URL của OAuth app phải đúng `https://learn.hcmute-dsc.io.vn/api/v1/auth/github/callback`           |
| Đăng nhập xong vẫn bị đá ra                                | site phải chạy HTTPS: cookie `__Host-sid` chỉ dùng được qua HTTPS                                           |
| Lỗi 403 "Origin" khi bấm nút                               | `WEB_ORIGIN` trong `.env` phải đúng `https://learn.hcmute-dsc.io.vn` (không có `/` cuối)                    |

## Bàn giao cho tech lead mới

1. Thêm SSH key của người mới vào user của họ trên VPS (không chia sẻ khóa của `learnhub`).
2. Chuyển quyền admin repo và org GitHub; chuyển quyền DNS nếu cần.
3. Chuyển OAuth app sang org hoặc tạo lại (đổi `GITHUB_CLIENT_*` trong `.env`, rồi chạy lại Deploy).
4. Tạo SSH key deploy mới (Bước 4, 7), xóa khóa cũ khỏi `authorized_keys`.
