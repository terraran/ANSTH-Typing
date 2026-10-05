import { SCRIPT_URL } from './config';
import { buildChunks, cleanTypingWords, generateBRText, generateStoryText, generateText, generateTimedText, seededRng } from './engine/text';
import { CHAR_CLASS, CLASS_NAMES, KEY_META, findKeyForChar, resolveKey, validateInput } from './engine/keymap';
import { KEYS_ON, KeyTester } from './ui/KeyTester';
import { ERROR_BURST, ERROR_WINDOW_MS, PRESSURE_SECS, SPAM_PENALTY, SPAM_WINDOW_KEYS, SPAM_WRONG_SHARE, SPEED_CPM, TEST_MIN_CHARS, TEST_SECS, HW_SECS, charBasePoints, comboMultiplier, fmtScore, hsKey, lessonStars, netThaiWpmOf, readGuestHighScores, stageTarget, thaiWpmOf, speedMultiplier, testTargetScore, writeGuestHighScores } from './engine/scoring';
import { ROOM_CODE_LEN, ROOM_CODE_RE, ZONE_GAP, ZONE_GRACE, ZONE_TICK, currentFirebaseUid, ensureFirebaseUser, fbArmLobby, fbArmRace, fbClearActiveRoom, fbCreate, fbDisarm, fbGet, fbGetActiveRoom, fbJoin, fbKeepSeat, fbListen, fbRemove, fbServerOffset, fbSetActiveRoom, fbSetChar, fbSetStatus, fbUpdatePlayer, getDB, getZonePos, getZoneSpeed, makeFreeCode, normalizeRoomCode, zonePosAt } from './firebase';
import { brOrder, brRaceOver, dcLeftMs, graceMs, isOutState, playerState } from './race/presence';
import { LeaveConfirm, RejoinBanner } from './race/PresenceUI';
import { apiGetHomework, apiGetStudentStats, apiGetWeeklyBoard, apiGetWeeklyPast, apiSubmitHomework, apiRequest, apiSaveMatch, apiSubmitWeekly, describeApiError, saveSession } from './api';
import { auth } from './auth';
import { LESSONS, findLesson } from './data/lessons';
import { stageOf } from './data/curriculum.js';
import { curriculumText, stageTestText } from './engine/curriculumText.js';
import { RUSH_STARS, emptyProgress, readLocalProgress, stepKey, stepState, writeLocalProgress } from './engine/progress.js';
import { PenaltyScreen, TestTimer, TextDisplay, TextPager, TimeUpOverlay } from './ui/common';
import { NameModal, StoryChoiceScreen } from './screens/Story';
import { ClassPickerScreen, GoogleSignInScreen } from './screens/Login';
import { PX_FONT, PxButton, PxIconButton, Scene, Sprite, TH_FONT } from './ui/pixel';
import { MyStatsScreen } from './screens/MyStatsScreen';
import { LessonScreen } from './screens/LessonScreen';
import { WeeklyBoardScreen } from './screens/WeeklyBoardScreen';
import { BattleRoyaleHud, DeadScreen, OneVsOneHud } from './race/Hud';
import { OnScreenKeyboard } from './ui/keyboard';
import { CountdownScreen, LobbyScreen, MPSetupScreen } from './race/Setup';
import { BattleRoyaleResults, HostDashboard, SpectatorView } from './race/Host';
import { ResultsScreen } from './screens/ResultsScreen';
import { PERF_ON, PerfMeter, perf } from './ui/PerfMeter';

// BR anti-AFK: after the zone starts moving, no correct key for AFK_FIRST_MS → lose 1 life,
// then 1 more every AFK_REPEAT_MS. Spam-penalty freezes and connection drops don't count.
const AFK_FIRST_MS = 15000, AFK_REPEAT_MS = 5000, AFK_WARN_MS = 8000;

const { useCallback, useEffect, useMemo, useRef, useState } = React;

