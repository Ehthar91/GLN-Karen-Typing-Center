const raceStage=document.querySelector('#raceStage'),raceJoin=document.querySelector('#raceJoin'),raceLobby=document.querySelector('#raceLobby'),raceLive=document.querySelector('#raceLive'),raceResults=document.querySelector('#raceResults');
let raceCode='',racePlayerId='',racePlayerName='',racePassageText='',raceTyped='',raceSendTimer=null,raceCountdownTimer=null,raceCountdownDone=true,raceStartedAt=0,raceCorrect=0,raceErrors=0,raceMode='',raceUnsubscribe=null,raceLanguage=typingLanguage,raceLastStatus='',raceFinishing=false,raceDifficultyMode='medium',raceKeyboardShifted=false;
let fb=null,db=null,auth=null,currentUser=null;
let raceLanguageHints=[],raceRoomLanguage='ksw',raceKeyboardMode='ksw';
// Race must remain playable with the teacher-selected keyboard even if the
// optional mixed-language helper was not uploaded or was blocked by caching.
const gameLanguageAuto=window.GLN_GAME_LANGUAGE_AUTO||(()=>{
  const names={ksw:'Sgaw Karen',pwo:'Pwo Karen',en:'English'};
  const normalize=value=>Object.prototype.hasOwnProperty.call(names,value)?value:'ksw';
  return {
    names,normalize,
    raceWords:value=>({passage:cleanWords(value),hints:[]}),
    at:(_passage,_position,fallback)=>normalize(fallback)
  };
})();
const carColors=['#ef3340','#1687e8','#19a974','#f5a623','#8b5cf6','#ec4899'];
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function raceCarGraphic(colorIndex=0){const color=carColors[colorIndex%carColors.length];return `<svg class="race-car-svg" viewBox="0 0 120 52" aria-hidden="true"><path class="car-shadow" d="M14 43h92"/><path fill="${color}" d="M8 34c2-7 8-10 18-11l15-13h35c10 0 18 5 25 13l12 3c4 1 6 4 6 9v6H8z"/><path fill="#dff4ff" d="M45 13h27c7 0 13 3 20 10H34z"/><path fill="rgba(255,255,255,.45)" d="M20 27h78l-7 5H17z"/><path fill="#fff" d="M103 27h9v5h-12z"/><circle cx="31" cy="40" r="9" fill="#17233b"/><circle cx="31" cy="40" r="4" fill="#cbd5e1"/><circle cx="92" cy="40" r="9" fill="#17233b"/><circle cx="92" cy="40" r="4" fill="#cbd5e1"/></svg>`}

// Share one initialization promise: restoring a tab and opening the game can
// otherwise try to initialize the default Firebase app at the same time.
// Firebase Realtime Database exposes an estimated offset from device time to
// server time. Use it for countdowns AND input/scoring gates, not visuals alone.
// Falls back to the local clock when offline or before the offset is available.
let raceServerClockOffset=0, raceServerClockListener=null;
function raceNow(){return Date.now()+raceServerClockOffset}
function observeRaceServerClock(){
  if(!fb||!db||raceServerClockListener)return;
  try{raceServerClockListener=fb.onValue(fb.ref(db,'.info/serverTimeOffset'),snapshot=>{
    const offset=Number(snapshot.val());if(Number.isFinite(offset))raceServerClockOffset=offset;
  },()=>{raceServerClockListener=null})}catch(error){console.warn('Race clock using device time',error)}
}
async function syncRaceServerClock(){
  if(!fb||!db)return;
  try{const snap=await fb.get(fb.ref(db,'.info/serverTimeOffset'));
    const offset=Number(snap.val());if(Number.isFinite(offset))raceServerClockOffset=offset;
  }catch{ /* clock estimate is best effort; keep local fallback */ }
}
let raceFirebaseInitPromise=null;
async function initRaceFirebase(){
  if(currentUser)return currentUser;
  if(raceFirebaseInitPromise)return raceFirebaseInitPromise;
  raceFirebaseInitPromise=(async()=>{
    try{
      const cfg=await import('./firebase-config.js');
      if(!cfg.firebaseConfig||!cfg.firebaseConfig.apiKey||String(cfg.firebaseConfig.apiKey).includes('PASTE_')){
        throw new Error('Firebase is not configured yet. Add your Firebase settings to firebase-config.js.');
      }
      const appMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
      const authMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
      const dbMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
      const app=appMod.getApps().length?appMod.getApp():appMod.initializeApp(cfg.firebaseConfig);
      auth=authMod.getAuth(app);
      db=dbMod.getDatabase(app);
      fb={...authMod,...dbMod};
      observeRaceServerClock();
      if(typeof auth.authStateReady==='function')await auth.authStateReady();
      if(auth.currentUser)currentUser=auth.currentUser;
      else{const credential=await authMod.signInAnonymously(auth);currentUser=credential.user}
      return currentUser;
    }catch(error){
      raceError(error.message||'Could not connect to the classroom race service.');
      document.querySelector('#raceConnection').textContent='Offline';
      throw error;
    }
  })();
  try{return await raceFirebaseInitPromise}
  finally{raceFirebaseInitPromise=null}
}

