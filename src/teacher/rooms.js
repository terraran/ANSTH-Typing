// Room codes as the school writes them.
// Y603 → Y6.3
export const roomLabel = c => { const m = /^Y(\d)(\d{2})$/.exec(c || ''); return m ? `Y${m[1]}.${parseInt(m[2], 10)}` : c; };

// Rooms grouped by grade for the sidebar: Y601, Y602 → "Y6"; codes without a grade go in one unnamed group.
export function groups(classes) {
  const m = new Map();
  for (const c of classes) { const g = (/^Y(\d)\d{2}$/.exec(c) || [])[1]; const k = g ? 'Y' + g : ''; m.set(k, [...(m.get(k) || []), c]); }
  return [...m];
}

// The weekly-test grade a room belongs to (grades come from getWeeklyTests, e.g. { grade: 'Y6' }).
export function gradeOf(code, grades) {
  const digit = s => (/\d/.exec(s || '') || [])[0];
  return (grades || []).find(g => code.startsWith(g.grade)) || (grades || []).find(g => digit(g.grade) === digit(code)) || null;
}

export const sameRoom = (a, b) => roomLabel(String(a || '')) === roomLabel(String(b || ''));
