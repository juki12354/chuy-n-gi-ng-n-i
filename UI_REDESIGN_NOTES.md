# Vbee AIVoice UI Redesign

Đã thiết kế lại giao diện theo yêu cầu: bố cục landing page kiểu Sonix.ai, dùng màu sắc nhận diện theo phong cách Vbee.

## File chính đã sửa

- `frontend/src/routes/index.tsx`
  - Viết lại landing page hoàn chỉnh.
  - Thêm header có menu nhiều cấp giống ảnh: Sản phẩm, Công ty, Tài nguyên, Kiếm tiền, Bảng giá.
  - Thêm hero section với mockup studio AI.
  - Thêm khối năng lực cốt lõi giống layout Sonix.ai.
  - Thêm workspace preview, product showcase, workflow 3 bước, referral, pricing preview, tài nguyên, FAQ, CTA và footer.

- `frontend/src/routes/__root.tsx`
  - Sửa lỗi JSX thừa thẻ đóng trong `NotFoundComponent`.

- `frontend/package-lock.json`
  - Cập nhật lại lock file để đồng bộ với `package.json`.

## Kiểm tra

Đã chạy thành công:

```bash
cd frontend
npm install
npm run build
```

Kết quả: build client và SSR đều thành công.

## Cách chạy

```bash
cd frontend
npm install
npm run dev
```

Mở trình duyệt tại địa chỉ Vite hiển thị, thường là:

```bash
http://localhost:3000
```

Trang bảng giá riêng:

```bash
/pricing
```
