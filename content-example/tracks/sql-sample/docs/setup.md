Làm các bước này **một lần** trước bài đầu tiên. Mất khoảng 15 phút.

## 1. Cài PostgreSQL 16

- **Windows / macOS**: tải bộ cài ở [postgresql.org/download](https://www.postgresql.org/download/) và giữ cổng mặc định `5432`.
- **Ubuntu**: `sudo apt install postgresql-16`.
- Không muốn cài? Dùng Docker:

```bash
docker run --name pg16 -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

## 2. Chọn một công cụ viết truy vấn

Bất kỳ công cụ nào kết nối được PostgreSQL: `psql`, DBeaver, pgAdmin hoặc extension SQLTools của VS Code.

## 3. Tự kiểm tra

Chạy lệnh sau. Nếu thấy `PostgreSQL 16.x` là xong:

```sql
SELECT version();
```

Gặp lỗi? Hỏi trong kênh Discord của CLB, kèm ảnh chụp lỗi.
