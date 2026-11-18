Closes #

## Thay đổi gì, vì sao

<!-- Một chủ đề mỗi PR. Ghi lý do, không chỉ liệt kê file. -->

## Nguyên nhân gốc (nếu là bug)

<!-- Vì sao lỗi xảy ra, không chỉ triệu chứng. Xóa mục này nếu không phải bug. -->

## Kiểm tra

<!-- Đã chạy gì, xem trang nào, ảnh chụp trước/sau nếu đổi giao diện. -->

## Checklist

- [ ] `pnpm format && pnpm lint && pnpm typecheck && pnpm test` xanh trên máy
- [ ] Có test cho quy tắc nghiệp vụ mới hoặc lỗi vừa sửa (hoặc ghi lý do không có)
- [ ] Đổi database: có migration mới, không sửa migration đã chạy; cập nhật `DATABASE.md`
- [ ] Đổi thiết kế, API, cách vận hành: cập nhật learning-hub-docs và `deploy/README.md`
- [ ] Không có secret, IP VPS, URL webhook hay email thành viên trong code, log, ảnh
