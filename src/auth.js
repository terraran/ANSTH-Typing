// Signed-in session (shared, mutable): Google ID token / subject, Firebase auth subject,
// whether Google Identity Services has been initialised.
export const auth = { idToken: '', subject: '', fbSubject: '', gisInit: false };

export // Decode Google JWT to get user profile
function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(atob(base64));
  } catch { return null; }
}
