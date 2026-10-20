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

// Homework → { homework: [{ hwId, classCode, studentName ('' = whole class), title, mode ('stage'|'exercise'), stage,
//   lessonId, exerciseTitle, minStars, dueDate 'yyyy-MM-dd', total, passed, tried }], classes: { code: [names] }, today }
export const homeworkList = () => apiRequest('getHomeworkList');
// → { students: [{ name, status ('none'|'tried'|'late'|'passed'), best, wpm, acc, attempts, passedAt, lastAt }] }
export const homeworkResults = hwId => apiRequest('getHomeworkResults', { hwId });
// New: { classCode, studentName, mode, stage, lessonId, exerciseTitle, title, minStars, dueDate } · edit: { hwId, minStars, dueDate }
// Both reply with homeworkList's shape.
export const setHomework = values => apiRequest('setHomework', values);
export const deleteHomework = hwId => apiRequest('deleteHomework', { hwId });

// Weekly tests → { tests: [{ testId, grade, weekStart, lessonId, exerciseTitle, stage, showHints, done, total }],
//   grades: [{ grade, students }], currentWeek 'yyyy-MM-dd' (Monday) }
export const weeklyTests = () => apiRequest('getWeeklyTests');
// → { ranking: [{ rank, name, displayName, room, score, max, kpm, wpm, accuracy, attempts, lastAt }], notDone: [{ room, names }] }
export const weeklyResults = testId => apiRequest('getWeeklyResults', { testId });
// { grade, weekStart, lessonId, exerciseTitle, showHints '1'|'0', stage } — replaces that grade's test for the week
export const setWeeklyTest = values => apiRequest('setWeeklyTest', values);
export const deleteWeeklyTest = testId => apiRequest('deleteWeeklyTest', { testId });
