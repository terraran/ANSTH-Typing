// School backend: Google Apps Script + Google Sheets (wraps src/api.js).
// Every call sends exactly what the screens used to send to Apps Script directly.
import { SCRIPT_URL } from '../config';
import { apiGetHomework, apiGetStudentStats, apiGetWeeklyBoard, apiGetWeeklyPast, apiMarkTipsSeen, apiRequest,
  apiSaveMatch, apiSubmitHomework, apiSubmitWeekly, apiTitleRunners, describeApiError, saveSession as apiSaveSession } from '../api';

// true = players sign in and results are saved (false = offline: everything stays on this device)
export const enabled = !!SCRIPT_URL;

export const describeError = describeApiError;

// Signed-in Google account → { classCode, studentName, character, tipsSeen }
export const lookup = () => apiRequest('lookupByEmail');

export const saveSession = apiSaveSession;

export const saveProgress = ({ classCode, studentName, key, stars, cleared }) =>
  apiRequest('saveProgress', { code: classCode, student: studentName, key, stars, cleared });

export const saveCharacter = (classCode, studentName, cfg) =>
  apiRequest('saveCharacter', { code: classCode, student: studentName, character: JSON.stringify(cfg) });

export const getStats = apiGetStudentStats;
export const markTipsSeen = apiMarkTipsSeen;
export const saveMatch = apiSaveMatch;

export const weeklyBoard = apiGetWeeklyBoard;
export const weeklyPast = apiGetWeeklyPast;
export const submitWeekly = apiSubmitWeekly;

export const getHomework = apiGetHomework;
export const submitHomework = apiSubmitHomework;

export const titleRunners = apiTitleRunners;

// ── Teacher page (teacher2.html) — the same Apps Script actions teacher.html uses ──
// → { classes: ['Y603', …] }  (throws 'Unauthorized' for accounts not in TEACHER_EMAILS)
export const teacherClasses = () => apiRequest('getClasses');
// → { students: [{ name, totalSessions, avgCpm, avgAcc, bestCpm, lastActive,
//                  sessions: [{ date, exercise, cpm, wpm, accuracy, errors, chars, duration }] }] }
export const classData = classCode => apiRequest('getClassData', { classCode });
// → { unlocks: [{ classCode, studentName ('' = whole class), stage }], classes: { code: [names] } }
export const getUnlocks = () => apiRequest('getUnlocks');
// stage 0 = remove the unlock; studentName '' = whole class. Replies with getUnlocks' shape.
export const setUnlock = (classCode, studentName, stage) => apiRequest('setUnlock', { classCode, studentName, stage });
// Show Mr.AT's tips again to a whole class → { reset: n }
export const resetTips = classCode => apiRequest('resetTips', { target: classCode });
