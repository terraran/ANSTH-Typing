import { SCRIPT_URL } from './config';
import { buildChunks, generateBRText, generateStoryText, generateText, generateTimedText, seededRng } from './engine/text';
import { CHAR_CLASS, CLASS_NAMES, KEY_META, findKeyForChar, mapKey, validateInput } from './engine/keymap';
import { ERROR_BURST, ERROR_WINDOW_MS, PRESSURE_SECS, SPAM_PENALTY, SPAM_WINDOW_KEYS, SPAM_WRONG_SHARE, SPEED_CPM, TEST_MIN_CHARS, TEST_SECS, charBasePoints, comboMultiplier, fmtScore, hsKey, readGuestHighScores, speedMultiplier, testTargetScore, writeGuestHighScores } from './engine/scoring';
import { ROOM_CODE_LEN, ROOM_CODE_RE, ZONE_GAP, ZONE_TICK, currentFirebaseUid, ensureFirebaseUser, fbCreate, fbGet, fbJoin, fbListen, fbRemove, fbSetChar, fbSetStatus, fbUpdatePlayer, getDB, getZonePos, getZoneSpeed, makeFreeCode } from './firebase';
import { apiGetStudentStats, apiGetWeeklyBoard, apiRequest, apiSubmitWeekly, describeApiError, saveSession } from './api';
import { auth } from './auth';
import { LESSONS } from './data/lessons';
import { PenaltyScreen, TestTimer, TextDisplay, TimeUpOverlay } from './ui/common';
import { NameModal, StoryChoiceScreen } from './screens/Story';
import { ClassPickerScreen, GoogleSignInScreen } from './screens/Login';
import { MyStatsScreen } from './screens/MyStatsScreen';
import { LessonScreen } from './screens/LessonScreen';
import { WeeklyBoardScreen } from './screens/WeeklyBoardScreen';
import { BattleRoyaleHud, DeadScreen, OneVsOneHud } from './race/Hud';
import { OnScreenKeyboard } from './ui/keyboard';
import { CountdownScreen, LobbyScreen, MPSetupScreen } from './race/Setup';
import { BattleRoyaleResults, HostDashboard, SpectatorView } from './race/Host';
import { ResultsScreen } from './screens/ResultsScreen';

const { useCallback, useEffect, useRef, useState } = React;

