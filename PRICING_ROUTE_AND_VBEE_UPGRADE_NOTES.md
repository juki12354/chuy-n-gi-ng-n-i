# Pricing route + Vbee upgrade

Các thay đổi chính:

1. Sửa luồng mở trang bảng giá
   - Menu `Bảng giá` trên trang chủ dùng route `/pricing` rõ ràng.
   - Kiểm tra bằng dev server: `http://localhost:3000/pricing` render đúng trang bảng giá, không render trang chủ.

2. Xóa bảng giá khỏi trang chủ
   - Đã bỏ section bảng giá xem nhanh khỏi `src/routes/index.tsx`.
   - Trang chủ chỉ còn CTA/menu dẫn sang trang bảng giá riêng.

3. Đồng bộ thanh menu trang bảng giá với trang chủ
   - Header trang `/pricing` đã có dropdown: Sản phẩm, Công ty, Tài nguyên, Kiếm tiền.
   - Mục `Bảng giá` được active bằng pill vàng giống style Vbee.
   - Mobile menu cũng được làm lại giống trang chủ.

4. Bổ sung các khối còn thiếu theo hướng Vbee/Sonix
   - Thêm khối `Hệ sinh thái Vbee-style` trên trang chủ: AIVoice Studio, AIVoice API, AI Dubbing, Voice Cloning, AICall.
   - Thêm khối lợi ích trên trang bảng giá: 1000+ giọng AI, tiết kiệm 90%, API sẵn sàng mở rộng.
   - Đổi tên gói bảng giá theo hướng Việt hóa/Vbee hơn: Free, Tiêu chuẩn, Đặc biệt, Business.

5. Kiểm tra build
   - Đã chạy thành công: `cd frontend && npm install && npm run build`.

Cách chạy:

```bash
cd backend
npm install
npm run dev
```

Mở terminal mới:

```bash
cd frontend
npm install
npm run dev
```

Mở web:

```text
http://localhost:3000
http://localhost:3000/pricing
```
