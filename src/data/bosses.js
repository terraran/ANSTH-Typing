// ═══════════════════════════════════════════════════════════════
// BOSS CHASE — the timed (last) step of each stage's boss lesson (src/ui/BossChase.jsx).
//   The boss stole something (stage 1: the treasure chest) and runs; the student types to catch up.
//   A stage without an entry here keeps the plain timed screen.
//
//   Art (PixelLab, assets/boss/stageN/), all drawn at its own size — never scaled by a fraction:
//   • run / runChest: 8-frame run facing right, one horizontal strip, every frame `w`×`h`
//     (both strips cropped to one shared box, so the feet stay on the same line); runChest = carrying what it stole
//   • chest: the stolen thing on its own (falls off / flies back), 24×24 · head: 24×24 icon for the top strip
//   • faces: half-body dialogue portraits (96×128); faceArt = the last painted column / row inside them, so the boss
//     stands right on the screen's bottom edge (`bottom` may differ per face)
//   • qte: what the boss throws at the hero, a different quick-time event per stage (drawn in code):
//     'rock' = Space to jump · 'crows' = keys on the music's beat (`keys`) · 'roots' = mash Space to break free ·
//     'dive' = hold Space under water until the tail has passed · 'seq' = `seqLen` keys from `keys` in order
//   • from stage 4 on the bosses wear no red bandana (each is its own character, not one bandit gang)
// ═══════════════════════════════════════════════════════════════

