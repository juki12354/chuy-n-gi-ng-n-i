# Vbee/Sonix-style API Integration

Đã tích hợp API nội bộ cho dự án:

## Backend

- `POST /api/keys` — tạo API key cho user đang đăng nhập.
- `GET /api/keys` — xem danh sách API key đang hoạt động.
- `DELETE /api/keys/:id` — thu hồi API key.
- `POST /api/v1/transcribe` — endpoint public để tích hợp Speech to Text bằng API key.
- `GET /api/v1/health` — kiểm tra API v1.

API key có dạng `vbee_sk_...`, chỉ hiển thị đầy đủ một lần khi tạo. Backend chỉ lưu SHA-256 hash của key.

## Frontend

- Thêm trang `/api` để tạo key, xem docs, copy code mẫu và test trực tiếp bằng file audio/video.
- Menu `Vbee API` trên trang chủ và bảng giá đã trỏ về `/api`.
- Dashboard có thêm link `API`.

## Cách gọi API

```bash
curl -X POST http://localhost:3001/api/v1/transcribe \
  -H "x-api-key: vbee_sk_YOUR_API_KEY" \
  -F "audio=@meeting.mp3" \
  -F "speakerLabels=true"
```

Hoặc dùng header:

```http
Authorization: Bearer vbee_sk_YOUR_API_KEY
```

## Provider chuyển giọng nói thành văn bản

Backend hiện hỗ trợ 3 provider:

- `sonix` — mô phỏng luồng như Sonix.ai: upload media, poll trạng thái, lấy transcript JSON có timestamp từng từ.
- `deepgram` — gửi file trực tiếp tới Deepgram pre-recorded endpoint, lấy transcript, word timestamps, duration và speaker labels khi bật diarization.
- `assemblyai` — provider cũ của dự án.

Trong `backend/.env`:

```env
TRANSCRIPTION_PROVIDER=sonix
SONIX_API_KEY=your_sonix_api_key_here
SONIX_LANGUAGE=vi
```

Sonix API yêu cầu tài khoản trả phí hoặc trial được cấp API key. Lấy key tại:

```text
https://my.sonix.ai/api
```

Muốn dùng Deepgram:

```env
TRANSCRIPTION_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_deepgram_api_key_here
DEEPGRAM_MODEL=nova-3
DEEPGRAM_LANGUAGE=vi
DEEPGRAM_SMART_FORMAT=true
DEEPGRAM_PUNCTUATE=true
DEEPGRAM_PARAGRAPHS=true
DEEPGRAM_UTTERANCES=true
```

Deepgram nhận request tại `POST https://api.deepgram.com/v1/listen` với header `Authorization: Token <apiKey>`. Backend đang gửi binary file upload hiện có, nên luồng upload, ghi âm, quota free/premium và API key nội bộ vẫn giữ nguyên.

Muốn dịch transcript sau khi chuyển giọng nói thành văn bản, khuyến nghị dùng Google Cloud Translation:

```env
TRANSLATION_PROVIDER=auto
GOOGLE_TRANSLATE_API_URL=https://translation.googleapis.com/language/translate/v2
GOOGLE_TRANSLATE_API_KEY=your_google_cloud_translation_key
```

Nếu chưa có Google key, backend fallback qua LibreTranslate/MyMemory:

```env
LIBRETRANSLATE_API_URL=https://libretranslate.com
LIBRETRANSLATE_API_KEY=
MYMEMORY_API_URL=https://api.mymemory.translated.net
MYMEMORY_EMAIL=
```

Hoặc tự host LibreTranslate:

```env
LIBRETRANSLATE_API_URL=http://localhost:5000
```

Client có thể gửi thêm:

```bash
-F "language=auto" \
-F "translateTo=en"
```

Response sẽ có thêm:

```json
{
  "sourceLanguage": "auto",
  "translation": {
    "text": "...",
    "sourceLanguage": "vi",
    "targetLanguage": "en",
    "provider": "google-cloud-translation"
  }
}
```

Muốn quay lại AssemblyAI:

```env
TRANSCRIPTION_PROVIDER=assemblyai
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

Không có key provider thì API quản lý key vẫn chạy, nhưng chức năng chuyển âm thanh thành văn bản sẽ trả lỗi cấu hình.

## Luồng Sonix đang được implement

1. `POST https://api.sonix.ai/v1/media` với `file`, `language`, `name`.
2. Poll `GET https://api.sonix.ai/v1/media/<media_id>` đến khi `status=completed`.
3. Lấy transcript tại `GET https://api.sonix.ai/v1/media/<media_id>/transcript.json`.
4. Chuẩn hóa `words` từ giây sang mili-giây để frontend highlight theo audio như cũ.

Lưu ý: Sonix giới hạn upload trực tiếp bằng multipart `file` là 100MB. Nếu cần file lớn hơn, cần mở rộng backend sang luồng `file_url`.

## Luồng Deepgram đang được implement

1. `POST https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&paragraphs=true&utterances=true`.
2. Gửi header `Authorization: Token <DEEPGRAM_API_KEY>` và `Content-Type` theo file người dùng upload.
3. Nếu user bật speaker labels, gửi thêm `diarize=true`.
4. Chuẩn hóa `results.channels[0].alternatives[0].transcript`, `words`, `metadata.duration` về cùng response `text`, `words`, `duration`, `provider`, `providerId` như Sonix/AssemblyAI.
