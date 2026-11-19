# Deploy Learning Hub lên VPS

Hướng dẫn này dành cho tech lead hiện tại và các thế hệ sau. Làm theo thứ tự, mỗi bước có lệnh kiểm tra. Cài đặt lần đầu mất khoảng 1 giờ; sau đó mỗi lần merge vào `main` là tự deploy.

> Bản tổng quan cho bàn giao (hiện trạng, lỗi đã gặp) nằm ở [`learning-hub-docs/docs/ops/DEPLOYMENT.md`](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/ops/DEPLOYMENT.md). Đổi cách deploy thì sửa cả hai.

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

| Thứ                                                                  | Ghi chú                                                                                                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| VPS Ubuntu 22.04/24.04                                               | ≥ 2 GB RAM, ≥ 20 GB đĩa, có Docker và Traefik                                                                                                  |
| Quyền sửa DNS của `hcmute-dsc.io.vn` trên Cloudflare                 | để tạo bản ghi `learn`                                                                                                                         |
| Quyền admin repo `hcmute-dsc/learning-hub`                           | để thêm secret và biến                                                                                                                         |
| Tài khoản GitHub của bạn                                             | để tạo OAuth app production                                                                                                                    |
| GitHub CLI `gh` trên máy bạn, quyền `repo,workflow,read:org,project` | để đặt secret, chạy Deploy; cách cài và lỗi hay gặp: [GH-CLI.md](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/ops/GH-CLI.md) |

Trong các lệnh dưới, `VPS_IP` là IP của VPS, `you` là user bạn đang SSH vào. Đây là chữ giữ chỗ: **thay bằng giá trị thật** trước khi chạy (lỗi `Could not resolve hostname vps_ip` là do quên thay).

> IP thật của VPS không ghi trong repo này (repo public, còn Cloudflare Proxied đang giấu IP đó). Hỏi tech lead hiện tại, hoặc xem bản ghi `learn` trên Cloudflare. GitHub chỉ giữ IP trong secret `VPS_HOST`, và secret thì không đọc lại được.

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

GitHub Actions sẽ SSH vào VPS bằng user riêng này, không dùng `root` hay user của bạn. Các lệnh dưới chạy bằng user có `sudo` của bạn trên VPS (`ssh you@VPS_IP`).

```bash
sudo adduser --disabled-password --gecos "" learnhub
sudo usermod -aG docker learnhub
sudo mkdir -p /opt/learning-hub/backups
sudo chown -R learnhub:learnhub /opt/learning-hub
```

> User trong nhóm `docker` có quyền gần bằng root trên VPS. Vì vậy chỉ dùng user này cho deploy, và chỉ đăng nhập bằng SSH key.

Kiểm tra:

```bash
id learnhub                          # phải có nhóm docker
ls -ld /opt/learning-hub             # chủ sở hữu learnhub
```

`learnhub` không có `sudo`. Khi đã SSH bằng `learnhub`, sửa file trong `/opt/learning-hub` bằng `nano` trực tiếp, không cần `sudo`.

## Bước 4. Tạo SSH key cho GitHub Actions

Trên **máy của bạn** (không phải VPS), trong thư mục `~/.ssh`. **Không tạo trong thư mục repo nào**, vì lỡ commit là lộ khóa:

```bash
cd ~/.ssh
ssh-keygen -t ed25519 -N "" -C "learning-hub-deploy" -f learning-hub-deploy
```

Khóa này không có passphrase, vì GitHub Actions không gõ passphrase được.

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
ssh -i ~/.ssh/learning-hub-deploy learnhub@VPS_IP "docker ps"
```

Thấy danh sách container (có thể rỗng) là được. Nếu lỗi, chạy lại với `ssh -v` và xem bảng [Lỗi thường gặp](#lỗi-thường-gặp).

Cho tiện, có thể thêm vào `~/.ssh/config` trên máy bạn để sau này chỉ gõ `ssh learnhub`:

```
Host learnhub
  HostName VPS_IP
  User learnhub
  IdentityFile ~/.ssh/learning-hub-deploy
  IdentitiesOnly yes
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

**Cách nhanh bằng `gh` CLI** (chạy trên máy bạn, trong `~/.ssh`; nội dung khóa đi thẳng từ file lên GitHub, không qua clipboard hay chat):

```bash
gh api -X PUT repos/hcmute-dsc/learning-hub/environments/production   # tạo environment
gh secret set VPS_HOST --env production --repo hcmute-dsc/learning-hub --body "VPS_IP"
gh secret set VPS_USER --env production --repo hcmute-dsc/learning-hub --body "learnhub"
gh secret set VPS_SSH_KEY --env production --repo hcmute-dsc/learning-hub < learning-hub-deploy
ssh-keyscan -p 22 VPS_IP | gh secret set VPS_KNOWN_HOSTS --env production --repo hcmute-dsc/learning-hub
gh secret list --env production --repo hcmute-dsc/learning-hub        # phải thấy 4 secret
```