function makeRoomCode(){
  return Array.from({length:5},()=>CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join('');
}
function cleanName(value){return String(value||'').trim().replace(/\s+/g,' ').slice(0,24)}
function cleanWords(value){return String(value||'').replace(/[,;\n\r\t]+/g,' ').trim().replace(/\s+/g,' ').slice(0,800)}
const PWO_RACE_MARKER='\u2060';
function storedRacePassage(passage,language){return language==='pwo'?PWO_RACE_MARKER+passage:passage}
function racePassageInfo(value){const stored=String(value||'');if(stored.startsWith(PWO_RACE_MARKER))return{language:'pwo',text:stored.slice(1)};return{language:/^[\x00-\x7F]*$/.test(stored)?'en':'ksw',text:stored}}
function roomRef(code){return fb.ref(db,`rooms/${code}`)}
function playerRef(code,uid){return fb.ref(db,`rooms/${code}/players/${uid}`)}

function openRace(){
  stopGame();gameGrid.hidden=true;gameStage.hidden=true;raceStage.hidden=false;raceJoin.hidden=false;raceLobby.hidden=true;raceLive.hidden=true;
  document.querySelector('#raceError').textContent='';
  document.querySelector('#raceCodeInput').value='';
  document.querySelector('#raceNameInput').value='';
  document.querySelector('#raceWordsInput').value='';
  raceLanguage=typingLanguage;raceRoomLanguage=typingLanguage;raceKeyboardMode=typingLanguage;document.querySelector('#raceHostLanguage').value=gameLanguageAuto.normalize(typingLanguage);document.querySelector('#raceHostAuto').checked=false;raceLanguageHints=[];raceLastStatus='';raceFinishing=false;raceResults.hidden=true;updateRaceLanguageInput();
  document.querySelector('#raceConnection').textContent='Connecting…';
  initRaceFirebase().then(()=>document.querySelector('#raceConnection').textContent='Online').catch(()=>{});
}
function closeRace(){
  if(raceUnsubscribe){raceUnsubscribe();raceUnsubscribe=null}
  clearTimeout(raceSendTimer);clearInterval(raceCountdownTimer);raceStage.hidden=true;raceCode='';racePlayerId='';raceTyped='';raceMode='';raceLastStatus='';raceResults.hidden=true;
}
document.querySelector('#backRace').onclick=()=>{closeRace();gameGrid.hidden=false};
function raceError(message){document.querySelector('#raceError').textContent=message}

document.querySelector('#createRaceForm').onsubmit=async e=>{
  e.preventDefault();raceError('');
  const parsed=gameLanguageAuto.raceWords(document.querySelector('#raceWordsInput').value);
  const passage=parsed.passage;const chosenLanguage=gameLanguageAuto.normalize(document.querySelector('#raceHostLanguage').value);
  try{
    if(!passage) throw new Error(`Paste at least one ${languageName()} word for the race.`);
    await initRaceFirebase();
    let created=false,tries=0;
    while(!created && tries<10){
      tries++;
      const code=makeRoomCode();
      const ref=roomRef(code);
      const existing=await fb.get(ref);
      if(existing.exists()) continue;
      const now=raceNow();
      await fb.set(ref,{
        hostUid:currentUser.uid,
        passage:storedRacePassage(passage,chosenLanguage),
        keyboardLanguage:chosenLanguage,keyboardMode:document.querySelector('#raceHostAuto').checked?'auto':'manual',languageHints:parsed.hints,
        status:'waiting',
        createdAt:now,
        expiresAt:now+14400000,
        players:{}
      });
      raceCode=code;created=true;
    }
    if(!created) throw new Error('Could not create a room. Please try again.');
    raceMode='host';racePlayerId='';raceLanguage=chosenLanguage;
    showRaceLobby({players:[]});watchRace();
  }catch(error){raceError(error.message)}
};

document.querySelector('#joinRaceForm').onsubmit=async e=>{
  e.preventDefault();raceError('');
  const code=document.querySelector('#raceCodeInput').value.trim().toUpperCase();
  const name=cleanName(document.querySelector('#raceNameInput').value);
  try{
    await initRaceFirebase();
    if(!/^[A-Z2-9]{5}$/.test(code)) throw new Error('Enter a valid five-character room code.');
    if(!name) throw new Error('Enter your name.');
    const snap=await fb.get(roomRef(code));
    if(!snap.exists()) throw new Error('Room not found. Check the code.');
    const room=snap.val();
    if(room.expiresAt && room.expiresAt<raceNow()) throw new Error('This room has expired. Ask the teacher to create a new race.');
    if(room.status!=='waiting') throw new Error('This race has already started.');
    const players=Object.values(room.players||{});
    if(players.length>=30) throw new Error('This room is full.');
    if(players.some(p=>String(p.name||'').toLowerCase()===name.toLowerCase())) throw new Error('That name is already in this room. Add an initial.');
    raceCode=code;racePlayerId=currentUser.uid;racePlayerName=name;raceMode='player';raceRoomLanguage=gameLanguageAuto.normalize(room.keyboardLanguage||racePassageInfo(room.passage).language);raceLanguage=raceRoomLanguage;raceKeyboardMode=room.keyboardMode==='auto'?'auto':raceRoomLanguage;
    await fb.set(playerRef(code,currentUser.uid),{
      id:currentUser.uid,name,progress:0,wpm:0,accuracy:100,
      color:players.length%carColors.length,joinedAt:raceNow(),finishedAt:0
    });
    showRaceLobby({players:[...players,{name}]});watchRace();
  }catch(error){raceError(error.message)}
};

function showRaceLobby(data){
  raceJoin.hidden=true;raceLobby.hidden=false;raceLive.hidden=true;raceLive.classList.remove('show-results');raceResults.hidden=true;
  document.querySelector('#roomCode').textContent=raceCode;
  document.querySelector('#startRace').hidden=raceMode!=='host';
  document.querySelector('#lobbyTitle').textContent=raceMode==='host'?'Waiting for racers':'You are in!';
  document.querySelector('#lobbyHint').textContent=raceMode==='host'?'Share the room code. Start when everyone has joined.':'Waiting for the teacher to start the race.';
  renderLobbyPlayers(data.players||[]);
}
function renderLobbyPlayers(players){
  const box=document.querySelector('#lobbyPlayers');box.innerHTML='';
  if(!players.length){const empty=document.createElement('span');empty.textContent='No students yet';box.appendChild(empty);return}
  players.forEach(player=>{const chip=document.createElement('span');chip.textContent=`✓ ${player.name}`;box.appendChild(chip)})
}
document.querySelector('#copyRaceCode').onclick=async()=>{
  try{await navigator.clipboard.writeText(raceCode);showToast('Room code copied')}
  catch{showToast(`Room code: ${raceCode}`)}
};

document.querySelector('#startRace').onclick=async()=>{
  try{
    await initRaceFirebase();
    const snap=await fb.get(roomRef(raceCode));
    if(!snap.exists()) throw new Error('Room not found.');
    const room=snap.val();
    if(room.hostUid!==currentUser.uid) throw new Error('Only the teacher who created this room can start it.');
    if(!Object.keys(room.players||{}).length) throw new Error('Wait for at least one student to join.');
    await syncRaceServerClock();
    const roundNow=raceNow();
    await fb.update(roomRef(raceCode),{status:'racing',startedAt:roundNow+4500,roundId:String(roundNow),endedAt:0,pausedAt:0});
  }catch(error){document.querySelector('#lobbyHint').textContent=error.message}
};

function watchRace(){
  if(raceUnsubscribe){raceUnsubscribe();raceUnsubscribe=null}
  raceUnsubscribe=fb.onValue(roomRef(raceCode),snap=>{
    if(!snap.exists()){document.querySelector('#raceConnection').textContent='Room closed';return}
    const room=snap.val();
    document.querySelector('#raceConnection').textContent='Online';
    const players=Object.values(room.players||{});
    if(room.status==='waiting'){
      const returning=raceLastStatus==='racing'||raceLastStatus==='finished';raceLastStatus='waiting';
      if(returning){raceTyped='';raceFinishing=false;showRaceLobby({players});if(raceMode==='player'&&racePlayerId){const me=(room.players||{})[racePlayerId];if(me&&(me.progress||me.finishedAt))fb.update(playerRef(raceCode,racePlayerId),{progress:0,wpm:0,accuracy:100,finishedAt:0}).catch(()=>{})}}
      else renderLobbyPlayers(players);return
    }
    raceLastStatus=room.status;
    const data={...room,players};
    if(raceLive.hidden)beginLiveRace(data);
    renderRace(data);
  },()=>document.querySelector('#raceConnection').textContent='Reconnecting…');
}
function beginLiveRace(data){
  const passageInfo=racePassageInfo(data.passage);
  if(!passageInfo.text.trim())throw new Error('This race has no practice words. Ask the host to start a new race with a word list.');raceLobby.hidden=true;raceLive.hidden=false;raceLive.classList.remove('show-results');raceResults.hidden=true;raceRoomLanguage=gameLanguageAuto.normalize(data.keyboardLanguage||passageInfo.language);raceLanguage=raceRoomLanguage;raceKeyboardMode=data.keyboardMode==='auto'?'auto':raceRoomLanguage;raceLanguageHints=Array.isArray(data.languageHints)?data.languageHints:[];racePassageText=passageInfo.text;raceTyped='';raceStartedAt=data.startedAt||raceNow();raceCorrect=0;raceErrors=0;
  raceDifficultyMode=String(data.difficulty||'Medium').toLowerCase();raceKeyboardShifted=false;
  raceLive.classList.remove('difficulty-easy','difficulty-medium','difficulty-hard');raceLive.classList.add(`difficulty-${raceDifficultyMode}`);
  raceLive.classList.toggle('teacher-view',raceMode==='host');document.querySelector('#raceFullscreen').hidden=raceMode!=='host';
  document.querySelector('#racePassage').lang=raceLanguage==='en'?'en':raceLanguage==='pwo'?'kjp':'ksw';
  renderRacePassage();renderRaceKeyboard();
  startRaceCountdown(raceStartedAt);
  if(raceMode==='host')document.querySelector('#racePrompt').textContent='Teacher view — watch the racers move live.';
}
function startRaceCountdown(startAt){clearInterval(raceCountdownTimer);const overlay=document.querySelector('#raceCountdown'),label=document.querySelector('#raceCountdownText');const update=()=>{const left=startAt-raceNow();if(left<=0){label.textContent='GO!';raceCountdownDone=true;setTimeout(()=>{overlay.hidden=true},550);clearInterval(raceCountdownTimer);return}raceCountdownDone=false;overlay.hidden=false;label.textContent=String(Math.max(1,Math.ceil(left/1000)))};update();raceCountdownTimer=setInterval(update,180)}
// Deterministic standings shared by the track, leaderboard, podium, and CSV.
// Finishing first wins a completed word race; timed ties use accuracy then WPM.
function raceRankPlayers(players){
  return [...(players||[])].sort((a,b)=>{
    const finishA=Number(a.finishedAt)||0,finishB=Number(b.finishedAt)||0;
    if(finishA&&finishB&&finishA!==finishB)return finishA-finishB;
    if(Boolean(finishA)!==Boolean(finishB))return finishA?-1:1;
    const progress=Number(b.progress||0)-Number(a.progress||0);
    if(Math.abs(progress)>0.0001)return progress;
    const accuracy=Number(b.accuracy??100)-Number(a.accuracy??100);
    if(accuracy)return accuracy;
    const speed=Number(b.wpm||0)-Number(a.wpm||0);
    if(speed)return speed;
    return (Number(a.joinedAt)||0)-(Number(b.joinedAt)||0)||String(a.id||'').localeCompare(String(b.id||''));
  });
}
// Map 0-100% progress to the actual lane's finish stripe, rather than an
// arbitrary 88% of the track. Account for the rendered vehicle's width so its
// front crosses the checkered line at 100% on wide, narrow and compact tracks.
function racePlaceCarAtProgress(car, progress){
  if(!car)return;
  const value=Math.max(0,Math.min(100,Number(progress)||0));
  const stripe=car.parentElement?.querySelector('.race-finish');
  const width=car.offsetWidth||parseFloat(getComputedStyle(car).width)||92;
  const stripeWidth=stripe?.offsetWidth||18;
  // The nose finishes inside the stripe, rather than stopping before it.
  const finishInset=2+stripeWidth*.25;
  const nextLeft=`calc(${value.toFixed(2)}% - ${(value/100*(width+finishInset)).toFixed(2)}px)`;
  if(car.style.left!==nextLeft)car.style.left=nextLeft;
}
// A Chromebook can rotate, zoom, or enter fullscreen after a racer finishes.
// Re-measure the car widths on resize without moving anyone's recorded score.
let raceCarResizeFrame=0;
window.addEventListener('resize',()=>{
  if(raceCarResizeFrame)cancelAnimationFrame(raceCarResizeFrame);
  raceCarResizeFrame=requestAnimationFrame(()=>{
    raceCarResizeFrame=0;
    document.querySelectorAll('#raceTrack .race-lane').forEach(lane=>{
      if(lane.dataset.raceProgress!==undefined)
        racePlaceCarAtProgress(lane.querySelector('.race-car'),Number(lane.dataset.raceProgress));
    });
  });
},{passive:true});
// Reuse the same lane and car nodes across Firebase updates. Rebuilding every car
// was interrupting CSS motion and forcing large vehicle images to repaint.
function renderRace(data){
  const players=raceRankPlayers(data.players);
  // Lane positions never follow the leaderboard: cars only move horizontally.
  const lanePlayers=[...players].sort((a,b)=>(Number(a.joinedAt)||0)-(Number(b.joinedAt)||0)||String(a.id||'').localeCompare(String(b.id||'')));
  const track=document.querySelector('#raceTrack');
  track.classList.toggle('density-medium',players.length>8&&players.length<=16);
  track.classList.toggle('density-compact',players.length>16);
  const existing=new Map(Array.from(track.querySelectorAll(':scope > .race-lane')).map(lane=>[lane.dataset.playerId,lane]));
  const keep=new Set();
  lanePlayers.forEach((player,index)=>{
    const id=String(player.id||player.name||index),progress=Math.max(0,Math.min(100,Number(player.progress)||0));
    let lane=existing.get(id);
    const isNewLane=!lane;
    if(!lane){
      lane=document.createElement('div');lane.className='race-lane';lane.dataset.playerId=id;
      const name=document.createElement('span');name.className='race-lane-name';
      const car=document.createElement('span');car.className='race-car';car.innerHTML=raceCarGraphic(player.color||0);
      const finish=document.createElement('span');finish.className='race-finish';
      const meter=document.createElement('span');meter.className='race-lane-progress';meter.setAttribute('aria-hidden','true');
      lane.append(name,meter,car,finish);
    }
    keep.add(id);
    const name=lane.querySelector('.race-lane-name'),car=lane.querySelector('.race-car'),meter=lane.querySelector('.race-lane-progress');
    const caption=`Lane ${index+1} · ${player.name||'Racer'}`;
    if(name.dataset.baseCaption!==caption){name.dataset.baseCaption=caption;name.textContent=caption;}
    lane.classList.toggle('is-your-lane',raceMode==='player'&&id===String(racePlayerId));
    lane.classList.toggle('is-finished',progress>=100);
    // Append before measuring: a detached car has no rendered width.
    if(!lane.isConnected)track.appendChild(lane);
    lane.dataset.raceProgress=progress.toFixed(2);
    racePlaceCarAtProgress(car,progress);
    // Vehicle skins are applied by race-features.js after this render wrapper.
    // Re-measure once they are styled, so even the first update is aligned.
    if(isNewLane)requestAnimationFrame(()=>{
      if(car.isConnected)racePlaceCarAtProgress(car,Number(lane.dataset.raceProgress));
    });
    if(meter)meter.style.width=`${progress.toFixed(2)}%`;
  });
  existing.forEach((lane,id)=>{if(!keep.has(id))lane.remove()});
  if(racePlayerId){
    const me=players.find(p=>p.id===racePlayerId),place=players.findIndex(p=>p.id===racePlayerId)+1;
    document.querySelector('#racePosition').textContent=(me?.progress||0)>=100?`Finished · #${place}`:`#${place||'–'} · ${Math.round(me?.progress||0)}%`;
  }else document.querySelector('#racePosition').textContent=`${players.length} racer${players.length===1?'':'s'}`;
  const scoringPlayers=players.filter(p=>p.roundEligible!==false);
  const allFinished=scoringPlayers.length>0&&scoringPlayers.every(p=>(p.progress||0)>=100);
  if(allFinished){
    document.querySelector('#raceStatusText').textContent='Race finished!';
    document.querySelector('#racePrompt').textContent=players[0]?`Winner: ${players[0].name}`:'Race finished';
    renderRaceResults(players);
    if(raceMode==='host'&&!raceFinishing&&data.status!=='finished'){raceFinishing=true;fb.update(roomRef(raceCode),{status:'finished',endedAt:raceNow()}).catch(()=>{raceFinishing=false})}
  }else document.querySelector('#raceStatusText').textContent='Race in progress';
}
function makePodiumPlace(player,place){const card=document.createElement('article');card.className=`podium-place place-${place}`;const medal=document.createElement('span');medal.className='podium-medal';medal.textContent=place===1?'🥇':place===2?'🥈':'🥉';const car=document.createElement('div');car.className='podium-car';car.innerHTML=raceCarGraphic(player.color||0);const name=document.createElement('strong');name.textContent=player.name;const stats=document.createElement('span');stats.textContent=`${Math.round(player.wpm||0)} WPM · ${Math.round(player.accuracy??100)}%`;const block=document.createElement('div');block.className='podium-block';block.dataset.place=place;block.append(name,stats);card.append(medal,car,block);return card}
function renderRaceResults(players){if(!players.length)return;const podium=document.querySelector('#racePodium'),otherBox=document.querySelector('#raceOthers'),otherList=document.querySelector('#raceOtherList');podium.innerHTML='';otherList.innerHTML='';const order=[players[1]&&[players[1],2],players[0]&&[players[0],1],players[2]&&[players[2],3]].filter(Boolean);order.forEach(([player,place])=>podium.appendChild(makePodiumPlace(player,place)));players.slice(3).forEach((player,index)=>{const row=document.createElement('div');const place=document.createElement('b');place.textContent=`${index+4}.`;const name=document.createElement('span');name.textContent=player.name;const stats=document.createElement('span');stats.textContent=`${Math.round(player.wpm||0)} WPM · ${Math.round(player.accuracy??100)}%`;row.append(place,name,stats);otherList.appendChild(row)});otherBox.hidden=players.length<=3;document.querySelector('#raceResultActions').hidden=raceMode!=='host';raceLive.classList.add('show-results');raceResults.hidden=false}
function raceExpected(){
  if(racePassageText[raceTyped.length]===' ')return{key:'Space',value:' ',shift:false};
  return allMappings(raceLanguage).find(item=>racePassageText.startsWith(item.value,raceTyped.length))||null
}
// Keep Karen vowels and tone marks together in the highlighted current syllable
// (a single UTF-16 code unit can be only part of a displayed glyph).
const raceGraphemeSegmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('und',{granularity:'grapheme'}):null;
function raceNextTextUnit(text){
  if(!text)return '';
  // Browser grapheme segmentation can separate U+1062 (Sgaw vowel) and U+1038
  // (tone) from the preceding consonant. Keep trailing marks with their base.
  if(raceGraphemeSegmenter){
    const segments=raceGraphemeSegmenter.segment(text)[Symbol.iterator]();
    let unit=segments.next().value?.segment||'';
    for(let next=segments.next();!next.done&&/^\p{M}/u.test(next.value.segment);next=segments.next())unit+=next.value.segment;
    return unit;
  }
  const points=Array.from(text);let unit=points[0]||'';
  for(let i=1;i<points.length&&/^\p{M}/u.test(points[i]);i++)unit+=points[i];
  return unit;
}
function renderRacePassage(){
  const box=document.querySelector('#racePassage');box.replaceChildren();
  const done=document.createElement('span');done.className='done';done.textContent=racePassageText.slice(0,raceTyped.length);
  const remaining=racePassageText.slice(raceTyped.length),currentText=raceNextTextUnit(remaining);
  const current=document.createElement('span');current.className='current';current.textContent=currentText;
  box.append(done,current,document.createTextNode(remaining.slice(currentText.length)));
}
function makeRaceTypeControl(label,display,action,className=''){
  const button=document.createElement('button');button.type='button';button.className='key modifier';
  if(className)button.classList.add(...className.split(' ').filter(Boolean));
  button.dataset.code=label;button.innerHTML=`<small>${label}</small>${display}`;button.onclick=action;return button
}
function makeRaceTypeKey(label,char,value=char){
  const button=document.createElement('button');button.type='button';button.className='key';button.dataset.code=label;button.dataset.value=value;
  button.innerHTML=`<small>${label==='Space'?'':label}</small>${char}`;button.onclick=()=>acceptRaceInput(value);return button
}
function setRaceKeyboardShift(on){raceKeyboardShifted=!!on;renderRaceKeyboard()}
function renderMediumRaceKeyboard(box,mobile,layout){
  if(!mobile){
    renderUnifiedDesktopKeyboard(box,{language:raceLanguage,shifted:raceKeyboardShifted,onKey:value=>acceptRaceInput(value),onBackspace:raceBackspace,onShift:on=>setRaceKeyboardShift(on),onCaps:on=>setRaceKeyboardShift(on)});return
  }
  box.classList.remove('real-keyboard');
  layout.forEach((row,rowIndex)=>{
    const line=document.createElement('div');line.className=`key-row keyboard-row-${rowIndex}`;
    if(rowIndex===layout.length-1)line.appendChild(makeRaceTypeControl('Shift','Shift',()=>setRaceKeyboardShift(!raceKeyboardShifted),'shift-key'));
    row.forEach(([key,normal,shift])=>line.appendChild(makeRaceTypeKey(key,raceKeyboardShifted?shift:normal,raceKeyboardShifted?shift:normal)));
    if(rowIndex===layout.length-1)line.appendChild(makeRaceTypeControl('Backspace','⌫',raceBackspace,'backspace-key'));
    box.appendChild(line)
  });
  const bottom=document.createElement('div');bottom.className='key-row phone-bottom-row keyboard-row-bottom';
  const space=makeRaceTypeKey('Space','Space',' ');space.classList.add('wide','space');bottom.appendChild(space);
  const enter=makeRaceTypeControl('Enter','↵',()=>{},'enter-key');enter.classList.add('wide');bottom.appendChild(enter);box.appendChild(bottom)
}
function setRaceKeyboardMode(language){
  if(raceMode!=='player'||raceLive.hidden||!['auto','ksw','pwo','en'].includes(language))return;
  raceKeyboardMode=language;raceKeyboardShifted=false;
  renderRaceKeyboard();
}
document.querySelectorAll('[data-race-keyboard]').forEach(button=>{
  button.addEventListener('click',()=>setRaceKeyboardMode(button.dataset.raceKeyboard));
});
function renderRaceKeyboard(){
  const box=document.querySelector('#raceKeyboard');box.innerHTML='';
  raceLanguage=raceKeyboardMode==='auto'?gameLanguageAuto.at(racePassageText,raceTyped.length,raceRoomLanguage,raceLanguageHints):gameLanguageAuto.normalize(raceKeyboardMode);
  const toolbar=document.querySelector('#raceKeyboardToolbar');
  toolbar.hidden=raceMode!=='player';
  const status=document.querySelector('#raceAutoLanguage');
  status.textContent=(raceKeyboardMode==='auto'&&!window.GLN_GAME_LANGUAGE_AUTO)?`${gameLanguageAuto.names[raceLanguage]} keyboard · Auto unavailable (manual fallback)`:`${raceKeyboardMode==='auto'?'Auto · ':''}${gameLanguageAuto.names[raceLanguage]} keyboard`;
  toolbar.querySelectorAll('[data-race-keyboard]').forEach(button=>{
    const active=button.dataset.raceKeyboard===raceKeyboardMode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  document.querySelector('#racePassage').lang=raceLanguage==='en'?'en':raceLanguage==='pwo'?'kjp':'ksw';
  const instruction=document.querySelector('#raceKeyInstruction'),mobile=phoneKeyboard(),layout=rowsForLanguage(raceLanguage),lastRow=layout.length-1;
  const medium=raceDifficultyMode==='medium';instruction.hidden=medium;
  if(medium){renderMediumRaceKeyboard(box,mobile,layout);return}
  const expected=raceExpected(),shifted=expected?.shift||false;
  instruction.hidden=false;instruction.textContent=expected?(expected.key==='Space'?'Press Space':shifted?`Hold Shift + press ${expected.key}`:`Press ${expected.key}`):'Finished!';instruction.classList.toggle('needs-shift',shifted);
  if(!mobile){
    renderUnifiedDesktopKeyboard(box,{language:raceLanguage,shifted,expected,hintShift:shifted,onKey:value=>acceptRaceInput(value),onBackspace:raceBackspace});return
  }
  box.classList.remove('real-keyboard');
  layout.forEach((row,rowIndex)=>{
    const line=document.createElement('div');line.className='key-row';
    if(rowIndex===lastRow){const shiftButton=document.createElement('button');shiftButton.type='button';shiftButton.className='key wide shift-key';shiftButton.textContent='Shift';if(shifted)shiftButton.classList.add('shift-required');line.appendChild(shiftButton)}
    row.forEach(([key,normal,shift])=>{const button=document.createElement('button');button.type='button';button.className='key';button.innerHTML=`<small>${key}</small>${shifted?shift:normal}`;if(expected&&expected.key===key)button.classList.add('expected');button.onclick=()=>acceptRaceInput(shifted?shift:normal);line.appendChild(button)});
    if(rowIndex===lastRow){const backspace=document.createElement('button');backspace.type='button';backspace.className='key wide';backspace.textContent='⌫';backspace.onclick=raceBackspace;line.appendChild(backspace)}box.appendChild(line)
  });
  const line=document.createElement('div'),space=document.createElement('button');line.className='key-row';space.type='button';space.className='key wide space';space.textContent='Space';if(expected?.key==='Space')space.classList.add('expected');space.onclick=()=>acceptRaceInput(' ');line.appendChild(space);
  const enter=document.createElement('button');enter.type='button';enter.className='key wide';enter.textContent='Enter';line.appendChild(enter);box.appendChild(line)
}
function raceBackspace(){if(raceMode!=='player'||!raceTyped||raceRoomData?.status!=='racing'||!raceCountdownDone||raceNow()<raceStartedAt)return;const next=previousTextBoundary(raceTyped,raceTyped.length),removed=raceTyped.length-next;raceTyped=raceTyped.slice(0,next);raceCorrect=Math.max(0,raceCorrect-removed);renderRacePassage();renderRaceKeyboard();scheduleRaceProgress()}
function acceptRaceInput(value){
  if(raceMode!=='player'||raceLive.hidden||!raceCountdownDone||raceRoomData?.status!=='racing'||raceNow()<raceStartedAt||raceTyped.length>=racePassageText.length)return;
  const remaining=racePassageText.slice(raceTyped.length);
  if(remaining.startsWith(value)){
    raceTyped+=value;raceCorrect+=value.length;document.querySelector('#racePrompt').textContent='Keep going!';
    renderRacePassage();renderRaceKeyboard();scheduleRaceProgress()
  }else{
    raceErrors++;const prompt=document.querySelector('#racePrompt');prompt.textContent=raceDifficultyMode==='easy'?'Try the highlighted key.':'Try again.';prompt.style.color='#c92525';
    setTimeout(()=>prompt.style.color='',220)
  }
}
function scheduleRaceProgress(){clearTimeout(raceSendTimer);raceSendTimer=setTimeout(sendRaceProgress,100)}
async function sendRaceProgress(){
  if(!raceCode||!racePlayerId||!fb)return;
  const elapsed=Math.max(1,(raceNow()-raceStartedAt)/60000),progress=Math.min(100,raceTyped.length/racePassageText.length*100),
        wpm=Math.round((raceCorrect/5)/elapsed),accuracy=Math.round(raceCorrect/Math.max(1,raceCorrect+raceErrors)*100);
  try{
    await fb.update(playerRef(raceCode,racePlayerId),{
      progress,wpm,accuracy,finishedAt:progress>=100?raceNow():0
    });
  }catch{}
  if(progress>=100)document.querySelector('#racePrompt').textContent=`Finished! ${wpm} WPM · ${accuracy}% accuracy`
}
document.addEventListener('keydown',e=>{
  if(raceStage.hidden||raceLive.hidden||raceMode!=='player'||e.ctrlKey||e.metaKey||e.altKey||e.key==='Shift')return;
  let value;if(e.code==='Space')value=' ';else{
    const key=physicalKey(e),mapping=rowsForLanguage(raceLanguage).flat().find(([mapped])=>mapped===key);if(!mapping)return;value=e.shiftKey?mapping[2]:mapping[1]
  }
  e.preventDefault();acceptRaceInput(value)
});
document.addEventListener('keydown',e=>{if(raceStage.hidden||raceLive.hidden||raceMode!=='player'||raceDifficultyMode!=='medium'||e.key!=='Shift')return;if(!raceKeyboardShifted){raceKeyboardShifted=true;renderRaceKeyboard()}});
document.addEventListener('keyup',e=>{if(raceStage.hidden||raceLive.hidden||raceMode!=='player'||raceDifficultyMode!=='medium'||e.key!=='Shift')return;if(raceKeyboardShifted){raceKeyboardShifted=false;renderRaceKeyboard()}});
document.querySelector('#raceAgain').onclick=async()=>{
  if(raceMode!=='host')return;
  try{
    const snap=await fb.get(roomRef(raceCode));if(!snap.exists())throw new Error('Room not found.');const room=snap.val(),updates={status:'waiting',startedAt:0};
    Object.keys(room.players||{}).forEach(uid=>{updates[`players/${uid}/progress`]=0;updates[`players/${uid}/wpm`]=0;updates[`players/${uid}/accuracy`]=100;updates[`players/${uid}/finishedAt`]=0});
    try{await fb.update(roomRef(raceCode),updates)}catch{await fb.update(roomRef(raceCode),{status:'waiting',startedAt:0})}
  }catch(error){document.querySelector('#raceStatusText').textContent=error.message}
};
document.querySelector('#raceNewWords').onclick=()=>{if(raceMode==='host'){closeRace();openRace()}};
const raceFullscreenButton=document.querySelector('#raceFullscreen');
raceFullscreenButton.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(raceStage.requestFullscreen)await raceStage.requestFullscreen()}catch{showToast('Full screen is not available on this browser')}};
document.addEventListener('fullscreenchange',()=>{const active=document.fullscreenElement===raceStage;raceFullscreenButton.textContent=active?'✕ Exit Full Screen':'⛶ Full Screen';raceStage.classList.toggle('is-fullscreen',active)});
function updateRaceLanguageInput(){const input=document.querySelector('#raceWordsInput');const lang=gameLanguageAuto.normalize(document.querySelector('#raceHostLanguage').value);input.lang=lang==='en'?'en':lang==='pwo'?'kjp':'ksw';input.placeholder='Enter English, Sgaw Karen, or Pwo Karen words';document.querySelector('#createRaceForm p').textContent='Choose a keyboard, then paste the words your students will type.';document.querySelector('.race-intro p').textContent='Everyone types the same passage. Students can switch keyboards; Auto is optional.'}
document.querySelector('#raceHostLanguage').addEventListener('change',updateRaceLanguageInput);
window.addEventListener('typinglanguagechange',()=>{if(raceJoin&&!raceJoin.hidden){raceLanguage=typingLanguage;updateRaceLanguageInput()}});
updateRaceLanguageInput();
