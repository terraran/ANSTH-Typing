// ═══════════════════════════════════════════════════════════════
// BOSS CHASE — the timed (last) step of each stage's boss lesson (src/ui/BossChase.jsx).
//   The boss stole the treasure chest and runs; the student types to catch up.
//   A stage without an entry here keeps the plain timed screen.
//
//   Art (PixelLab, assets/boss/stageN/), all drawn at its own size — never scaled by a fraction:
//   • run / runChest: 8-frame run facing right, one horizontal strip, every frame `w`×`h`
//     (both strips cropped to one shared box, so the feet stay on the same line)
//   • chest: the loose chest (falls off / flies back), faces: half-body dialogue portraits (96×128);
//     faceArt = where the painting ends inside them, so the boss stands right on the screen's bottom edge
//   • obstacle: what the boss throws back — 'rock' is drawn in code
// ═══════════════════════════════════════════════════════════════

const BOSSES = {
  1: {
    name: 'เจ้าหมูป่าจอมป่วน',
    dir: 'assets/boss/stage1/',
    run: 'run.png', runChest: 'run-chest.png', frames: 8, w: 87, h: 60, fps: 11,
    chest: 'chest.png',
    faces: { smug: 'half-smug.png', shock: 'half-shock.png' },
    faceArt: { right: 83, bottom: 116 },   // last painted column / row inside the 96×128 portraits (as stored, before mirroring)
    obstacle: 'rock',
    lines: {
      intro: [
        { face: 'smug', text: 'อู๊ดๆ! กล่องสมบัติของหมู่บ้านเป็นของข้าแล้ว!' },
        { face: 'smug', text: 'อยากได้คืนเหรอ? งั้นพิมพ์ให้เร็ว ๆ แล้ววิ่งไล่ข้าให้ทันสิ!' },
        { face: 'smug', text: 'ระวังก้อนหินของข้าด้วยล่ะ ฮ่าๆ!' },
      ],
      caught: [                                           // ⭐⭐⭐ — before the stomp
        { face: 'shock', text: 'อ๊ะ!? เจ้าตามทันข้าได้ยังไงเนี่ย!' },
        { face: 'shock', text: 'เดี๋ยว ๆ อย่าเพิ่งกระโดดนะ— อู๊ดดด!' },
      ],
      escaped: [                                          // ⭐–⭐⭐ — dropped the chest and got away
        { face: 'smug', text: 'ชิ! ทำกล่องหล่นซะได้…' },
        { face: 'smug', text: 'ครั้งนี้ข้ายอมก่อน แต่คราวหน้าเจ้าไม่ทันข้าแน่! เจอกันใหม่!' },
      ],
      won: [                                              // 0 stars — ran off with the chest
        { face: 'smug', text: 'ฮ่าๆๆ ช้าไปแล้ว! กล่องนี้เป็นของข้า!' },
        { face: 'smug', text: 'ไปฝึกพิมพ์มาใหม่ แล้วค่อยมาไล่ข้าอีกทีนะ!' },
      ],
    },
    taunts: { start: 'อู๊ดๆ ไล่ให้ทันสิ!', throw: 'ฮึ่ย!', throwRage: 'รับไปเลย!!', laugh: 'ฮ่าๆๆ!' },
  },
};

export const bossFor = stage => BOSSES[stage] || null;
