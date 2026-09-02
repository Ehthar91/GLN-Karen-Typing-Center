const raceStage=document.querySelector('#raceStage'),raceJoin=document.querySelector('#raceJoin'),raceLobby=document.querySelector('#raceLobby'),raceLive=document.querySelector('#raceLive');
let raceCode='',racePlayerId='',racePlayerName='',racePassageText='',raceTyped='',raceSendTimer=null,raceStartedAt=0,raceCorrect=0,raceErrors=0,raceMode='',raceUnsubscribe=null;
let fb=null,db=null,auth=null,currentUser=null;
const carColors=['🚗','🚙','🏎️','🚕','🚓','🚘'];
const RACE_PASSAGES=[
  'မိၢ် ပၢ် မိၢ်ပၢ် ဖိခွါ ဖိမုၣ် ဟံၣ်ဖိဃီဖိ',
  'မုၢ်ဒဲး မုၢ်ဆၣ် မုၢ်ယူာ် ကိးနံၤဒဲး ကိးဂီၤဒဲး',
  'မ့ၤ တၢ်အီၣ် ညၣ် ဆီညၣ် ကိးဟါဒဲး ကိးနၤဒဲး'
];
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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
    const credential=await authMod.signInAnonymously(auth);
    currentUser=credential.user;
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
function roomRef(code){return fb.ref(db,`rooms/${code}`)}
function playerRef(code,uid){return fb.ref(db,`rooms/${code}/players/${uid}`)}

function openRace(){
  stopGame();gameGrid.hidden=true;gameStage.hidden=true;raceStage.hidden=false;raceJoin.hidden=false;raceLobby.hidden=true;raceLive.hidden=true;
  document.querySelector('#raceError').textContent='';
  document.querySelector('#raceCodeInput').value='';
  document.querySelector('#raceNameInput').value='';
  document.querySelector('#raceConnection').textContent='Connecting…';
  initRaceFirebase().then(()=>document.querySelector('#raceConnection').textContent='Online').catch(()=>{});
}
function closeRace(){
  if(raceUnsubscribe){raceUnsubscribe();raceUnsubscribe=null}
  clearTimeout(raceSendTimer);raceStage.hidden=true;raceCode='';racePlayerId='';raceTyped='';raceMode='';
}
document.querySelector('#backRace').onclick=()=>{closeRace();gameGrid.hidden=false};
function raceError(message){document.querySelector('#raceError').textContent=message}

document.querySelector('#createRaceForm').onsubmit=async e=>{
  e.preventDefault();raceError('');
  try{
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
        passage:RACE_PASSAGES[Math.floor(Math.random()*RACE_PASSAGES.length)],
        status:'waiting',
        createdAt:now,
        expiresAt:now+14400000,
        players:{}
      });
      raceCode=code;created=true;
    }
    if(!created) throw new Error('Could not create a room. Please try again.');
    raceMode='host';racePlayerId='';
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
    raceCode=code;racePlayerId=currentUser.uid;racePlayerName=name;raceMode='player';
    await fb.set(playerRef(code,currentUser.uid),{
      id:currentUser.uid,name,progress:0,wpm:0,accuracy:100,
      color:players.length%carColors.length,joinedAt:Date.now(),finishedAt:0
    });
    showRaceLobby({players:[...players,{name}]});watchRace();
  }catch(error){raceError(error.message)}
};

function showRaceLobby(data){
  raceJoin.hidden=true;raceLobby.hidden=false;raceLive.hidden=true;
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
    await fb.update(roomRef(raceCode),{status:'racing',startedAt:Date.now()});
  }catch(error){document.querySelector('#lobbyHint').textContent=error.message}
};

function watchRace(){
  if(raceUnsubscribe){raceUnsubscribe();raceUnsubscribe=null}
  raceUnsubscribe=fb.onValue(roomRef(raceCode),snap=>{
    if(!snap.exists()){document.querySelector('#raceConnection').textContent='Room closed';return}
    const room=snap.val();
    document.querySelector('#raceConnection').textContent='Online';
    const players=Object.values(room.players||{});
    if(room.status==='waiting'){renderLobbyPlayers(players);return}
    const data={...room,players};
    if(raceLive.hidden)beginLiveRace(data);
    renderRace(data);
  },()=>document.querySelector('#raceConnection').textContent='Reconnecting…');
}
function beginLiveRace(data){
  raceLobby.hidden=true;raceLive.hidden=false;racePassageText=data.passage;raceTyped='';raceStartedAt=Date.now();raceCorrect=0;raceErrors=0;
  renderRacePassage();renderRaceKeyboard();
  if(raceMode==='host')document.querySelector('#racePrompt').textContent='Teacher view — watch the racers move live.';
}
function renderRace(data){
  const players=[...(data.players||[])].sort((a,b)=>b.progress-a.progress||((a.finishedAt||Infinity)-(b.finishedAt||Infinity))||a.joinedAt-b.joinedAt);
  const track=document.querySelector('#raceTrack');track.innerHTML='';
  players.forEach((player,index)=>{
    const lane=document.createElement('div');lane.className='race-lane';
    const name=document.createElement('span');name.className='race-lane-name';name.textContent=`${index+1}. ${player.name}`;
    const car=document.createElement('span');car.className='race-car';car.textContent=carColors[(player.color||0)%carColors.length];car.style.left=`${Math.min(91,(player.progress||0)*.91)}%`;
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
  }else document.querySelector('#raceStatusText').textContent='Race in progress';
}
function raceExpected(){
  if(racePassageText[raceTyped.length]===' ')return{key:'Space',value:' ',shift:false};
  return allMappings().find(item=>racePassageText.startsWith(item.value,raceTyped.length))||null
}
function renderRacePassage(){
  const box=document.querySelector('#racePassage');box.innerHTML='';
  const done=document.createElement('span');done.className='done';done.textContent=racePassageText.slice(0,raceTyped.length);
  const current=document.createElement('span');current.className='current';current.textContent=racePassageText.slice(raceTyped.length,raceTyped.length+1);
  const rest=document.createTextNode(racePassageText.slice(raceTyped.length+1));box.append(done,current,rest)
}
function renderRaceKeyboard(){
  const box=document.querySelector('#raceKeyboard');box.innerHTML='';const expected=raceExpected(),shifted=expected?.shift||false;
  rows.slice(1).forEach(row=>{
    const line=document.createElement('div');line.className='key-row';
    row.forEach(([key,normal,shift])=>{
      const button=document.createElement('button');button.type='button';button.className='key';button.innerHTML=`<small>${key}</small>${shifted?shift:normal}`;
      if(expected&&expected.key===key)button.classList.add('expected');
      button.onclick=()=>acceptRaceInput(shifted?shift:normal);line.appendChild(button)
    });box.appendChild(line)
  });
  const line=document.createElement('div'),space=document.createElement('button');line.className='key-row';space.type='button';space.className='key wide space';space.textContent='Space';
  if(expected?.key==='Space')space.classList.add('expected');space.onclick=()=>acceptRaceInput(' ');line.appendChild(space);box.appendChild(line)
}
function acceptRaceInput(value){
  if(raceMode!=='player'||raceLive.hidden||raceTyped.length>=racePassageText.length)return;
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
    const key=physicalKey(e),mapping=rows.flat().find(([mapped])=>mapped===key);if(!mapping)return;value=e.shiftKey?mapping[2]:mapping[1]
  }
  e.preventDefault();acceptRaceInput(value)
});