const raceStage=document.querySelector('#raceStage'),raceJoin=document.querySelector('#raceJoin'),raceLobby=document.querySelector('#raceLobby'),raceLive=document.querySelector('#raceLive'),raceResults=document.querySelector('#raceResults');
let raceCode='',racePlayerId='',racePlayerName='',racePassageText='',raceTyped='',raceSendTimer=null,raceCountdownTimer=null,raceCountdownDone=true,raceStartedAt=0,raceCorrect=0,raceErrors=0,raceMode='',raceUnsubscribe=null,raceLanguage=typingLanguage,raceLastStatus='',raceFinishing=false;
let fb=null,db=null,auth=null,currentUser=null;
const carColors=['#ef3340','#1687e8','#19a974','#f5a623','#8b5cf6','#ec4899'];
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function raceCarGraphic(colorIndex=0){const color=carColors[colorIndex%carColors.length];return `<svg class="race-car-svg" viewBox="0 0 120 52" aria-hidden="true"><path class="car-shadow" d="M14 43h92"/><path fill="${color}" d="M8 34c2-7 8-10 18-11l15-13h35c10 0 18 5 25 13l12 3c4 1 6 4 6 9v6H8z"/><path fill="#dff4ff" d="M45 13h27c7 0 13 3 20 10H34z"/><path fill="rgba(255,255,255,.45)" d="M20 27h78l-7 5H17z"/><path fill="#fff" d="M103 27h9v5h-12z"/><circle cx="31" cy="40" r="9" fill="#17233b"/><circle cx="31" cy="40" r="4" fill="#cbd5e1"/><circle cx="92" cy="40" r="9" fill="#17233b"/><circle cx="92" cy="40" r="4" fill="#cbd5e1"/></svg>`}

