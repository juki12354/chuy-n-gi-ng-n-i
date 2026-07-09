# Sửa lỗi đăng nhập

Bản này đã sửa luồng đăng nhập để không phụ thuộc Google OAuth.

## Đã sửa

- Thêm API `POST /api/auth/login` cho đăng nhập email/password.
- Trang `/login` có form nhập email và mật khẩu.
- Trang `/register` cho phép đăng ký trực tiếp, không bắt buộc đi qua Google.
- Backend tự kiểm tra/tạo các bảng cần thiết khi khởi động:
  - `users`
  - `transcriptions`
  - các cột `avatar`, `words`, `audio_filename` nếu còn thiếu.
- Tạo sẵn tài khoản demo khi backend khởi động:
  - Email: `demo@vbee.local`
  - Mật khẩu: `123456`
- Google Login được giữ lại, nhưng nếu chưa cấu hình OAuth thì sẽ báo lỗi rõ ràng thay vì làm hỏng đăng nhập.

## Cách chạy

Terminal 1:

```bash
cd backend
npm install
npm run dev
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Mở web:

```text
http://localhost:3000
```

Backend chạy ở:

```text
http://localhost:3001
```

## Lưu ý PostgreSQL

Bạn vẫn cần tạo database một lần nếu chưa có:

```sql
CREATE DATABASE golden_voice;
```

Sau đó backend sẽ tự tạo bảng bên trong database đó.
