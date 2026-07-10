# Hướng dẫn cài đặt & chạy

## 1. Chuẩn bị PostgreSQL

```sql
-- Mở psql và chạy:
CREATE DATABASE golden_voice;
\c golden_voice
\i database/schema.sql
```

## 2. Tạo Google OAuth Credentials

1. Vào https://console.cloud.google.com/apis/credentials
2. Tạo project mới (hoặc chọn project có sẵn)
3. Bật **Google+ API** hoặc **People API**
4. Chọn **Create Credentials → OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Thêm Authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
7. Copy **Client ID** và **Client Secret**

## 3. Cài đặt Backend

```bash
cd backend
copy .env.example .env
# Mở .env và điền các thông tin:
# - DB_PASSWORD, JWT_SECRET
# - SONIX_API_KEY nếu dùng Sonix.ai
# - hoặc DEEPGRAM_API_KEY nếu dùng Deepgram
# - hoặc ASSEMBLYAI_API_KEY nếu dùng AssemblyAI

npm install
npm run dev
# Backend chạy tại http://localhost:3001
```

### Chọn provider Speech to Text

Trong `backend/.env`, đặt:

```env
TRANSCRIPTION_PROVIDER=sonix
SONIX_API_KEY=your_sonix_api_key_here
SONIX_LANGUAGE=vi
```

Lấy Sonix API key tại `https://my.sonix.ai/api`. Sonix API dùng Bearer token, upload media qua `/v1/media`, poll trạng thái `/v1/media/<id>`, rồi lấy transcript từ `/v1/media/<id>/transcript.json`.

Nếu muốn dùng Deepgram:

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

Deepgram API dùng header `Authorization: Token <apiKey>` và nhận file trực tiếp tại `POST https://api.deepgram.com/v1/listen`. Khi bật "nhận diện nhiều người nói" trên app, backend sẽ gửi thêm `diarize=true` hoặc `DEEPGRAM_DIARIZE_MODEL` nếu bạn cấu hình model riêng.

### Lấy lời bài hát / file có nhạc nền

Trang Upload có chế độ `Bài hát / nhạc nền`. Khi chọn chế độ này, backend sẽ ưu tiên tách vocal bằng Demucs nếu server đã cài, sau đó chuẩn hóa audio bằng ffmpeg rồi mới gửi sang provider speech-to-text. Nếu chưa có Demucs, app tự fallback về ffmpeg filter để vẫn chạy được.

```env
AUDIO_PREPROCESSING_ENABLED=true
DEMUCS_ENABLED=auto
DEMUCS_PYTHON_PATH=python
DEMUCS_MODEL=htdemucs
DEMUCS_TIMEOUT_MS=600000
```

Cài Demucs trên server:

```bash
python -m pip install -U demucs
```

Lưu ý: chế độ này giúp lấy lời bài hát tốt hơn nhiều so với gửi file nhạc gốc trực tiếp, nhưng chất lượng còn phụ thuộc vocal có rõ không, nhạc nền có lấn giọng không và model speech-to-text đang dùng.

### Dịch transcript sang ngôn ngữ khác

Deepgram dùng để chuyển giọng nói thành văn bản. Nếu muốn dịch transcript sang tiếng khác như Sonix, backend gọi thêm dịch vụ dịch văn bản. Khuyến nghị dùng Google Cloud Translation cho nhiều ngôn ngữ.

Trong `backend/.env`:

```env
TRANSLATION_PROVIDER=auto
GOOGLE_TRANSLATE_API_URL=https://translation.googleapis.com/language/translate/v2
GOOGLE_TRANSLATE_API_KEY=your_google_cloud_translation_key
```

Nếu chưa có Google key, backend vẫn có thể fallback qua LibreTranslate/MyMemory:

```env
LIBRETRANSLATE_API_URL=https://libretranslate.com
LIBRETRANSLATE_API_KEY=
MYMEMORY_API_URL=https://api.mymemory.translated.net
MYMEMORY_EMAIL=
```

Nếu dùng bản tự host miễn phí:

```env
LIBRETRANSLATE_API_URL=http://localhost:5000
LIBRETRANSLATE_API_KEY=
```

Trên giao diện upload/ghi âm/API, chọn `Ngôn ngữ âm thanh` và `Dịch văn bản sang`. Nếu chưa cấu hình được dịch vụ dịch, app vẫn giữ transcript gốc và báo lỗi dịch riêng.

Nếu muốn dùng provider cũ:

```env
TRANSCRIPTION_PROVIDER=assemblyai
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

## 4. Cài đặt & chạy Frontend

```bash
cd frontend
copy .env.example .env
# .env chỉ có 1 biến: VITE_API_URL=http://localhost:3001

npm install
npm run dev
# Frontend chạy tại http://localhost:3000
```

## 5. Luồng hoạt động

```
Trang chủ → Bấm nút → Chuyển đến /login
/login → Bấm "Đăng nhập bằng Google" → Google OAuth
  → Đã có tài khoản → /dashboard (đăng nhập thành công)
  → Chưa có → /register (nhập first name, last name, email, password)
              → Tạo xong → /dashboard
```

## Biến môi trường Backend (.env)

| Biến | Ý nghĩa | Ví dụ |
|------|---------|-------|
| PORT | Port backend | 3001 |
| FRONTEND_URL | URL frontend | http://localhost:3000 |
| DB_HOST | Host PostgreSQL | localhost |
| DB_PORT | Port PostgreSQL | 5432 |
| DB_NAME | Tên database | golden_voice |
| DB_USER | User PostgreSQL | postgres |
| DB_PASSWORD | Password PostgreSQL | your_password |
| GOOGLE_CLIENT_ID | Google OAuth Client ID | ... |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret | ... |
| GOOGLE_CALLBACK_URL | Google OAuth callback URL | http://localhost:3001/api/auth/google/callback |
| TRANSCRIPTION_PROVIDER | Provider speech-to-text | sonix, deepgram hoặc assemblyai |
| SONIX_API_KEY | API key Sonix.ai | your_sonix_api_key |
| SONIX_LANGUAGE | Mã ngôn ngữ Sonix | vi |
| DEEPGRAM_API_KEY | API key Deepgram | your_deepgram_api_key |
| DEEPGRAM_MODEL | Model Deepgram | nova-3 |
| DEEPGRAM_LANGUAGE | Mã ngôn ngữ Deepgram | vi |
| DEEPGRAM_DETECT_LANGUAGE | Tự phát hiện ngôn ngữ thay vì dùng DEEPGRAM_LANGUAGE | false |
| TRANSLATION_PROVIDER | Provider dịch transcript | auto, google, libretranslate hoặc mymemory |
| GOOGLE_TRANSLATE_API_URL | Endpoint Google Cloud Translation | https://translation.googleapis.com/language/translate/v2 |
| GOOGLE_TRANSLATE_API_KEY | API key Google Cloud Translation | ... |
| LIBRETRANSLATE_API_URL | Endpoint dịch transcript | https://libretranslate.com |
| LIBRETRANSLATE_API_KEY | API key LibreTranslate nếu endpoint yêu cầu | ... |
| MYMEMORY_API_URL | Endpoint MyMemory fallback | https://api.mymemory.translated.net |
| MYMEMORY_EMAIL | Email MyMemory để tăng quota nếu có | your@email.com |
| ASSEMBLYAI_API_KEY | API key AssemblyAI | your_assemblyai_api_key |
| JWT_SECRET | Chuỗi bí mật cho JWT | random_long_string |