async function initRaceFirebase(){
  if(currentUser) return currentUser;
  try{
    const cfg=await import('./firebase-config.js');
    if(!cfg.firebaseConfig || !cfg.firebaseConfig.apiKey || String(cfg.firebaseConfig.apiKey).includes('PASTE_')){
      throw new Error('Firebase is not configured yet. Add your Firebase settings to firebase-config.js.');
    }
    const appMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const authMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
    const dbMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
    const app=appMod.initializeApp(cfg.firebaseConfig);
    auth=authMod.getAuth(app);
    db=dbMod.getDatabase(app);
    fb={...authMod,...dbMod};
    if(typeof auth.authStateReady==='function')await auth.authStateReady();
    if(auth.currentUser)currentUser=auth.currentUser;
    else{const credential=await authMod.signInAnonymously(auth);currentUser=credential.user}
    return currentUser;
  }catch(error){
    raceError(error.message || 'Could not connect to the classroom race service.');
    document.querySelector('#raceConnection').textContent='Offline';
    throw error;
  }
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
  raceLanguage=typingLanguage;raceLastStatus='';raceFinishing=false;raceResults.hidden=true;updateRaceLanguageInput();
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
  const passage=cleanWords(document.querySelector('#raceWordsInput').value);
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
      const now=Date.now();
      await fb.set(ref,{
        hostUid:currentUser.uid,
        passage:storedRacePassage(passage,typingLanguage),
        status:'waiting',
        createdAt:now,
        expiresAt:now+14400000,
        players:{}
      });
      raceCode=code;created=true;
    }
    if(!created) throw new Error('Could not create a room. Please try again.');
    raceMode='host';racePlayerId='';raceLanguage=typingLanguage;
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
    if(room.expiresAt && room.expiresAt<Date.now()) throw new Error('This room has expired. Ask the teacher to create a new race.');
    if(room.status!=='waiting') throw new Error('This race has already started.');
    const players=Object.values(room.players||{});
    if(players.length>=30) throw new Error('This room is full.');
    if(players.some(p=>String(p.name||'').toLowerCase()===name.toLowerCase())) throw new Error('That name is already in this room. Add an initial.');
    raceCode=code;racePlayerId=currentUser.uid;racePlayerName=name;raceMode='player';raceLanguage=racePassageInfo(room.passage).language;
    await fb.set(playerRef(code,currentUser.uid),{
      id:currentUser.uid,name,progress:0,wpm:0,accuracy:100,
      color:players.length%carColors.length,joinedAt:Date.now(),finishedAt:0
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
    await fb.update(roomRef(raceCode),{status:'racing',startedAt:Date.now()+3500});
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
  const passageInfo=racePassageInfo(data.passage);raceLobby.hidden=true;raceLive.hidden=false;raceLive.classList.remove('show-results');raceResults.hidden=true;raceLanguage=passageInfo.language;racePassageText=passageInfo.text;raceTyped='';raceStartedAt=data.startedAt||Date.now();raceCorrect=0;raceErrors=0;
  raceLive.classList.toggle('teacher-view',raceMode==='host');document.querySelector('#raceFullscreen').hidden=raceMode!=='host';
  document.querySelector('#racePassage').lang=raceLanguage==='en'?'en':raceLanguage==='pwo'?'kjp':'ksw';
  renderRacePassage();renderRaceKeyboard();
  startRaceCountdown(raceStartedAt);
  if(raceMode==='host')document.querySelector('#racePrompt').textContent='Teacher view — watch the racers move live.';
}
function startRaceCountdown(startAt){clearInterval(raceCountdownTimer);const overlay=document.querySelector('#raceCountdown'),label=document.querySelector('#raceCountdownText');const update=()=>{const left=startAt-Date.now();if(left<=0){label.textContent='GO!';raceCountdownDone=true;setTimeout(()=>{overlay.hidden=true},550);clearInterval(raceCountdownTimer);return}raceCountdownDone=false;overlay.hidden=false;label.textContent=String(Math.max(1,Math.ceil(left/1000)))};update();raceCountdownTimer=setInterval(update,180)}
function renderRace(data){
  const players=[...(data.players||[])].sort((a,b)=>b.progress-a.progress||((a.finishedAt||Infinity)-(b.finishedAt||Infinity))||a.joinedAt-b.joinedAt);
  const track=document.querySelector('#raceTrack');track.innerHTML='';track.classList.toggle('density-medium',players.length>8&&players.length<=16);track.classList.toggle('density-compact',players.length>16);
  players.forEach((player,index)=>{
    const lane=document.createElement('div');lane.className='race-lane';
    const name=document.createElement('span');name.className='race-lane-name';name.textContent=`${index+1}. ${player.name}`;
    const car=document.createElement('span');car.className='race-car';car.innerHTML=raceCarGraphic(player.color||0);car.style.left=`${Math.min(88,(player.progress||0)*.88)}%`;
    const finish=document.createElement('span');finish.className='race-finish';lane.append(name,car,finish);track.appendChild(lane)
  });
  if(racePlayerId){
    const me=players.find(p=>p.id===racePlayerId),place=players.findIndex(p=>p.id===racePlayerId)+1;
    document.querySelector('#racePosition').textContent=(me?.progress||0)>=100?`Finished · #${place}`:`#${place} · ${Math.round(me?.progress||0)}%`;
  }else document.querySelector('#racePosition').textContent=`${players.length} racer${players.length===1?'':'s'}`;
  const allFinished=players.length>0&&players.every(p=>(p.progress||0)>=100);
  if(allFinished){
    document.querySelector('#raceStatusText').textContent='Race finished!';
    document.querySelector('#racePrompt').textContent=players[0]?`Winner: ${players[0].name}`:'Race finished';
    renderRaceResults(players);
    if(raceMode==='host'&&!raceFinishing&&data.status!=='finished'){raceFinishing=true;fb.update(roomRef(raceCode),{status:'finished'}).catch(()=>{raceFinishing=false})}
  }else document.querySelector('#raceStatusText').textContent='Race in progress';
}
function makePodiumPlace(player,place){const card=document.createElement('article');card.className=`podium-place place-${place}`;const medal=document.createElement('span');medal.className='podium-medal';medal.textContent=place===1?'🥇':place===2?'🥈':'🥉';const car=document.createElement('div');car.className='podium-car';car.innerHTML=raceCarGraphic(player.color||0);const name=document.createElement('strong');name.textContent=player.name;const stats=document.createElement('span');stats.textContent=`${Math.round(player.wpm||0)} WPM · ${Math.round(player.accuracy??100)}%`;const block=document.createElement('div');block.className='podium-block';block.dataset.place=place;block.append(name,stats);card.append(medal,car,block);return card}
function renderRaceResults(players){if(!players.length)return;const podium=document.querySelector('#racePodium'),otherBox=document.querySelector('#raceOthers'),otherList=document.querySelector('#raceOtherList');podium.innerHTML='';otherList.innerHTML='';const order=[players[1]&&[players[1],2],players[0]&&[players[0],1],players[2]&&[players[2],3]].filter(Boolean);order.forEach(([player,place])=>podium.appendChild(makePodiumPlace(player,place)));players.slice(3).forEach((player,index)=>{const row=document.createElement('div');const place=document.createElement('b');place.textContent=`${index+4}.`;const name=document.createElement('span');name.textContent=player.name;const stats=document.createElement('span');stats.textContent=`${Math.round(player.wpm||0)} WPM · ${Math.round(player.accuracy??100)}%`;row.append(place,name,stats);otherList.appendChild(row)});otherBox.hidden=players.length<=3;document.querySelector('#raceResultActions').hidden=raceMode!=='host';raceLive.classList.add('show-results');raceResults.hidden=false}
function raceExpected(){
  if(racePassageText[raceTyped.length]===' ')return{key:'Space',value:' ',shift:false};
  return allMappings(raceLanguage).find(item=>racePassageText.startsWith(item.value,raceTyped.length))||null
}
function renderRacePassage(){
  const box=document.querySelector('#racePassage');box.innerHTML='';
  const done=document.createElement('span');done.className='done';done.textContent=racePassageText.slice(0,raceTyped.length);
  const current=document.createElement('span');current.className='current';current.textContent=racePassageText.slice(raceTyped.length,raceTyped.length+1);
  const rest=document.createTextNode(racePassageText.slice(raceTyped.length+1));box.append(done,current,rest)
}
function renderRaceKeyboard(){
  const box=document.querySelector('#raceKeyboard');box.innerHTML='';const expected=raceExpected(),shifted=expected?.shift||false,instruction=document.querySelector('#raceKeyInstruction'),mobile=phoneKeyboard(),layout=rowsForLanguage(raceLanguage);
  instruction.textContent=expected?(expected.key==='Space'?'Press Space':shifted?`Hold Shift + press ${expected.key}`:`Press ${expected.key}`):'Finished!';
  instruction.classList.toggle('needs-shift',shifted);
  layout.forEach((row,rowIndex)=>{
    const line=document.createElement('div');line.className='key-row';
    if(mobile&&rowIndex===layout.length-1){const shiftButton=document.createElement('button');shiftButton.type='button';shiftButton.className='key wide shift-key';shiftButton.textContent='Shift';if(shifted)shiftButton.classList.add('shift-required');line.appendChild(shiftButton)}
    row.forEach(([key,normal,shift])=>{
      const button=document.createElement('button');button.type='button';button.className='key';button.innerHTML=`<small>${key}</small>${shifted?shift:normal}`;
      if(expected&&expected.key===key)button.classList.add('expected');
      button.onclick=()=>acceptRaceInput(shifted?shift:normal);line.appendChild(button)
    });
    if(mobile&&rowIndex===layout.length-1){const backspace=document.createElement('button');backspace.type='button';backspace.className='key wide';backspace.textContent='⌫';backspace.onclick=raceBackspace;line.appendChild(backspace)}
    if(!mobile&&rowIndex===0){const backspace=document.createElement('button');backspace.type='button';backspace.className='key wide';backspace.textContent='Backspace';backspace.onclick=raceBackspace;line.appendChild(backspace)}
    if(!mobile&&rowIndex===2){const enter=document.createElement('button');enter.type='button';enter.className='key wide';enter.textContent='Enter';line.appendChild(enter)}box.appendChild(line)
  });
  const line=document.createElement('div'),leftShift=document.createElement('button'),space=document.createElement('button'),rightShift=document.createElement('button');line.className='key-row';
  [leftShift,rightShift].forEach(button=>{button.type='button';button.className='key wide shift-key';button.textContent='Shift';button.tabIndex=-1;if(shifted)button.classList.add('shift-required')});
  space.type='button';space.className='key wide space';space.textContent='Space';
  if(expected?.key==='Space')space.classList.add('expected');space.onclick=()=>acceptRaceInput(' ');if(!mobile)line.append(leftShift);line.appendChild(space);if(mobile){const enter=document.createElement('button');enter.type='button';enter.className='key wide';enter.textContent='Enter';line.appendChild(enter)}else line.appendChild(rightShift);box.appendChild(line)
}
function raceBackspace(){if(raceMode!=='player'||!raceTyped)return;const next=previousTextBoundary(raceTyped,raceTyped.length),removed=raceTyped.length-next;raceTyped=raceTyped.slice(0,next);raceCorrect=Math.max(0,raceCorrect-removed);renderRacePassage();renderRaceKeyboard();scheduleRaceProgress()}
function acceptRaceInput(value){
  if(raceMode!=='player'||raceLive.hidden||!raceCountdownDone||raceTyped.length>=racePassageText.length)return;
  const remaining=racePassageText.slice(raceTyped.length);
  if(remaining.startsWith(value)){
    raceTyped+=value;raceCorrect+=value.length;document.querySelector('#racePrompt').textContent='Keep going!';
    renderRacePassage();renderRaceKeyboard();scheduleRaceProgress()
  }else{
    raceErrors++;const prompt=document.querySelector('#racePrompt');prompt.textContent='Try the highlighted key.';prompt.style.color='#c92525';
    setTimeout(()=>prompt.style.color='',220)
  }
}
function scheduleRaceProgress(){clearTimeout(raceSendTimer);raceSendTimer=setTimeout(sendRaceProgress,100)}
async function sendRaceProgress(){
  if(!raceCode||!racePlayerId||!fb)return;
  const elapsed=Math.max(1,(Date.now()-raceStartedAt)/60000),progress=Math.min(100,raceTyped.length/racePassageText.length*100),
        wpm=Math.round((raceCorrect/5)/elapsed),accuracy=Math.round(raceCorrect/Math.max(1,raceCorrect+raceErrors)*100);
  try{
    await fb.update(playerRef(raceCode,racePlayerId),{
      progress,wpm,accuracy,finishedAt:progress>=100?Date.now():0
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
function updateRaceLanguageInput(){const input=document.querySelector('#raceWordsInput'),english=typingLanguage==='en',pwo=typingLanguage==='pwo',name=languageName();input.lang=languageTag();input.placeholder=english?'family\nmother\nfather':pwo?'ဆ\nတ\nန\nမ':'မိၢ်\nပၢ်\nမိၢ်ပၢ်';document.querySelector('#createRaceForm p').textContent=`Paste the ${name} words your students will type.`;document.querySelector('.race-intro p').textContent=`Everyone types the same ${name} passage. Accurate typing moves your car toward the finish line.`}
window.addEventListener('typinglanguagechange',()=>{if(raceJoin&&!raceJoin.hidden){raceLanguage=typingLanguage;updateRaceLanguageInput()}});
updateRaceLanguageInput();
