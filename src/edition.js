// Which edition this build is: the school site (edition.json = {}) or the public one.
// edition.json sits at the repo root and is read at build time only (not copied into dist/).
// Anything the two editions do differently lives here: wording, feature switches, the backend.
import overrides from '../edition.json';
import * as schoolBackend from './backend/school';

const SCHOOL = {
  id: 'school',
  // Features only the school has
  teacherLink: true,   // "สำหรับครู ›" link on the class picker
  homework: true,      // การบ้าน button + list
  weekly: true,        // ภารกิจประจำสัปดาห์ (weekly test board)
  saveMatch: true,     // 1v1 / Battle Royale results → Matches sheet
  // Wording that differs
  text: {
    pickerTitle: 'เข้าเล่นด้วยบัญชีโรงเรียน',
    pickerLooking: 'กำลังค้นหาห้องเรียนของคุณ...',
    pickerNotFound: 'ตรวจว่าเข้าด้วยบัญชีโรงเรียน หรือแจ้งครูให้เพิ่มอีเมลนี้ในรายชื่อห้อง',
  },
};

export const EDITION = { ...SCHOOL, ...overrides, text: { ...SCHOOL.text, ...(overrides.text || {}) } };

// One set of calls the screens use for saving/loading, whichever backend is behind it.
export const backend = schoolBackend;
