# Sonix API Ready Notes

Bản này đã có thể cấu hình để chạy speech-to-text theo luồng giống Sonix.ai.

## Cấu hình nhanh

Mở `backend/.env` và điền:

```env
TRANSCRIPTION_PROVIDER=sonix
SONIX_API_KEY=your_sonix_api_key_here
SONIX_LANGUAGE=vi
```

Lấy API key tại:

```text
https://my.sonix.ai/api
```

Sau đó chạy:

```bash
cd backend
npm install
npm run dev
```

Ở terminal khác:

```bash
cd frontend
npm install
npm run dev
```

Mở:

```text
http://localhost:3000
```

## Luồng API public

1. Đăng nhập vào app.
2. Vào trang `/api`.
3. Tạo API key dạng `vbee_sk_...`.
4. Gọi endpoint:

```bash
curl -X POST http://localhost:3001/api/v1/transcribe \
  -H "x-api-key: vbee_sk_YOUR_API_KEY" \
  -F "audio=@meeting.mp3" \
  -F "speakerLabels=true"
```

Response sẽ có `text`, `words`, `duration`, `provider`, `providerId`.

## Ghi chú

- Sonix multipart upload trực tiếp giới hạn 100MB. File lớn hơn cần mở rộng backend sang luồng `file_url`.
- Nếu muốn dùng AssemblyAI, đổi:

```env
TRANSCRIPTION_PROVIDER=assemblyai
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```