Khóa bí mật `learning-hub-deploy` trên máy bạn: GitHub đã giữ một bản. Nếu bạn cần SSH quản trị bằng user `learnhub` (sửa `.env`, xem log) thì giữ lại trên máy riêng của mình. Nếu không thì xóa. Không gửi khóa này cho ai: người mới tạo khóa của họ (xem [Bàn giao](#bàn-giao-cho-tech-lead-mới)).

Chưa bật biến `DEPLOY_ENABLED` vội; làm Bước 8 trước.

## Bước 8. Kiểm tra Traefik

Không cần sửa gì ở Traefik. Chỉ kiểm tra mạng `edge` có tồn tại (container `web` sẽ gia nhập mạng này):

```bash
docker network ls --filter name=^edge$
```

Phải thấy một dòng `edge`. Các tên Learning Hub dùng (mạng `edge`, entry point `websecure`, cert resolver `letsencrypt`) khớp với cấu hình Traefik hiện tại của VPS; nếu sau này Traefik đổi tên, sửa các `labels` trong `docker-compose.prod.yml`.

> VPS không có Traefik? Xóa `labels` và mạng `edge` của service `web`, thêm `ports: ['127.0.0.1:3100:3000']`, rồi trỏ reverse proxy tới đó: mẫu cho [Caddy](proxy/Caddyfile.example) và [Nginx](proxy/nginx.conf.example).

## Bước 9. Deploy lần đầu

1. Repo → **Settings → Secrets and variables → Actions → Variables** → thêm `DEPLOY_ENABLED` = `true` (hoặc `gh variable set DEPLOY_ENABLED --repo hcmute-dsc/learning-hub --body true`).
2. **Actions → Deploy → Run workflow** (nhánh `main`), hoặc `gh workflow run deploy.yml --repo hcmute-dsc/learning-hub --ref main`.
3. Chờ job xanh (`gh run watch`). Job cuối gọi `https://learn.hcmute-dsc.io.vn` để kiểm tra.

**Workflow Deploy làm gì** ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)):

| Bước                    | Chi tiết                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khi nào chạy            | sau khi CI xanh trên `main` (`workflow_run`), hoặc bấm tay. Hai lần deploy không bao giờ chạy cùng lúc.                                                                                             |
| `images` (api, web)     | build Docker image, đẩy lên GHCR với 2 tag: mã commit và `latest`. Dùng `GITHUB_TOKEN`, không cần secret riêng.                                                                                     |
| `deploy` → Set up SSH   | ghi `VPS_SSH_KEY` và `VPS_KNOWN_HOSTS` ra file tạm trên máy chạy job. Host key được ghim, nên job từ chối nói chuyện với máy không phải VPS của mình.                                               |
| Copy compose file       | `scp` file `docker-compose.prod.yml` và `backup.sh` vào `/opt/learning-hub/`. Vì vậy **đừng sửa 2 file này trên VPS**, sửa trong repo.                                                              |
| Pull images and restart | đăng nhập GHCR bằng token chỉ sống trong job, ghi `IMAGE_TAG=<commit>` vào `.env`, `pull`, đăng xuất, `up -d --wait` (chạy migration trước api), rồi xóa image Learning Hub cũ để VPS khỏi đầy đĩa. |
| Check the site answers  | gọi trang chủ tối đa 10 lần, không trả lời thì job đỏ.                                                                                                                                              |

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

Nguồn nội dung là biến `CONTENT_SOURCE` trong `.env`:

