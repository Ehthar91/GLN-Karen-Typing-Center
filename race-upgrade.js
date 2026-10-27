/* GLN Classroom Car Race — reliability + stable dashboard upgrade, 2026-10-25.
   Loads after race.js/race-features.js; existing race modes and UI are preserved. */
(() => {
  'use strict';
  const SESSION_KEY='gln-classroom-car-race-session-v2';
  const raceEl=id=>document.getElementById(id);
  const readSession=()=>{try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  const writeSession=session=>{try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(session))}catch{}};
  const forgetSession=()=>{try{sessionStorage.removeItem(SESSION_KEY)}catch{}};
  const sameIdentity=record=>Boolean(record&&record.code===raceCode&&record.uid===currentUser?.uid&&record.role===raceMode);
  const effectiveNow=room=>room?.status==='paused'&&room.pausedAt?Number(room.pausedAt):room?.status==='finished'&&room.endedAt?Number(room.endedAt):raceNow();
  const elapsedSeconds=room=>Math.max(0,(effectiveNow(room)-Number(room?.startedAt||effectiveNow(room)))/1000);
  const graphemes=value=>raceGraphemeSegmenter?Array.from(raceGraphemeSegmenter.segment(value)).length:Array.from(value).length;
  const currentPlayer=room=>Array.isArray(room?.players)?room.players.find(p=>p.id===racePlayerId):room?.players?.[racePlayerId];
  let dashboardTimer=null;
  let resumedOnceForRound='';
  let restoringSession=false;
  let expireUpdatePending=false;
  // Accuracy Challenge: distance (percentage points) temporarily lost to wrong keys.
  // Keep text completion independent so correct characters are never erased.
  let raceReverseDebt=0;
  let raceClientSequence=0;
  let observedRound='', observedProgress=new Map();
  const reverseFlashTimers=new WeakMap();
  // The only reverse boundary is the START line. Do not bank invisible
  // penalties after the car reaches 0%; the next correct key can move forward.
  const advanced=room=>window.GLNRaceAdvancedSettings?.read(room) ||
    {reversePerError:3,accuracyTarget:90,reverseFeedback:true};
  const availableDistance=()=>racePassageText?.length?Math.max(0,Math.min(100,raceTyped.length/racePassageText.length*100)):0;
  const clampDebt=value=>window.GLNRaceAdvancedSettings?.limitToTrack(value,availableDistance()) ??
    Math.min(Math.max(0,Number(value)||0),availableDistance());
  const reverseEnabled=room=>room?.scoringMode==='accuracy';
  const passageUnits=()=>Math.max(1,graphemes(racePassageText));
  function flashReverseLane(uid){
    if(!advanced(raceRoomData).reverseFeedback)return;
    const lane=[...raceEl('raceTrack').querySelectorAll('.race-lane')]
      .find(node=>node.dataset.playerId===String(uid));
    if(!lane)return;
    clearTimeout(reverseFlashTimers.get(lane));
    lane.classList.remove('race-is-reversing');
    // Force a new flash even for consecutive wrong keys.
    void lane.offsetWidth;
    lane.classList.add('race-is-reversing');
    reverseFlashTimers.set(lane,setTimeout(()=>lane.classList.remove('race-is-reversing'),550));
  }


  // Save the host/player identity independently of typed content. One tab, one race.
  function saveIdentity(){
    if(!raceCode||!currentUser||!['player','host'].includes(raceMode))return;
    const old=readSession(),existing=sameIdentity(old)?old:{};
    writeSession({...existing,code:raceCode,uid:currentUser.uid,role:raceMode,name:raceMode==='player'?racePlayerName:'',updatedAt:raceNow()});
  }
  function saveTyping(){
    if(raceMode!=='player'||!raceRoomData?.roundId||!racePassageText)return;
    const old=readSession();
    writeSession({...sameIdentity(old)?old:{},code:raceCode,uid:currentUser?.uid,role:'player',name:racePlayerName,
      roundId:String(raceRoomData.roundId),passage:racePassageText,typed:raceTyped,errors:raceErrors,reverseDebt:raceReverseDebt,
      wordErrors:window.GLNRaceVocabulary?.serialize()||{},updatedAt:raceNow()});
  }

  const originalCloseRace=closeRace;
  closeRace=()=>{
    if(!restoringSession)forgetSession();
    clearInterval(dashboardTimer);dashboardTimer=null;
    resumedOnceForRound='';expireUpdatePending=false;raceReverseDebt=0;raceClientSequence=0;observedRound='';observedProgress.clear();
    originalCloseRace();
  };
  const originalWatchRace=watchRace;
  watchRace=()=>{saveIdentity();originalWatchRace()};
  const originalShowRaceLobby=showRaceLobby;
  showRaceLobby=data=>{
    originalShowRaceLobby(data);
    // Previous rounds should not accumulate duplicate setup summaries.
    const summaries=[...document.querySelectorAll('.lobby-copy .race-settings-summary')];
    summaries.slice(0,-1).forEach(node=>node.remove());
    saveIdentity();
    if(raceRoomData?.status==='waiting'&&raceMode==='player'&&raceLastStatus==='waiting'){
      // A new round must never inherit last round's typing or finished flag.
      const last=readSession();if(sameIdentity(last)&&last.roundId&&raceRoomData.roundId===0){
        writeSession({...last,roundId:'',typed:'',errors:0,reverseDebt:0,wordErrors:{},passage:''});
      }
    }
  };

  // Recover after an ordinary refresh or temporary network interruption.
  async function restoreSavedRace(){
    const saved=readSession();
    if(!saved||!saved.code||!['host','player'].includes(saved.role)||!saved.uid)return;
    try{
      await initRaceFirebase();
      // Firebase persists anonymous authentication on a device. Never adopt a room
      // owned by a different UID; never bypass host removal or expiration.
      if(currentUser.uid!==saved.uid)return forgetSession();
      const snapshot=await fb.get(roomRef(saved.code));
      if(!snapshot.exists())return forgetSession();
      const room=snapshot.val();
      if(room.expiresAt&&room.expiresAt<raceNow())return forgetSession();
      const me=room.players?.[saved.uid];
      if(saved.role==='host'&&room.hostUid!==saved.uid)return forgetSession();
      if(saved.role==='player'&&!me)return forgetSession();
      if(saved.role==='player'&&room.removedPlayers?.[saved.uid])return forgetSession();
      restoringSession=true;
      raceCode=saved.code;raceMode=saved.role;racePlayerId=saved.role==='player'?saved.uid:'';
      racePlayerName=me?.name||saved.name||'';
      raceRoomData=room;raceWasRemoved=false;
      const info=racePassageInfo(room.passage);
      raceRoomLanguage=gameLanguageAuto.normalize(room.keyboardLanguage||info.language);
      raceLanguage=raceRoomLanguage;
      raceKeyboardMode=room.keyboardMode==='auto'?'auto':raceRoomLanguage;
      showRaceLobby({players:Object.values(room.players||{})});
      watchRace();
      raceEl('raceConnection').textContent='Reconnected';
    }catch(error){
      console.warn('Car Race: previous session could not be recovered',error);
      // Keep the session on network failure so Retry via the Race card still works.
      raceEl('raceConnection').textContent='Reconnect unavailable';
    }finally{restoringSession=false}
  }
  const originalOpenRace=openRace;
  openRace=()=>{
    originalOpenRace();
    if(readSession())void restoreSavedRace();
  };

  // Rejoin an existing player without writing a new 0%-progress record. Also
  // allows a previously removed student back ONLY after the host has approved it.
  raceEl('joinRaceForm').onsubmit=async event=>{
    event.preventDefault();raceError('');
    const code=raceEl('raceCodeInput').value.trim().toUpperCase();
    const name=cleanName(raceEl('raceNameInput').value);
    try{
      if(!/^[A-Z2-9]{5}$/.test(code))throw new Error('Enter a valid five-character room code.');
      if(!name)throw new Error('Enter your name.');
      await initRaceFirebase();
      const snapshot=await fb.get(roomRef(code));
      if(!snapshot.exists())throw new Error('Room not found. Check the code.');
      const room=snapshot.val(),players=Object.values(room.players||{});
      if(room.expiresAt&&room.expiresAt<raceNow())throw new Error('This room has expired.');
      const existing=room.players?.[currentUser.uid];
      const removed=room.removedPlayers?.[currentUser.uid];
      if(removed&&!removed.allowRejoin)throw new Error('The host removed you from this race.');
      if(!existing&&room.status==='finished')throw new Error('This race has ended. Ask the teacher to restart.');
      if(!existing&&room.status!=='waiting'&&!(room.allowLate&&['racing','paused'].includes(room.status))&&!removed?.allowRejoin)
        throw new Error('This race has already started.');
      if(!existing&&players.length>=30)throw new Error('This room is full.');
      if(!existing&&players.some(p=>String(p.name||'').toLocaleLowerCase()===name.toLocaleLowerCase()))
        throw new Error('That name is already in this room. Add an initial.');
      const info=racePassageInfo(room.passage);
      raceCode=code;racePlayerId=currentUser.uid;raceMode='player';raceWasRemoved=false;
      racePlayerName=existing?.name||name;
      raceRoomData=room;removedScreen.hidden=true;
      raceRoomLanguage=gameLanguageAuto.normalize(room.keyboardLanguage||info.language);
      raceLanguage=raceRoomLanguage;
      raceKeyboardMode=room.keyboardMode==='auto'?'auto':raceRoomLanguage;
      if(!existing){
        const customPassage=room.randomize?storedRacePassage(shuffleRaceWords(info.text),raceRoomLanguage):room.passage;
        const player={id:currentUser.uid,name,progress:0,typedCount:0,errors:0,wpm:0,accuracy:100,
          reverseDebt:0,color:Number(raceEl('raceCarColor').value)||0,avatar:Number(raceEl('raceAvatar').value)||0,
          team:window.GLNRaceTeams?.assign(players,room.teamCount)|| (room.teamCount?(players.length%room.teamCount)+1:0),customPassage,joinedAt:raceNow(),finishedAt:0};
        const update={[`players/${currentUser.uid}`]:player};
        if(removed?.allowRejoin)update[`removedPlayers/${currentUser.uid}`]=null;
        await fb.update(roomRef(code),update);
      }
      showRaceLobby({players:existing?players:[...players,{id:currentUser.uid,name}]});
      watchRace();
    }catch(error){raceError(error.message||'Could not join this race.');}
  };

  // The round ID is stable across Pause/Resume, unlike startedAt (which shifts
  // forward to exclude paused time). Restore progress only for the same passage.
  const originalBeginLiveRace=beginLiveRace;
  beginLiveRace=data=>{
    originalBeginLiveRace(data);
    if(raceMode==='player'){
      const roundId=String(data.roundId||data.startedAt||'');
      const key=`${raceCode}:${roundId}`;
      if(resumedOnceForRound!==key){
        resumedOnceForRound=key;
        const saved=readSession();
        const me=(data.players||[]).find(p=>p.id===racePlayerId);
        raceClientSequence=Math.max(0,Number(me?.lastClientSequence)||0);
        raceReverseDebt=0; // Never carry a previous round's penalty forward.
        if(sameIdentity(saved)&&saved.roundId===roundId&&saved.passage===racePassageText&&
           racePassageText.startsWith(saved.typed||'')){
          raceTyped=String(saved.typed||'');raceErrors=Math.max(0,Number(saved.errors)||0);
          raceReverseDebt=reverseEnabled(data)?clampDebt(saved.reverseDebt,data):0;
        }
        // Recover from Firebase if this browser's session record is missing
        // or older than the student's server-side position.
        if(me&&Number(me.typedCount)>raceTyped.length){
          raceTyped=racePassageText.slice(0,Math.min(racePassageText.length,Number(me.typedCount)));
          raceErrors=Math.max(0,Number(me.errors)||0);
          raceReverseDebt=reverseEnabled(data)?clampDebt(me.reverseDebt,data):0;
        }
        raceCorrect=raceTyped.length;
        // Restore word-level mistakes for this exact round and passage only.
        window.GLNRaceVocabulary?.restore({saved,player:me,roundId,passage:racePassageText});
        renderRacePassage();
        saveTyping();
      }
    }
    clearInterval(dashboardTimer);
    dashboardTimer=setInterval(refreshRaceDashboardClock,500);
  };

  // Prevent any scoring changes after time runs out (even before the host's
  // Firebase state-change event arrives).
  function canTypeNow(){
    const room=raceRoomData;
    return raceMode==='player'&&room?.status==='racing'&&raceCountdownDone&&
      raceNow()>=Number(room.startedAt||0)&&
      !(room.lengthMode==='time'&&elapsedSeconds(room)>=Number(room.duration||60))&&
      raceTyped.length<racePassageText.length&&!raceWasRemoved;
  }
  const originalAcceptRaceInput=acceptRaceInput;
  acceptRaceInput=value=>{
    if(!canTypeNow())return;
    const length=raceTyped.length,errors=raceErrors;
    originalAcceptRaceInput(value);
    if(reverseEnabled(raceRoomData)){
      if(raceErrors>errors){
        // A wrong key reverses the car without modifying correctly typed text.
        raceReverseDebt=clampDebt(window.GLNRaceAdvancedSettings?.addError(raceReverseDebt,raceRoomData)
          ?? raceReverseDebt+advanced(raceRoomData).reversePerError);
        raceEl('racePrompt').textContent=advanced(raceRoomData).reverseFeedback?'Wrong key — car reversing!':'Wrong key — progress reduced!';
        flashReverseLane(racePlayerId);
        // Publish the reverse immediately; a fast next key must not swallow it
        // inside the normal 100ms typing debounce.
        clearTimeout(raceSendTimer);raceSendTimer=null;
        queueMicrotask(()=>{void sendRaceProgress();});
      }else if(raceTyped.length>length&&raceReverseDebt>0){
        // Correct typing pays back the penalty over several keystrokes.
        const advance=graphemes(raceTyped.slice(length));
        const recovery=Math.max(.75,Math.min(1.5,50/passageUnits()));
        raceReverseDebt=Math.max(0,raceReverseDebt-recovery*advance);
      }
    }else raceReverseDebt=0;
    if(length!==raceTyped.length||errors!==raceErrors){
      window.GLNRaceVocabulary?.onInput({beforeLength:length,beforeErrors:errors});
      saveTyping();
      // In Speed/Balanced races, a wrong key is a scoring event too. Publish
      // it even when no correct character follows the mistake.
      if(raceErrors>errors&&!reverseEnabled(raceRoomData))scheduleRaceProgress();
    }
  };
  const originalBackspace=raceBackspace;
  raceBackspace=()=>{
    if(!raceTyped||!canTypeNow())return;
    originalBackspace();
    // Backspacing may shrink the available track distance.
    raceReverseDebt=clampDebt(raceReverseDebt);
    saveTyping();
  };

  // Single authoritative progress write, using effective ACTIVE seconds. A
  // paused race updates startedAt on resume, so the pause cannot deflate WPM.
  sendRaceProgress=async()=>{
    if(!raceCode||!racePlayerId||!fb||raceWasRemoved||raceRoomData?.status!=='racing')return;
    const room=raceRoomData;
    if(raceNow()<Number(room.startedAt||0))return;
    if(room.lengthMode==='time'&&elapsedSeconds(room)>=Number(room.duration||60))return;
    const characters=graphemes(raceTyped),minutes=Math.max(1/60,elapsedSeconds(room)/60);
    const wpm=Math.round(characters/5/minutes),accuracy=Math.round(characters/Math.max(1,characters+raceErrors)*100);
    const rawProgress=racePassageText.length?Math.min(100,raceTyped.length/racePassageText.length*100):0;
    const finished=racePassageText.length>0&&raceTyped.length>=racePassageText.length;
    const penalty=reverseEnabled(room)?clampDebt(raceReverseDebt):0;
    raceReverseDebt=penalty;
    // At passage completion, the car crosses the finish line; until then the
    // position really is reduced and drives the shared live standings.
    const progress=finished?100:Math.max(0,rawProgress-penalty);
    // Use a player-scoped transaction: an in-flight Chromebook update from an
    // earlier round must NEVER revive progress after Race Again. These writes
    // also remain ordered when a student types quickly or briefly disconnects.
    try {
      const target=playerRef(raceCode,racePlayerId);
      const roundId=String(room.roundId||room.startedAt||'');
      const sequence=++raceClientSequence;
      const payload={progress,typedCount:raceTyped.length,errors:raceErrors,wpm,accuracy,
        wordErrors:window.GLNRaceVocabulary?.serialize()||null,
        reverseDebt:penalty,lastProgressAt:raceNow(),lastClientSequence:sequence,
        finishedAt:finished?raceNow():0};
      const result=await fb.runTransaction(target,previous=>
        window.GLNRaceReliability?.applyProgress(previous,{roundId,managed:room.reliabilityV51===true,sequence,payload})
      ,{applyLocally:false});
      if(finished&&result.committed)raceEl('racePrompt').textContent=`Finished! ${wpm} WPM · ${accuracy}% accuracy`;
    }catch(error){console.warn('Car Race: progress not synced',error)}
  };

  // Teacher-only live standings separate from permanently assigned lanes.
  const track=raceEl('raceTrack');
  const shell=document.createElement('div');shell.className='race-dashboard';shell.id='raceDashboard';
  const leaderboard=document.createElement('aside');leaderboard.id='raceLeaderboard';leaderboard.className='race-leaderboard';
  leaderboard.setAttribute('aria-label','Live race standings');
  leaderboard.innerHTML='<div class="race-leaderboard-title"><div><small>LIVE STANDINGS</small><strong>Leaderboard</strong></div><span id="raceLeaderboardCount">0 racers</span></div><div class="race-leaderboard-list" id="raceLeaderboardList"></div>';
  track.replaceWith(shell);shell.append(track,leaderboard);
  const playerHud=document.createElement('div');playerHud.id='racePlayerHud';playerHud.className='race-player-hud';
  playerHud.innerHTML='<span>⏱ <strong id="racePlayerClock">0:00</strong></span><span>Progress <strong id="racePlayerProgress">0%</strong></span><span>Speed <strong id="racePlayerWpm">0 WPM</strong></span><span>Accuracy <strong id="racePlayerAccuracy">100%</strong></span><span class="race-reverse-indicator" id="raceReverseIndicator" hidden>↶ Recovering <strong id="raceReverseDebt">0%</strong></span>';
  shell.before(playerHud);
  const labelHost=()=>raceMode==='host';
  function refreshRaceDashboardClock(){
    const room=raceRoomData;if(!room||raceLive.hidden)return;
    if(room.lengthMode==='time'&&room.status==='racing'&&elapsedSeconds(room)>=Number(room.duration||60)&&raceMode==='host'&&!expireUpdatePending){
      expireUpdatePending=true;
      fb.update(roomRef(raceCode),{status:'finished',endedAt:raceNow()}).catch(()=>{expireUpdatePending=false});
    }
    const seconds=room.lengthMode==='time'?Math.max(0,Number(room.duration||60)-elapsedSeconds(room)):elapsedSeconds(room);
    raceEl('racePlayerClock').textContent=formatRaceTime(seconds);
    const me=currentPlayer(room);
    if(me){
      raceEl('racePlayerProgress').textContent=`${Math.round(me.progress||0)}%`;
      raceEl('racePlayerWpm').textContent=`${Math.round(me.wpm||0)} WPM`;
      raceEl('racePlayerAccuracy').textContent=`${Math.round(me.accuracy??100)}%`;
    }
    const isRecovering=reverseEnabled(room)&&raceMode==='player'&&raceReverseDebt>0;
    raceEl('raceReverseIndicator').hidden=!isRecovering;
    if(isRecovering)raceEl('raceReverseDebt').textContent=`${raceReverseDebt.toFixed(1)}%`;
    playerHud.hidden=labelHost();
    leaderboard.hidden=!labelHost();
    if(labelHost()){
      const pauseButton=raceEl('racePause');
      pauseButton.disabled=!['racing','paused'].includes(room.status)||
        (room.status==='racing'&&raceNow()<Number(room.startedAt||0));
      raceEl('raceEnd').disabled=room.status==='finished';
    }
  }
  const originalRenderRace=renderRace;
  renderRace=data=>{
    // keep the start aligned with the host, including pause/resume adjustment
    raceStartedAt=Number(data.startedAt)||raceStartedAt;
    if(data.status!=='racing')clearTimeout(raceSendTimer);
    if(data.status==='waiting')expireUpdatePending=false;
    originalRenderRace(data);
    // Monitor published progress, not keystroke counts: the teacher sees cars
    // visibly reverse on any student's error. Reset history each round.
    const round=`${raceCode}:${data.roundId||data.startedAt||''}`;
    if(observedRound!==round){observedRound=round;observedProgress.clear()}
    if(reverseEnabled(data)&&data.status==='racing'){
      (data.players||[]).forEach(player=>{
        const uid=String(player.id),next=Math.max(0,Number(player.progress)||0);
        const previous=observedProgress.get(uid);
        if(previous!==undefined&&next<previous-.05)flashReverseLane(uid);
        observedProgress.set(uid,next);
      });
    }else observedProgress.clear();
    const ranked=raceRankPlayers(data.players);
    const container=raceEl('raceLeaderboardList');
    const oldNodes=new Map([...container.children].map(el=>[el.dataset.uid,el]));
    ranked.forEach((p,index)=>{
      const uid=String(p.id||p.name||index);
      let row=oldNodes.get(uid);
      if(!row){
        row=document.createElement('div');row.className='race-leaderboard-row';row.dataset.uid=uid;
        row.innerHTML='<b class="race-standing-place"></b><div class="race-standing-main"><strong class="race-standing-name"></strong><div class="race-standing-meter"><i></i></div></div><span class="race-standing-stats"></span>';
      }
      row.querySelector('.race-standing-place').textContent=String(index+1);
      row.querySelector('.race-standing-name').textContent=p.name||'Racer';
      row.querySelector('.race-standing-meter i').style.width=`${Math.max(0,Math.min(100,Number(p.progress)||0))}%`;
      row.querySelector('.race-standing-stats').textContent=`${Math.round(p.progress||0)}% · ${Math.round(p.wpm||0)} WPM`;
      row.classList.toggle('is-leader',index===0);
      if(container.children[index]!==row)container.insertBefore(row,container.children[index]||null);
      oldNodes.delete(uid);
    });
    oldNodes.forEach(node=>node.remove());
    raceEl('raceLeaderboardCount').textContent=`${ranked.length} racers`;
    if(raceMode==='player'&&data.status==='paused')raceEl('racePrompt').textContent='Paused by teacher — typing is temporarily disabled.';
    if(raceMode==='player'&&data.status==='finished')raceEl('racePrompt').textContent='Race finished — results are final.';
    refreshRaceDashboardClock();
  };

  // Match exports to the ranking shown on the screen (including timed ties).
  raceEl('raceExportResults').onclick=()=>{
    if(raceMode!=='host'||!raceRoomData)return;
    const ranked=raceRankPlayers(Object.values(raceRoomData.players||{}));
    const rows=['Place,Name,Team,WPM,Accuracy,Progress',...ranked.map((p,i)=>`${i+1},"${String(p.name||'').replaceAll('"','""')}",${p.team?`Team ${p.team}`:''},${Math.round(p.wpm||0)},${Math.round(p.accuracy??100)},${Math.round(p.progress||0)}%`)];
    const blob=new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=`classroom-race-${raceCode}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  // A new race must not reuse the old session's progress after the restart.
  raceEl('raceAgain').addEventListener('click',()=>{resumedOnceForRound='';expireUpdatePending=false;});

  // On a refreshed tab, reopen the Game Race view immediately. No new account,
  // room code, or student name entry is required (same browser/device only).
  if(readSession()){
    queueMicrotask(()=>{
      if(!readSession())return;
      typeView.hidden=true;practiceView.hidden=true;gamesView.hidden=false;
      navType.classList.remove('active');navPractice.classList.remove('active');navGames.classList.add('active');
      const otherNav=document.querySelector('#navQuiz');if(otherNav)otherNav.classList.remove('active');
      chooseGame('race');
    });
  }
})();