const BOSSES = {
  1: {
    name: 'เจ้าหมูป่าจอมป่วน',
    dir: 'assets/boss/stage1/',
    run: 'run.png', runChest: 'run-chest.png', frames: 8, w: 87, h: 60, fps: 11,
    chest: 'chest.png',
    head: 'head.png',                        // 24×24 head icon: the stomp counter + the end of the distance bar
    faces: { smug: 'half-smug.png', shock: 'half-shock.png' },
    faceArt: { right: 83, bottom: 116 },   // last painted column / row inside the 96×128 portraits (as stored, before mirroring)
    qte: 'rock',
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
    taunts: { start: 'อู๊ดๆ ไล่ให้ทันสิ!', throw: 'ฮึ่ย!', throwRage: 'รับไปเลย!!', laugh: 'ฮ่าๆๆ!', stomped: 'อ๊าก!! จำไว้นะ!' },
  },
  2: {
    name: 'หุ่นไล่กายักษ์',
    dir: 'assets/boss/stage2/',
    run: 'run.png', runChest: 'run-carry.png', frames: 8, w: 66, h: 81, fps: 11,
    chest: 'item.png',                       // กระบุงข้าวทอง
    head: 'head.png',
    faces: { smug: 'half-smug.png', shock: 'half-shock.png' },
    faceArt: { right: 86, bottom: { smug: 121, shock: 124 } },
    qte: 'crows', keys: ['เ', 'ง', 'ร', '้', 'ำ', 'ไ'],
    lines: {
      intro: [
        { face: 'smug', text: 'ฮ่าๆ! กระบุงข้าวทองของทุ่งนานี้ เป็นของข้าแล้ว!' },
        { face: 'smug', text: 'อยากได้คืนก็พิมพ์ให้เร็ว ๆ แล้ววิ่งไล่ข้าให้ทันสิ!' },
        { face: 'smug', text: 'ระวังฝูงอีกาของข้าด้วย กดแป้นให้ตรงจังหวะ ไม่งั้นโดนรุมจิกนะ!' },
      ],
      caught: [
        { face: 'shock', text: 'ห๊า!? ตามข้าทันได้ยังไงกัน!' },
        { face: 'shock', text: 'อย่า ๆ อย่าเหยียบหมวกฟางข้านะ— อ๊ากก!' },
      ],
      escaped: [
        { face: 'smug', text: 'แย่แล้ว! กระบุงข้าวหล่นซะได้…' },
        { face: 'smug', text: 'คราวนี้ข้ายอมก่อน แต่คราวหน้าอีกาของข้าไม่ปล่อยเจ้าแน่!' },
      ],
      won: [
        { face: 'smug', text: 'ฮ่าๆๆ ช้าไปแล้ว! ข้าวทองนี้เป็นของข้า!' },
        { face: 'smug', text: 'กลับไปฝึกพิมพ์มาใหม่ แล้วค่อยมาไล่ข้าอีกทีนะ!' },
      ],
    },
    taunts: { start: 'ตามมาสิ เจ้าตัวเล็ก!', throw: 'อีกา! จัดการมัน!', throwRage: 'อีกาทั้งฝูง บุก!!', laugh: 'ฮ่าๆๆ!', stomped: 'โอ๊ย! หมวกข้า!' },
  },
  3: {
    name: 'พญาไม้เฒ่า',
    dir: 'assets/boss/stage3/',
    run: 'run.png', runChest: 'run-carry.png', frames: 8, w: 64, h: 86, fps: 11,
    chest: 'item.png',                       // ผลไม้ทอง
    head: 'head.png',
    faces: { smug: 'half-smug.png', shock: 'half-shock.png' },
    faceArt: { right: 84, bottom: { smug: 118, shock: 121 } },
    qte: 'roots',
    lines: {
      intro: [
        { face: 'smug', text: 'ฮึ่ม… ผลไม้ทองของป่าใหญ่ ข้าขอเก็บไว้เองดีกว่า!' },
        { face: 'smug', text: 'อยากได้คืน ก็พิมพ์ให้เร็วแล้ววิ่งตามข้ามาสิ!' },
        { face: 'smug', text: 'ระวังรากไม้ของข้าให้ดี โดนพันขาเมื่อไหร่ ต้องรัว SPACE ให้หลุดเร็ว ๆ ล่ะ!' },
      ],
      caught: [
        { face: 'shock', text: 'เอ๊ะ!? เจ้าตามข้าทันได้ยังไง!' },
        { face: 'shock', text: 'ใบข้าร่วงหมดแล้ว อย่ากระโดดนะ— โอ๊ยยย!' },
      ],
      escaped: [
        { face: 'smug', text: 'ชิ! ผลไม้ทองหลุดมือซะได้…' },
        { face: 'smug', text: 'ข้ายอมรอบนี้ แต่รากไม้ของข้ายังรอเจ้าอยู่นะ!' },
      ],
      won: [
        { face: 'smug', text: 'ฮ่าๆๆ ช้าไปแล้ว! ผลไม้ทองนี้เป็นของข้า!' },
        { face: 'smug', text: 'ไปฝึกพิมพ์มาใหม่ แล้วค่อยมาไล่ข้าอีกที!' },
      ],
    },
    taunts: { start: 'ตามข้ามาเลย!', throw: 'รากไม้ จับมัน!', throwRage: 'รากไม้ทั้งป่า!!', laugh: 'ฮ่าๆๆ!', stomped: 'โอ๊ย! กิ่งข้า!' },
  },
  4: {
    name: 'จระเข้ชาละวัน',
    dir: 'assets/boss/stage4/',
    run: 'run.png', runChest: 'run-carry.png', frames: 8, w: 89, h: 62, fps: 11,
    chest: 'item.png',                       // ไข่มุกยักษ์
    head: 'head.png',
    faces: { smug: 'half-smug.png', shock: 'half-shock.png' },
    faceArt: { right: 88, bottom: { smug: 127, shock: 124 } },
    qte: 'dive',
    lines: {
      intro: [
        { face: 'smug', text: 'ฮ่าๆๆ! ไข่มุกยักษ์แห่งลำธาร ตกเป็นของชาละวันแล้ว!' },
        { face: 'smug', text: 'อยากได้คืนก็พิมพ์ให้เร็ว ๆ แล้ววิ่งไล่ข้ามาสิ!' },
        { face: 'smug', text: 'ระวังหางของข้าให้ดี! กด SPACE ค้างไว้ดำน้ำหลบ แล้วอย่าเพิ่งโผล่จนกว่าหางจะผ่านไปนะ!' },
      ],
      caught: [
        { face: 'shock', text: 'ห๊ะ!? เจ้าตามข้าทันได้ยังไง!' },
        { face: 'shock', text: 'มงกุฎข้าจะหล่นแล้ว อย่ากระโดดนะ— โอ๊ยยย!' },
      ],
      escaped: [
        { face: 'smug', text: 'แย่แล้ว! ไข่มุกหลุดมือซะได้…' },
        { face: 'smug', text: 'ครั้งนี้ข้ายอม แต่ลำธารนี้ยังเป็นถิ่นของชาละวันนะ!' },
      ],
      won: [
        { face: 'smug', text: 'ฮ่าๆๆ ช้าไปแล้ว! ไข่มุกยักษ์เป็นของข้า!' },
        { face: 'smug', text: 'กลับไปฝึกพิมพ์มาใหม่ แล้วค่อยมาไล่ราชาจระเข้อย่างข้า!' },
      ],
    },
    taunts: { start: 'ตามมาเลย ถ้ากล้า!', throw: 'กินหางข้าซะ!', throwRage: 'หางฟาดสะเทือนลำธาร!!', laugh: 'ฮ่าๆๆ!', stomped: 'โอ๊ย! มงกุฎข้า!' },
  },
  5: {
    name: 'ยักษ์หินผา',
    dir: 'assets/boss/stage5/',
    run: 'run.png', runChest: 'run-carry.png', frames: 8, w: 81, h: 70, fps: 11,
    chest: 'item.png',                       // ทับทิมแดง
    head: 'head.png',
    faces: { smug: 'half-smug.png', shock: 'half-shock.png' },
    faceArt: { right: 91, bottom: { smug: 122, shock: 120 } },
    qte: 'seq', seqLen: 2, keys: ['บ', 'ล', 'ฝ', 'ค', 'ต', 'ถ', 'ภ', 'จ', 'ข', 'ช'],   // stage 5's new keys
    lines: {
      intro: [
        { face: 'smug', text: 'โฮะ โฮะ! ทับทิมแดงบนยอดเขา ข้าเอามาเก็บไว้เองแล้ว!' },
        { face: 'smug', text: 'อยากได้คืน ก็พิมพ์ให้เร็วแล้วปีนตามข้ามาสิ!' },
        { face: 'smug', text: 'ข้าจะกลิ้งหินยักษ์ใส่เจ้า! กดแป้นสองตัวตามลำดับให้ทัน แล้วกระโดดข้ามไปให้ได้!' },
      ],
      caught: [
        { face: 'shock', text: 'หา!? เจ้าตัวเล็กตามข้าทันได้ยังไง!' },
        { face: 'shock', text: 'อย่ากระโดดใส่หัวข้านะ หินข้าจะร้าว— โอ๊ยยย!' },
      ],
      escaped: [
        { face: 'smug', text: 'แย่แล้ว! ทับทิมหลุดจากหลังข้าซะได้…' },
        { face: 'smug', text: 'คราวนี้ข้ายอม แต่ภูเขาทั้งลูกยังเป็นของข้านะ!' },
      ],
      won: [
        { face: 'smug', text: 'โฮะ โฮะ โฮะ ช้าไปแล้ว! ทับทิมเป็นของข้า!' },
        { face: 'smug', text: 'กลับไปฝึกพิมพ์มาใหม่ แล้วค่อยมาปีนเขาไล่ข้าอีกที!' },
      ],
    },
    taunts: { start: 'ตามมาสิ ถ้าปีนไหว!', throw: 'รับหินไปซะ!', throwRage: 'หินถล่มทั้งภูเขา!!', laugh: 'ฮ่าๆๆ!', stomped: 'โอ๊ย! หัวข้าร้าว!' },
  },
};

export const bossFor = stage => BOSSES[stage] || null;
