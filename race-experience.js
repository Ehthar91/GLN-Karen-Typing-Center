/* GLN Classroom Car Race v3 — synchronized start, sound, overtakes, and finish celebration.
   Loaded AFTER race-upgrade.js. No external fonts, audio files, or canvas required. */
(()=>{
  'use strict';
  const el=id=>document.getElementById(id);
  const track=el('raceTrack'),countdown=el('raceCountdown'),countdownText=el('raceCountdownText');
  if(!track||!countdown||!countdownText||!el('raceDashboard'))return;
  const prefersReducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const LOCAL_MUTE_KEY='gln-race-v3-local-mute';
  let localMute=false;
  try{localMute=localStorage.getItem(LOCAL_MUTE_KEY)==='true'}catch{}
  let audioContext=null;
  let countdownHideTimer=null,noticeTimer=null,finishTimer=null;
  let roundKey='',lastStep='',lastRoomStatus='',roundHasStarted=false;
  let previousRanks=new Map(),previousProgress=new Map(),completed=new Set();
  let lastOvertakeAt=0,seenResultKey='',lastResultSignature='',lastRoomSound=null;
  const soundAllowed=()=>raceRoomData?.sound!==false&&!localMute;
  const visible=()=>!raceStage.hidden&&!raceLive.hidden&&!document.hidden;
  function context(){
    if(audioContext)return audioContext;
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    try{audioContext=new Ctx()}catch{return null}
    return audioContext;
  }
  function unlockAudio(){
    if(!soundAllowed())return;
    const ctx=context();if(ctx?.state==='suspended')ctx.resume().catch(()=>{});
  }
  function chirp(frequency,duration=.12,volume=.045,type='sine',when=0){
    if(!soundAllowed()||!visible())return;
    const ctx=context();if(!ctx||ctx.state!=='running')return;
    const start=ctx.currentTime+when,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+duration+.01);
  }
  function playCue(kind){
    if(kind==='step')chirp(440,.095,.035,'sine');
    else if(kind==='go'){chirp(670,.19,.055,'triangle');chirp(900,.24,.04,'triangle',.13)}
    else if(kind==='finish'){chirp(523,.16,.04,'sine');chirp(659,.16,.04,'sine',.18);chirp(784,.28,.05,'triangle',.36)}
    else if(kind==='overtake')chirp(740,.09,.018,'triangle');
  }
  // The host changes the room-wide sound permission. Players can also mute
  // their own device without changing anyone else's preference.
  const soundButton=document.createElement('button');
  soundButton.type='button';soundButton.id='raceV3Sound';soundButton.className='race-v3-sound';
  el('raceHostControls').before(soundButton);
  const playerStanding=document.createElement('span');
  playerStanding.className='race-v3-standing';
  playerStanding.innerHTML='Place <strong id="raceV3Place">—</strong>';
  el('racePlayerHud').prepend(playerStanding);
  function refreshSoundButton(){
    const isHost=raceMode==='host';const permitted=raceRoomData?.sound!==false;
    const enabled=permitted&&!localMute;
    soundButton.textContent=enabled?'🔊 Sound on':'🔇 Sound off';
    soundButton.title=isHost?'Teacher control: enable or disable race sound on all devices':'Mute or unmute sounds on this device';
    soundButton.setAttribute('aria-label',`${isHost?'Classroom':'My device'} race sound ${enabled?'on':'off'}`);
    soundButton.setAttribute('aria-pressed',String(enabled));
    soundButton.disabled=raceMode!=='host'&&raceMode!=='player';
    soundButton.hidden=raceMode!=='host'&&raceMode!=='player';
  }
  soundButton.onclick=async()=>{
    if(raceMode==='host'&&raceRoomData&&fb){
      const next=raceRoomData.sound===false;
      soundButton.disabled=true;
      try{await fb.update(roomRef(raceCode),{sound:next});
        // Also set the host's device to audible when enabling classroom sound.
        if(next){localMute=false;try{localStorage.setItem(LOCAL_MUTE_KEY,'false')}catch{}}
      }catch(error){console.warn('Race sound setting failed',error)}
      soundButton.disabled=false;
    }else{
      localMute=!localMute;
      try{localStorage.setItem(LOCAL_MUTE_KEY,String(localMute))}catch{}
    }
    if(localMute&&typeof stopRaceAmbience==='function')stopRaceAmbience();
    refreshSoundButton();unlockAudio();
  };
  el('startRace').addEventListener('click',unlockAudio,{capture:true});
  el('joinRaceForm').addEventListener('submit',unlockAudio,{capture:true});
  el('raceV3Sound').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')unlockAudio()});

  // Replace the v2 numeral overlay with a race-light signal; both use the room
  // timestamp and the Firebase-estimated server clock via raceNow().
  countdown.classList.add('race-v3-countdown');
  const signal=document.createElement('div');signal.className='race-v3-signal';
  signal.setAttribute('aria-hidden','true');
  signal.innerHTML='<span class="race-v3-light red"></span><span class="race-v3-light amber"></span><span class="race-v3-light green"></span>';
  const cueText=document.createElement('span');cueText.className='race-v3-cue';cueText.textContent='GET READY';
  countdown.prepend(signal);countdownText.after(cueText);
  function resetSignal(){
    clearInterval(raceCountdownTimer);clearTimeout(countdownHideTimer);
    lastStep='';roundHasStarted=false;raceCountdownDone=false;
    countdown.classList.remove('race-v3-ready','race-v3-three','race-v3-two','race-v3-one','race-v3-go');
    countdown.hidden=true;
  }
  const baseCountdown=startRaceCountdown;
  startRaceCountdown=startAt=>{
    clearInterval(raceCountdownTimer);clearTimeout(countdownHideTimer);
    const initialRemaining=Number(startAt)-raceNow();
    lastStep='';roundHasStarted=initialRemaining<=0;
    // A refresh or late join after GO must never replay the countdown/sound.
    if(initialRemaining<=-750){raceCountdownDone=true;countdown.hidden=true;return}
    const update=()=>{
      const timeRemaining=Number(startAt)-raceNow();
      let phase,caption;
      if(timeRemaining>3000){phase='ready';caption='GET READY'}
      else if(timeRemaining>2000){phase='three';caption='3'}
      else if(timeRemaining>1000){phase='two';caption='2'}
      else if(timeRemaining>0){phase='one';caption='1'}
      else{phase='go';caption='GO!'}
      countdown.hidden=false;
      countdown.classList.remove('race-v3-ready','race-v3-three','race-v3-two','race-v3-one','race-v3-go');
      countdown.classList.add('race-v3-'+phase);
      countdownText.textContent=caption;
      cueText.textContent=phase==='ready'?'ENGINES READY':phase==='go'?'RACE TO THE FINISH':'TYPE WHEN THE LIGHT TURNS GREEN';
      raceCountdownDone=phase==='go';
      if(phase!==lastStep){
        if(lastStep && phase!=='ready' && timeRemaining>-300){playCue(phase==='go'?'go':'step')}
        lastStep=phase;
      }
      if(phase==='go'){
        roundHasStarted=true;
        clearInterval(raceCountdownTimer);
        countdownHideTimer=setTimeout(()=>{countdown.hidden=true},650);
      }
    };
    update();if(!roundHasStarted)raceCountdownTimer=setInterval(update,80);
  };

  const overtakingNotice=document.createElement('div');
  overtakingNotice.id='raceV3Overtaking';overtakingNotice.className='race-v3-overtaking';
  overtakingNotice.hidden=true;overtakingNotice.setAttribute('aria-live','off');
  el('raceDashboard').before(overtakingNotice);
  const pausedTag=document.createElement('span');pausedTag.id='raceV3Paused';
  pausedTag.className='race-v3-paused';pausedTag.textContent='⏸ RACE PAUSED';pausedTag.hidden=true;
  el('raceStatusText').after(pausedTag);
  const winnerLine=document.createElement('p');winnerLine.id='raceV3Winner';winnerLine.className='race-v3-winner';
  el('raceResultsTitle').after(winnerLine);
  const confettiBurst=document.createElement('div');confettiBurst.className='race-v3-confetti-burst';
  confettiBurst.setAttribute('aria-hidden','true');el('raceResults').prepend(confettiBurst);
  function clearOvertakeNotice(){clearTimeout(noticeTimer);overtakingNotice.hidden=true}
  function beginNewRound(data){
    roundKey=`${raceCode}:${data.roundId||data.startedAt}`;
    previousRanks.clear();previousProgress.clear();completed.clear();
    lastOvertakeAt=0;lastRoomStatus='racing';seenResultKey='';lastResultSignature='';lastRoomSound=null;
    clearOvertakeNotice();pausedTag.hidden=true;
    el('raceResults').classList.remove('race-v3-results-celebrating');
    confettiBurst.replaceChildren();winnerLine.textContent='';
  }
  const originalBegin=beginLiveRace;
  beginLiveRace=data=>{
    const key=`${raceCode}:${data.roundId||data.startedAt}`;
    if(roundKey!==key)beginNewRound(data);
    originalBegin(data);
    refreshSoundButton();
  };
  function overtaking(player,oldRank,newRank){
    if(prefersReducedMotion?.matches)return;
    const lane=[...track.querySelectorAll(':scope > .race-lane')].find(x=>x.dataset.playerId===String(player.id));
    if(lane){
      lane.classList.remove('race-v3-overtaking-lane');void lane.offsetWidth;
      lane.classList.add('race-v3-overtaking-lane');
      setTimeout(()=>lane.classList.remove('race-v3-overtaking-lane'),1250);
    }
    const uid=String(player.id||'');
    const row=[...el('raceLeaderboardList').children].find(x=>x.dataset.uid===uid);
    if(row){row.classList.add('race-v3-climbing');setTimeout(()=>row.classList.remove('race-v3-climbing'),1250)}
    if(raceNow()-lastOvertakeAt>2100 && visible()){
      overtakingNotice.textContent=`⚡ ${player.name||'Racer'} overtakes! #${oldRank} → #${newRank}`;
      overtakingNotice.hidden=false;lastOvertakeAt=raceNow();
      clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>overtakingNotice.hidden=true,1900);
      if(player.id===racePlayerId)playCue('overtake');
    }
  }
  function finishFlag(player){
    const lane=[...track.querySelectorAll(':scope > .race-lane')].find(x=>x.dataset.playerId===String(player.id));
    if(!lane)return;
    const flag=document.createElement('span');flag.className='race-v3-finish-flash';flag.textContent='🏁 FINISHED';
    lane.append(flag);setTimeout(()=>flag.remove(),1700);
  }
  function celebrate(players){
    if(!players.length)return;
    const winner=players[0];
    if(raceMode==='player'&&racePlayerId){
      const place=players.findIndex(p=>p.id===racePlayerId)+1;
      winnerLine.textContent=place===1?'🏆 You won the race!'
        :place>1?`You finished #${place} · 🏆 ${winner.name} wins!`
        :`🏆 ${winner.name} wins the race!`;
    }else winnerLine.textContent=`🏆 ${winner.name} wins the race!`;
    el('raceResults').classList.add('race-v3-results-celebrating');
    clearTimeout(finishTimer);
    confettiBurst.replaceChildren();
    if(!prefersReducedMotion?.matches){
      for(let i=0;i<24;i++){
        const piece=document.createElement('i');
        piece.style.setProperty('--x',`${(i*37)%100}%`);
        piece.style.setProperty('--delay',`${(i%7)*85}ms`);
        piece.style.setProperty('--color', ['#ffd54f','#18d6fa','#ff4975','#51e7af','#ffffff'][i%5]);
        confettiBurst.append(piece);
      }
    }
    finishTimer=setTimeout(()=>confettiBurst.replaceChildren(),2700);
    if(roundHasStarted)playCue('finish');
  }
  // v3.2: enrich the existing podium elements without changing vehicle assets,
  // race ranking or the multiplayer result data. Player names are always text.
  const originalMakePodiumPlace=makePodiumPlace;
  makePodiumPlace=(player,place)=>{
    const card=originalMakePodiumPlace(player,place);
    const car=card.querySelector('.podium-vehicle');
    const medal=card.querySelector('.podium-medal');
    const block=card.querySelector('.podium-block');
    const oldStats=block?.querySelector('span');
    if(!car||!medal||!block||!oldStats)return card;

    const carStage=document.createElement('div');
    carStage.className='race-v32-car-stage';
    car.before(carStage);
    carStage.append(car);
    const plate=document.createElement('div');
    plate.className='race-v32-car-plate';
    const badge=document.createElement('b');
    badge.textContent=String(place).padStart(2,'0');
    const plateName=document.createElement('span');
    plateName.textContent=player.name||'Racer';
    plate.title=player.name||'Racer';
    plate.append(badge,plateName);
    carStage.append(plate);

    medal.classList.add('race-v32-medal');
    medal.setAttribute('aria-hidden','true');
    block.prepend(medal);
    const metricGroup=document.createElement('div');
    metricGroup.className='race-v32-metrics';
    for(const [number,label] of [
      [Math.round(Number(player.wpm)||0),'WPM'],
      [Math.round(Number(player.accuracy??100)||0)+'%','Accuracy']
    ]){
      const metric=document.createElement('div');
      metric.className='race-v32-metric';
      const value=document.createElement('b');
      value.textContent=String(number);
      const caption=document.createElement('small');
      caption.textContent=label;
      metric.append(value,caption);
      metricGroup.append(metric);
    }
    oldStats.replaceWith(metricGroup);
    return card;
  };
  // Avoid rebuilding the whole podium on every Firebase snapshot when values
  // have not changed; this also prevents restarting its entrance animation.
  const originalRenderResults=renderRaceResults;
  renderRaceResults=players=>{
    const signature=JSON.stringify((players||[]).map(p=>[p.id,p.name,p.progress,p.wpm,p.accuracy,p.finishedAt]));
    if(!raceResults.hidden&&signature===lastResultSignature)return;
    lastResultSignature=signature;
    originalRenderResults(players);
    const othersHeading=el('raceOthers')?.querySelector('h3');
    if(othersHeading)othersHeading.textContent=players.length===4?'Other Racer':'Other Racers';
    // Print and CSV export are teacher actions, not student controls.
    const teacherTools=el('raceResults').querySelector('.race-result-toolbar');
    if(teacherTools)teacherTools.hidden=raceMode!=='host';
  };
  const originalRender=renderRace;
  renderRace=data=>{
    const key=`${raceCode}:${data.roundId||data.startedAt}`;
    if(roundKey!==key)beginNewRound(data);
    const oldStatus=lastRoomStatus;
    originalRender(data);
    const ranked=raceRankPlayers(data.players||[]),now=raceNow();
    const running=data.status==='racing'&&now>=Number(data.startedAt||0);
    ranked.forEach((player,index)=>{
      const id=String(player.id||'');
      if(!id)return;
      const oldRank=previousRanks.get(id),progress=Math.max(0,Number(player.progress)||0);
      const previous=previousProgress.get(id);
      if(running&&oldRank!==undefined&&index+1<oldRank&&previous!==undefined&&progress>previous+.001){
        overtaking(player,oldRank,index+1);
      }
      if(progress>=100&&!completed.has(id)){
        completed.add(id);
        if(running&&previous!==undefined&&previous<100)finishFlag(player);
      }
      previousRanks.set(id,index+1);previousProgress.set(id,progress);
    });
    // Don't retain entries for removed students.
    const keep=new Set(ranked.map(p=>String(p.id||'')));
    for(const id of previousRanks.keys())if(!keep.has(id)){previousRanks.delete(id);previousProgress.delete(id);completed.delete(id)}
    const place=raceMode==='player'?ranked.findIndex(p=>p.id===racePlayerId)+1:0;
    el('raceV3Place').textContent=place?`#${place} / ${ranked.length}`:'—';
    pausedTag.hidden=data.status!=='paused';
    // Stop old ambience when the teacher disables classroom audio. The local
    // device mute must also mute ambience, not only the countdown cues.
    if((data.sound===false||localMute)&&typeof stopRaceAmbience==='function')stopRaceAmbience();
    else if(data.status==='racing'&&data.music&&lastRoomSound===false&&
            typeof startRaceAmbience==='function')startRaceAmbience(data);
    lastRoomSound=data.sound!==false;
    if(data.status==='paused'){
      clearOvertakeNotice();
      if(typeof stopRaceAmbience==='function')stopRaceAmbience();
    }
    if(data.status==='finished'){
      clearOvertakeNotice();
      if(typeof stopRaceAmbience==='function')stopRaceAmbience();
      // The same result may be rendered on every Firebase update.
      if(seenResultKey!==key){
        seenResultKey=key;
        celebrate(ranked);
      }
    }else if(data.status==='racing'&&oldStatus==='paused'&&data.music&&data.sound!==false&&typeof startRaceAmbience==='function'){
      startRaceAmbience(data);
    }
    lastRoomStatus=data.status;
    const teacherTools=el('raceResults').querySelector('.race-result-toolbar');
    if(teacherTools)teacherTools.hidden=raceMode!=='host';
    refreshSoundButton();
  };
  const originalShowLobby=showRaceLobby;
  showRaceLobby=data=>{
    originalShowLobby(data);
    resetSignal();clearOvertakeNotice();
    if(typeof stopRaceAmbience==='function')stopRaceAmbience();
    el('raceResults').classList.remove('race-v3-results-celebrating');
    if(raceMode==='host'){
      // The existing sounds checkbox sets the room default for new races.
      el('raceSoundToggle').title='Teacher setting: enable sounds on all connected devices';
    }
  };
  const originalClose=closeRace;
  closeRace=()=>{
    resetSignal();clearOvertakeNotice();clearTimeout(finishTimer);
    confettiBurst.replaceChildren();
    lastRoomStatus='';roundKey='';seenResultKey='';
    originalClose();
  };
  refreshSoundButton();
})();
