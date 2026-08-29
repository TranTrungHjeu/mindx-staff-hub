# MindX Staff Schedule Viewer (Standalone Project)

Dự án **Trang Tra cứu Lịch độc lập** dành cho MindX Technology School. Dự án kết nối **trực tiếp với LMS GraphQL API** của MindX mà không cần server backend trung gian.

---

## 🔑 Biến Môi Trường (Required ENV Variables)

Tạo file `.env` tại thư mục gốc của dự án với các biến sau:

```env
# ----- Auth (Server-side only — KHÔNG thêm prefix NEXT_PUBLIC_) -----
TE_USERNAME=I3470
TE_PASSWORD=MindX@2024

# ----- LMS Endpoints -----
LMS_GATEWAY_URL=https://lms-api.mindx.edu.vn/
LMS_BASE_URL=https://base-api.mindx.edu.vn/
LMS_ORIGIN=https://lms.mindx.edu.vn
LMS_REFERER=https://lms.mindx.edu.vn/
FIREBASE_API_KEY=AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4

# ----- Config Mặc định -----
NEXT_PUBLIC_DEFAULT_CENTRE_IDS=6443460f94300678908f7974
```

---

## 🚀 Hướng Dẫn Chạy & Deploy

### 1. Chạy ở Môi trường Local:
```bash
# Cài đặt thư viện
npm install

# Chạy server phát triển (Port 3001)
npm run dev
```
Truy cập: `http://localhost:3001`

### 2. Triển khai (Deploy) công khai:
- **Vercel / Railway / Render / Netlify:**
  1. Push dự án lên GitHub / GitLab.
  2. Tạo dự án mới trên Vercel / Railway.
  3. Cấu hình các **Environment Variables** đầy đủ như bảng trên.
  4. Deploy!

- **Docker / VPS:**
  ```bash
  npm run build
  npm run start
  ```

---

## 🛠️ Tóm Tắt Kiến Trúc
- **Standalone 100%:** Server-side route handlers trong Next.js tự động gửi yêu cầu đăng nhập LMS qua Firebase Auth API để lấy Bearer Token, sau đó gọi GraphQL Gateway.
- **Read-Only Viewer:** Dùng cho nhân viên/giảng viên tra cứu ma trận lịch học theo cơ sở mà không cần đăng nhập tài khoản cá nhân.
