// The public edition's teacher calls (backend/public.js) in the shape the teacher page already
// uses for the school (classes as ids, unlocks as a list), plus the code-classroom extras.
export function publicApi(raw) {
  let meta = {};                                     // classId → { id, name, count, teacherStage }
  const unlocks = () => ({ unlocks: Object.values(meta).filter(c => c.teacherStage > 0)
    .map(c => ({ classCode: c.id, studentName: '', stage: c.teacherStage })) });
  return {
    codes: true,                                     // rooms made of student codes (no roster sheet)
    reloadAfterUnlock: true,                         // per-student unlocks come back with classData
    describeError: raw.describeError,
    label: id => meta[id]?.name || 'ห้องเรียน',
    meta: id => meta[id],
    async teacherClasses() {
      const d = await raw.teacherClasses();
      meta = Object.fromEntries(d.classes.map(c => [c.id, c]));
      return { classes: d.classes.map(c => c.id) };
    },
    getUnlocks: async () => unlocks(),
    classData: id => raw.classData(id),
    // code '' = the whole room
    async setUnlock(id, code, stage) {
      await raw.setUnlock(id, code, stage);
      if (!code && meta[id]) meta[id] = { ...meta[id], teacherStage: Number(stage) || 0 };
      return unlocks();
    },
    resetTips: id => raw.resetTips(id),
    async createClass(name, count) {
      const r = await raw.createClass(name, count);
      meta[r.id] = { id: r.id, name, count, teacherStage: 0 };
      return r;
    },
    async addStudents(id, n) {
      const r = await raw.addStudents(id, n);
      if (meta[id]) meta[id] = { ...meta[id], count: (meta[id].count || 0) + n };
      return r;
    },
    reissueCode: code => raw.reissueCode(code),
    async renameClass(id, name) { await raw.renameClass(id, name); if (meta[id]) meta[id] = { ...meta[id], name }; },
    async deleteClass(id) { await raw.deleteClass(id); delete meta[id]; },
  };
}