export function ThaiTypingApp() {
  if (PERF_ON) perf.renders++;
  const [screen,        setScreen]        = useState(SCRIPT_URL ? 'google-login' : 'lessons');
  const [classCode,     setClassCode]     = useState('');
  const [studentName,   setStudentName]   = useState('');
  const [displayName,   setDisplayName]   = useState('');
  const [saveStatus,    setSaveStatus]    = useState('idle'); // idle|saving|saved|error
  const [saveError,     setSaveError]     = useState('');
  const [lesson,        setLesson]        = useState(null);
  const [exercise,      setExercise]      = useState(null);
  const [target,        setTarget]        = useState('');
  const [pos,           setPos]           = useState(0);
  const [errors,        setErrors]        = useState(0);
  const [startTime,     setStartTime]     = useState(null);
  const [endTime,       setEndTime]       = useState(null);
  const [hint,          setHint]          = useState(null);
  const [flashCode,     setFlashCode]     = useState(null);
  const [shiftHeld,     setShiftHeld]     = useState(false);
  const [capsLockOn,    setCapsLockOn]    = useState(false);
  const [now,           setNow]           = useState(Date.now());
  const [penaltySecs,   setPenaltySecs]   = useState(0);  // >0 = frozen by spam penalty
  const [maxLives,      setMaxLives]      = useState(3);  // BR life count for this room
  const [pressureSecs,  setPressureSecs]  = useState(0);  // 1v1 countdown after opponent finishes
  const [bestCombo,     setBestCombo]     = useState(0);  // longest scoring streak this run
  // Multiplayer (Phase 4)
  const [roomCode,    setRoomCode]    = useState('');
  const [roomType,    setRoomType]    = useState(''); // '1v1'|'royale'
  const [isHost,      setIsHost]      = useState(false);
  const [roomPlayers, setRoomPlayers] = useState({});
  const [roomInfo,    setRoomInfo]    = useState(null);
  const [playerLives, setPlayerLives] = useState(3);
  const [countNum,    setCountNum]    = useState(3);
  const [joinCode,    setJoinCode]    = useState('');
  const [joinError,   setJoinError]   = useState('');
  const [mpBusy,      setMpBusy]      = useState(false);
  const [raceStand,   setRaceStand]   = useState([]);
  const [mpSetupMode, setMpSetupMode] = useState(''); // '1v1'|'royale'
  // Leaving / dropping out / coming back (race presence)
  const [leaveAsk,    setLeaveAsk]    = useState(false);  // "are you sure?" while a race runs
  const [rejoinOffer, setRejoinOffer] = useState(null);   // {code,type,expiresAt} — dropped out, can return
  const [rejoinBusy,  setRejoinBusy]  = useState(false);
  const [notice,      setNotice]      = useState('');     // one-line message (room closed, …)
  const [brOver,      setBrOver]      = useState(false);  // Battle Royale finished (for spectators)
  const [brFinal,     setBrFinal]     = useState(null);   // Battle Royale final order, locked 2 s after the end
  const [rivalDcSecs, setRivalDcSecs] = useState(0);      // 1v1: seconds the dropped opponent has left
  const [presTick,    setPresTick]    = useState(0);      // 1 s tick: re-check grace periods
  const [zonePos,     setZonePos]     = useState(0); // safe zone boundary position
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [serverTimeReady, setServerTimeReady] = useState(false);
  const [ghostData,     setGhostData]     = useState(null);  // best previous run {timings,cpm,accuracy}
  const [ghostKey,      setGhostKey]      = useState('');    // localStorage key for this exercise
  const [newRecord,     setNewRecord]     = useState(false); // did this run set a new ghost record?
  const [adventureName, setAdventureName] = useState(()=>{ try{return localStorage.getItem('adventureName')||'';}catch(e){return '';} });
  const [storyPath,     setStoryPath]     = useState(()=>{ try{return localStorage.getItem('storyPath')||'';}catch(e){return '';} });
  const [storyPower,    setStoryPower]    = useState(()=>{ try{return localStorage.getItem('storyPower')||'';}catch(e){return '';} });
  const [showNameModal, setShowNameModal] = useState(false);
  const pendingStoryRef = useRef(null);
  // Google Sign-In
  const [googleUser, setGoogleUser]   = useState(null); // { name, email, picture, sub }
  // Pixel character — saved per Google account (school computers are shared)
  const [character, setCharacter] = useState(()=>window.CharKit?CharKit.loadLocal('guest'):null);
  // Weekly test (one per grade level per week)
  const [weekly,       setWeekly]       = useState(null);   // board payload from getWeeklyBoard
  const [weeklyStatus, setWeeklyStatus] = useState('idle'); // idle|loading|ok|error
  const [testBoard,    setTestBoard]    = useState(null);   // board returned right after submitting
  const [timeUp,       setTimeUp]       = useState(false);  // "⏰ หมดเวลา!" overlay
  // BR Zone & spectator
  const [zoneWpm,       setZoneWpm]       = useState(0);
  const [zoneTs,        setZoneTs]        = useState(0);   // timestamp of last zone update
  const [isHostSpectator, setIsHostSpectator] = useState(false);
  const [spectatingPlayer, setSpectatingPlayer] = useState(null);
  const zoneDrainRef  = useRef(null);   // interval for zone life drain
  const lastZoneCalcRef = useRef(0);    // timestamp of last zone calc
  const serverTimeOffsetRef = useRef(0);
  const lastZoneDrainTickRef = useRef(0);
  const afkBaseRef    = useRef(0);       // BR: time of last correct key (or forgiven pause)
  const afkHitsRef    = useRef(0);       // BR: AFK lives lost since then
  const offlineRef    = useRef(false);   // Firebase connection currently down
  const [afkLeft, setAfkLeft] = useState(null);   // BR: seconds until the next AFK life loss (warning)
  // Theme: 'light' | 'dark' | 'auto'
  const [themeMode, setThemeMode] = useState(()=>{ try{return localStorage.getItem('theme')||'light';}catch{return 'light';} });
  const isDark = false;   // dark theme paused: the pixel scene is a daytime scene

  const keystrokeTimes = useRef([]);
  const errorTimes     = useRef([]);
  const hasSaved       = useRef(false);   // prevents double-save on same results screen
  const fbUnsub        = useRef(null);    // Firebase listener cleanup
  const lastFBUp       = useRef(0);       // throttle Firebase position writes
  const rcRef          = useRef('');      // roomCode ref (avoids stale closures)
  const rtRef          = useRef('');      // roomType ref
  const plRef          = useRef(3);       // playerLives ref
  const snRef          = useRef('');      // studentName ref
  const myRoomName     = useRef('');      // name used when joining/creating room (used for all Firebase writes)
  const charRef        = useRef(null);
  const roomInfoRef    = useRef(null);
  const roomPlayersRef = useRef({});
  const isHostRef      = useRef(false);
  const ccRef          = useRef('');       // class code (sent with room joins for match stats)
  const leaveAskRef    = useRef(false);
  const raceRunningRef = useRef(false);
  const requestLeaveRef= useRef(()=>{});
  const brFinalRef     = useRef(null);
  const matchSavedRef  = useRef('');     // matchId already sent to the Matches sheet    // latest character (for room create/join callbacks)
  const practiceRef    = useRef(null);    // typing area — scrolled into view once per run
  const currentTimings = useRef([]);       // inter-keystroke intervals for ghost recording
  const lastCorrectTime= useRef(null);     // timestamp of last correct keypress
  const frozenRef      = useRef(false);    // true while spam penalty is active
  const raceEndedRef   = useRef(false);    // guards against double race-end triggers
  const pressCountRef  = useRef(0);        // total keypresses for KPM calculation
  // Scoring (solo, weekly test and 1v1)
  const [score,       setScore]       = useState(0);
  const [scoreStreak, setScoreStreak] = useState(0);
  const [lastGain,    setLastGain]    = useState(null);   // {v,id} for the +points pop-up
  const scoreRef      = useRef(0);
  const streakRef     = useRef(0);
  const scoredIdx     = useRef(new Set());  // positions already scored (no backspace farming)
  const missedIdx     = useRef(new Set());  // positions typed wrong at least once → 0 points
  const speedBuf      = useRef([]);         // last 5 correct-key intervals
  const lastScoreTime = useRef(null);
  const lessonIdRef   = useRef(1);
  // Test mode
  const [activeTest,  setActiveTest]  = useState(null); // weekly test being taken
  const [activeHw,    setActiveHw]    = useState(null); // homework being done
  const [hwResult,    setHwResult]    = useState(null); // {stars,minStars,passed,late,wpm,target,net,accuracy}
  const [homework,    setHomework]    = useState([]);   // my homework list (getHomework)
  const hwRef         = useRef(null);
  const hwLoadedAt    = useRef(0);
  const [maxScore,    setMaxScore]    = useState(0);    // weekly test: target score (100%)
  const [highScores,  setHighScores]  = useState({});   // practice best per exercise
  const [prevBest,    setPrevBest]    = useState(0);    // high score before this run
  // Curriculum progress: best ⭐ per step, lessons cleared by a ⚔️ Rush, stage unlocked by the teacher.
  // Signed in → from the Progress sheet (getStudentStats); guest → this device only.
  const [progress,    setProgress]    = useState(()=>readLocalProgress());
  const [curResult,   setCurResult]   = useState(null);  // curriculum: {stars, prevStars, wpm, target, net} of the last run
  const testRef       = useRef(null);
  const hsDone        = useRef(false);
  const highScoresRef = useRef({});   // latest highScores for callbacks with [] deps (ghost score fallback)
  useEffect(() => { highScoresRef.current = highScores; }, [highScores]);

  // ── Derived values — declared early so all effects can reference them ──
  // Text, chunks and the visible chunk are memoised so memoised children (TextDisplay)
  // only re-render when what they show actually changes.
  const targetChars = useMemo(() => target ? [...target] : [], [target]);
  const totalChars  = targetChars.length;
  // Split target into ~2-line word-boundary chunks (see buildChunks above)
  // Pages of 3 real lines, measured by <TextPager> at the text box's width; until it has measured
  // this text (first frame, or a text it hasn't seen), fall back to the old fixed-size chunks.
  const [measured, setMeasured] = useState(null);         // {src: targetChars, chunks}
  const onPages = useCallback((src, ch) => setMeasured(m =>
    m && m.src===src && JSON.stringify(m.chunks)===JSON.stringify(ch) ? m : {src, chunks:ch}), []);
  const chunks = useMemo(() => (measured && measured.src===targetChars && measured.chunks.length)
    ? measured.chunks : buildChunks(targetChars), [targetChars, measured]);
  // Derive chunkIdx from pos — always in sync, no stale-state lag
  const chunkIdx = (() => {
    for (let i=0; i<chunks.length; i++) { if (pos < chunks[i].end) return i; }
    return Math.max(0, chunks.length-1);
  })();
  const curChunk    = chunks[chunkIdx] || {start:0, end:totalChars};
  const displayChars = useMemo(() => targetChars.slice(curChunk.start, curChunk.end), [targetChars, curChunk.start, curChunk.end]);
  const displayPos   = Math.max(0, pos - curChunk.start);

  // Live values are computed at render time (each keystroke renders), so no clock tick is needed.
  const elapsed     = startTime ? ((endTime??Date.now())-startTime)/60000 : 0;
  const kpm         = elapsed>0 ? Math.round(pressCountRef.current/elapsed) : 0;
  const wpm         = elapsed>0 ? Math.round(pos/elapsed/5) : 0;
  const accuracy    = (pos+errors)>0 ? Math.round((pos/(pos+errors))*100) : 100;
  const isEliminated = roomType==='royale' && playerLives<=0;
  // A race I am still in: leaving it now needs confirmation and counts as a forfeit.
  const raceRunning = !!roomCode && (screen==='countdown' || (screen==='practice' && !endTime && !isEliminated));
  const nextChar    = pos<targetChars.length ? targetChars[pos] : null;
  // Timed run: weekly test (2 min) or a timed curriculum step (exercise.secs). 0 = untimed.
  const timeLimit   = activeHw ? HW_SECS : activeTest ? TEST_SECS : (!roomCode && exercise?.secs) || 0;
  const nextKey     = nextChar ? findKeyForChar(nextChar) : null;
  const nextCode    = nextKey?.code ?? null;
  const needsShift  = nextKey?.needsShift ?? false;
  // Correct shift hand: left-hand target → Right Shift; right-hand target → Left Shift
  const showHints   = !activeTest || activeTest.showHints !== false;
  // My look on the race track: saved character, else the stable one from my room name
  useEffect(() => {
    if (studentName && character && window.CharKit) CharKit.saveLocal('last', character);
  }, [studentName, character]);

  const myCfg = window.CharKit
    ? (CharKit.sanitize(character) || CharKit.fromName(myRoomName.current||studentName||'ผู้เล่น1'))
    : null;
  const correctShiftCode = (needsShift && nextCode)
    ? (['LP','LR','LM','LI'].includes(KEY_META[nextCode]?.f) ? 'ShiftRight' : 'ShiftLeft')
    : null;

  // Every screen fits the window (no page scrolling): the race lane gets shorter on short screens.
  const [viewH, setViewH] = useState(()=>window.innerHeight);
  useEffect(() => {
    const on=()=>setViewH(window.innerHeight);
    window.addEventListener('resize',on);
    return ()=>window.removeEventListener('resize',on);
  },[]);
  const laneH = viewH<720 ? 84 : 100;

  // ?perf=1: time from key press to the next frame
  useEffect(() => {
    if (!PERF_ON || !perf.t0) return;
    const t0=perf.t0; perf.t0=0;
    requestAnimationFrame(()=>{ perf.lat.push(performance.now()-t0); if (perf.lat.length>100) perf.lat.shift(); });
  }, [pos, errors, hint, flashCode]);

  // Hide loading screen after React's first render completes
  useEffect(() => {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
  }, []);
  // Sync theme to document + listen for system changes
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme', isDark?'dark':'light');
    try{ localStorage.setItem('theme', themeMode); }catch{}
  },[isDark, themeMode]);


  // Clock tick while typing (faster during the weekly test so the ring moves smoothly)
  useEffect(() => {
    if (screen!=='practice'||!startTime||endTime||!timeLimit) return;   // only timed runs need a clock tick
    const id=setInterval(()=>setNow(Date.now()),200);
    return ()=>clearInterval(id);
  },[screen,startTime,endTime,timeLimit]);

  // Weekly test: 2 minutes from the first keypress, then "⏰ หมดเวลา!" → results.
  // The clock keeps running during a spam penalty (that is part of the penalty).
  useEffect(() => {
    if (screen!=='practice'||!timeLimit||!startTime||endTime) return;
    if (now-startTime < timeLimit*1000) return;
    setEndTime(startTime+timeLimit*1000);
    frozenRef.current=false; setPenaltySecs(0);
    setTimeUp(true);
    setTimeout(()=>{ setTimeUp(false); setScreen(s=>s==='practice'?'results':s); },1400);
  },[now,screen,timeLimit,startTime,endTime]);

  // Spam penalty freeze — 5s, then resume the SAME race at the same position
  useEffect(() => {
    if (penaltySecs<=0) return;
    const t=setTimeout(()=>{
      const next=penaltySecs-1;
      setPenaltySecs(next);
      if (next<=0) {
        frozenRef.current=false;
        keystrokeTimes.current=[]; errorTimes.current=[];
        lastCorrectTime.current=null;   // don't count frozen time as a keystroke gap
        afkBaseRef.current=Date.now(); afkHitsRef.current=0;   // frozen time is not AFK
      }
    },1000);
    return ()=>clearTimeout(t);
  },[penaltySecs]);

  // 1v1 pressure timer — starts when the opponent finishes first. When it runs
  // out, send this player's final score so both sides can settle the winner.
  useEffect(() => {
    if (pressureSecs<=0) return;
    const t=setTimeout(()=>{
      const next=pressureSecs-1;
      setPressureSecs(next);
      if (next<=0 && screen==='practice') {
        setEndTime(Date.now());
        if (rcRef.current) {
          fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'ผู้เล่น1',
            {pos:stateRef.current.pos,score:scoreRef.current,status:'done'}).catch(()=>{});
        }
        setScreen('results');
      }
    },1000);
    return ()=>clearTimeout(t);
  },[pressureSecs,screen]);

  // Zone countdown tick — re-render every second during BR to animate countdown
  useEffect(() => {
    if (roomType !== 'royale') return;
    const id = setInterval(() => setZoneTs(t => t > 0 ? t : 0), 1000);
    return () => clearInterval(id);
  }, [roomType]);

  // Use Firebase's clock offset so every device measures the race from the
  // same server time, even when their local clocks differ.
  useEffect(() => {
    const db = getDB();
    if (!db || !roomCode) return;
    const ref = db.ref('.info/serverTimeOffset');
    const onOffset = snap => {
      const offset = Number(snap.val()) || 0;
      serverTimeOffsetRef.current = offset;
      setServerTimeOffset(offset);
      setServerTimeReady(true);
    };
    ref.on('value', onOffset);
    return () => ref.off('value', onOffset);
  }, [roomCode]);

  // A watching host uses the exact same scheduled race start as the players.
  useEffect(() => {
    if (screen==='host-dashboard' && roomInfo?.raceStartsAt && serverTimeReady) {
      setStartTime(roomInfo.raceStartsAt-serverTimeOffsetRef.current);
    }
  }, [screen, roomInfo?.raceStartsAt, serverTimeReady]);

  // Firebase room listener — active during lobby / countdown / practice / results
  // (results keeps listening so the 1v1 winner updates when the opponent finishes)
  useEffect(() => {
    if (!roomCode) return;
    if (screen!=='mp-lobby' && screen!=='countdown' && screen!=='practice' && screen!=='host-dashboard' && screen!=='results') return;
    // Room updates arrive every time anyone types (30 players ≈ 90 per second).
    // Apply at most 4 per second: first one at once, the rest batched to the latest.
    let pending=null, timer=null, last=0;
    const apply = data => {
      setRoomInfo(data.info);
      setRoomPlayers(data.players || {});
      if (data.zone?.cpm || data.zone?.wpm) { setZoneWpm(data.zone.cpm||data.zone.wpm); setZoneTs(data.zone.ts||Date.now()); }
      if (data.info?.maxLives) setMaxLives(data.info.maxLives);
      // ── Lobby/countdown: host manually triggers countdown ──
      if (data.info?.status==='countdown' && screen==='mp-lobby') setScreen('countdown');
    };
    const flush = () => { timer=null; last=Date.now(); const d=pending; pending=null; if (d) apply(d); };
    const unsub = fbListen(roomCode, (data) => {
      if (!data) {
        clearTimeout(timer); timer=null; pending=null;
        // The host closed the room before the race started.
        if (screen==='mp-lobby' || screen==='countdown') { cleanupRoomLocal(); setNotice('เจ้าของห้องปิดห้องแล้ว'); }
        return;
      }
      pending=data;
      const wait=250-(Date.now()-last);
      if (wait<=0) flush();
      else if (!timer) timer=setTimeout(flush,wait);
    });
    fbUnsub.current = unsub;
    return () => { clearTimeout(timer); unsub(); fbUnsub.current=null; };
  },[roomCode, screen, isHost]);

  // Presence clock: re-check grace periods once a second during a race.
  useEffect(() => {
    if (!roomCode || !['practice','host-dashboard','results'].includes(screen)) return;
    const id = setInterval(() => setPresTick(t => t+1), 1000);
    return () => clearInterval(id);
  }, [roomCode, screen]);

  // Who is still in the race? Ends the race when it is over — also when players
  // left on purpose or dropped out and did not come back in time.
  useEffect(() => {
    if (!roomCode || !roomInfo) return;
    const sNow = Date.now()+serverTimeOffsetRef.current;
    if (roomInfo.type==='royale') {
      const over = brRaceOver(roomPlayers, roomInfo, sNow);
      setBrOver(over);
      if (over && roomInfo.status!=='done' && isHost && roomInfo.status==='countdown') {
        fbSetStatus(roomCode,'done',{endedAt:Date.now()}).catch(()=>{});
      }
      if (screen==='practice' && over && !raceEndedRef.current) {
        raceEndedRef.current=true;
        setEndTime(Date.now());
        // last position (the 350 ms throttle may have skipped it) — used for the final order
        fbUpdatePlayer(roomCode,'',{pos:stateRef.current.pos}).catch(()=>{});
        finishPresence();
        setTimeout(()=>setScreen(s=>s==='practice'?'results':s),400);
      }
    } else if (roomInfo.type==='1v1' && screen==='practice') {
      const uid = currentFirebaseUid();
      const rv = Object.entries(roomPlayers||{}).find(([k,p])=>p&&!p.isSpectator&&k!==uid&&p.uid!==uid)?.[1];
      const rs = rv ? playerState(rv,'1v1',sNow) : null;
      setRivalDcSecs(rs==='dc' ? Math.ceil(dcLeftMs(rv,'1v1',sNow)/1000) : 0);
      if (raceEndedRef.current || stateRef.current.endTime) return;
      if (rs && isOutState(rs)) {
        // Opponent left (or dropped and did not return) → I win now.
        raceEndedRef.current=true;
        setPressureSecs(0); setRivalDcSecs(0);
        setEndTime(Date.now());
        fbUpdatePlayer(roomCode,'',{pos:stateRef.current.pos,score:scoreRef.current,status:'done'}).catch(()=>{});
        finishPresence();
        setScreen('results');
      } else if (rs==='done') {
        const me = roomPlayers?.[uid];
        if (!me || me.status!=='done') { raceEndedRef.current=true; setPressureSecs(PRESSURE_SECS); }
      }
    }
  }, [roomPlayers, roomInfo, presTick, screen, roomCode, isHost]);

  // Race over for me (finished / eliminated / results): nothing happens on disconnect any more.
  useEffect(() => {
    if (!roomCode) return;
    if (screen==='results' || (roomType==='royale' && playerLives<=0 && screen==='practice')) finishPresence();
  }, [screen, playerLives, roomCode, roomType]);

  // Connection came back while still racing (Firebase reconnects by itself):
  // re-arm the disconnect marker and mark me racing again — unless I was gone too long.
  useEffect(() => {
    if (!roomCode || screen!=='practice') return;
    const db = getDB(); if (!db) return;
    const ref = db.ref('.info/connected');
    const onConn = snap => {
      if (snap.val()!==true) { offlineRef.current=true; return; }
      if (offlineRef.current) { offlineRef.current=false; afkBaseRef.current=Date.now(); afkHitsRef.current=0; }
      const code = rcRef.current;
      if (!code || raceEndedRef.current || stateRef.current.endTime) return;
      if (rtRef.current==='royale' && plRef.current<=0) return;
      try { fbArmRace(code); } catch {}
      const me = roomPlayersRef.current?.[currentFirebaseUid()];
      if (me && me.status==='disconnected') {
        const sNow = Date.now()+serverTimeOffsetRef.current;
        if (dcLeftMs(me,rtRef.current,sNow)<=0) {
          setNotice('การเชื่อมต่อหลุดนานเกินไป — ถูกนับว่าออกจากการแข่งขัน');
          handleLeaveRoomRef.current();
        } else fbUpdatePlayer(code,'',{status:'racing'}).catch(()=>{});
      }
    };
    ref.on('value', onConn);
    return () => ref.off('value', onConn);
  }, [roomCode, screen]);

  // Browser warning before refresh / closing the tab during a race.
  useEffect(() => {
    if (!raceRunning) return;
    const h = e => { e.preventDefault(); e.returnValue=''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [raceRunning]);

  // Countdown 3,2,1 → start race
  useEffect(() => {
    if (screen !== 'countdown') return;
    const raceStartsAt = Number(roomInfo?.raceStartsAt);
    if (!raceStartsAt || !serverTimeReady) return;
    let launched = false;
    const launch = () => {
      const remaining = raceStartsAt - (Date.now()+serverTimeOffsetRef.current);
      setCountNum(Math.min(3,Math.max(1,Math.ceil(remaining/1000))));
      if (remaining > 0 || launched) return;
      launched = true;
      clearInterval(id);
      // Reset race data, then use the shared server-scheduled start instant.
      setPos(0); setErrors(0); setStartTime(raceStartsAt-serverTimeOffsetRef.current); setEndTime(null);
      setHint(null); setFlashCode(null); setShiftHeld(false); setNow(Date.now());
      keystrokeTimes.current=[]; errorTimes.current=[];
      currentTimings.current=[]; lastCorrectTime.current=null;
      hasSaved.current=false; setSaveStatus('idle'); setSaveError('');
      setNewRecord(false);
      setPlayerLives(maxLives); plRef.current=maxLives;
      // Scoring starts fresh for every race (1v1 is decided by score)
      setScore(0); scoreRef.current=0; setScoreStreak(0); streakRef.current=0; setLastGain(null);
      scoredIdx.current=new Set(); missedIdx.current=new Set();
      speedBuf.current=[]; lastScoreTime.current=null; setBestCombo(0);
      setActiveTest(null); testRef.current=null; setTestBoard(null); setTimeUp(false);
      setActiveHw(null); hwRef.current=null; setHwResult(null);
      setRaceStand([]); setZonePos(0); setZoneWpm(0); lastZoneDrainTickRef.current=0;
      setPenaltySecs(0); setPressureSecs(0);
      frozenRef.current=false; raceEndedRef.current=false;
      pressCountRef.current=0;
      // From now on a lost connection marks me "disconnected" (I can come back),
      // and this account remembers which race it is in.
      const code=rcRef.current;
      try { fbArmRace(code); } catch {}
      fbSetActiveRoom(code, rtRef.current).catch(()=>{});
      setScreen('practice');
    };
    const id = setInterval(launch,100);
    launch();
    return () => clearInterval(id);
  },[screen,roomInfo?.raceStartsAt,serverTimeReady,serverTimeOffset,maxLives]);

  // All clients derive the same moving boundary from the scheduled race start.
  useEffect(() => {
    if ((screen !== 'practice' && screen !== 'host-dashboard') || roomType !== 'royale') return;
    if (screen === 'practice' && !startTime) return;
    const update = () => {
      const elapsed = (Date.now()-startTime)/1000;
      setZonePos(getZonePos(startTime,totalChars));
      setZoneWpm(getZoneSpeed(elapsed));
    };
    update();
    const id = setInterval(update,250);
    return () => clearInterval(id);
  }, [screen, roomType, startTime, totalChars]);

  // Damage checks use the race-wide 10-second tick, not an interval started
  // independently on each player's first keypress.
  useEffect(() => {
    if (screen !== 'practice' || roomType !== 'royale' || !startTime) return;
    const id = setInterval(() => {
      const elapsedMs = Date.now()-startTime;
      const tick = Math.floor(elapsedMs/ZONE_TICK);
      if (tick<=0 || tick<=lastZoneDrainTickRef.current) return;
      lastZoneDrainTickRef.current=tick;
      const boundary = getZonePos(startTime,totalChars);
      const outside = boundary-stateRef.current.pos>ZONE_GAP;
      if (!outside || plRef.current<=0) return;
      const newLives = Math.max(0,plRef.current-1);
      setPlayerLives(newLives); plRef.current=newLives;
      fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'Player',{lives:newLives});
      if (newLives===0) fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'Player',{status:'eliminated'});
    },250);
    return () => clearInterval(id);
  }, [screen, roomType, startTime]);

  // BR anti-AFK — runs on this client only; see AFK_* constants.
  useEffect(() => {
    if (screen !== 'practice' || roomType !== 'royale' || !startTime) return;
    afkBaseRef.current=Date.now(); afkHitsRef.current=0;
    const id = setInterval(() => {
      const t = Date.now();
      if (frozenRef.current || offlineRef.current) {        // spam freeze / no connection: not AFK
        afkBaseRef.current=t; afkHitsRef.current=0; setAfkLeft(null); return;
      }
      if (stateRef.current.endTime || raceEndedRef.current || plRef.current<=0) { setAfkLeft(null); return; }
      const base = Math.max(afkBaseRef.current, startTime+ZONE_GRACE*1000);
      const idle = t-base;
      if (idle < AFK_WARN_MS) { setAfkLeft(null); return; }
      const due = idle < AFK_FIRST_MS ? 0 : 1+Math.floor((idle-AFK_FIRST_MS)/AFK_REPEAT_MS);
      if (due > afkHitsRef.current) {
        afkHitsRef.current = due;
        const newLives = Math.max(0,plRef.current-1);
        setPlayerLives(newLives); plRef.current=newLives;
        fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'Player',{lives:newLives});
        if (newLives===0) {
          fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'Player',{status:'eliminated'});
          setAfkLeft(null); return;
        }
      }
      const nextAt = base+AFK_FIRST_MS+afkHitsRef.current*AFK_REPEAT_MS;
      const left = Math.max(0,Math.ceil((nextAt-t)/1000));
      setAfkLeft(v => v===left ? v : left);
    },250);
    return () => { clearInterval(id); setAfkLeft(null); };
  }, [screen, roomType, startTime]);

  // (The ghost runner now moves inside CharKit.RaceTrack — no page re-render per frame.)

  // Save ghost to localStorage when results screen appears
  useEffect(() => {
    if (screen !== 'results') return;
    if (!ghostKey) return;                            // tests don't record ghosts
    if (currentTimings.current.length < 5) return;   // too short to be meaningful
    const elapsed = startTime && endTime ? (endTime - startTime) / 60000 : 0;
    const finalKpm = elapsed > 0 ? Math.round(pressCountRef.current / elapsed) : 0;
    const finalAcc = (pos + errors) > 0 ? Math.round((pos / (pos + errors)) * 100) : 100;
    if (finalKpm < 5 || finalAcc < 70) return;       // too poor to save
    try {
      const existing   = localStorage.getItem(ghostKey);
      const existingData = existing ? JSON.parse(existing) : null;
      const finalScore = scoreRef.current;
      // Ghost = best SCORE run (same rule as High Score). Old ghosts saved before
      // this change have no score → use the exercise's High Score instead.
      const ghostScore = existingData
        ? (existingData.score ?? (lesson&&exercise ? highScoresRef.current[hsKey(lesson.id, exercise.title)] : 0) ?? 0)
        : 0;
      if (!existingData || finalScore > ghostScore) {
        localStorage.setItem(ghostKey, JSON.stringify({
          timings:  [...currentTimings.current],
          cpm:      finalKpm,
          accuracy: finalAcc,
          score:    finalScore,
        }));
        setNewRecord(true);
      }
    } catch (e) { /* localStorage unavailable */ }
  }, [screen]);

  // Save results to Google Sheets when the results screen appears
  useEffect(() => {
    if (screen !== 'results') return;
    // Practice high score (solo practice only — not tests or multiplayer rooms)
    // Homework: stars by the lesson rule (not saved to lesson progress)
    if (!hsDone.current && hwRef.current && lesson && exercise) {
      hsDone.current = true;
      const h = hwRef.current;
      const mins = startTime && endTime ? (endTime - startTime) / 60000 : 0;
      const acc = (pos + errors) > 0 ? Math.round(pos / (pos + errors) * 100) : 100;
      const net = exercise.kind === 'long' || exercise.kind === 'longtimed';
      const wpm = net ? netThaiWpmOf(pressCountRef.current, errors, mins) : thaiWpmOf(pressCountRef.current, mins);
      const target = stageTarget(h.stage || lesson.stage);
      const stars = lessonStars(wpm, acc, target);
      setHwResult({ stars, minStars: h.minStars, passed: stars >= h.minStars, late: Date.now() > h.dueEndsAt,
        wpm: Math.round(wpm * 10) / 10, target, net, accuracy: acc });
    }
    if (!hsDone.current && !testRef.current && !hwRef.current && !rcRef.current && lesson && exercise) {
      hsDone.current = true;
      const k = hsKey(lesson.id, exercise.title);
      const sc = scoreRef.current;
      setPrevBest(highScores[k] || 0);
      if (sc > (highScores[k] || 0)) {
        const next = {...highScores, [k]: sc};
        setHighScores(next);
        if (!studentName || !SCRIPT_URL) writeGuestHighScores(next);
      }
      if (lesson.curriculum) {
        const mins = startTime && endTime ? (endTime - startTime) / 60000 : 0;
        const acc = (pos + errors) > 0 ? Math.round(pos / (pos + errors) * 100) : 100;
        const net = exercise.kind === 'long' || exercise.kind === 'longtimed';
        const wpm = net ? netThaiWpmOf(pressCountRef.current, errors, mins) : thaiWpmOf(pressCountRef.current, mins);
        const target = stageTarget(lesson.stage);
        const stars = lessonStars(wpm, acc, target);
        const prevStars = progress.stars[k] || 0;
        const idx = lesson.exercises.indexOf(exercise);
        const rush = stepState(progress, lesson, idx).rush;                 // played as a ⚔️ Rush?
        const clears = idx === lesson.exercises.length - 1 && stars >= RUSH_STARS && !progress.cleared[lesson.id];
        setCurResult({ stars, prevStars, wpm: Math.round(wpm * 10) / 10, target, net, accuracy: acc, rush, cleared: clears });
        if (stars > prevStars || clears) {
          const np = { ...progress, stars: { ...progress.stars, [k]: Math.max(stars, prevStars) },
            cleared: clears ? { ...progress.cleared, [lesson.id]: true } : progress.cleared };
          setProgress(np);
          if (studentName && SCRIPT_URL) {
            apiRequest('saveProgress', { code: classCode, student: studentName, key: k, stars: Math.max(stars, prevStars), cleared: clears ? lesson.id : '' })
              .catch(() => {});
          } else writeLocalProgress(np);
        }
      } else setCurResult(null);
    }
    if (!studentName || !SCRIPT_URL) return;
    if (rcRef.current) return;            // races are saved to the Matches sheet (recordMatch), not Sessions
    if (hasSaved.current) return;         // guard — only save once per results view
    hasSaved.current = true;
    setSaveStatus('saving'); setSaveError('');
    const elapsed = startTime && endTime ? (endTime - startTime) / 60000 : 0;
    const finalKpm = elapsed > 0 ? Math.round(pressCountRef.current / elapsed) : 0;
    const finalAcc = (pos + errors) > 0 ? Math.round((pos / (pos + errors)) * 100) : 100;
    const duration = endTime && startTime ? Math.round((endTime - startTime) / 1000) : 0;
    if (hwRef.current) {
      // Homework attempt → HomeworkSubmissions; the server re-checks the stars
      const h = hwRef.current;
      const mins = startTime && endTime ? (endTime - startTime) / 60000 : 0;
      const acc = (pos + errors) > 0 ? Math.round(pos / (pos + errors) * 100) : 100;
      const net = exercise?.kind === 'long' || exercise?.kind === 'longtimed';
      const wpm = net ? netThaiWpmOf(pressCountRef.current, errors, mins) : thaiWpmOf(pressCountRef.current, mins);
      apiSubmitHomework({
        classCode, studentName, hwId:h.hwId, stars:lessonStars(wpm, acc, stageTarget(h.stage || lesson?.stage)),
        cpm:finalKpm, accuracy:finalAcc, errors, totalChars:pos, duration:Math.max(1, Math.min(duration, HW_SECS)),
      })
        .then(d => {
          setSaveStatus('saved');
          setHwResult(r => r ? { ...r, stars:d.stars, passed:d.passed, late:d.late } : r);
          if (d.homework) { setHomework(d.homework); hwLoadedAt.current = Date.now(); }
        })
        .catch(err => { setSaveStatus('error'); setSaveError(describeApiError(err)); });
      return;
    }
    if (testRef.current) {
      // Weekly test attempt → Submissions; the reply is the updated board with my new rank
      apiSubmitWeekly({
        classCode, studentName, testId:testRef.current.testId,
        score:scoreRef.current, maxScore, cpm:finalKpm, accuracy:finalAcc,
        errors, totalChars:pos, duration:Math.min(duration,TEST_SECS),
      })
        .then(d => { setSaveStatus('saved'); setTestBoard(d); setWeekly(d); setWeeklyStatus('ok'); })
        .catch(err => { setSaveStatus('error'); setSaveError(describeApiError(err)); });
      return;
    }
    saveSession({
      classCode, studentName,
      email: googleUser?.email || '',
      lessonId: lesson?.id || 0,
      exerciseTitle: exercise?.title || '',
      cpm: finalKpm, wpm: Math.round(finalKpm / 5),
      accuracy: finalAcc, errors,
      totalChars: pos,
      duration,
      score: rcRef.current ? 0 : scoreRef.current,
    })
      .then(d => setSaveStatus(d.ok ? 'saved' : 'error'))
      .catch(()  => setSaveStatus('error'));
  }, [screen]);

  // Load practice high scores: from Sheets when signed in, else this device.
  useEffect(() => {
    if (studentName && SCRIPT_URL) {
      apiGetStudentStats(classCode, studentName)
        .then(d => {
          setHighScores(d.highScores || {});
          // Backend without Progress.gs yet → keep this device's progress so nothing locks up
          setProgress(d.progress ? { ...emptyProgress(), ...d.progress } : readLocalProgress());
        })
        .catch(() => {});
    } else {
      setHighScores(readGuestHighScores());
      setProgress(readLocalProgress());
    }
  }, [classCode, studentName]);

  // Weekly board: loaded at sign-in, when the board opens, every 60 s while it is
  // open, and right after a test is submitted (the submit reply is the new board).
  const loadWeekly = useCallback(async () => {
    if (!classCode || !studentName || !SCRIPT_URL) { setWeekly(null); setWeeklyStatus('idle'); return; }
    setWeeklyStatus('loading');
    try {
      const d = await apiGetWeeklyBoard(classCode, studentName);
      setWeekly(d); setWeeklyStatus('ok');
    } catch { setWeeklyStatus('error'); }
  }, [classCode, studentName]);
  useEffect(() => { loadWeekly(); }, [loadWeekly]);

  // Homework: loaded at sign-in and again when the lesson menu opens (at most once a minute)
  const loadHomework = useCallback(async () => {
    if (!classCode || !studentName || !SCRIPT_URL) { setHomework([]); return; }
    hwLoadedAt.current = Date.now();
    try { const d = await apiGetHomework(classCode, studentName); setHomework(d.homework || []); }
    catch { /* keep the last list (backend without Homework.gs → empty) */ }
  }, [classCode, studentName]);
  useEffect(() => { loadHomework(); }, [loadHomework]);
  useEffect(() => {
    if (screen === 'lessons' && Date.now() - hwLoadedAt.current > 60000) loadHomework();
  }, [screen, loadHomework]);
  useEffect(() => {
    if (screen !== 'weekly') return;
    const id = setInterval(loadWeekly, 60000);
    return () => clearInterval(id);
  }, [screen, loadWeekly]);

  const stateRef = useRef({});
  stateRef.current = { pos, target, targetChars, startTime, endTime, errors };
  brFinalRef.current = brFinal;
  rcRef.current = roomCode; rtRef.current = roomType;
  roomInfoRef.current = roomInfo; roomPlayersRef.current = roomPlayers; isHostRef.current = isHost;
  ccRef.current = classCode; leaveAskRef.current = leaveAsk;
  raceRunningRef.current = raceRunning;
  plRef.current = playerLives; snRef.current = studentName; charRef.current = character;

    // Save on this device first, then to Google Sheets when signed in.
  const saveCharacter = useCallback(async (cfg) => {
    CharKit.saveLocal(googleUser?.email||'guest', cfg);
    setCharacter(cfg);
    if (studentName && SCRIPT_URL && auth.idToken) {
      try {
        await apiRequest('saveCharacter',{code:classCode,student:studentName,character:JSON.stringify(cfg)});
      } catch (err) {
        throw new Error(describeApiError(err)+' — บันทึกไว้ในเครื่องนี้แล้ว');
      }
    }
  },[googleUser, studentName, classCode]);

  // Curriculum: the step after this one (next step of the lesson, else step 1 of the next lesson)
  // Only offered when that step is open (a failed Rush does not open the step before it).
  const nextStepOf = (les, ex) => {
    if (!les?.curriculum || !ex) return null;
    const i = les.exercises.indexOf(ex);
    let n = null;
    if (i >= 0 && i < les.exercises.length - 1) n = { lesson: les, exercise: les.exercises[i + 1] };
    else { const nl = LESSONS.find(l => l.num === les.num + 1); if (nl) n = { lesson: nl, exercise: nl.exercises[0] }; }
    if (n && !stepState(progress, n.lesson, n.lesson.exercises.indexOf(n.exercise)).open) return null;
    return n;
  };

  const startExercise = useCallback((les,ex,opts={}) => {
    if (les.story && les.id===14) {
      const nm=(()=>{try{return localStorage.getItem('adventureName')||'';}catch(e){return '';}})();
      if (!nm) { pendingStoryRef.current={les,ex}; setShowNameModal(true); return; }
    }
    setLesson(les); setExercise(ex);
    let text;
    if (les.story) {
      const nm=(()=>{try{return localStorage.getItem('adventureName')||'นักผจญภัย';}catch(e){return 'นักผจญภัย';}})();
      text = generateStoryText(ex.words, nm);
    } else {
      text = opts.text || (les.curriculum ? curriculumText(les, ex) : generateText(ex.words,ex.minChars));
    }
    setTarget(text);
    const test = opts.test || null;
    setActiveTest(test); testRef.current = test;
    const hw = opts.hw || null;
    setActiveHw(hw); hwRef.current = hw; setHwResult(null);
    setMaxScore(test ? testTargetScore([...text], les.id) : 0);
    setTestBoard(null); setTimeUp(false);
    setScore(0); scoreRef.current=0; setScoreStreak(0); streakRef.current=0; setLastGain(null);
    scoredIdx.current=new Set(); missedIdx.current=new Set();
    speedBuf.current=[]; lastScoreTime.current=null; lessonIdRef.current=les.id;
    hsDone.current=false; setPrevBest(0); setCurResult(null);
    setPos(0); setErrors(0); setStartTime(null); setEndTime(null);
    setHint(null); setFlashCode(null); setShiftHeld(false); setNow(Date.now());
    keystrokeTimes.current=[]; errorTimes.current=[];
    currentTimings.current=[]; lastCorrectTime.current=null;
    hasSaved.current = false;
    frozenRef.current = false; raceEndedRef.current = false;
    pressCountRef.current = 0;
    setPenaltySecs(0); setPressureSecs(0);
    setBestCombo(0);
    setSaveStatus('idle'); setSaveError('');
    setNewRecord(false);
    if (test || hw) { setGhostKey(''); setGhostData(null); }   // no ghost during tests / homework
    else {
      const gk = (les.story?'story_':'ghostv2_') + les.id + '_' + encodeURIComponent(ex.title);
      setGhostKey(gk);
      try {
        const saved = localStorage.getItem(gk);
        const g = saved ? JSON.parse(saved) : null;
        // Old ghost (no score) → treat the exercise's High Score as its score
        if (g && g.score == null) g.score = highScoresRef.current[hsKey(les.id, ex.title)] || 0;
        setGhostData(g);
      } catch { setGhostData(null); }
    }
    setScreen('practice');
  },[]);

  // Start this week's test: same seeded text for the whole grade level.
  const startWeeklyTest = useCallback(() => {
    const t = weekly?.test;
    if (!t) return;
    const les = findLesson(t.lessonId);
    const exs = les ? (les.exercises || []) : [];
    if (t.stage) {
      // Test by stage: lessonId is that stage's boss lesson (keyboard + speed target);
      // the text is generated from the whole stage.
      const ex = exs[exs.length-1];
      if (!les || !ex) { alert('ไม่พบด่าน '+t.stage+' ในแอป — แจ้งครูให้ตั้งแบบทดสอบใหม่'); return; }
      startExercise(les, ex, {test:t, text:stageTestText(Number(t.stage), seededRng(t.testId), TEST_MIN_CHARS)});
      return;
    }
    const num = s => (String(s||'').match(/^(\d+\.\d+)/)||[])[1];
    const ex = exs.find(e=>e.title===t.exerciseTitle)
      || exs.find(e=>num(e.title) && num(e.title)===num(t.exerciseTitle));
    if (!les || !ex) { alert('ไม่พบแบบฝึก "'+t.exerciseTitle+'" ในแอป — แจ้งครูให้ตั้งแบบทดสอบใหม่'); return; }
    const text = les.curriculum
      ? curriculumText(les, ex, seededRng(t.testId), {minChars:TEST_MIN_CHARS})
      : generateTimedText(ex.words, TEST_MIN_CHARS, seededRng(t.testId));
    startExercise(les, ex, {test:t, text});
  },[weekly, startExercise]);

  // Start a homework item: same seeded text for everyone it is for, 1 min 30 s.
  const startHomework = useCallback((h) => {
    if (!h) return;
    const les = findLesson(h.lessonId);
    const exs = les ? (les.exercises || []) : [];
    let ex, text;
    if (h.mode === 'exercise') {
      const num = s => (String(s||'').match(/^(\d+\.\d+)/)||[])[1];
      ex = exs.find(e=>e.title===h.exerciseTitle) || exs.find(e=>num(e.title) && num(e.title)===num(h.exerciseTitle));
      if (les && ex) text = curriculumText(les, ex, seededRng(h.hwId), {minChars:TEST_MIN_CHARS});
    } else {
      ex = exs[exs.length-1];
      if (les && ex) text = stageTestText(Number(h.stage), seededRng(h.hwId), TEST_MIN_CHARS);
    }
    if (!les || !ex || !text) { alert('ไม่พบแบบฝึกของการบ้าน "'+h.title+'" ในแอป — แจ้งครู'); return; }
    startExercise(les, ex, {hw:h, text});
  },[startExercise]);

  const openWeekly = useCallback(() => { setScreen('weekly'); loadWeekly(); },[loadWeekly]);

  // Create a 1v1 room for a specific exercise
  const handleCreate1v1 = useCallback(async (les) => {
    setMpBusy(true); setJoinError('');
    // Combine all words from the lesson's word bank for the race
    const allWords = cleanTypingWords(les.exercises.flatMap(ex=>ex.words));
    const text = generateText(allWords, 200);
    try {
      await ensureFirebaseUser();
      const code = await makeFreeCode();
      await fbCreate(code,{type:'1v1',lessonId:les.id,
        exerciseTitle:les.thaiName,targetText:text,
        hostName:snRef.current||'ผู้เล่น1'});
      const h1name = snRef.current || 'ผู้เล่น1';
      myRoomName.current = h1name;
      await fbJoin(code, h1name, 3, ccRef.current);
      if (charRef.current) fbSetChar(code, charRef.current);
      setRoomCode(code); rcRef.current=code;
      setRoomType('1v1'); rtRef.current='1v1';
      setIsHost(true);
      lessonIdRef.current = les.id;
      setLesson(les); setExercise(null); setTarget(text);
      try { fbArmLobby(code, true); } catch {}
      setScreen('mp-lobby');
    } catch(e) { setJoinError('สร้างห้องไม่ได้: '+e.message); }
    setMpBusy(false);
  },[]);

  // Create a Battle Royale room (called from teacher panel link)
  const handleCreateBR = useCallback(async (les, lives=3) => {
    setMpBusy(true); setJoinError('');
    // Progressive BR text — combines multiple chapters for increasing difficulty
    const text = generateBRText(les, les.exercises?.[0]||{words:[]}, 600);
    try {
      await ensureFirebaseUser();
      const code = await makeFreeCode();
      await fbCreate(code,{type:'royale',lessonId:les.id,
        exerciseTitle:les.thaiName,targetText:text,maxLives:lives,
        hostName:snRef.current||'ครู'});
      const hBRname = snRef.current || 'ครู';
      myRoomName.current = hBRname;
      await fbJoin(code, hBRname, lives, ccRef.current);
      if (charRef.current) fbSetChar(code, charRef.current);
      setMaxLives(lives); setPlayerLives(lives); plRef.current=lives;
      setRoomCode(code); rcRef.current=code;
      setRoomType('royale'); rtRef.current='royale';
      setIsHost(true);
      lessonIdRef.current = les.id;
      setLesson(les); setExercise(null); setTarget(text);
      try { fbArmLobby(code, true); } catch {}
      setScreen('mp-lobby');
    } catch(e) { setJoinError('สร้างห้องไม่ได้'); }
    setMpBusy(false);
  },[]);

  // Join an existing room by code
  const handleJoin = useCallback(async (code) => {
    const roomId=normalizeRoomCode(code);
    if (!ROOM_CODE_RE.test(roomId)) { setJoinError('รหัสห้องต้องมี '+ROOM_CODE_LEN+' ตัวอักษร'); return; }
    setMpBusy(true); setJoinError('');
    try {
      await ensureFirebaseUser();
      const data = await fbGet(roomId);
      if (!data) { setJoinError('ไม่พบห้อง '+roomId); setMpBusy(false); return; }
      if (data.info?.status!=='lobby') { setJoinError('ห้องนี้กำลังแข่งอยู่แล้ว'); setMpBusy(false); return; }
      const seats = data.info?.type==='1v1' ? 2 : Infinity;     // 1v1 = host + 1 player
      const others = Object.keys(data.players||{}).filter(id=>id!==currentFirebaseUid());
      if (others.length>=seats) { setJoinError('ห้องนี้เต็มแล้ว (1 ปะทะ 1 เข้าได้ 2 คน)'); setMpBusy(false); return; }
      const name = snRef.current || ('ผู้เล่น'+(Object.keys(data.players||{}).length+1));
      myRoomName.current = name;
      const rl = data.info?.maxLives || 3;
      setMaxLives(rl); setPlayerLives(rl); plRef.current=rl;
      await fbJoin(roomId, name, rl, ccRef.current);
      if (seats!==Infinity && !(await fbKeepSeat(roomId, seats))) {
        setJoinError('ห้องนี้เต็มแล้ว (1 ปะทะ 1 เข้าได้ 2 คน)'); setMpBusy(false); return;
      }
      if (charRef.current) fbSetChar(roomId, charRef.current);
      const les = findLesson(data.info.lessonId);
      setRoomCode(roomId); rcRef.current=roomId;
      setRoomType(data.info.type); rtRef.current=data.info.type;
      setIsHost(false);
      lessonIdRef.current = les?.id || Number(data.info.lessonId) || 1;
      setLesson(les); setTarget(data.info.targetText);
      try { fbArmLobby(roomId, false); } catch {}
      setScreen('mp-lobby');
    } catch(e) { setJoinError('เชื่อมต่อไม่ได้'); }
    setMpBusy(false);
  },[]);

  // Host starts the race manually
  const handleStartRace = useCallback(async () => {
    const db = getDB();
    let offset = serverTimeOffsetRef.current;
    try {
      const snap = await db?.ref('.info/serverTimeOffset').once('value');
      offset = Number(snap?.val()) || offset;
      serverTimeOffsetRef.current = offset;
      setServerTimeOffset(offset);
      setServerTimeReady(true);
    } catch {}
    const raceStartsAt = Date.now() + offset + 4000;
    await fbSetStatus(rcRef.current,'countdown',{raceStartsAt});
  },[]);

  // Race over for me: cancel the disconnect marker and forget the active race.
  const finishPresence = useCallback(() => {
    const code=rcRef.current; if (!code) return;
    try { fbDisarm(code); } catch {}
    fbClearActiveRoom().catch(()=>{});
  },[]);

  // Send this race to the Matches sheet (signed-in students only, once per race).
  const recordMatch = useCallback((m) => {
    const info=roomInfoRef.current, code=rcRef.current;
    if (!code || !info?.raceStartsAt || !snRef.current || !SCRIPT_URL || !auth.idToken) return;
    const matchId=code+'-'+info.raceStartsAt;
    if (matchSavedRef.current===matchId) return;
    matchSavedRef.current=matchId;
    const st=stateRef.current, end=st.endTime||Date.now();
    const mins=st.startTime?Math.max(1/60,(end-st.startTime)/60000):0;
    const cpm=mins?Math.min(3000,Math.round(pressCountRef.current/mins)):0;
    const accuracy=(st.pos+st.errors)>0?Math.round(st.pos/(st.pos+st.errors)*100):100;
    setSaveStatus('saving');
    apiSaveMatch({classCode:ccRef.current,studentName:snRef.current,matchId,type:info.type,room:code,
      cpm,accuracy,chars:st.pos,...m})
      .then(d=>setSaveStatus(d&&d.ok?'saved':'error'))
      .catch(()=>{ setSaveStatus('error'); matchSavedRef.current=''; });
  },[]);

  // Battle Royale: lock the final order 2 s after the end (late position updates
  // can still arrive), then save my place. Nothing after that changes the order.
  useEffect(() => {
    if (!roomCode || roomType!=='royale' || !brOver || brFinal) return;
    const t=setTimeout(()=>{
      const order=brOrder(roomPlayersRef.current,Date.now()+serverTimeOffsetRef.current);
      setBrFinal(order);
      const uid=currentFirebaseUid();
      const i=order.findIndex(([k,p])=>k===uid||p.uid===uid);
      if (i>=0) {
        const me=order[i][1];
        recordMatch({result:i===0?'win':'lose',place:i+1,players:order.length,
          note:me.status==='eliminated'?'eliminated':me.status==='done'?'finished':'survived'});
      }
    },2000);
    return ()=>clearTimeout(t);
  },[brOver,roomCode,roomType,brFinal]);

  // 1v1: save once the result screen has locked the winner.
  const onDuelSettled = useCallback((d) => {
    const uid=currentFirebaseUid();
    const rv=Object.entries(roomPlayersRef.current||{}).find(([k,p])=>p&&!p.isSpectator&&k!==uid&&p.uid!==uid)?.[1];
    recordMatch({result:d.outcome,oppName:rv?.name||d.rvName,oppClass:rv?.cls||'',
      myScore:scoreRef.current,oppScore:d.rvScore,note:d.rvLeft?'opp-left':''});
  },[recordMatch]);

  // Forget the room on this device (no Firebase writes).
  const cleanupRoomLocal = useCallback(() => {
    if (fbUnsub.current) { fbUnsub.current(); fbUnsub.current=null; }
    setRoomCode(''); rcRef.current='';
    setRoomType(''); rtRef.current='';
    setIsHost(false); setRoomPlayers({}); setRoomInfo(null);
    setPressureSecs(0); setPenaltySecs(0); setLeaveAsk(false);
    setBrOver(false); setBrFinal(null); setRivalDcSecs(0); setSpectatingPlayer(null); setIsHostSpectator(false);
    frozenRef.current=false; raceEndedRef.current=false;
    myRoomName.current='';
    setScreen('lessons');
  },[]);

  // Leave the room. Before the race: remove me (host: close the room).
  // After the start: my name stays — status "left" if I was still racing (forfeit),
  // and the room is deleted once nobody is in it any more.
  const handleLeaveRoom = useCallback(async () => {
    const code=rcRef.current, uid=currentFirebaseUid();
    if (code) {
      try { fbDisarm(code); } catch {}
      try {
        const info=roomInfoRef.current, players=roomPlayersRef.current||{};
        const started=!!info && info.status!=='lobby';
        if (!started) {
          if (uid) await getDB()?.ref('rooms/'+code+'/players/'+uid).remove();
          if (isHostRef.current) await fbRemove(code);
        } else {
          const me=uid&&players[uid];
          if (me) {
            const upd={active:false};
            // Only a race that is still running counts as a forfeit. After the end,
            // leaving just closes the room for me — my place does not change.
            const forfeit = raceRunningRef.current && ['waiting','racing','disconnected'].includes(me.status);
            if (forfeit) upd.status='left';
            await fbUpdatePlayer(code,'',upd);
            // Match stats: a forfeit is a loss; an eliminated BR player who leaves before
            // the end is saved with the place they have now.
            if (info.raceStartsAt && (forfeit || (info.type==='royale' && !brFinalRef.current && me.status==='eliminated'))) {
              if (info.type==='1v1') {
                const rv=Object.entries(players).find(([k,p])=>k!==uid&&p&&!p.isSpectator)?.[1];
                recordMatch({result:'lose',oppName:rv?.name||'',oppClass:rv?.cls||'',
                  myScore:scoreRef.current,oppScore:Number(rv?.score)||0,note:'left'});
              } else {
                const order=brOrder({...players,[uid]:{...me,...upd}},Date.now()+serverTimeOffsetRef.current);
                const i=order.findIndex(([k])=>k===uid);
                if (i>=0) recordMatch({result:'lose',place:i+1,players:order.length,note:forfeit?'left':'eliminated'});
              }
            }
          }
          const others=Object.entries(players).filter(([k,p])=>k!==uid&&p&&!p.isSpectator);
          if (others.every(([,p])=>p.active===false||p.status==='left')) await fbRemove(code).catch(()=>{});
        }
      } catch {}
      fbClearActiveRoom().catch(()=>{});
    }
    cleanupRoomLocal();
  },[cleanupRoomLocal]);
  const handleLeaveRoomRef = useRef(handleLeaveRoom);
  handleLeaveRoomRef.current = handleLeaveRoom;

  // Every "leave" button goes through here: ask first while a race is running.
  const requestLeave = useCallback(() => {
    if (raceRunningRef.current) setLeaveAsk(true);
    else handleLeaveRoomRef.current();
  },[]);
  requestLeaveRef.current = requestLeave;

  // ── Coming back after dropping out (refresh, closed tab, other computer) ──
  const checkRejoin = useCallback(async () => {
    try {
      if (rcRef.current) return;
      const ar=await fbGetActiveRoom(); if (!ar || !ar.code) return;
      const data=await fbGet(ar.code), uid=currentFirebaseUid();
      const me=data?.players?.[uid], type=data?.info?.type;
      const off=await fbServerOffset(), sNow=Date.now()+off;
      const ok = data && me && data.info.status!=='done' &&
        (me.status==='disconnected' || me.status==='racing') &&
        !(type==='royale' && brRaceOver(data.players,data.info,sNow));
      if (!ok) { fbClearActiveRoom().catch(()=>{}); return; }
      const left = me.status==='disconnected' ? dcLeftMs(me,type,sNow) : graceMs(type);
      if (left<=0) { fbClearActiveRoom().catch(()=>{}); return; }
      setRejoinOffer({code:ar.code,type,expiresAt:Date.now()+left});
    } catch (e) { console.warn('rejoin check:',e?.message); }
  },[]);

  useEffect(() => {
    if (typeof firebase==='undefined' || !getDB()) return;
    const unsub=firebase.auth().onAuthStateChanged(user=>{
      if (!user) { setRejoinOffer(null); return; }
      checkRejoin();
    });
    return () => unsub();
  },[checkRejoin]);

  const dismissRejoin = useCallback(async (expired) => {
    const offer=rejoinOffer; setRejoinOffer(null);
    if (!offer) return;
    if (!expired) {   // the student chose not to return → counts as leaving the race
      fbUpdatePlayer(offer.code,'',{status:'left',active:false}).catch(()=>{});
    }
    fbClearActiveRoom().catch(()=>{});
  },[rejoinOffer]);

  const doRejoin = useCallback(async () => {
    const offer=rejoinOffer; if (!offer) return;
    setRejoinBusy(true);
    try {
      await ensureFirebaseUser();
      const code=offer.code, data=await fbGet(code), uid=currentFirebaseUid();
      const me=data?.players?.[uid];
      if (!data || !me) throw new Error('gone');
      const info=data.info, type=info.type;
      const off=await fbServerOffset();
      serverTimeOffsetRef.current=off; setServerTimeOffset(off); setServerTimeReady(true);
      const sNow=Date.now()+off;
      if (me.status==='disconnected' && dcLeftMs(me,type,sNow)<=0) throw new Error('expired');
      const text=info.targetText||'', total=[...text].length;
      const p=Math.min(Number(me.pos)||0,total);
      let lives=Number(me.lives); if (!Number.isFinite(lives)) lives=info.maxLives||3;
      const nowTick=Math.floor((sNow-info.raceStartsAt)/ZONE_TICK);
      if (type==='royale' && me.dcAt) {
        // The storm kept moving while I was away: lose the lives I would have lost.
        const dcTick=Math.floor((me.dcAt-info.raceStartsAt)/ZONE_TICK);
        let missed=0;
        for (let t=Math.max(1,dcTick+1); t<=nowTick; t++) if (zonePosAt(t*ZONE_TICK/1000,total)-p>ZONE_GAP) missed++;
        lives=Math.max(0,lives-missed);
      }
      lastZoneDrainTickRef.current=Math.max(0,nowTick);
      afkBaseRef.current=Date.now(); afkHitsRef.current=0;   // time away is not AFK
      const les=findLesson(info.lessonId)||LESSONS[0];
      myRoomName.current=me.name||snRef.current||'ผู้เล่น';
      setRoomCode(code); rcRef.current=code; setRoomType(type); rtRef.current=type;
      setIsHost(info.hostUid===uid); setRoomInfo(info); setRoomPlayers(data.players||{});
      setMaxLives(info.maxLives||3);
      lessonIdRef.current=les.id; setLesson(les); setExercise(null); setTarget(text);
      setPos(p); setErrors(Number(me.errors)||0); setStartTime(info.raceStartsAt-off); setEndTime(null);
      setHint(null); setFlashCode(null); setShiftHeld(false); setNow(Date.now());
      keystrokeTimes.current=[]; errorTimes.current=[]; currentTimings.current=[]; lastCorrectTime.current=null;
      hasSaved.current=false; setSaveStatus('idle'); setSaveError(''); setNewRecord(false);
      setGhostData(null); setGhostKey('');
      setPlayerLives(lives); plRef.current=lives;
      const sc=Number(me.score)||0; setScore(sc); scoreRef.current=sc;
      setScoreStreak(0); streakRef.current=0; setLastGain(null);
      scoredIdx.current=new Set(Array.from({length:p},(_,i)=>i)); missedIdx.current=new Set();
      speedBuf.current=[]; lastScoreTime.current=null; setBestCombo(0);
      setActiveTest(null); testRef.current=null; setTestBoard(null); setTimeUp(false);
      setActiveHw(null); hwRef.current=null; setHwResult(null);
      setPenaltySecs(0); setPressureSecs(0); frozenRef.current=false; raceEndedRef.current=false;
      pressCountRef.current=p;
      const out = type==='royale' && lives<=0;
      await fbUpdatePlayer(code,'',{status:out?'eliminated':'racing',lives});
      if (!out) { try { fbArmRace(code); } catch {} }
      setRejoinOffer(null);
      setScreen('practice');
    } catch (e) {
      setRejoinOffer(null);
      setNotice('กลับเข้าแข่งไม่ได้แล้ว — การแข่งขันจบหรือหมดเวลาแล้ว');
      fbClearActiveRoom().catch(()=>{});
    }
    setRejoinBusy(false);
  },[rejoinOffer]);

  // Log the student out → back to the sign-in screen
  const handleLogout = useCallback(() => {
    setClassCode(''); setStudentName(''); setDisplayName('');
    setLesson(null); setExercise(null); setTarget(''); setPos(0);
    setErrors(0); setStartTime(null); setEndTime(null); setSaveStatus('idle');
    setGoogleUser(null); setWeekly(null); setWeeklyStatus('idle'); setTestBoard(null);
    setCharacter(window.CharKit?CharKit.loadLocal('guest'):null);
    setActiveTest(null); testRef.current=null;
    setActiveHw(null); hwRef.current=null; setHomework([]); hwLoadedAt.current=0;
    auth.idToken=''; auth.subject=''; auth.fbSubject='';
    if (typeof firebase!=='undefined'&&firebase.apps.length) firebase.auth().signOut().catch(()=>{});
    if (typeof google !== 'undefined') {
      try { google.accounts.id.disableAutoSelect(); } catch {}
    }
    setScreen(SCRIPT_URL ? 'google-login' : 'lessons');
  },[]);

  useEffect(() => {
    if (screen!=='practice') return;
    const handleKeyDown=(e)=>{
      if (PERF_ON) perf.t0=performance.now();
      if (e.key==='Shift') { setShiftHeld(true); return; }
      if (e.key==='CapsLock') { setCapsLockOn(e.getModifierState('CapsLock')); return; }
      if (e.ctrlKey||e.altKey||e.metaKey) return;
      e.preventDefault();
      if (leaveAskRef.current) return;  // "leave the race?" dialog is open
      if (frozenRef.current) return;   // spam penalty active — ignore typing
      if (e.key==='Escape') {
        if (rcRef.current) requestLeaveRef.current();
        else setScreen(testRef.current?'weekly':'lessons');
        return;
      }
      const { pos,target,targetChars,startTime,endTime } = stateRef.current;
      if (endTime) return;             // finished, or the weekly test time is up
      if (e.code==='Backspace') {
        if (pos>0) {
          setPos(p=>p-1);
          if (rcRef.current) fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'ผู้เล่น1',{pos:pos-1});
        }
        setHint(null); return;
      }
      const rk=resolveKey(e);           // falls back to e.key when e.code is unusable
      const char=rk?.char;
      if (!char) return;

      // Compute needsShift from current position (stateRef) for KPM counting
      const _nextChForKPM = pos<targetChars.length ? targetChars[pos] : null;
      const _needsShiftForKPM = _nextChForKPM ? (findKeyForChar(_nextChForKPM)?.needsShift??false) : false;

      if (!startTime && !rcRef.current) setStartTime(Date.now());
      const typedSoFar=targetChars.slice(0,pos).join('')+char;
      const result=validateInput(target,typedSoFar);

      // SPAM CHECK 1: very fast AND mostly wrong. Fast, accurate typing is never
      // punished — only key-mashing (random keys at high speed) is.
      const nowMs=Date.now();
      const kBuf=keystrokeTimes.current;
      kBuf.push({t:nowMs,ok:!!result.ok});
      if (kBuf.length>SPAM_WINDOW_KEYS) kBuf.shift();
      if (kBuf.length>=SPAM_WINDOW_KEYS) {
        const span=kBuf[kBuf.length-1].t-kBuf[0].t;
        const wrong=kBuf.filter(k=>!k.ok).length;
        if (span>0 && ((kBuf.length-1)/span)*60000>SPEED_CPM && wrong/kBuf.length>=SPAM_WRONG_SHARE) {
          keystrokeTimes.current=[]; errorTimes.current=[];
          frozenRef.current=true; setPenaltySecs(SPAM_PENALTY); return;
        }
      }

      if (result.ok) {
        setHint(null); setFlashCode(null);
        // ── Score this key (once per position) ──
        if (!scoredIdx.current.has(pos)) {
          scoredIdx.current.add(pos);
          const t = Date.now();
          if (lastScoreTime.current !== null) {
            speedBuf.current.push(Math.min(5000, t - lastScoreTime.current));
            if (speedBuf.current.length > 5) speedBuf.current.shift();
          }
          lastScoreTime.current = t;
          const gain = missedIdx.current.has(pos) ? 0 : Math.round(
            charBasePoints(targetChars[pos]) *
            speedMultiplier(speedBuf.current, lessonIdRef.current) *
            comboMultiplier(streakRef.current));
          streakRef.current += 1; setScoreStreak(streakRef.current);
          setBestCombo(b=>Math.max(b,streakRef.current));
          if (gain > 0) {
            scoreRef.current += gain; setScore(scoreRef.current);
            setLastGain({v:gain,id:t});
          }
        }
        // Count keypresses for KPM: +1 for the key, +1 extra for shift when needed
        pressCountRef.current += _needsShiftForKPM ? 2 : 1;
        // Record timing for ghost replay
        const nowForGhost = Date.now();
        if (lastCorrectTime.current !== null) {
          currentTimings.current.push(nowForGhost - lastCorrectTime.current);
        }
        lastCorrectTime.current = nowForGhost;
        afkBaseRef.current = nowForGhost; afkHitsRef.current = 0;   // BR anti-AFK
        setPos(p=>{
          const next=p+1;
          if (next>=targetChars.length){
            setEndTime(Date.now());
            // Mark race finish in Firebase (with the final score for 1v1)
            if (rcRef.current) {
              fbUpdatePlayer(rcRef.current, myRoomName.current||snRef.current||'ผู้เล่น1',
                {pos:next,status:'done',finishedAt:Date.now(),
                 ...(rtRef.current==='1v1'?{score:scoreRef.current}:{})});
            }
            if (rcRef.current) { raceEndedRef.current=true; finishPresence(); }
            setTimeout(()=>setScreen('results'),600);
          }
          return next;
        });
        // Throttled Firebase position sync
        if (rcRef.current) {
          const nowFB=Date.now();
          if (nowFB-lastFBUp.current>350) {
            lastFBUp.current=nowFB;
            const el=stateRef.current.startTime?(nowFB-stateRef.current.startTime)/60000:0;
            const np=stateRef.current.pos+1;
            const nc=el>0?Math.round(np/el):0;
            if (np<targetChars.length) {
              fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'ผู้เล่น1',
                {pos:np,cpm:Math.min(3000,nc),wpm:Math.min(600,Math.round(nc/5)),
                 // eliminated players keep practising but must not come back to life
                 status:(rtRef.current==='royale'&&plRef.current<=0)?'eliminated':'racing',
                 ...(rtRef.current==='1v1'?{score:scoreRef.current}:{})});
            }
          }
        }
      } else {
        // Any wrong key breaks the scoring streak; this position now earns 0
        streakRef.current=0; setScoreStreak(0);
        if (pos<targetChars.length) missedIdx.current.add(pos);
        if (result.costsLife) {
          setErrors(er=>er+1);
          setFlashCode(rk.code);
          setTimeout(()=>setFlashCode(null),400);
          // Battle Royale lives
          if (rcRef.current && rtRef.current==='royale') {
            const newLives=Math.max(0,plRef.current-1);
            setPlayerLives(newLives); plRef.current=newLives;
            fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'ผู้เล่น1',{lives:newLives});
            if (newLives===0) {
              // Eliminated — screen greys out but the student keeps typing for practice
              fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'ผู้เล่น1',{status:'eliminated'});
            }
          }
          // SPAM CHECK 2: error burst
          const eBuf=errorTimes.current;
          eBuf.push(nowMs);
          const cutoff=nowMs-ERROR_WINDOW_MS;
          while (eBuf.length&&eBuf[0]<cutoff) eBuf.shift();
          if (eBuf.length>=ERROR_BURST) {
            keystrokeTimes.current=[]; errorTimes.current=[];
            frozenRef.current=true; setPenaltySecs(SPAM_PENALTY); return;
          }
        }
        if (result.hint) setHint(result.hint);
      }
    };
    const handleKeyUp=(e)=>{ if (e.key==='Shift') setShiftHeld(false); };
    window.addEventListener('keydown',handleKeyDown);
    window.addEventListener('keyup',handleKeyUp);
    return ()=>{ window.removeEventListener('keydown',handleKeyDown); window.removeEventListener('keyup',handleKeyUp); };
  },[screen]);

  if (KEYS_ON) return <KeyTester/>;   // ?keys=1 keyboard tester

  // After Google sign-in: find the student's class (full-screen, same scene as the title).
  if (screen==='class-picker' && googleUser) return (
          <ClassPickerScreen
            googleUser={googleUser}
            onSelect={(code, foundName, serverChar) => {
              setClassCode(code);
              if (window.CharKit) {
                const who = googleUser?.email || 'guest';
                const ch = CharKit.sanitize(serverChar) || CharKit.loadLocal(who);
                setCharacter(ch);
                if (ch) CharKit.saveLocal(who, ch);
              }
              const name = foundName || (googleUser ? googleUser.name : '');
              setStudentName(name);
              setDisplayName(name);
              setScreen('lessons');
            }}
            onBack={() => setScreen('google-login')}
          />
  );

  // Title screen (before sign-in) is full-screen, outside the app frame.
  if (screen==='google-login') return (
    <GoogleSignInScreen
      onSignIn={(profile, credential) => {
        auth.idToken=credential||'';
        auth.subject=profile?.sub||'';
        setGoogleUser(profile);
        setScreen('class-picker');
      }}
      onSolo={async() => { auth.idToken=''; auth.subject=''; auth.fbSubject=''; if(typeof firebase!=='undefined'&&firebase.apps.length&&firebase.auth().currentUser&&!firebase.auth().currentUser.isAnonymous)await firebase.auth().signOut().catch(()=>{}); setGoogleUser(null); setStudentName(''); setScreen('lessons'); }}
    />
  );

  const soloTyping = screen==='practice' && !roomCode;
  const wideScreen = screen==='my-stats' || screen==='weekly' || screen==='character' || screen==='results';
  // These screens stretch to the bottom of the window; the rest (typing, results, rooms…) keep their natural height.
  const fillScreen = screen==='lessons' || screen==='my-stats' || screen==='weekly' || screen==='results';
  return (
    <div style={{height:'100dvh',overflow:'hidden',fontFamily:TH_FONT,position:'relative',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:soloTyping?'center':'flex-start',
      padding:'var(--fp)',gap:'var(--fg)',color:'var(--c-t1)'}}>
      {/* Pixel scene behind every screen (dimmer while typing so the text stands out) */}
      <div style={{position:'fixed',inset:0,zIndex:0}}><Scene dim={screen==='practice'?0.25:screen==='lessons'?0.08:0.18}/></div>

      {PERF_ON && <PerfMeter/>}
      {penaltySecs>0 && <PenaltyScreen countdown={penaltySecs}/>}
      {timeUp && <TimeUpOverlay/>}
      {showNameModal && (
        <NameModal onConfirm={(name)=>{
          setAdventureName(name);
          try{localStorage.setItem('adventureName',name);}catch(e){}
          setShowNameModal(false);
          if(pendingStoryRef.current){
            const p=pendingStoryRef.current; pendingStoryRef.current=null;
            setTimeout(()=>startExercise(p.les,p.ex),80);
          }
        }}/>
      )}

      {/* Header: small logo + navigation, on a wooden bar (hidden in solo typing — the HUD has its own back button) */}
      {!soloTyping && (
      <div className="px-wood" style={{width:'100%',maxWidth:1120,display:'flex',justifyContent:'space-between',alignItems:'center',
        gap:10,flexWrap:'wrap',padding:'0 4px',position:'relative',zIndex:1,flex:'none'}}>
        <button onClick={()=>!roomCode&&setScreen('lessons')} aria-label="หน้าหลัก"
          style={{background:'none',border:0,padding:0,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
          <span className="px-logo" style={{fontFamily:"'Kanit',sans-serif",fontStyle:'italic',fontWeight:800,fontSize:26,lineHeight:1.2,
            filter:'drop-shadow(2px 0 0 #3B2416) drop-shadow(-2px 0 0 #3B2416) drop-shadow(0 2px 0 #3B2416) drop-shadow(0 -2px 0 #3B2416) drop-shadow(3px 3px 0 #3B2416)'}}>
            แป้นพิมพ์ผจญภัย</span>
        </button>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {screen!=='lessons'&&screen!=='spam'&&(
            <PxButton onClick={()=>roomCode?requestLeave():setScreen('lessons')} style={{minHeight:'var(--hb)',fontSize:14}}>← หน้าหลัก</PxButton>
          )}
          {studentName && (
            <PxButton onClick={handleLogout} style={{minHeight:'var(--hb)',fontSize:14}}>ออกจากระบบ</PxButton>
          )}
        </div>
      </div>
      )}

      {/* Card */}
      <div className={(screen==='lessons'?'':'px-panel ')+'px-scroll'} style={{width:'100%',maxWidth:screen==='lessons'||wideScreen?1120:900,position:'relative',zIndex:1,
        padding:screen==='lessons'?0:'var(--cp)',flex:fillScreen?'1 1 auto':'0 1 auto',minHeight:0,display:'flex',flexDirection:'column'}}>

        {notice&&(
          <div role="status" style={{display:'flex',alignItems:'center',gap:10,background:'#F8EED2',border:'3px solid #3B2416',
            padding:'8px 14px',marginBottom:14,fontSize:15,fontWeight:700,color:'#3B2416',
            fontFamily:"'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif"}}>
            <Sprite name="i_help"/><span style={{flex:1}}>{notice}</span>
            <button onClick={()=>setNotice('')} aria-label="ปิด" className="sp sp-i_x px-icon-btn"/>
          </div>
        )}
        {rejoinOffer&&!roomCode&&['google-login','class-picker','lessons'].includes(screen)&&(
          <RejoinBanner offer={rejoinOffer} busy={rejoinBusy} onRejoin={doRejoin} onDismiss={dismissRejoin}/>
        )}
        {leaveAsk&&(
          <LeaveConfirm roomType={roomType} onStay={()=>setLeaveAsk(false)}
            onLeave={()=>{ setLeaveAsk(false); handleLeaveRoom(); }}/>
        )}
        {screen==='my-stats' && studentName && (
          <MyStatsScreen
            studentName={studentName}
            classCode={classCode}
            myCfg={myCfg}
            onBack={() => setScreen('lessons')}
          />
        )}
        {screen==='character' && window.CharKit && (
          <CharKit.CreatorScreen initial={character} signedIn={!!studentName}
            onSave={saveCharacter} onBack={()=>setScreen('lessons')}/>
        )}
        {screen==='lessons' && (
          <LessonScreen onSelect={startExercise} progress={progress}
            onOpenSetup={(mode)=>{ setMpSetupMode(mode); setScreen('mp-setup'); }}
            onJoin={handleJoin}
            joinCode={joinCode} setJoinCode={setJoinCode}
            joinError={joinError} mpBusy={mpBusy}
            studentName={studentName} classCode={classCode}
            storyPath={storyPath} storyPower={storyPower}
            onViewStats={()=>setScreen('my-stats')}
            onLogin={()=>setScreen('google-login')}
            weekly={weekly}
            onOpenWeekly={openWeekly}
            homework={homework}
            onStartHomework={startHomework}
            highScores={highScores}
            character={character}
            onOpenCharacter={()=>setScreen('character')}
          />
        )}

        {screen==='weekly'&&(
          <WeeklyBoardScreen data={weekly} status={weeklyStatus}
            onRefresh={loadWeekly} onStart={startWeeklyTest}
            onLoadPast={id=>apiGetWeeklyPast(classCode, studentName, id)}
            onBack={()=>setScreen('lessons')}/>
        )}

        {screen==='practice'&&lesson&&target&&(()=>{
          const TF="'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
          const keyLabel = nextKey ? (needsShift?'⇧ + ':'')+nextKey.code.replace('Key','').replace('Digit','')
            .replace('BracketLeft','[').replace('BracketRight',']')
            .replace('Semicolon',';').replace('Quote',"'")
            .replace('Comma',',').replace('Period','.').replace('Slash','/') : '';
          // "now typing" box — inside the solo HUD, or its own slim row in a race room
          // Fixed widths everywhere: the box must not change size between "ว" and "เว้นวรรค",
          // otherwise the HUD reflows and the whole typing screen jumps.
          const oneLine = {whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'};
          const nowTyping = (
            <div style={{display:'flex',alignItems:'center',gap:8,flex:'none',visibility:nextChar?'visible':'hidden'}} aria-hidden={!nextChar}>
              {roomCode&&<span style={{fontSize:12,fontWeight:700,fontFamily:TF,color:'#3B2416',whiteSpace:'nowrap'}}>กำลังพิมพ์</span>}
              <span title="ตัวที่ต้องพิมพ์ต่อไป" aria-label="กำลังพิมพ์" style={{fontFamily:TF,fontSize:nextChar===' '?16:24,fontWeight:700,lineHeight:'34px',height:40,width:88,flex:'none',
                color:'#3B2416',background:'#FFC23D',border:'3px solid #3B2416',textAlign:'center',...oneLine}}>
                {nextChar===' '?'เว้นวรรค':(nextChar||'')}</span>
              <span style={{display:'flex',flexDirection:'column',lineHeight:1.3,width:76,flex:'none'}}>
                <span style={{fontSize:12,fontWeight:600,fontFamily:TF,color:roomCode?'#6A4A30':'#F5E6BE',...oneLine}}>
                  {nextChar?(CLASS_NAMES[CHAR_CLASS[nextChar]]??''):''}</span>
                <span style={{fontFamily:PX_FONT,fontSize:11,fontWeight:400,color:roomCode?'#6A4A30':'#F5D27A',height:14,...oneLine}}>
                  {nextKey&&showHints?keyLabel:''}</span>
              </span>
            </div>
          );
          return (
          <div ref={practiceRef} className="px-fill" style={{display:'flex',flexDirection:'column',gap:'var(--fg)',position:'relative',
            ...(isEliminated?{filter:'grayscale(1)',opacity:.65,transition:'filter .6s, opacity .6s'}:{})}}>
            {/* Eliminated banner — student keeps typing for practice */}
            {isEliminated&&(
              <DeadScreen
                standings={roomPlayers||{}}
                onLeave={requestLeave}
                onSpectate={()=>setScreen('host-dashboard')}
              />
            )}

            {roomType==='1v1'&&roomCode&&(
              <OneVsOneHud
                roomCode={roomCode}
                roomPlayers={roomPlayers}
                myName={myRoomName.current||studentName||'ผู้เล่น1'}
                pos={pos}
                totalChars={totalChars}
                score={score}
                streak={scoreStreak}
                myCfg={myCfg} kpm={kpm}
              />
            )}

            {roomType==='royale'&&roomCode&&(
              <BattleRoyaleHud
                roomCode={roomCode}
                roomPlayers={roomPlayers}
                myName={myRoomName.current||studentName||'ผู้เล่น1'}
                pos={pos}
                totalChars={totalChars}
                zonePos={zonePos}
                playerLives={playerLives}
                afkLeft={afkLeft}
                myCfg={myCfg} kpm={kpm}
                startTime={startTime}
              />
            )}

            {/* Solo practice (untimed only): my character runs as I type; races my best run (ghost) if there is one */}
            {!roomCode&&!activeTest&&!activeHw&&!timeLimit&&window.CharKit&&myCfg&&(
              <div style={{border:'3px solid #3B2416',overflow:'hidden',flex:'none'}}>
                <CharKit.RaceTrack mode="1v1" scene height={laneH} info={`${pos} / ${totalChars} ตัว`} runners={[
                  {id:'me',me:true,label:'คุณ',cfg:myCfg,pct:totalChars?pos/totalChars:0,kpm,finished:pos>=totalChars,color:'#1D4ED8'},
                  ...(ghostData?[{id:'ghost',label:'👻 สถิติ '+fmtScore(ghostData.score||0)+' คะแนน',cfg:myCfg,alpha:.38,color:'#64748B',kpm:ghostData.cpm,
                    track:{timings:ghostData.timings,start:startTime,total:totalChars}}]:[]),
                ]}/>
              </div>
            )}
            {!roomCode&&(
              <div className="px-wood" style={{display:'flex',alignItems:'center',gap:14,padding:'0 4px',color:'#F5E6BE',flex:'none',
                boxSizing:'border-box',height:timeLimit>0?'var(--hud-t)':'var(--hud)'}}>
                <PxButton onClick={()=>setScreen('lessons')} style={{minHeight:'var(--hb)',fontSize:14,flex:'none'}}>← กลับ</PxButton>
                {timeLimit>0&&<div style={{flex:'none',whiteSpace:'nowrap'}}><TestTimer startTime={startTime} now={now} endTime={endTime} total={timeLimit}/></div>}
                <div style={{display:'flex',flexDirection:'column',lineHeight:1.35,minWidth:0,flex:'1 1 0'}}>
                  {activeTest&&<><span style={{fontSize:13,fontWeight:600,color:'#E8CF95',...oneLine}}>ภารกิจประจำสัปดาห์</span>
                    <span style={{fontSize:18,fontWeight:700,...oneLine}} title={activeTest.exerciseTitle}>{activeTest.exerciseTitle}</span></>}
                  {activeHw&&<><span style={{fontSize:13,fontWeight:600,color:'#E8CF95',...oneLine}}>การบ้าน · ต้องได้ {activeHw.minStars} ดาว</span>
                    <span style={{fontSize:18,fontWeight:700,...oneLine}} title={activeHw.title}>{activeHw.title}</span></>}
                  {!activeTest&&!activeHw&&lesson?.curriculum&&exercise&&<><span style={{fontSize:13,fontWeight:600,color:'#E8CF95',...oneLine}}>ด่าน {lesson.stage} · บท {lesson.num}</span>
                    <span style={{fontSize:18,fontWeight:700,...oneLine}} title={exercise.title}>{exercise.title}</span></>}
                  {!activeTest&&!activeHw&&!lesson?.curriculum&&exercise&&<span style={{fontSize:18,fontWeight:700,...oneLine}} title={exercise.title}>{exercise.title}</span>}
                </div>
                {nowTyping}
                {/* score with COMBO underneath (stacked, so it takes little width) */}
                <div style={{marginLeft:'auto',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flex:'none'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,position:'relative'}} aria-label="คะแนน">
                    <Sprite name="i_coin" className="px-z"/>
                    {/* room for 100,000 so a new digit never pushes the HUD */}
                    <span style={{fontFamily:PX_FONT,fontSize:20,fontWeight:400,color:'#F5D27A',minWidth:'7ch',whiteSpace:'nowrap'}}>{fmtScore(score)}</span>
                    {lastGain&&(
                      <span key={lastGain.id} className="score-pop"
                        style={{position:'absolute',right:0,bottom:'100%',marginBottom:-4,whiteSpace:'nowrap',pointerEvents:'none',
                          fontFamily:PX_FONT,fontSize:16,fontWeight:400,color:lastGain.v>=400?'#FFC23D':'#9BE39A'}}>+{lastGain.v}</span>
                    )}
                  </div>
                  {/* always takes its place; only shown while the combo is on */}
                  <span style={{fontFamily:PX_FONT,fontSize:11,fontWeight:400,color:'#FF9A5C',whiteSpace:'nowrap',lineHeight:1,
                    visibility:comboMultiplier(scoreStreak)>1?'visible':'hidden'}} aria-label="คอมโบ" aria-hidden={comboMultiplier(scoreStreak)<=1}>
                    COMBO x{Math.max(1,comboMultiplier(scoreStreak)).toFixed(1)}</span>
                </div>
              </div>
            )}
            {roomCode&&nextChar&&(
              <div style={{padding:'4px 12px',background:'#F8EED2',border:'3px solid #3B2416',flex:'none'}}>{nowTyping}</div>
            )}
            <div className="px-panel" style={{padding:roomCode?'0 8px':'2px 10px',flex:'1 1 auto',minHeight:0,
              display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
              <div style={{position:'relative',width:'100%'}}>
                <TextDisplay displayChars={displayChars} displayPos={displayPos} compact={!!roomCode} offset={curChunk.start}/>
                <TextPager targetChars={targetChars} compact={!!roomCode} onChunks={onPages}/>
              </div>
            </div>
            <div className="px-wood" style={{padding:'0 2px',color:'#F5E6BE',flex:'none'}}>
              <OnScreenKeyboard nextCode={showHints?nextCode:null} needsShift={showHints&&needsShift}
                flashCode={flashCode} shiftHeld={shiftHeld} correctShiftCode={showHints?correctShiftCode:null}/>
            </div>

            {/* Messages float over the race lane / HUD so they never push the keyboard off the screen */}
            {(capsLockOn||hint||(rivalDcSecs>0&&pressureSecs<=0)||pressureSecs>0)&&(
              <div style={{position:'absolute',top:0,left:0,right:0,zIndex:5,display:'flex',flexDirection:'column',gap:6,pointerEvents:'none'}}>
                {capsLockOn&&(
                  <div role="alert" style={{padding:'6px 12px',background:'#FFE9A8',
                    border:'3px solid #3B2416',display:'flex',alignItems:'center',gap:8,pointerEvents:'auto',boxShadow:'0 4px 0 rgba(59,36,22,.35)'}}>
                    <Sprite name="i_help" className="px-z"/>
                    <span style={{fontFamily:TF,fontSize:14,color:'#3B2416',fontWeight:700}}>
                      Caps Lock เปิดอยู่ — ภาษาไทยไม่ใช้ Caps Lock กรุณากด Caps Lock เพื่อปิด แล้วใช้ Shift แทน
                    </span>
                    <button onClick={()=>setCapsLockOn(false)} aria-label="ปิด" className="sp sp-i_x px-icon-btn px-z" style={{marginLeft:'auto'}}/>
                  </div>
                )}
                {hint&&(
                  <div style={{padding:'6px 12px',background:'#FFE9A8',border:'3px solid #3B2416',
                    display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 0 rgba(59,36,22,.35)'}}>
                    <Sprite name="i_help" className="px-z"/>
                    <span style={{fontFamily:TF,fontSize:15,color:'#3B2416',fontWeight:700}}>{hint}</span>
                  </div>
                )}
                {/* 1v1 — opponent dropped out: they have a few seconds to come back */}
                {rivalDcSecs>0&&pressureSecs<=0&&(
                  <div role="status" style={{background:'#FFE9A8',border:'3px solid #3B2416',padding:'8px 16px',
                    fontFamily:TF,fontSize:15,fontWeight:700,color:'#3B2416',boxShadow:'0 4px 0 rgba(59,36,22,.35)'}}>
                    📶 คู่แข่งหลุดการเชื่อมต่อ — รออีก {rivalDcSecs} วินาที ถ้าไม่กลับมา คุณชนะ
                  </div>
                )}
                {/* 1v1 pressure timer — opponent already finished */}
                {pressureSecs>0&&(
                  <div role="alert" style={{background:'#FBD3CC',border:'3px solid #3B2416',
                    padding:'8px 16px',display:'flex',alignItems:'center',gap:14,boxShadow:'0 4px 0 rgba(59,36,22,.35)'}}>
                    <span style={{fontFamily:PX_FONT,fontSize:24,fontWeight:400,color:'#B3261E',minWidth:48,
                      textAlign:'center'}}>{pressureSecs}</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:TF,fontSize:15,fontWeight:700,color:'#7A1D14'}}>
                        คู่แข่งพิมพ์จบแล้ว! เหลือ {pressureSecs} วินาที — เก็บคะแนนให้ได้มากที่สุด!</div>
                      <div style={{background:'#F5E6BE',border:'2px solid #3B2416',height:12,marginTop:6,overflow:'hidden'}}>
                        <div style={{width:`${(pressureSecs/PRESSURE_SECS)*100}%`,height:'100%',
                          background:'#D9452F',transition:'width 1s steps(4)'}}/>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })()}

        {screen==='mp-setup'&&(
          <MPSetupScreen
            mode={mpSetupMode} busy={mpBusy}
            onBack={()=>setScreen('lessons')}
            onSelect={(les,lives)=>{
              if(mpSetupMode==='1v1') handleCreate1v1(les);
              else handleCreateBR(les,lives||3);
            }}/>
        )}
        {screen==='mp-lobby'&&(
          <LobbyScreen
            roomCode={roomCode} roomInfo={roomInfo} myCfg={myCfg}
            roomPlayers={roomPlayers} isHost={isHost}
            roomType={roomType} myName={myRoomName.current||studentName||'ผู้เล่น1'}
            onStart={handleStartRace} onLeave={handleLeaveRoom}
            onStartSpectator={async()=>{
              setIsHostSpectator(true);
              try { fbDisarm(rcRef.current); } catch {}   // watching host: never delete the running race
              handleStartRace();
              // Remove host from players list so they don't show as competitor
              const huid=currentFirebaseUid();
              if (huid) await getDB()?.ref('rooms/'+rcRef.current+'/players/'+huid).remove();
              setScreen('host-dashboard');
            }}/>
        )}
        {screen==='host-dashboard'&&(
          roomType==='royale'&&brOver ? (
            <BattleRoyaleResults
              roomCode={roomCode}
              roomPlayers={roomPlayers}
              rows={brFinal}
              sOffset={serverTimeOffset}
              onBack={handleLeaveRoom}
            />
          ) : spectatingPlayer ? (
            <SpectatorView
              playerName={roomPlayers?.[spectatingPlayer]?.name||'ผู้เล่น'}
              targetChars={targetChars}
              progress={roomPlayers?.[spectatingPlayer]?.pos||0}
              onBack={()=>setSpectatingPlayer(null)}
            />
          ) : (
            <HostDashboard
              roomCode={roomCode}
              roomPlayers={roomPlayers}
              roomType={roomType}
              zoneWpm={zoneWpm}
              zonePos={zonePos}
              onSpectate={name=>{setSpectatingPlayer(name);}}
              sOffset={serverTimeOffset}
              watcherNote={isHostSpectator?'':'คุณตกรอบแล้ว · กำลังดูการแข่งขันต่อ'}
              onBack={()=>{handleLeaveRoom();}}
            />
          )
        )}
        {screen==='countdown'&&(
          <CountdownScreen num={countNum} roomCode={roomCode} roomType={roomType}
            roomPlayers={roomPlayers} myCfg={myCfg} myName={myRoomName.current||studentName||'ผู้เล่น1'}/>
        )}
        {screen==='results'&&lesson?.story&&exercise?.isChoice?(
          <StoryChoiceScreen exercise={exercise}
            adventureName={adventureName||'นักผจญภัย'}
            onChoose={(saves)=>{
              if(saves.storyPath){setStoryPath(saves.storyPath);try{localStorage.setItem('storyPath',saves.storyPath);}catch(e){}}
              if(saves.storyPower){setStoryPower(saves.storyPower);try{localStorage.setItem('storyPower',saves.storyPower);}catch(e){}}
              setScreen('lessons');
            }}/>
        ):screen==='results'&&(
          <ResultsScreen cpm={kpm} accuracy={accuracy} errors={errors}
            totalChars={pos} lesson={lesson}
            saveStatus={saveStatus} saveError={saveError} studentName={studentName}
            ghostData={ghostData} newRecord={newRecord}
            roomCode={roomCode} roomType={roomType}
            roomPlayers={roomPlayers} myName={myRoomName.current||studentName||'ผู้เล่น1'}
            bestCombo={bestCombo}
            score={score} maxScore={maxScore} isTest={!!activeTest}
            testBoard={testBoard}
            prevBest={prevBest}
            curResult={!roomCode&&!activeTest&&!activeHw?curResult:null}
            nextStep={!roomCode&&!activeTest&&!activeHw?nextStepOf(lesson,exercise):null}
            hwResult={!roomCode&&activeHw?hwResult:null}
            onNext={()=>{ const n=nextStepOf(lesson,exercise); if(n) startExercise(n.lesson,n.exercise); }}
            myCfg={myCfg}
            sOffset={serverTimeOffset}
            brFinal={brFinal}
            onDuelSettled={onDuelSettled}
            onRestart={()=>{
              if(rcRef.current){handleLeaveRoom();}
              else if(hwRef.current) startHomework(hwRef.current);
              else if(testRef.current) startWeeklyTest();
              else if(lesson&&exercise) startExercise(lesson,exercise);
              else setScreen('lessons');
            }}
            onBack={()=>{
              if(rcRef.current){handleLeaveRoom();}
              else if(testRef.current) openWeekly();
              else setScreen('lessons');
            }}/>
        )}
      </div>
    </div>
  );
}
