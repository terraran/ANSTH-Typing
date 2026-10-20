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
