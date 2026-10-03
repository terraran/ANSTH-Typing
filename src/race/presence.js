// Race presence: who is still in the race, who dropped out, who left on purpose.
//
// Player status in Firebase:
//   waiting · racing · done · eliminated  — as before
//   left          — left on purpose (forfeit). Never comes back.
//   disconnected  — connection lost (closed tab, network). `dcAt` = server time.
//                   Can come back within the grace period, then counts as left.
// `active: false`  — the player has closed the room after the race (name stays).

export const DC_GRACE_MS = { royale: 60000, '1v1': 15000 };

export function graceMs(type) { return DC_GRACE_MS[type] || DC_GRACE_MS.royale; }

// Effective state at server time `sNow`:
// 'waiting' | 'racing' | 'done' | 'eliminated' | 'left' | 'dc' (can still return) | 'gone' (grace over)
export function playerState(p, type, sNow) {
  const s = p && p.status;
  if (s === 'disconnected') {
    const at = Number(p.dcAt) || 0;
    return at && sNow - at > graceMs(type) ? 'gone' : 'dc';
  }
  return s || 'waiting';
}

// Milliseconds left before a disconnected player counts as gone (0 if not 'dc').
export function dcLeftMs(p, type, sNow) {
  if (!p || p.status !== 'disconnected') return 0;
  return Math.max(0, (Number(p.dcAt) || 0) + graceMs(type) - sNow);
}

export const isOutState = st => st === 'left' || st === 'gone';
export const isAliveState = st => st === 'racing' || st === 'waiting' || st === 'dc';

// Battle Royale order (results, standings, podium):
// finished first (by finish time) → still racing / reconnecting → eliminated → left.
export function brOrder(roomPlayers, sNow = Date.now()) {
  const tier = p => {
    const st = playerState(p, 'royale', sNow);
    return st === 'done' ? 0 : isAliveState(st) ? 1 : st === 'eliminated' ? 2 : 3;
  };
  return Object.entries(roomPlayers || {}).filter(([, p]) => p && !p.isSpectator).sort(([, ap], [, bp]) => {
    const ta = tier(ap), tb = tier(bp);
    if (ta !== tb) return ta - tb;
    if (ta === 0 && ap.finishedAt && bp.finishedAt) return ap.finishedAt - bp.finishedAt;
    if ((bp.pos || 0) !== (ap.pos || 0)) return (bp.pos || 0) - (ap.pos || 0);
    return (bp.cpm || 0) - (ap.cpm || 0);
  });
}

// Is a Battle Royale race over? (someone finished, or at most one player still in)
export function brRaceOver(roomPlayers, info, sNow = Date.now()) {
  if (info && info.status === 'done') return true;
  const racers = Object.values(roomPlayers || {}).filter(p => p && !p.isSpectator);
  const states = racers.map(p => playerState(p, 'royale', sNow));
  if (states.includes('done')) return true;
  return racers.length >= 2 && states.filter(isAliveState).length <= 1;
}

// Short label for lists.
export function stateBadge(st, p, type, sNow) {
  if (st === 'done') return '🏁';
  if (st === 'eliminated') return '💀';
  if (st === 'left' || st === 'gone') return '🚪';
  if (st === 'dc') return '📶 ' + Math.ceil(dcLeftMs(p, type, sNow) / 1000) + 'วิ';
  return '';
}