export function ThaiTypingApp() {
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
  const [zonePos,     setZonePos]     = useState(0); // safe zone boundary position
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [serverTimeReady, setServerTimeReady] = useState(false);
  const [ghostData,     setGhostData]     = useState(null);  // best previous run {timings,cpm,accuracy}
  const [ghostPos,      setGhostPos]      = useState(0);     // ghost's current character position
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
  // Theme: 'light' | 'dark' | 'auto'
  const [themeMode, setThemeMode] = useState(()=>{ try{return localStorage.getItem('theme')||'light';}catch{return 'light';} });
  const isDark = themeMode==='dark';

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
  const charRef        = useRef(null);    // latest character (for room create/join callbacks)
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
  const [maxScore,    setMaxScore]    = useState(0);    // weekly test: target score (100%)
  const [highScores,  setHighScores]  = useState({});   // practice best per exercise
  const [prevBest,    setPrevBest]    = useState(0);    // high score before this run
  const testRef       = useRef(null);
  const hsDone        = useRef(false);

  // ── Derived values — declared early so all effects can reference them ──
  const targetChars = target ? [...target] : [];
  const totalChars  = targetChars.length;
  // Split target into ~2-line word-boundary chunks (see buildChunks above)
  const chunks = buildChunks(targetChars);
  // Derive chunkIdx from pos — always in sync, no stale-state lag
  const chunkIdx = (() => {
    for (let i=0; i<chunks.length; i++) { if (pos < chunks[i].end) return i; }
    return Math.max(0, chunks.length-1);
  })();
  const curChunk    = chunks[chunkIdx] || {start:0, end:totalChars};
  const displayChars = targetChars.slice(curChunk.start, curChunk.end);
  const displayPos   = Math.max(0, pos - curChunk.start);

  const elapsed     = startTime ? ((endTime??now)-startTime)/60000 : 0;
  const kpm         = elapsed>0 ? Math.round(pressCountRef.current/elapsed) : 0;
  const wpm         = elapsed>0 ? Math.round(pos/elapsed/5) : 0;
  const accuracy    = (pos+errors)>0 ? Math.round((pos/(pos+errors))*100) : 100;
  const isEliminated = roomType==='royale' && playerLives<=0;
  const nextChar    = pos<targetChars.length ? targetChars[pos] : null;
  const nextKey     = nextChar ? findKeyForChar(nextChar) : null;
  const nextCode    = nextKey?.code ?? null;
  const needsShift  = nextKey?.needsShift ?? false;
  // Correct shift hand: left-hand target → Right Shift; right-hand target → Left Shift
  const showHints   = !activeTest || activeTest.showHints !== false;
  // My look on the race track: saved character, else the stable one from my room name
  const myCfg = window.CharKit
    ? (CharKit.sanitize(character) || CharKit.fromName(myRoomName.current||studentName||'ผู้เล่น1'))
    : null;
  const correctShiftCode = (needsShift && nextCode)
    ? (['LP','LR','LM','LI'].includes(KEY_META[nextCode]?.f) ? 'ShiftRight' : 'ShiftLeft')
    : null;

  // Lock the view once when a run starts: race HUD / score at the top of the
  // screen so the text and the on-screen keyboard are visible together.
  // Only once per run — the student can scroll freely afterwards.
  useEffect(() => {
    if (screen!=='practice') return;
    const id=requestAnimationFrame(()=>{
      const el=practiceRef.current; if(!el) return;
      const top=el.getBoundingClientRect().top+window.scrollY-8;
      window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
    });
    return ()=>cancelAnimationFrame(id);
  },[screen]);

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
    if (screen!=='practice'||!startTime||endTime) return;
    const id=setInterval(()=>setNow(Date.now()),activeTest?200:500);
    return ()=>clearInterval(id);
  },[screen,startTime,endTime,activeTest]);

  // Weekly test: 2 minutes from the first keypress, then "⏰ หมดเวลา!" → results.
  // The clock keeps running during a spam penalty (that is part of the penalty).
  useEffect(() => {
    if (screen!=='practice'||!activeTest||!startTime||endTime) return;
    if (now-startTime < TEST_SECS*1000) return;
    setEndTime(startTime+TEST_SECS*1000);
    frozenRef.current=false; setPenaltySecs(0);
    setTimeUp(true);
    setTimeout(()=>{ setTimeUp(false); setScreen(s=>s==='practice'?'results':s); },1400);
  },[now,screen,activeTest,startTime,endTime]);

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
    const unsub = fbListen(roomCode, (data) => {
      if (!data) return;
      setRoomInfo(data.info);
      const pl = data.players || {};
      setRoomPlayers(pl);
      if (data.zone?.cpm || data.zone?.wpm) { setZoneWpm(data.zone.cpm||data.zone.wpm); setZoneTs(data.zone.ts||Date.now()); }
      if (data.info?.maxLives) setMaxLives(data.info.maxLives);

      // ── Lobby/countdown: host manually triggers countdown ──
      if (data.info?.status==='countdown' && screen==='mp-lobby') setScreen('countdown');

      // Resolve BR completion for both racers and the host spectator.
      const type = data.info?.type;
      const entries = Object.entries(pl).filter(([,p])=>!p.isSpectator);
      const someoneDone = entries.some(([,p])=>p.status==='done');
      if (type==='royale') {
        const stillRacing = entries.filter(([,p])=>p.status!=='eliminated' && p.status!=='done');
        const lastStanding = entries.length>=2 && stillRacing.length<=1 && !someoneDone;
        const raceOver = someoneDone || lastStanding || data.info?.status==='done';
        if (raceOver && data.info?.status!=='done') {
          fbSetStatus(roomCode,'done',{endedAt:Date.now()}).catch(()=>{});
        }
        if (screen==='practice' && raceOver && !raceEndedRef.current) {
          raceEndedRef.current=true;
          setEndTime(Date.now());
          setTimeout(()=>setScreen(s=>s==='practice'?'results':s),400);
        }
      } else if (screen==='practice' && type==='1v1') {
        const me = currentFirebaseUid();
        const iAmDone = Object.values(pl).some(p=>p.uid===me&&p.status==='done');
        if (someoneDone && !iAmDone && !raceEndedRef.current) {
          raceEndedRef.current=true;
          setPressureSecs(PRESSURE_SECS);
        }
      }
    });
    fbUnsub.current = unsub;
    return () => { unsub(); fbUnsub.current=null; };
  },[roomCode, screen, isHost]);

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
      setNewRecord(false); setGhostPos(0);
      setPlayerLives(maxLives); plRef.current=maxLives;
      // Scoring starts fresh for every race (1v1 is decided by score)
      setScore(0); scoreRef.current=0; setScoreStreak(0); streakRef.current=0; setLastGain(null);
      scoredIdx.current=new Set(); missedIdx.current=new Set();
      speedBuf.current=[]; lastScoreTime.current=null; setBestCombo(0);
      setActiveTest(null); testRef.current=null; setTestBoard(null); setTimeUp(false);
      setRaceStand([]); setZonePos(0); setZoneWpm(0); lastZoneDrainTickRef.current=0;
      setPenaltySecs(0); setPressureSecs(0);
      frozenRef.current=false; raceEndedRef.current=false;
      pressCountRef.current=0;
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

  // Animate the ghost cursor during practice
  useEffect(() => {
    if (screen !== 'practice' || !ghostData || !startTime) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let cum = 0, gp = 0;
      for (const t of ghostData.timings) {
        cum += t;
        if (cum <= elapsed) gp++;
        else break;
      }
      setGhostPos(Math.min(gp, ghostData.timings.length));
    }, 60);
    return () => clearInterval(id);
  }, [screen, ghostData, startTime]);

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
      if (!existingData || finalKpm > existingData.cpm) {
        localStorage.setItem(ghostKey, JSON.stringify({
          timings:  [...currentTimings.current],
          cpm:      finalKpm,
          accuracy: finalAcc,
        }));
        setNewRecord(true);
      }
    } catch (e) { /* localStorage unavailable */ }
  }, [screen]);

  // Save results to Google Sheets when the results screen appears
  useEffect(() => {
    if (screen !== 'results') return;
    // Practice high score (solo practice only — not tests or multiplayer rooms)
    if (!hsDone.current && !testRef.current && !rcRef.current && lesson && exercise) {
      hsDone.current = true;
      const k = hsKey(lesson.id, exercise.title);
      const sc = scoreRef.current;
      setPrevBest(highScores[k] || 0);
      if (sc > (highScores[k] || 0)) {
        const next = {...highScores, [k]: sc};
        setHighScores(next);
        if (!studentName || !SCRIPT_URL) writeGuestHighScores(next);
      }
    }
    if (!studentName || !SCRIPT_URL) return;
    if (hasSaved.current) return;         // guard — only save once per results view
    hasSaved.current = true;
    setSaveStatus('saving'); setSaveError('');
    const elapsed = startTime && endTime ? (endTime - startTime) / 60000 : 0;
    const finalKpm = elapsed > 0 ? Math.round(pressCountRef.current / elapsed) : 0;
    const finalAcc = (pos + errors) > 0 ? Math.round((pos / (pos + errors)) * 100) : 100;
    const duration = endTime && startTime ? Math.round((endTime - startTime) / 1000) : 0;
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
        .then(d => setHighScores(d.highScores || {}))
        .catch(() => {});
    } else {
      setHighScores(readGuestHighScores());
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
  useEffect(() => {
    if (screen !== 'weekly') return;
    const id = setInterval(loadWeekly, 60000);
    return () => clearInterval(id);
  }, [screen, loadWeekly]);

  const stateRef = useRef({});
  stateRef.current = { pos, target, targetChars, startTime, endTime };
  rcRef.current = roomCode; rtRef.current = roomType;
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
      text = opts.text || generateText(ex.words,ex.minChars);
    }
    setTarget(text);
    const test = opts.test || null;
    setActiveTest(test); testRef.current = test;
    setMaxScore(test ? testTargetScore([...text], les.id) : 0);
    setTestBoard(null); setTimeUp(false);
    setScore(0); scoreRef.current=0; setScoreStreak(0); streakRef.current=0; setLastGain(null);
    scoredIdx.current=new Set(); missedIdx.current=new Set();
    speedBuf.current=[]; lastScoreTime.current=null; lessonIdRef.current=les.id;
    hsDone.current=false; setPrevBest(0);
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
    setGhostPos(0);
    if (test) { setGhostKey(''); setGhostData(null); }   // no ghost during tests
    else {
      const gk = (les.story?'story_':'ghostv2_') + les.id + '_' + encodeURIComponent(ex.title);
      setGhostKey(gk);
      try {
        const saved = localStorage.getItem(gk);
        setGhostData(saved ? JSON.parse(saved) : null);
      } catch { setGhostData(null); }
    }
    setScreen('practice');
  },[]);

  // Start this week's test: same seeded text for the whole grade level.
  const startWeeklyTest = useCallback(() => {
    const t = weekly?.test;
    if (!t) return;
    const les = LESSONS.find(l=>l.id===Number(t.lessonId));
    const exs = les ? (les.exercises || []) : [];
    const num = s => (String(s||'').match(/^(\d+\.\d+)/)||[])[1];
    const ex = exs.find(e=>e.title===t.exerciseTitle)
      || exs.find(e=>num(e.title) && num(e.title)===num(t.exerciseTitle));
    if (!les || !ex) { alert('ไม่พบแบบฝึก "'+t.exerciseTitle+'" ในแอป — แจ้งครูให้ตั้งแบบทดสอบใหม่'); return; }
    const text = generateTimedText(ex.words, TEST_MIN_CHARS, seededRng(t.testId));
    startExercise(les, ex, {test:t, text});
  },[weekly, startExercise]);

  const openWeekly = useCallback(() => { setScreen('weekly'); loadWeekly(); },[loadWeekly]);

  // Create a 1v1 room for a specific exercise
  const handleCreate1v1 = useCallback(async (les) => {
    setMpBusy(true); setJoinError('');
    // Combine all words from the lesson's word bank for the race
    const allWords = [...new Set(les.exercises.flatMap(ex=>ex.words))];
    const text = generateText(allWords, 200);
    try {
      await ensureFirebaseUser();
      const code = await makeFreeCode();
      await fbCreate(code,{type:'1v1',lessonId:les.id,
        exerciseTitle:les.thaiName,targetText:text,
        hostName:snRef.current||'ผู้เล่น1'});
      const h1name = snRef.current || 'ผู้เล่น1';
      myRoomName.current = h1name;
      await fbJoin(code, h1name);
      if (charRef.current) fbSetChar(code, charRef.current);
      setRoomCode(code); rcRef.current=code;
      setRoomType('1v1'); rtRef.current='1v1';
      setIsHost(true);
      lessonIdRef.current = les.id;
      setLesson(les); setExercise(null); setTarget(text);
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
      await fbJoin(code, hBRname, lives);
      if (charRef.current) fbSetChar(code, charRef.current);
      setMaxLives(lives); setPlayerLives(lives); plRef.current=lives;
      setRoomCode(code); rcRef.current=code;
      setRoomType('royale'); rtRef.current='royale';
      setIsHost(true);
      lessonIdRef.current = les.id;
      setLesson(les); setExercise(null); setTarget(text);
      setScreen('mp-lobby');
    } catch(e) { setJoinError('สร้างห้องไม่ได้'); }
    setMpBusy(false);
  },[]);

  // Join an existing room by code
  const handleJoin = useCallback(async (code) => {
    const roomId=String(code||'').trim().toUpperCase();
    if (!ROOM_CODE_RE.test(roomId)) { setJoinError('รหัสห้องต้องมี '+ROOM_CODE_LEN+' ตัวอักษร'); return; }
    setMpBusy(true); setJoinError('');
    try {
      await ensureFirebaseUser();
      const data = await fbGet(roomId);
      if (!data) { setJoinError('ไม่พบห้อง '+roomId); setMpBusy(false); return; }
      if (data.info?.status!=='lobby') { setJoinError('ห้องนี้กำลังแข่งอยู่แล้ว'); setMpBusy(false); return; }
      const name = snRef.current || ('ผู้เล่น'+(Object.keys(data.players||{}).length+1));
      myRoomName.current = name;
      const rl = data.info?.maxLives || 3;
      setMaxLives(rl); setPlayerLives(rl); plRef.current=rl;
      await fbJoin(roomId, name, rl);
      if (charRef.current) fbSetChar(roomId, charRef.current);
      const les = LESSONS.find(l=>l.id===data.info.lessonId)||null;
      setRoomCode(roomId); rcRef.current=roomId;
      setRoomType(data.info.type); rtRef.current=data.info.type;
      setIsHost(false);
      lessonIdRef.current = les?.id || Number(data.info.lessonId) || 1;
      setLesson(les); setTarget(data.info.targetText);
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

  // Leave/cleanup room
  const handleLeaveRoom = useCallback(async () => {
    const code=rcRef.current;
    if (code) {
      try {
        const uid=currentFirebaseUid();
        if (uid) await getDB()?.ref('rooms/'+code+'/players/'+uid).remove();
        if (isHost) await fbRemove(code);
      } catch{}
    }
    if (fbUnsub.current) { fbUnsub.current(); fbUnsub.current=null; }
    setRoomCode(''); rcRef.current='';
    setRoomType(''); rtRef.current='';
    setIsHost(false); setRoomPlayers({}); setRoomInfo(null);
    setPressureSecs(0); setPenaltySecs(0);
    frozenRef.current=false; raceEndedRef.current=false;
    myRoomName.current='';
    setScreen('lessons');
  },[isHost]);

  // Log the student out → back to the sign-in screen
  const handleLogout = useCallback(() => {
    setClassCode(''); setStudentName(''); setDisplayName('');
    setLesson(null); setExercise(null); setTarget(''); setPos(0);
    setErrors(0); setStartTime(null); setEndTime(null); setSaveStatus('idle');
    setGoogleUser(null); setWeekly(null); setWeeklyStatus('idle'); setTestBoard(null);
    setCharacter(window.CharKit?CharKit.loadLocal('guest'):null);
    setActiveTest(null); testRef.current=null;
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
      if (e.key==='Shift') { setShiftHeld(true); return; }
      if (e.key==='CapsLock') { setCapsLockOn(e.getModifierState('CapsLock')); return; }
      if (e.ctrlKey||e.altKey||e.metaKey) return;
      e.preventDefault();
      if (frozenRef.current) return;   // spam penalty active — ignore typing
      if (e.key==='Escape') { setScreen(testRef.current?'weekly':'lessons'); return; }
      const { pos,target,targetChars,startTime,endTime } = stateRef.current;
      if (endTime) return;             // finished, or the weekly test time is up
      if (e.code==='Backspace') {
        if (pos>0) {
          setPos(p=>p-1);
          if (rcRef.current) fbUpdatePlayer(rcRef.current,myRoomName.current||snRef.current||'ผู้เล่น1',{pos:pos-1});
        }
        setHint(null); return;
      }
      const char=mapKey(e);
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
                {pos:np,cpm:Math.min(3000,nc),wpm:Math.min(600,Math.round(nc/5)),status:'racing',
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
          setFlashCode(e.code);
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

  return (
    <div style={{minHeight:'100vh',background:'var(--c-bg)',fontFamily:'system-ui,sans-serif',
      display:'flex',flexDirection:'column',alignItems:'center',padding:'24px 16px 40px',background:'var(--c-bg)',color:'var(--c-t1)'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');`}</style>

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

      {/* Header */}
      <div style={{width:'100%',maxWidth:860,display:'flex',
        justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:26}}>⌨️</span>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:'var(--c-t1)',
              fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>แบบฝึกพิมพ์ภาษาไทย</div>
            <div style={{fontSize:10,color:'var(--c-t3)'}}>Thai Typing Practice — Kedmanee (TIS 820-2538)</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {/* Student badge */}
          {studentName && (
            <div style={{background:'#F1F5F9',border:'1.5px solid var(--c-border)',
              borderRadius:8,padding:'5px 10px',fontSize:11,color:'#475569',
              fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
              ห้อง {classCode} | <strong>{studentName}</strong>
            </div>
          )}
          {/* Back to lessons */}
          {screen!=='lessons'&&screen!=='spam'&&(
            <button onClick={()=>setScreen('lessons')} style={{background:'transparent',
              border:'1.5px solid #CBD5E1',borderRadius:8,padding:'6px 12px',cursor:'pointer',
              fontSize:11,color:'var(--c-t2)',fontWeight:600,
              fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>← บทเรียน</button>
          )}
          {/* Logout (class mode only) */}
          {studentName && (
            <button onClick={handleLogout} style={{background:'transparent',
              border:'1.5px solid #FCA5A5',borderRadius:8,padding:'6px 12px',cursor:'pointer',
              fontSize:11,color:'#DC2626',fontWeight:600,
              fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>ออกจากระบบ</button>
          )}
          {/* Theme toggle */}
          <button onClick={()=>setThemeMode(m=>m==='dark'?'light':'dark')}
            title={isDark?'Switch to Light Mode':'Switch to Dark Mode'}
            style={{fontSize:16,background:'transparent',border:'1.5px solid var(--c-border)',
              borderRadius:8,padding:'5px 9px',cursor:'pointer',lineHeight:1}}>
            {isDark?'☀️':'🌙'}
          </button>
          {/* Link to teacher panel */}
          <a href="teacher.html" style={{fontSize:11,color:'var(--c-t3)',textDecoration:'none',
            fontWeight:600,padding:'6px 10px',border:'1.5px solid var(--c-border)',borderRadius:8,
            display:'flex',alignItems:'center',gap:3}}>🎓 ครู</a>
        </div>
      </div>

      {/* Card */}
      <div style={{width:'100%',maxWidth:860,background:'var(--c-card)',borderRadius:20,
        boxShadow:'0 4px 24px rgba(0,0,0,.12)',padding:'30px 26px'}}>

        {screen==='google-login' && (
          <GoogleSignInScreen
            onSignIn={(profile, credential) => {
              auth.idToken=credential||'';
              auth.subject=profile?.sub||'';
              setGoogleUser(profile);
              setScreen('class-picker');
            }}
            onSolo={async() => { auth.idToken=''; auth.subject=''; auth.fbSubject=''; if(typeof firebase!=='undefined'&&firebase.apps.length)await firebase.auth().signOut().catch(()=>{}); setGoogleUser(null); setStudentName(''); setScreen('lessons'); }}
          />
        )}
        {screen==='class-picker' && googleUser && (
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
        )}

        {screen==='my-stats' && studentName && (
          <MyStatsScreen
            studentName={studentName}
            classCode={classCode}
            onBack={() => setScreen('lessons')}
          />
        )}
        {screen==='character' && window.CharKit && (
          <CharKit.CreatorScreen initial={character} signedIn={!!studentName}
            onSave={saveCharacter} onBack={()=>setScreen('lessons')}/>
        )}
        {screen==='lessons' && (
          <LessonScreen onSelect={startExercise}
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
            highScores={highScores}
            character={character}
            onOpenCharacter={()=>setScreen('character')}
          />
        )}

        {screen==='weekly'&&(
          <WeeklyBoardScreen data={weekly} status={weeklyStatus}
            onRefresh={loadWeekly} onStart={startWeeklyTest}
            onBack={()=>setScreen('lessons')}/>
        )}

        {screen==='practice'&&lesson&&target&&(
          <div ref={practiceRef} style={isEliminated?{filter:'grayscale(1)',opacity:.65,transition:'filter .6s, opacity .6s'}:undefined}>
            {/* Eliminated banner — student keeps typing for practice */}
            {isEliminated&&(
              <DeadScreen
                standings={roomPlayers||{}}
                onLeave={()=>handleLeaveRoom&&handleLeaveRoom()}
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
                myCfg={myCfg} kpm={kpm}
                startTime={startTime}
              />
            )}

            {!roomCode&&(
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10,
                fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
                {activeTest&&<TestTimer startTime={startTime} now={now} endTime={endTime}/>}
                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                  {activeTest&&(
                    <span style={{alignSelf:'flex-start',background:'#EDE9FE',color:'#6D28D9',borderRadius:8,
                      padding:'3px 10px',fontSize:12,fontWeight:800}}>📝 แบบทดสอบประจำสัปดาห์ · {activeTest.exerciseTitle}</span>
                  )}
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:22,fontWeight:800,color:'var(--c-t1)'}}>⭐ {fmtScore(score)}</span>
                    {lastGain&&(
                      <span key={lastGain.id} className="score-pop"
                        style={{fontSize:15,fontWeight:800,color:lastGain.v>=400?'#D97706':'#059669'}}>
                        +{lastGain.v}</span>
                    )}
                  </div>
                </div>
                {comboMultiplier(scoreStreak)>1&&(
                  <span style={{marginLeft:'auto',background:'#FFF7ED',color:'#EA580C',borderRadius:8,
                    padding:'4px 10px',fontSize:13,fontWeight:800}}>
                    🔥 x{comboMultiplier(scoreStreak).toFixed(1)}</span>
                )}
              </div>
            )}
            <div style={{background:'var(--c-surf)',borderRadius:14,padding:roomCode?'8px 16px':'22px 18px',
              marginBottom:roomCode?8:14,border:'1.5px solid var(--c-border)',minHeight:96,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <TextDisplay displayChars={displayChars} displayPos={displayPos} compact={!!roomCode}/>
            </div>
            <div style={{marginTop:8}}>
              <OnScreenKeyboard nextCode={showHints?nextCode:null} needsShift={showHints&&needsShift}
                flashCode={flashCode} shiftHeld={shiftHeld} correctShiftCode={showHints?correctShiftCode:null}/>
              {capsLockOn&&(
                <div style={{marginTop:8,padding:'7px 14px',background:'#FEF9C3',
                  border:'1.5px solid #FDE047',borderRadius:8,
                  display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:15}}>⚠️</span>
                  <span style={{fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",
                    fontSize:12,color:'#713F12',fontWeight:600}}>
                    Caps Lock เปิดอยู่ — ภาษาไทยไม่ใช้ Caps Lock กรุณากด Caps Lock เพื่อปิด แล้วใช้ Shift แทน
                  </span>
                  <button onClick={()=>setCapsLockOn(false)}
                    style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',
                      fontSize:14,color:'#92400E',fontWeight:800,padding:'0 4px'}}>✕</button>
                </div>
              )}
            </div>

            {nextChar&&(
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,
                padding:'9px 14px',background:'#EFF6FF',borderRadius:9,
                border:'1.5px solid #BFDBFE'}}>
                <span style={{fontSize:10,color:'#2563EB',fontWeight:700,
                  fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>กำลังพิมพ์:</span>
                <span style={{fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",
                  fontSize:22,fontWeight:800,color:'#1D4ED8'}}>
                  {nextChar===' '?'(เว้นวรรค)':nextChar}</span>
                <span style={{fontSize:10,color:'#64748B',
                  fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
                  {CLASS_NAMES[CHAR_CLASS[nextChar]]??''}</span>
                {nextKey&&showHints&&(
                  <span style={{marginLeft:'auto',fontSize:10,color:'#64748B',fontWeight:700}}>
                    {needsShift?'⇧ + ':''}
                    {nextKey.code.replace('Key','').replace('Digit','')
                      .replace('BracketLeft','[').replace('BracketRight',']')
                      .replace('Semicolon',';').replace('Quote',"'")
                      .replace('Comma',',').replace('Period','.').replace('Slash','/')}
                  </span>
                )}
              </div>
            )}

            {hint&&(
              <div style={{padding:'9px 14px',background:'#FEF3C7',borderRadius:9,
                border:'1.5px solid #FCD34D',marginBottom:10,
                display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:16}}>💡</span>
                <span style={{fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",
                  fontSize:13,color:'#92400E',fontWeight:600}}>{hint}</span>
              </div>
            )}

            {/* 1v1 pressure timer — opponent already finished */}
            {pressureSecs>0&&(
              <div style={{background:'#FEF2F2',border:'2px solid #EF4444',borderRadius:12,
                padding:'12px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:14}}>
                <span style={{fontSize:30,fontWeight:800,color:'#DC2626',minWidth:44,
                  textAlign:'center'}}>{pressureSecs}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",
                    fontSize:14,fontWeight:800,color:'#DC2626'}}>
                    คู่แข่งพิมพ์จบแล้ว! เหลือ {pressureSecs} วินาที — เก็บคะแนนให้ได้มากที่สุด!</div>
                  <div style={{background:'#FECACA',borderRadius:6,height:6,marginTop:6,overflow:'hidden'}}>
                    <div style={{width:`${(pressureSecs/PRESSURE_SECS)*100}%`,height:'100%',
                      background:'#DC2626',borderRadius:6,transition:'width 1s linear'}}/>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

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
              handleStartRace();
              // Remove host from players list so they don't show as competitor
              const huid=currentFirebaseUid();
              if (huid) await getDB()?.ref('rooms/'+rcRef.current+'/players/'+huid).remove();
              setScreen('host-dashboard');
            }}/>
        )}
        {screen==='host-dashboard'&&(
          roomType==='royale'&&roomInfo?.status==='done' ? (
            <BattleRoyaleResults
              roomCode={roomCode}
              roomPlayers={roomPlayers}
              onBack={()=>setSpectatingPlayer(null)}
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
            myCfg={myCfg}
            onRestart={()=>{
              if(rcRef.current){handleLeaveRoom();}
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
