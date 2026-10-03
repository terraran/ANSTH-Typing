# แบบฝึกพิมพ์ภาษาไทย (ANSTH-Typing)

## โครงสร้าง
- `index.html` — หน้าเว็บ (CSS + โหลดสคริปต์) **ไม่มีโค้ดแอปแล้ว**
- `src/` — โค้ดแอปทั้งหมด แยกตามหน้าที่
  - `config.js` ค่าตั้งค่า (Google Client ID, Apps Script URL, Firebase)
  - `api.js` เรียก Apps Script · `firebase.js` ห้องแข่ง/Safe Zone · `auth.js` สถานะการเข้าสู่ระบบ
  - `engine/` แป้น Kedmanee, ข้อความ, คะแนน · `data/lessons.js` บทเรียน
  - `ui/` คีย์บอร์ด, กล่องข้อความ ฯลฯ · `screens/` หน้าต่าง ๆ · `race/` 1v1 / Battle Royale
  - `App.jsx` ตัวควบคุมหลัก · `main.jsx` จุดเริ่ม
- `char.js` — ตัวละคร (ไม่ต้องแปลง) · `teacher.html` — หน้าครู · `assets/` — รูป
- `legacy.html` — เวอร์ชันเดิม (Babel) สำรองไว้ ถ้าเวอร์ชันใหม่มีปัญหาให้เปิดหน้านี้แทน

## การเผยแพร่
ทุกครั้งที่อัปโหลด/commit เข้า branch หลัก GitHub Actions จะ
1. รวมโค้ดใน `src/` เป็น `app.js` (ย่อขนาด ไม่ต้องใช้ Babel ในเบราว์เซอร์)
2. ใส่เลขเวอร์ชันให้ `app.js` / `char.js` อัตโนมัติ (ไม่ต้องแก้ `?v=` เอง)
3. เผยแพร่ขึ้น GitHub Pages

ดูสถานะได้ที่แท็บ **Actions** (เครื่องหมาย ✓ เขียว = สำเร็จ)

ตั้งค่าครั้งเดียว: **Settings → Pages → Source = GitHub Actions**

## ทดสอบในเครื่อง (ไม่จำเป็น)
```
npm install
npm run build      # ได้โฟลเดอร์ dist/ = เว็บที่จะเผยแพร่
```
