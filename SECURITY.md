# Bao mat he thong Vbee AIVoice

## Nguyen tac van hanh

- Khong commit `.env`, khoa API, token, file am thanh nguoi dung hoac ban sao database.
- Production chi chay qua HTTPS. PostgreSQL tu xa phai bat TLS va xac minh chung chi.
- API va transcription worker la hai process/container rieng. API dat
  `RUN_TRANSCRIPTION_WORKER=false`; worker khoi dong bang `npm run worker` voi
  `RUN_TRANSCRIPTION_WORKER=true`.
- Upload staging va thu muc audio phai nam ngoai webroot, chi user chay service
  duoc doc/ghi. Gan persistent volume rieng neu co nhieu worker.
- Production phai bat `MALWARE_SCAN_REQUIRED=true` va cau hinh
  `CLAMAV_SCAN_COMMAND`. Worker xu ly media nen chay trong container khong root,
  gioi han CPU, RAM, disk va khong co quyen truy cap he thong host.

## Secrets bat buoc

Tao cac gia tri ngau nhien doc lap, toi thieu 32 byte:

- `JWT_SECRET`
- `AUDIT_HASH_SECRET`
- `PROVIDER_FILE_SIGNING_SECRET`
- Khoa Google OAuth, Deepgram/Sonix/AssemblyAI, Translation, SMTP va PayOS

Dung secret manager cua nen tang trien khai. Doi khoa ngay khi khoa xuat hien
trong chat, log, anh chup, commit hoac may khong con tin cay.

## Giam sat va ung pho

- Theo doi `security_audit_events`, ty le HTTP 401/403/429, queue depth, job loi,
  dung luong staging/audio, webhook PayOS bi tu choi va chi phi provider.
- Canh bao khi dang nhap sai tang dot bien, API key tao/thu hoi, payment amount
  mismatch, file bi malware scanner chan hoac queue gan day.
- Sao luu PostgreSQL ma hoa, thu khoi phuc dinh ky va gioi han quyen cua tai
  khoan backup.
- Khi nghi bi xam nhap: khoa ingress, xoay toan bo secrets, tang
  `users.auth_version`/thu hoi refresh sessions, thu hoi API key, doi khoa
  webhook/provider, bao toan audit log va doi chieu giao dich PayOS.

## Kiem tra truoc khi phat hanh

```powershell
cd backend
npm audit --omit=dev

cd ..\frontend
npm audit
npm run build
```

Backend se tu dung khi `NODE_ENV=production` ma con HTTP, secret yeu/trung nhau,
DB tu xa khong TLS, thanh toan demo, worker chay chung API hoac chua bat quet
malware.