- `github`: đọc thẳng các thư mục `tracks/` trong `CONTENT_REPO`.
- `registry`: `CONTENT_REPO` (`learning-hub-content`) chỉ chứa `tracks.yaml`. Mỗi track nằm trong repo riêng `learning-hub-track-<slug>`, và được đọc tại đúng commit ghi trong `tracks.yaml` ([ADR-10](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/product/DECISIONS.md#adr-10--mỗi-track-một-repo-learning-hub-content-thành-registry)). Muốn publish phiên bản mới của một track thì mở PR đổi commit của track đó trong `tracks.yaml`.

Đổi `CONTENT_SOURCE` xong thì chạy **Actions → Deploy → Run workflow** để API đọc lại `.env`, rồi mới chạy lệnh sync ở trên.

**Lời giải tham khảo (không bắt buộc).** Repo nội dung là công khai, nên lời giải nằm trong repo **riêng tư** `learning-hub-checker`, file `exercises/<track>/<exercise>/solution.md` ([CONTENT-SPECIFICATION §3.8](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/product/CONTENT-SPECIFICATION.md)). Thành viên chỉ thấy lời giải khi đã hoàn thành bài (đạt, hoặc được mentor duyệt nếu bài cần review). Mặc định tắt (`SOLUTIONS_SOURCE=none`). Muốn bật:

1. Tạo fine-grained token **chỉ đọc** (Contents: Read-only) cho đúng repo `learning-hub-checker`.
2. Trong `.env` trên VPS: `SOLUTIONS_SOURCE=github`, `SOLUTIONS_REPO=hcmute-dsc/learning-hub-checker`, `SOLUTIONS_BRANCH=main`, và dán token vào `SOLUTIONS_GITHUB_TOKEN` (tự gõ trên VPS, không dán vào chat hay issue).
3. Chạy **Actions → Deploy → Run workflow**, rồi sync + publish như trên.

API đọc lời giải ở commit mới nhất của repo checker lúc sync và publish (commit được ghi vào phiên bản nội dung). Chỉ sửa lời giải thì chưa có phiên bản mới: lời giải mới lên site cùng lần publish nội dung kế tiếp.

Rồi mở https://learn.hcmute-dsc.io.vn, đăng nhập bằng GitHub của tech lead (tự thành admin), vào **Quản trị** để thêm danh sách email thành viên.

## Bước 11. Sao lưu hằng ngày

```bash
sudo -u learnhub crontab -e
```

Thêm dòng (2:30 sáng giờ Việt Nam = 19:30 UTC, giữ 14 ngày):

```
30 19 * * * /opt/learning-hub/backup.sh >> /opt/learning-hub/backups/backup.log 2>&1
```

Bản sao lưu chứa email thành viên, nên `backup.sh` chỉ cho user `learnhub` đọc (thư mục `700`, file `600`).

Chạy thử ngay: `sudo -u learnhub /opt/learning-hub/backup.sh`. Kiểm tra cron đã cài: `sudo -u learnhub crontab -l` phải thấy dòng `backup.sh`.

Cách xem bản sao lưu, kiểm tra và khôi phục: xem [Sao lưu và khôi phục database](#sao-lưu-và-khôi-phục-database). Bản sao mã hóa mỗi tuần ra ngoài VPS (cài một lần, cần `age`): [Chép bản sao lưu ra ngoài VPS](#chép-bản-sao-lưu-ra-ngoài-vps-mỗi-tuần-tự-động).

## Bước 12. Thông báo Discord (không bắt buộc)

Learning Hub gửi tin vào 2 kênh Discord. Để trống URL thì tắt, mọi thứ khác vẫn chạy bình thường.

| Kênh                                         | Biến                        | Ai đọc                      |
| -------------------------------------------- | --------------------------- | --------------------------- |
| Kênh CLB (ví dụ `#learning-hub`)             | `DISCORD_WEBHOOK_URL`       | mentor và thành viên        |
| Kênh vận hành, riêng tư (ví dụ `#hub-alert`) | `DISCORD_ALERT_WEBHOOK_URL` | tech lead và người trực web |

**Tạo webhook** (cần quyền Manage Webhooks trên server Discord): chuột phải vào kênh → **Edit Channel → Integrations → Webhooks → New Webhook** → đặt tên (ví dụ `Learning Hub`) → **Copy Webhook URL**. Làm 2 lần, mỗi kênh một webhook.

URL webhook là mật khẩu: ai có nó đều gửi tin vào kênh được. Không dán vào chat, issue hay code. Lộ thì vào lại chỗ trên, **Delete Webhook** rồi tạo cái mới.

**Đặt vào đâu:**

1. `/opt/learning-hub/.env` trên VPS (cho API): đăng nhập bằng user `learnhub`, mở `nano /opt/learning-hub/.env`, điền `DISCORD_WEBHOOK_URL=` và `DISCORD_ALERT_WEBHOOK_URL=` (dán URL liền, không dấu cách, không ngoặc kép), lưu bằng `Ctrl+O`, thoát bằng `Ctrl+X`.
2. GitHub (cho workflow kiểm tra uptime): secret của repo, không phải của environment `production`. Cách nhanh là chạy lệnh dưới trên máy mình rồi dán URL webhook kênh vận hành khi được hỏi:

   ```bash
   gh secret set DISCORD_ALERT_WEBHOOK_URL --repo hcmute-dsc/learning-hub
   ```

   Hoặc trên web: repo → **Settings → Secrets and variables → Actions → New repository secret**.

3. **Actions → Deploy → Run workflow** (hoặc `gh workflow run deploy.yml --repo hcmute-dsc/learning-hub --ref main`) để API đọc lại `.env`.

**Kiểm tra** (chạy trên VPS; URL đọc thẳng từ `.env` nên không hiện ra màn hình):

```bash
# Gửi thử 1 tin vào mỗi kênh: thấy "OK" và tin hiện trong Discord là URL đúng
cd /opt/learning-hub
for k in DISCORD_WEBHOOK_URL DISCORD_ALERT_WEBHOOK_URL; do
  curl -fsS -H 'Content-Type: application/json' -d "{\"content\":\"Learning Hub: thử $k\"}" \
    "$(grep "^$k=" .env | cut -d= -f2-)" && echo "$k OK"
done

# Sau khi Deploy: API phải thấy cả 2 biến
docker compose -f docker-compose.prod.yml exec -T api sh -c \
  'test -n "$DISCORD_WEBHOOK_URL" && echo club:set; test -n "$DISCORD_ALERT_WEBHOOK_URL" && echo alert:set'
```

Workflow **Uptime** chỉ gửi tin khi site lỗi, nên chạy tay mà site khỏe thì sẽ không có tin nào. Đó là đúng.

Lần bật đầu tiên: 17/11/2026 (kênh CLB và kênh vận hành, secret repo đã thêm).

**Ý nghĩa từng tin:**

| Tin                                    | Kênh     | Khi nào                                                                                                                     | Cần làm gì                                                                                          |
| -------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 📝 **Bài chờ review**                  | CLB      | thành viên nộp project cần mentor chấm                                                                                      | mentor bấm link `/review/…` để nhận review                                                          |
| **Review xong** — ✅ Đạt / 🔁 Cần sửa  | CLB      | mentor chấm xong                                                                                                            | không; thành viên xem nhận xét trên web                                                             |
| 📚 **Nội dung mới đã được publish**    | CLB      | admin publish nội dung mới; tin ghi tên lộ trình, các bài được thêm/sửa/gỡ (tối đa 12 tên) và link xem thay đổi trên GitHub | không; thành viên vào `/tracks` xem bài mới                                                         |
| 🚨 **Lỗi 500 trên API**                | vận hành | API gặp lỗi chưa xử lý. Cùng một lỗi chỉ báo 1 lần mỗi 10 phút, tối đa 10 tin mỗi giờ (số tin bị gộp có ghi)                | tìm `requestId` trong log: `docker compose -f docker-compose.prod.yml logs api \| grep <requestId>` |
| 🔴 **Learning Hub không trả lời đúng** | vận hành | workflow **Uptime** (15 phút một lần) thấy trang chủ không trả `200` hoặc `/api/v1/tracks` không trả `401`                  | xem mục [Lỗi thường gặp](#lỗi-thường-gặp); job đỏ trong tab Actions cũng gửi email cho admin repo   |

Tin không bao giờ chứa email hay dữ liệu cá nhân, chỉ có tên bài, tên lộ trình và login GitHub. Tin lỗi chỉ có method, đường dẫn (không có query string), `requestId` và câu báo lỗi; chi tiết đầy đủ nằm trong log API.

Kiểm tra: **Actions → Uptime → Run workflow**. Job xanh là site đang chạy. Thử một webhook bằng tay:

```bash
curl -H 'content-type: application/json' -d '{"content":"thử webhook"}' "URL_WEBHOOK"
```

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

Migration không tự quay ngược. Nếu phiên bản lỗi đã đổi database, khôi phục từ bản sao lưu ([Sao lưu và khôi phục database](#sao-lưu-và-khôi-phục-database)).

## Sao lưu và khôi phục database

Mọi lệnh dưới chạy trên VPS bằng user `learnhub` (`ssh learnhub`), trong `/opt/learning-hub`.

**Bản sao lưu có gì:** toàn bộ database `learning_hub` (pg_dump dạng SQL, nén gzip, không kèm owner), gồm tài khoản và email, bài nộp, review, phiên bản nội dung, nhật ký quản trị.

**Bản sao lưu không có gì:**

- `.env` (secret): giữ riêng, mất thì tạo lại theo Bước 6.
- Bài học gốc: nằm trên GitHub, đồng bộ lại được.

| Việc                    | Lệnh                                                        |
| ----------------------- | ----------------------------------------------------------- |
| Xem các bản sao lưu     | `ls -lh backups/`                                           |
| Xem cron có chạy không  | `tail backups/backup.log` (mỗi đêm một dòng `backup ok`)    |
| Sao lưu ngay (bằng tay) | `./backup.sh`, nên chạy trước mọi thao tác nguy hiểm với DB |
| Đổi số ngày giữ         | `KEEP_DAYS=30` trước lệnh trong crontab (mặc định 14)       |

### Chép bản sao lưu ra ngoài VPS (mỗi tuần, tự động)

Hỏng VPS là mất cả dữ liệu lẫn bản sao lưu nằm trên đó. Vì vậy mỗi tuần có một bản **mã hóa** được kéo về máy của tech lead:

```
VPS, cron Chủ nhật 20:00 UTC (= 3:00 sáng thứ Hai giờ VN), user learnhub:
  offsite-export.sh: lấy bản sao lưu mới nhất → mã hóa bằng age (khóa CÔNG KHAI của tech lead)
                     → backups/offsite/learning_hub-….sql.gz.age, giữ 4 bản
Máy tech lead (Windows), Task Scheduler thứ Hai 9:00:
  offsite-pull.ps1:  ssh learnhub-backup list / get → tải bản mới → giữ 12 bản (~3 tháng)
```

- VPS **không có** khóa giải mã. Chỉ khóa bí mật `age` trên máy tech lead (có passphrase) mới mở được.
- Máy tech lead dùng một SSH key riêng `learning-hub-backup-pull`. Trong `authorized_keys`, key này bị khóa bằng `command="…/offsite-serve.sh"`: chỉ được `list` và `get <tên file .age>`, không mở được shell, không đọc được `.env` hay bản chưa mã hóa. Lộ key này thì người khác cũng chỉ lấy được file đã mã hóa.
- Máy tắt lúc 9:00 thứ Hai? Task Scheduler chạy bù khi máy bật lại (`-StartWhenAvailable`).
- Thư mục chứa bản sao (`-Dest`) phải **ngoài mọi repo git**, ví dụ `$HOME\learning-hub-backups` hoặc `D:\repos\learning-hub-backups`. Script tự từ chối nếu thư mục nằm trong một repo. Dù đã mã hóa: không commit, không đưa lên Drive công khai, không gửi qua chat.

**Cài đặt (một lần).** Trên máy bạn (PowerShell):

```powershell
winget install --id FiloSottile.age -e          # mở PowerShell mới sau khi cài
# 1. Khóa age để mã hóa bản sao lưu
New-Item -ItemType Directory -Force $HOME\.age | Out-Null
age-keygen -o $HOME\.age\plain.key              # in ra "Public key: age1…": chép dòng age1… lại
age -p -o $HOME\.age\learning-hub-backup.key $HOME\.age\plain.key   # đặt passphrase cho khóa
Remove-Item $HOME\.age\plain.key
# 2. SSH key chỉ dùng để kéo bản sao (bấm Enter 2 lần: không passphrase, để Task Scheduler chạy được)
ssh-keygen -t ed25519 -C "learning-hub-backup-pull" -f $HOME\.ssh\learning-hub-backup-pull
Get-Content $HOME\.ssh\learning-hub-backup-pull.pub   # dùng ở bước VPS
```

Cất **file `learning-hub-backup.key` và passphrase** vào trình quản lý mật khẩu của bạn. Mất một trong hai thì mọi bản sao ngoài VPS đều không mở được.

Thêm vào `~/.ssh/config` trên máy bạn (thay `VPS_IP`):

```
Host learnhub-backup
  HostName VPS_IP
  User learnhub
  IdentityFile ~/.ssh/learning-hub-backup-pull
  IdentitiesOnly yes
```

Trên VPS (sau khi PR có `offsite-export.sh` đã merge và Deploy xanh, vì Deploy chép script lên VPS):

```bash
sudo apt install -y age                                          # user admin có sudo
sudo -u learnhub nano /opt/learning-hub/offsite-recipients.txt   # dán dòng age1… (khóa công khai, không phải secret)
sudo -u learnhub nano /home/learnhub/.ssh/authorized_keys
#   thêm 1 dòng MỚI (đừng sửa dòng của khóa deploy):
#   restrict,command="/opt/learning-hub/offsite-serve.sh" <nội dung learning-hub-backup-pull.pub>
sudo -u learnhub crontab -e
#   thêm dòng:
#   0 20 * * 0 /opt/learning-hub/offsite-export.sh >> /opt/learning-hub/backups/offsite.log 2>&1
sudo -u learnhub /opt/learning-hub/offsite-export.sh             # chạy thử: phải thấy "offsite ok"
```

Kéo lần đầu và đặt lịch, trên máy bạn, trong thư mục clone `learning-hub` (đã `git pull` sau khi merge):

```powershell
ssh learnhub-backup list                     # lần đầu: gõ yes để lưu host key; phải thấy tên file .age
ssh learnhub-backup "cat /opt/learning-hub/.env"   # phải bị từ chối: "only 'list' and 'get <name>' are allowed"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\offsite-pull.ps1 -Dest D:\repos\learning-hub-backups

$script = (Resolve-Path deploy\offsite-pull.ps1).Path
$action = New-ScheduledTaskAction -Execute powershell.exe `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Dest D:\repos\learning-hub-backups"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
Register-ScheduledTask -TaskName "Learning Hub offsite backup" -Action $action -Trigger $trigger -Settings $settings
Start-ScheduledTask "Learning Hub offsite backup"; Start-Sleep 20
Get-Content D:\repos\learning-hub-backups\pull.log -Tail 3   # phải thấy "pull ok"
```

**Theo dõi.** Trên VPS: `tail backups/offsite.log` (mỗi tuần một dòng `offsite ok`). Trên máy bạn: `pull.log` trong thư mục `-Dest` (mỗi tuần một dòng `pull ok`). Thấy `FAILED`, hoặc hơn 2 tuần không có dòng mới, thì xem lỗi ghi ngay trên dòng đó.

| Đổi gì                   | Cách làm                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Số bản giữ trên VPS      | `KEEP_COPIES=8` trước lệnh trong crontab (mặc định 4)                                 |
| Số bản giữ trên máy bạn  | thêm `-Keep 24` vào lệnh của task (mặc định 12)                                       |
| Thêm người giữ bản sao   | thêm dòng `age1…` của họ vào `offsite-recipients.txt` (từ tuần sau mã hóa cho cả hai) |
| Ngừng cho một máy kéo về | xóa dòng `learning-hub-backup-pull` của máy đó trong `authorized_keys` của `learnhub` |

**Khôi phục từ bản sao ngoài VPS** (khi VPS mất hẳn). Trên máy bạn:

```powershell
$f = "D:\repos\learning-hub-backups\learning_hub-YYYYMMDD-HHMMSS.sql.gz.age"
age -d -i $HOME\.age\learning-hub-backup.key -o $HOME\learning_hub-restore.sql.gz $f   # hỏi passphrase
scp $HOME\learning_hub-restore.sql.gz learnhub@VPS_MỚI:/opt/learning-hub/backups/learning_hub-YYYYMMDD-HHMMSS.sql.gz
Remove-Item $HOME\learning_hub-restore.sql.gz   # file giải mã có email thành viên: xóa ngay
```

Rồi làm theo [Chuyển sang VPS mới](#chuyển-sang-vps-mới) và [Khôi phục database production](#khôi-phục-database-production).

### Kiểm tra bản sao ngoài VPS (mỗi tháng)

Chạy trên máy bạn (cần `age` và Docker Desktop). Script giải mã bản mới nhất vào thư mục tạm, nạp vào một Postgres **tạm, không nối mạng**, in số dòng, rồi xóa container và file giải mã (kể cả khi lỗi). Có `-ProdHost learnhub` (alias quản trị ở Bước 4) thì in thêm số dòng production để so; production chỉ được đọc.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\offsite-restore-check.ps1 `
  -Dest D:\repos\learning-hub-backups -ProdHost learnhub
```

Kết quả đúng: `Decrypt OK`, `gzip OK`, `Restore OK`, và 2 dòng số gần bằng nhau. Dòng cuối script in sẵn một hàng để chép vào bảng kiểm tra ở learning-hub-docs `docs/ops/DEPLOYMENT.md` §5.3.

### Kiểm tra bản sao lưu dùng được (mỗi tháng)

Bản sao lưu chưa khôi phục thử thì chưa chắc dùng được. Lệnh dưới nạp bản mới nhất vào một Postgres **tạm**, không nối mạng, rồi so số dòng với production. **Không đụng database thật.**

```bash
cd /opt/learning-hub
f=$(ls -t backups/learning_hub-*.sql.gz | head -1); echo "Kiểm tra $f"
gunzip -t "$f" && echo "gzip OK"
docker run -d --rm --name lh-restore-test --network none \
  -e POSTGRES_PASSWORD=test -e POSTGRES_USER=hub -e POSTGRES_DB=learning_hub postgres:16
sleep 10   # chờ Postgres tạm khởi động
gunzip -c "$f" | docker exec -i lh-restore-test psql -q -v ON_ERROR_STOP=1 -U hub -d learning_hub >/dev/null && echo "Khôi phục OK"
Q="select (select count(*) from users), (select count(*) from submissions), (select count(*) from _prisma_migrations)"
docker exec lh-restore-test psql -U hub -d learning_hub -At -c "$Q"                       # bản sao lưu
docker compose -f docker-compose.prod.yml exec -T db psql -U hub -d learning_hub -At -c "$Q"  # production
docker rm -f lh-restore-test
```

Thấy `Khôi phục OK` và 2 dòng số gần giống nhau là được. Production có thể nhiều hơn một chút, vì có dữ liệu mới sau lúc sao lưu. Lần đầu chạy thử: 17/11/2026, khớp.

### Khôi phục database production

Mọi dữ liệu **sau** thời điểm của bản sao lưu sẽ mất. Báo trước trên Discord CLB vì site sẽ tắt vài phút.

```bash
cd /opt/learning-hub
ls -lh backups/                                  # 1. chọn file
./backup.sh                                      # 2. sao lưu trạng thái hiện tại, phòng khi chọn nhầm file
docker compose -f docker-compose.prod.yml stop web api          # 3. tắt site
docker compose -f docker-compose.prod.yml exec -T db psql -U hub -d postgres \
  -c "DROP DATABASE learning_hub WITH (FORCE);" -c "CREATE DATABASE learning_hub OWNER hub;"   # 4. làm rỗng DB
gunzip -c backups/learning_hub-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -q -v ON_ERROR_STOP=1 -U hub -d learning_hub   # 5. nạp lại
docker compose -f docker-compose.prod.yml up -d --wait          # 6. bật lại (migrate chạy trước api)
docker compose -f docker-compose.prod.yml ps                    # 7. kiểm tra
```

- Bước 5 dừng ngay ở lỗi đầu tiên. Nếu lỗi, đừng bật site: làm lại từ bước 4 với file khác.
- Bước 6: nếu bản sao lưu cũ hơn code đang chạy, `migrate` tự áp các migration còn thiếu.
- Khôi phục vì một bản deploy làm hỏng DB? Quay `IMAGE_TAG` về bản cũ trước ([Quay về phiên bản cũ](#quay-về-phiên-bản-cũ)), rồi mới khôi phục. Nếu không, migration lỗi sẽ chạy lại.
- Sau đó mở site, đăng nhập, xem **Quản trị → Thành viên** thấy đủ tài khoản. Ghi lại sự cố (ngày, file đã dùng, lý do) vào tài liệu bàn giao.

### Chuyển sang VPS mới

1. Làm Bước 1–9 trên VPS mới, đến khi Deploy xanh (DB mới đang rỗng).
2. Chép bản sao lưu lên: `scp learning_hub-….sql.gz learnhub@VPS_MỚI:/opt/learning-hub/backups/`.
3. Làm các bước khôi phục ở trên, từ bước 3.
4. Đổi bản ghi DNS `learn` sang IP mới, cập nhật secret `VPS_HOST` và `VPS_KNOWN_HOSTS`.

## Lỗi thường gặp

| Hiện tượng                                                    | Nguyên nhân hay gặp                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Job "Copy compose file" báo `Host key verification failed`    | `VPS_KNOWN_HOSTS` sai hoặc VPS được cài lại: chạy lại `ssh-keyscan`                                                 |
| `Permission denied (publickey)`                               | khóa công khai chưa nằm trong `/home/learnhub/.ssh/authorized_keys`, hoặc sai quyền file                            |
| `ssh -v` báo `Server accepts key` rồi vẫn `Permission denied` | khóa có passphrase (hay gặp khi tạo bằng PowerShell với `-N '""'`): bỏ passphrase bằng `ssh-keygen -p -f KEY -N ""` |
| `Could not resolve hostname vps_ip`                           | quên thay chữ giữ chỗ `VPS_IP` bằng IP thật                                                                         |
| `Connection refused` / `timed out` khi SSH                    | sai IP hoặc sai cổng SSH (`VPS_PORT`)                                                                               |
| `UNPROTECTED PRIVATE KEY FILE` (Windows)                      | `icacls KEY /inheritance:r /grant:r "$(whoami):F"` (xem Bước 4)                                                     |
| `pull access denied` cho image `:latest`                      | `IMAGE_TAG` trong `.env` trống: chạy lại Deploy, workflow tự ghi                                                    |
| Trang đăng nhập xong báo 500, log web gọi nhầm API site khác  | mạng `edge` dùng chung: API phải có alias riêng `learning-hub-api` (đã cấu hình), đừng đổi về `api`                 |
| `migrate` thoát với lỗi                                       | xem `docker compose -f docker-compose.prod.yml logs migrate`; thường do `DATABASE_URL` sai mật khẩu                 |
| Trang báo 404 hoặc bị chuyển về trang khác                    | Traefik chưa thấy container `web`: kiểm tra `ps` (web healthy?) và `docker logs traefik --tail 50`                  |
| Trang báo 502/504                                             | web chưa sẵn sàng, hoặc `web` không nằm trong mạng `edge` (`docker inspect learning-hub-web-1`)                     |
| Chứng chỉ HTTPS lỗi                                           | xem `docker logs traefik` (dòng `acme`); token Cloudflare của Traefik phải có quyền zone `hcmute-dsc.io.vn`         |
| Mọi thành viên bị báo "quá nhiều request" cùng lúc            | `TRUST_PROXY_HOPS` sai: `2` khi Cloudflare Proxied, `1` khi DNS only                                                |
| Đăng nhập GitHub báo `redirect_uri` sai                       | Callback URL của OAuth app phải đúng `https://learn.hcmute-dsc.io.vn/api/v1/auth/github/callback`                   |
| Đăng nhập xong vẫn bị đá ra                                   | site phải chạy HTTPS: cookie `__Host-sid` chỉ dùng được qua HTTPS                                                   |
| Lỗi 403 "Origin" khi bấm nút                                  | `WEB_ORIGIN` trong `.env` phải đúng `https://learn.hcmute-dsc.io.vn` (không có `/` cuối)                            |
| Không có tin Discord nào                                      | `DISCORD_WEBHOOK_URL` / `DISCORD_ALERT_WEBHOOK_URL` trống hoặc sai, hoặc chưa Deploy lại sau khi sửa `.env`         |
| Link trong tin Discord trỏ sai trang                          | link lấy từ `WEB_ORIGIN` trong `.env`                                                                               |
| Workflow Uptime đỏ nhưng site vẫn mở được                     | xem log của job: thường do `/api/v1/tracks` trả `502` (container `api` chết) chứ không phải `401`                   |

## Bàn giao cho tech lead mới

1. Thêm SSH key của người mới vào user của họ trên VPS (không chia sẻ khóa của `learnhub`).
2. Chuyển quyền admin repo và org GitHub; chuyển quyền DNS nếu cần.
3. Chuyển OAuth app sang org hoặc tạo lại (đổi `GITHUB_CLIENT_*` trong `.env`, rồi chạy lại Deploy).
4. Tạo SSH key deploy mới (Bước 4, 7), xóa khóa cũ khỏi `authorized_keys`.
5. Tạo lại 2 webhook Discord nếu người cũ rời server (Bước 12), cập nhật `.env` và secret repo.
6. Bản sao ngoài VPS: người mới làm phần cài đặt ở [Chép bản sao lưu ra ngoài VPS](#chép-bản-sao-lưu-ra-ngoài-vps-mỗi-tuần-tự-động) với khóa `age` và SSH key của **họ**, thay dòng `age1…` trong `offsite-recipients.txt`, rồi tự chạy [kiểm tra bản sao lưu](#kiểm-tra-bản-sao-lưu-dùng-được-mỗi-tháng) và [kiểm tra bản sao ngoài VPS](#kiểm-tra-bản-sao-ngoài-vps-mỗi-tháng) một lần. Người cũ xóa dòng `learning-hub-backup-pull` của mình trong `authorized_keys`, gỡ task trong Task Scheduler, xóa các bản sao và khóa `age` trên máy mình.
7. Kiểm tra cài đặt repo: chỉ squash merge, bảo vệ nhánh `main` (bắt buộc PR, check `build-test`, `secrets`, `check` xanh, nhánh PR cập nhật theo `main`; bật từ 18/11/2026). Lệnh `gh` và cách đổi sang "1 approval" khi có maintainer thứ hai: [WORKFLOW §7.5](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/ops/WORKFLOW.md#75-cài-đặt-repo-để-ép-quy-trình-admin-làm-mỗi-repo-một-lần).
8. GitHub App `hcmute-dsc-learning-hub` (cài cho mọi repo của org; tự thêm issue/PR của `learning-hub-content`, `learning-hub-docs` và các repo track vào project) thuộc org, không cần tạo lại; chỉ cần người mới là owner của org. Cách cài từ đầu và đổi private key: [WORKFLOW §4](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/ops/WORKFLOW.md#4-cài-đặt-làm-bằng-tay-trên-web-api-của-github-chưa-hỗ-trợ).
9. Nội dung: mỗi track một repo `learning-hub-track-<slug>`, `learning-hub-content` là registry (`tracks.yaml`). Tạo track mới cho mentor, cấp quyền, publish: [NEW-TRACK.md](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/ops/NEW-TRACK.md), skill `new-track`.

## Hiện trạng production (cập nhật khi thay đổi)

| Mục                             | Giá trị                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Cài lần đầu                     | 17/11/2026, Ubuntu 22.04, Traefik v3 có sẵn (mạng `edge`)                                                  |
| Thư mục                         | `/opt/learning-hub` (chủ: `learnhub`), database riêng trong stack này, không dùng chung Postgres site khác |
| User deploy                     | `learnhub` (nhóm `docker`, không `sudo`, chỉ SSH key)                                                      |
| Secret environment `production` | `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`                                                   |
| Secret repo                     | `DISCORD_ALERT_WEBHOOK_URL` (workflow Uptime)                                                              |
| Biến repo                       | `DEPLOY_ENABLED=true`                                                                                      |
| DNS                             | `learn` → VPS, Cloudflare Proxied, `TRUST_PROXY_HOPS=2`                                                    |
| Sao lưu                         | cron 19:30 UTC của `learnhub`, giữ 14 ngày, `/opt/learning-hub/backups`                                    |
| Bản sao ngoài VPS               | chưa bật (learning-hub#1): mã hóa `age` Chủ nhật 20:00 UTC, kéo về máy tech lead thứ Hai, giữ 4 + 12 bản   |
| Discord                         | bật 17/11/2026 (kênh CLB + kênh vận hành)                                                                  |
