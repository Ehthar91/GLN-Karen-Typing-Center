const customStage=document.querySelector('#customGameStage');
const customSetup=document.querySelector('#customGameSetup');
const customLive=document.querySelector('#customGameLive');
const customResults=document.querySelector('#customGameResults');
const customListKey='glnCustomGameListsV1';
const cq=s=>document.querySelector(s);

const tugAvatars=[
  {key:'headband-boy',name:'Headband Boy'},
  {key:'ponytail-girl',name:'Ponytail Girl'},
  {key:'curly-student',name:'Curly-Hair Student'},
  {key:'glasses-boy',name:'Glasses Boy'},
  {key:'cap-boy',name:'Cap Boy'},
  {key:'hoodie-girl',name:'Hoodie Girl'},
  {key:'sporty-girl',name:'Sporty Girl'},
  {key:'blue-hoodie-student',name:'Blue-Hoodie Student'}
];
const TUG_CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TUG_WIN_LEAD=5;

let customMode='adventure';
let customItems=[];
let customIndex=0;
let customScore=0;
let customLives=3;
let customValue='';
let customDifficultyMode='medium',customKeyboardShifted=false;
let customLanguage=typingLanguage;

let tugCode='';
let tugRole='';
let tugPlayerId='';
let tugPlayerName='';
let tugAvatarIndex=0;
let tugSelectedTeam='';
let tugTeam='';
let tugRoom=null;
let tugUnsubscribe=null;
let tugClassStarted=false;
let tugFinishing=false;
let tugPromptStartedAt=0;
let tugPromptErrors=0;
let tugCorrectChars=0;
let tugAttemptedChars=0;
let tugErrors=0;
let tugGameStartedAt=0;
let tugPreviewToken=0;
let tugLastScores={};

function customLists(){try{return JSON.parse(localStorage.getItem(customListKey)||'{}')}catch{return{}}}
function writeCustomLists(value){localStorage.setItem(customListKey,JSON.stringify(value))}
function parseCustomItems(value){return String(value||'').split(/\r?\n|,/).map(v=>v.trim().replace(/\s+/g,' ')).filter(Boolean)}
function refreshCustomLists(){
  const menu=cq('#customSavedList');
  const current=menu.value;
  const lists=customLists();
  menu.innerHTML='<option value="">Choose a saved list…</option>';
  Object.keys(lists).sort().forEach(name=>menu.add(new Option(name,name)));
  if(lists[current])menu.value=current;
}
function languageTagFor(language){return language==='en'?'en':language==='pwo'?'kjp':'ksw'}
function customGameLanguage(){return customMode==='tug'&&tugRole==='player'?customLanguage:typingLanguage}
function normalizeTugDifficulty(value){const mode=String(value||'medium').toLowerCase();return mode==='normal'?'medium':(['easy','medium','hard'].includes(mode)?mode:'medium')}
function customDifficulty(){return customMode==='tug'&&tugRole==='player'?normalizeTugDifficulty(customDifficultyMode):cq('#customDifficulty').value}
function shuffledChallenges(source,count){
  const items=Array.from({length:count},(_,i)=>source[i%source.length]);
  for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]]}
  return items;
}
function textUnits(value){return Array.from(String(value||'')).length}

function tugRoomRef(code){return fb.ref(db,`tugRooms/${code}`)}
function tugPlayerRef(code,uid){return fb.ref(db,`tugRooms/${code}/players/${uid}`)}
function makeTugCode(){return Array.from({length:5},()=>TUG_CODE_CHARS[Math.floor(Math.random()*TUG_CODE_CHARS.length)]).join('')}
function tugError(message){cq('#tugClassError').textContent=message||''}
function teamLabel(team){return team==='red'?'Team A':team==='blue'?'Team B':'Unassigned'}
function teamDot(team){return team==='red'?'Ⓐ':team==='blue'?'Ⓑ':'○'}
function speedBonusWpm(){return customDifficulty()==='easy'?20:customDifficulty()==='hard'?40:30}
function tugAvatarData(index){return tugAvatars[((Number(index)||0)%tugAvatars.length+tugAvatars.length)%tugAvatars.length]}
function tugAvatarSrc(index,team='neutral'){
  const data=tugAvatarData(index);
  return `tug-avatar-${data.key}.png`;
}
function tugAvatarPose(player,base='idle'){if(base!=='pull')return base;if(player?.finished)return'hold';return'pull'}
function tugConsumeScoreBursts(players){
  const bursts={},next={};
  players.forEach(player=>{
    const score=Number(player?.score)||0;
    const previous=Number(tugLastScores[player.id])||0;
    if(score>previous)bursts[player.id]=score-previous>=2?'power':'pull';
    next[player.id]=score;
  });
  tugLastScores=next;
  return bursts;
}
function renderTugAvatarFigure(playerOrIndex,options={}){
  const player=typeof playerOrIndex==='object'&&playerOrIndex?playerOrIndex:{avatar:playerOrIndex,name:options.name||''};
  const avatarIndex=((Number(player.avatar)||0)%tugAvatars.length+tugAvatars.length)%tugAvatars.length;
  const data=tugAvatarData(avatarIndex);
  const team=options.team||player.team||'';
  const facing=options.facing||((team==='blue'||options.side==='blue')?'left':'right');
  const state=options.state||'idle';
  const root=document.createElement(options.tag||'div');
  root.className=['tug-character',team?`team-${team}`:'',`facing-${facing}`,`state-${state}`,options.compact?'compact':'',options.mini?'mini':'',options.highlight?'is-me':'',options.pulse?`pulse-${options.pulse}`:''].filter(Boolean).join(' ');
  root.setAttribute('aria-label',player.name?`${player.name} avatar: ${data.name}`:data.name);
  if(options.showName){
    const name=document.createElement('span');
    name.className='tug-character-name';
    name.textContent=player.name||data.name;
    root.appendChild(name);
  }
  const stage=document.createElement('span');
  stage.className='tug-character-stage';
  const img=document.createElement('img');
  img.className='tug-avatar-art';
  img.alt='';
  img.decoding='async';
  img.loading='lazy';
  img.src=tugAvatarSrc(avatarIndex,team||'neutral');
  img.onerror=()=>{
    img.hidden=true;
    stage.classList.add('asset-missing');
    if(!stage.querySelector('.tug-avatar-fallback')){
      const fallback=document.createElement('span');
      fallback.className='tug-avatar-fallback';
      fallback.textContent=data.name.split(/\s+/).map(word=>word[0]).slice(0,2).join('');
      stage.appendChild(fallback);
    }
  };
  stage.appendChild(img);
  if(options.pulse){
    const pop=document.createElement('b');
    pop.className='tug-character-pop';
    pop.textContent=options.pulse==='power'?'+2 PULL':'PULL!';
    stage.appendChild(pop);
  }
  root.appendChild(stage);
  if(options.caption){
    const meta=document.createElement('span');
    meta.className='tug-character-meta';
    meta.textContent=options.caption;
    root.appendChild(meta);
  }
  return root;
}
function renderTugAvatarPicker(){
  const box=cq('#tugAvatarPicker');
  box.innerHTML='';
  tugAvatars.forEach((avatar,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='tug-avatar-choice';
    button.setAttribute('role','radio');
    button.setAttribute('aria-label',avatar.name);
    button.onclick=()=>{tugAvatarIndex=index;renderTugAvatarPicker()};
    const selected=index===tugAvatarIndex;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-checked',selected?'true':'false');
    button.appendChild(renderTugAvatarFigure(index,{compact:true,state:selected?'ready':'idle',facing:'right'}));
    const label=document.createElement('span');
    label.className='tug-avatar-choice-label';
    label.textContent=avatar.name;
    button.appendChild(label);
    box.appendChild(button);
  });
}
function renderTugTeamChoice(){
  cq('#tugChooseRed').classList.toggle('selected',tugSelectedTeam==='red');
  cq('#tugChooseBlue').classList.toggle('selected',tugSelectedTeam==='blue');
}
cq('#tugChooseRed').onclick=()=>{if(!cq('#tugChooseRed').disabled){tugSelectedTeam='red';renderTugTeamChoice()}};
cq('#tugChooseBlue').onclick=()=>{if(!cq('#tugChooseBlue').disabled){tugSelectedTeam='blue';renderTugTeamChoice()}};

function closeTugRoom(){
  if(tugUnsubscribe){tugUnsubscribe();tugUnsubscribe=null}
  tugRoom=null;tugClassStarted=false;tugFinishing=false;tugCode='';tugRole='';tugPlayerId='';tugPlayerName='';tugSelectedTeam='';tugTeam='';tugLastScores={};
}
function openCustomGame(mode){
  stopGame();
  if(typeof closeRace==='function')closeRace();
  closeTugRoom();
  customMode=mode;
  gameGrid.hidden=true;gameStage.hidden=true;
  const raceStage=cq('#raceStage');if(raceStage)raceStage.hidden=true;
  customStage.hidden=false;customLive.hidden=true;customResults.hidden=true;
  cq('#tugLobby').hidden=true;cq('#tugTeacherLive').hidden=true;
  const adventure=mode==='adventure';
  cq('#customGameTitle').textContent=adventure?'Typing Adventure':'Typing Tug of War';
  cq('#customGameIcon').textContent=adventure?'🧭':'🪢';
  cq('#customRestart').hidden=!adventure;
  if(adventure){
    cq('#tugClassSetup').hidden=true;customSetup.hidden=false;
    cq('#customSetupTitle').textContent='Build a Typing Adventure';
    cq('#customStartGame').textContent='Start adventure';
    cq('#customWordsInput').lang=languageTag();
    if(!cq('#customWordsInput').value)cq('#customWordsInput').value=activeGameWords().join('\n');
    customError('');refreshCustomLists();
  }else{
    customSetup.hidden=true;cq('#tugClassSetup').hidden=false;tugError('');
    cq('#tugConnection').textContent='Connecting…';
    cq('#tugWordsInput').lang=languageTag();
    cq('#tugCodeInput').value='';cq('#tugNameInput').value='';
    cq('#tugTeamField').hidden=true;cq('#tugJoinTeamNote').textContent='Enter a room code to see how teams are assigned.';
    tugAvatarIndex=0;tugSelectedTeam='';renderTugAvatarPicker();renderTugTeamChoice();
    initRaceFirebase().then(()=>cq('#tugConnection').textContent='Online').catch(()=>cq('#tugConnection').textContent='Offline');
  }
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-game="adventure"],[data-game="tug"]').forEach(card=>card.onclick=()=>openCustomGame(card.dataset.game));

function resetCustomSetup(){stopCustomGame();customSetup.hidden=false;customLive.hidden=true;customResults.hidden=true}
cq('#customBackGames').onclick=()=>{stopCustomGame();closeTugRoom();customStage.hidden=true;gameGrid.hidden=false};
cq('#customRestart').onclick=resetCustomSetup;
cq('#customNewList').onclick=resetCustomSetup;
cq('#customPlayAgain').onclick=()=>beginCustomGame();
cq('#customSavedList').onchange=e=>{const value=customLists()[e.target.value];if(value)cq('#customWordsInput').value=value};
cq('#customSaveList').onclick=()=>{
  const value=cq('#customWordsInput').value;
  if(!parseCustomItems(value).length)return customError('Add words or sentences first.');
  const name=prompt('Name this list:',`Game List ${Object.keys(customLists()).length+1}`);
  if(!name?.trim())return;
  const lists=customLists(),clean=name.trim().slice(0,40);
  lists[clean]=value;writeCustomLists(lists);refreshCustomLists();cq('#customSavedList').value=clean;showToast('Game list saved');
};
cq('#customDeleteList').onclick=()=>{const name=cq('#customSavedList').value;if(!name)return;const lists=customLists();delete lists[name];writeCustomLists(lists);refreshCustomLists();showToast('Saved list deleted')};
function customError(message){cq('#customGameError').textContent=message}
cq('#customStartGame').onclick=beginCustomGame;

function beginCustomGame(){
  const source=parseCustomItems(cq('#customWordsInput').value);
  if(!source.length)return customError('Add at least one word or sentence.');
  const count=Math.max(1,Math.min(50,Number(cq('#customChallengeCount').value)||10));
  customMode='adventure';customItems=shuffledChallenges(source,count);customIndex=0;customScore=0;customLives=3;customValue='';
  customLanguage=typingLanguage;customDifficultyMode=cq('#customDifficulty').value;
  customSetup.hidden=true;customResults.hidden=true;cq('#customResultActions').hidden=false;customLive.hidden=false;
  cq('#adventureWorld').hidden=false;cq('#tugWorld').hidden=true;
  cq('#customStatusLabel').textContent='Checkpoint';cq('#customLifeLabel').textContent='Stars';
  nextCustomChallenge();
}
function stopCustomGame(){/* Tug of War has no countdown animation to cancel. */}
function nextCustomChallenge(){
  if(customMode==='adventure'&&(customIndex>=customItems.length||customLives<=0))return finishCustomGame();
  if(customMode==='tug'&&customIndex>=customItems.length)return finishCustomGame();
  customValue='';
  cq('#customTyped').textContent='';cq('#customTyped').className='custom-typed';
  cq('#customRound').textContent=`${Math.min(customIndex+1,customItems.length)} / ${customItems.length}`;
  cq('#customScore').textContent=customScore;
  if(customMode==='adventure'){
    cq('#customLives').className='';cq('#customLives').textContent='★'.repeat(customLives)+'☆'.repeat(3-customLives);
    cq('#adventurePlayer').style.left=`${(customIndex/customItems.length)*100}%`;
  }else{
    cq('#customLives').textContent=tugTeam==='red'?'A':'B';
    cq('#customLives').className=tugTeam==='red'?'team-red-text':'team-blue-text';
    tugPromptStartedAt=performance.now();tugPromptErrors=0;
  }
  renderCustomTarget();renderCustomKeyboard();
}
function renderCustomTarget(){
  const target=customItems[customIndex]||'';
  const box=cq('#customTarget'),done=document.createElement('span'),current=document.createElement('span');
  done.className='done';done.textContent=target.slice(0,customValue.length);
  current.className='current';current.textContent=target.slice(customValue.length,customValue.length+1)||' ';
  box.replaceChildren(done,current,document.createTextNode(target.slice(customValue.length+1)));
}
function customExpected(){
  const target=customItems[customIndex]||'';
  if(target[customValue.length]===' ')return{key:'Space',value:' ',shift:false};
  return mappingsForLanguage(customGameLanguage()).find(m=>target.startsWith(m.value,customValue.length))||null;
}
function customControl(label,action,active=false){const b=document.createElement('button');b.type='button';b.className='key wide game-control';b.textContent=label;b.onclick=action;if(active)b.classList.add('shift-required');return b}
function makeCustomTypeControl(label,display,action,className=''){
  const button=document.createElement('button');button.type='button';button.className='key modifier';
  if(className)button.classList.add(...className.split(' ').filter(Boolean));
  button.dataset.code=label;button.innerHTML=`<small>${label}</small>${display}`;button.onclick=action;return button
}
function makeCustomTypeKey(label,char,value=char){
  const button=document.createElement('button');button.type='button';button.className='key';button.dataset.code=label;button.dataset.value=value;
  button.innerHTML=`<small>${label==='Space'?'':label}</small>${char}`;button.onclick=()=>acceptCustomInput(value);return button
}
function setCustomKeyboardShift(on){customKeyboardShifted=!!on;renderCustomKeyboard()}
function renderMediumCustomKeyboard(box){
  const mobile=phoneKeyboard(),layout=rowsForLanguage(customGameLanguage());
  box.classList.toggle('real-keyboard',!mobile);
  layout.forEach((row,rowIndex)=>{
    const line=document.createElement('div');line.className=`key-row keyboard-row-${rowIndex}`;
    if(!mobile&&rowIndex===1)line.appendChild(makeCustomTypeControl('Tab','Tab',()=>{},'tab-key'));
    if(!mobile&&rowIndex===2)line.appendChild(makeCustomTypeControl('Caps Lock','Caps',()=>setCustomKeyboardShift(!customKeyboardShifted),'caps-key'));
    if(rowIndex===layout.length-1)line.appendChild(makeCustomTypeControl('Shift',mobile?'Shift':'⇧ Shift',()=>setCustomKeyboardShift(!customKeyboardShifted),'shift-key'));
    row.forEach(([key,normal,shift])=>line.appendChild(makeCustomTypeKey(key,customKeyboardShifted?shift:normal,customKeyboardShifted?shift:normal)));
    if(!mobile&&rowIndex===0)line.appendChild(makeCustomTypeControl('Backspace','⌫ Backspace',customBackspace,'backspace-key'));
    if(!mobile&&rowIndex===2)line.appendChild(makeCustomTypeControl('Enter','↵ Enter',()=>{},'enter-key'));
    if(rowIndex===layout.length-1){
      if(mobile)line.appendChild(makeCustomTypeControl('Backspace','⌫',customBackspace,'backspace-key'));
      else line.appendChild(makeCustomTypeControl('Shift','Shift ⇧',()=>setCustomKeyboardShift(!customKeyboardShifted),'shift-key'));
    }
    box.appendChild(line)
  });
  const bottom=document.createElement('div');bottom.className='key-row phone-bottom-row keyboard-row-bottom';
  if(!mobile){[['Ctrl','Ctrl'],['Alt','Alt']].forEach(([label,display])=>bottom.appendChild(makeCustomTypeControl(label,display,()=>{},'system-key')))}
  const space=makeCustomTypeKey('Space','Space',' ');space.classList.add('wide','space');bottom.appendChild(space);
  if(mobile){const enter=makeCustomTypeControl('Enter','↵',()=>{},'enter-key');enter.classList.add('wide');bottom.appendChild(enter)}
  else [['Alt','Alt'],['Ctrl','Ctrl']].forEach(([label,display])=>bottom.appendChild(makeCustomTypeControl(label,display,()=>{},'system-key')));
  box.appendChild(bottom)
}
function renderEasyCustomKeyboard(box){
  box.classList.remove('real-keyboard');
  const expected=customExpected(),needShift=expected?.shift||false;
  rowsForLanguage(customGameLanguage()).forEach((row,rowIndex)=>{
    const line=document.createElement('div');line.className='key-row';
    row.forEach(([key,normal,shift])=>{const b=document.createElement('button');b.type='button';b.className='key';b.dataset.code=key;b.innerHTML=`<small>${key}</small>${needShift?shift:normal}`;if(expected?.key===key)b.classList.add('expected');b.onclick=()=>acceptCustomInput(needShift?shift:normal);line.appendChild(b)});
    if(rowIndex===0)line.appendChild(customControl('Backspace',customBackspace));box.appendChild(line);
  });
  const bottom=document.createElement('div');bottom.className='key-row';bottom.appendChild(customControl('Shift',()=>{},needShift));
  const space=customControl('Space',()=>acceptCustomInput(' '));space.classList.add('space');if(expected?.key==='Space')space.classList.add('expected');
  bottom.append(space,customControl('Shift',()=>{},needShift));box.appendChild(bottom);
}
function renderCustomKeyboard(){
  const box=cq('#customGameKeyboard');box.innerHTML='';
  const mode=customMode==='tug'?normalizeTugDifficulty(customDifficulty()):customDifficulty();
  if(mode==='hard'){box.hidden=true;box.classList.remove('real-keyboard');return}
  box.hidden=false;
  if(customMode==='tug'&&mode==='medium'){renderMediumCustomKeyboard(box);return}
  renderEasyCustomKeyboard(box)
}
function customBackspace(){
  if(!customValue)return;
  customValue=customValue.slice(0,previousTextBoundary(customValue,customValue.length));
  cq('#customTyped').textContent=customValue;renderCustomTarget();renderCustomKeyboard();
}
function currentTugAccuracy(){return tugAttemptedChars?Math.max(0,Math.min(100,(tugCorrectChars/tugAttemptedChars)*100)):100}
function currentTugWpm(){
  const elapsed=Math.max(1,(Date.now()-tugGameStartedAt)/1000);
  return Math.max(0,(tugCorrectChars/5)/(elapsed/60));
}
function syncTugPlayer(finished=false){
  if(tugRole!=='player'||!tugCode||!tugPlayerId||!fb)return Promise.resolve();
  return fb.update(tugPlayerRef(tugCode,tugPlayerId),{
    score:customScore,index:customIndex,finished:!!finished,finishedAt:finished?Date.now():0,
    correctChars:tugCorrectChars,attemptedChars:tugAttemptedChars,errors:tugErrors,
    wpm:Number(currentTugWpm().toFixed(1)),accuracy:Number(currentTugAccuracy().toFixed(1))
  }).catch(()=>{});
}
function acceptCustomInput(value){
  if(customLive.hidden||!customItems[customIndex])return;
  const remaining=customItems[customIndex].slice(customValue.length);
  const units=Math.max(1,textUnits(value));
  if(remaining.startsWith(value)){
    if(customMode==='tug'){tugAttemptedChars+=units;tugCorrectChars+=units}
    customValue+=value;cq('#customTyped').textContent=customValue;renderCustomTarget();
    if(customValue===customItems[customIndex]){
      if(customMode==='tug'){
        const elapsed=Math.max(.5,(performance.now()-tugPromptStartedAt)/1000);
        const promptWpm=(textUnits(customItems[customIndex])/5)/(elapsed/60);
        const bonus=promptWpm>=speedBonusWpm()&&tugPromptErrors===0?1:0;
        customScore+=1+bonus;customIndex++;
        syncTugPlayer(customIndex>=customItems.length);nextCustomChallenge();
      }else{
        customScore++;customIndex++;nextCustomChallenge();
      }
    }else renderCustomKeyboard();
  }else{
    cq('#customTyped').classList.add('wrong');setTimeout(()=>cq('#customTyped').classList.remove('wrong'),220);
    if(customMode==='tug'){tugAttemptedChars+=units;tugErrors++;tugPromptErrors++}
    else if(customDifficulty()==='hard'){customLives--;nextCustomChallenge()}
  }
}
function finishCustomGame(){
  customLive.hidden=true;customResults.hidden=false;
  if(tugRole==='player'&&customMode==='tug'){
    syncTugPlayer(true);cq('#customResultIcon').textContent='🪢';cq('#customResultTitle').textContent='Your pulling is complete!';
    cq('#customResultSummary').textContent=`You contributed ${customScore} pull point${customScore===1?'':'s'}. Waiting for the rest of the class.`;
    cq('#customResultActions').hidden=true;return;
  }
  const win=customLives>0;cq('#customResultIcon').textContent=win?'🏆':'🎯';
  cq('#customResultTitle').textContent=win?'Adventure complete!':'Adventure ended';
  cq('#customResultSummary').textContent=`You completed ${customScore} of ${customItems.length} challenges.`;
  cq('#customResultActions').hidden=false;
  const key=`glnBest_${typingLanguage}_adventure`;localStorage.setItem(key,Math.max(customScore,Number(localStorage.getItem(key)||0)));
}

function tugTeamStats(players){
  const groups={red:players.filter(p=>p.team==='red'),blue:players.filter(p=>p.team==='blue')};
  const calc=list=>{const total=list.reduce((sum,p)=>sum+(Number(p.score)||0),0);return{players:list,total,avg:list.length?total/list.length:0}};
  return{red:calc(groups.red),blue:calc(groups.blue)};
}
function tugRopePosition(players){
  const stats=tugTeamStats(players);
  const lead=stats.blue.avg-stats.red.avg;
  return Math.max(2,Math.min(98,50+(lead/TUG_WIN_LEAD)*48));
}
function tugOutcome(players,allFinished=false){
  const stats=tugTeamStats(players);
  if(!stats.red.players.length||!stats.blue.players.length)return null;
  const diff=stats.red.avg-stats.blue.avg;
  if(diff>=TUG_WIN_LEAD)return{winner:'red',reason:'rope',stats};
  if(diff<=-TUG_WIN_LEAD)return{winner:'blue',reason:'rope',stats};
  if(allFinished){
    if(Math.abs(diff)<.001)return{winner:'tie',reason:'complete',stats};
    return{winner:diff>0?'red':'blue',reason:'complete',stats};
  }
  return null;
}
function chooseBalancedTeam(players){
  const stats=tugTeamStats(players);
  if(stats.red.players.length<stats.blue.players.length)return'red';
  if(stats.blue.players.length<stats.red.players.length)return'blue';
  return Math.random()<.5?'red':'blue';
}

cq('#tugCreateForm').onsubmit=async event=>{
  event.preventDefault();tugError('');
  const source=parseCustomItems(cq('#tugWordsInput').value);
  const count=Math.max(1,Math.min(50,Number(cq('#tugChallengeCount').value)||10));
  try{
    if(!source.length)throw new Error('Paste at least one word or sentence.');
    await initRaceFirebase();
    let created=false,tries=0;
    while(!created&&tries<10){
      tries++;
      const code=makeTugCode(),ref=tugRoomRef(code),existing=await fb.get(ref);
      if(existing.exists())continue;
      const now=Date.now(),items=shuffledChallenges(source,count);
      await fb.set(ref,{hostUid:currentUser.uid,items,difficulty:normalizeTugDifficulty(cq('#tugDifficulty').value),challengeCount:items.length,language:typingLanguage,teamMode:cq('#tugTeamMode').value,winLead:TUG_WIN_LEAD,status:'waiting',winner:'',createdAt:now,expiresAt:now+14400000,startedAt:0,finishedAt:0,players:{}});
      tugCode=code;created=true;
    }
    if(!created)throw new Error('Could not create a room. Please try again.');
    tugRole='host';tugPlayerId='';showTugLobby({players:[]});watchTugRoom();
  }catch(error){tugError(error.message||'Could not create the Tug of War room.')}
};

async function previewTugRoom(){
  const code=cq('#tugCodeInput').value.trim().toUpperCase();
  cq('#tugCodeInput').value=code;
  const token=++tugPreviewToken;
  tugSelectedTeam='';renderTugTeamChoice();cq('#tugTeamField').hidden=true;
  if(code.length!==5){cq('#tugJoinTeamNote').textContent='Enter a room code to see how teams are assigned.';return}
  try{
    await initRaceFirebase();const snap=await fb.get(tugRoomRef(code));if(token!==tugPreviewToken)return;
    if(!snap.exists()){cq('#tugJoinTeamNote').textContent='Room not found yet. Check the code.';return}
    const room=snap.val(),players=Object.values(room.players||{}),stats=tugTeamStats(players);
    if(room.teamMode==='choose'){
      cq('#tugTeamField').hidden=false;
      const redBlocked=stats.red.players.length>stats.blue.players.length;
      const blueBlocked=stats.blue.players.length>stats.red.players.length;
      cq('#tugChooseRed').disabled=redBlocked;cq('#tugChooseBlue').disabled=blueBlocked;
      cq('#tugJoinTeamNote').textContent='Choose a team. The fuller team may be temporarily locked to keep teams balanced.';
    }else if(room.teamMode==='host')cq('#tugJoinTeamNote').textContent='The host will assign your team after you join.';
    else cq('#tugJoinTeamNote').textContent='You will be placed on a balanced random team when you join.';
  }catch{if(token===tugPreviewToken)cq('#tugJoinTeamNote').textContent='Could not check that room yet.'}
}
cq('#tugCodeInput').addEventListener('input',previewTugRoom);

cq('#tugJoinForm').onsubmit=async event=>{
  event.preventDefault();tugError('');
  const code=cq('#tugCodeInput').value.trim().toUpperCase();
  const rawName=typeof cleanName==='function'?cleanName(cq('#tugNameInput').value):String(cq('#tugNameInput').value||'').trim().replace(/\s+/g,' ').slice(0,24);
  try{
    if(!/^[A-Z2-9]{5}$/.test(code))throw new Error('Enter a valid five-character room code.');
    if(!rawName)throw new Error('Enter your name.');
    await initRaceFirebase();
    const snap=await fb.get(tugRoomRef(code));if(!snap.exists())throw new Error('Tug of War room not found. Check the code.');
    const room=snap.val();
    if(room.expiresAt&&room.expiresAt<Date.now())throw new Error('This Tug of War room has expired.');
    if(room.status!=='waiting')throw new Error('This Tug of War game has already started.');
    const players=Object.values(room.players||{});
    if(players.length>=40)throw new Error('This room is full.');
    if(players.some(player=>String(player.name||'').toLowerCase()===rawName.toLowerCase()&&player.id!==currentUser.uid))throw new Error('That name is already in this room. Add an initial.');
    let team='unassigned';
    if(room.teamMode==='random')team=chooseBalancedTeam(players);
    else if(room.teamMode==='choose'){
      if(!['red','blue'].includes(tugSelectedTeam))throw new Error('Choose Team A or Team B.');
      const stats=tugTeamStats(players);
      if(tugSelectedTeam==='red'&&stats.red.players.length>stats.blue.players.length)throw new Error('Team A is full right now. Choose Team B.');
      if(tugSelectedTeam==='blue'&&stats.blue.players.length>stats.red.players.length)throw new Error('Team B is full right now. Choose Team A.');
      team=tugSelectedTeam;
    }
    tugCode=code;tugRole='player';tugPlayerId=currentUser.uid;tugPlayerName=rawName;tugTeam=team;customLanguage=room.language||typingLanguage;
    const player={id:currentUser.uid,name:rawName,avatar:tugAvatarIndex,team,score:0,index:0,finished:false,joinedAt:Date.now(),finishedAt:0,correctChars:0,attemptedChars:0,errors:0,wpm:0,accuracy:100};
    await fb.set(tugPlayerRef(code,currentUser.uid),player);
    showTugLobby({players:[...players.filter(p=>p.id!==currentUser.uid),player]});watchTugRoom();
  }catch(error){tugError(error.message||'Could not join the Tug of War room.')}
};

function showTugLobby(data){
  cq('#tugClassSetup').hidden=true;customSetup.hidden=true;customLive.hidden=true;customResults.hidden=true;cq('#tugTeacherLive').hidden=true;cq('#tugLobby').hidden=false;
  cq('#tugRoomCode').textContent=tugCode;
  const host=tugRole==='host';
  cq('#startTugRoom').hidden=!host;
  cq('#tugLobbyTitle').textContent=host?'Waiting for players':tugTeam==='unassigned'?'You joined! Waiting for a team':'You joined '+teamLabel(tugTeam)+'!';
  cq('#tugLobbyHint').textContent=host?'Share the room code. Start when both teams are ready.':tugTeam==='unassigned'?'Your avatar is ready. The host will place you on a team.':'Your avatar is ready. Wait for the host to start.';
  renderTugLobbyPlayers(data.players||[]);
}
function renderTugLobbyPlayers(players){
  const box=cq('#tugLobbyTeams');box.innerHTML='';
  cq('#tugPlayerCount').textContent=`Joined: ${players.length} ${players.length===1?'player':'players'}`;
  const groups=[['red','Team A'],['blue','Team B']];
  if(players.some(p=>p.team==='unassigned'))groups.push(['unassigned','Waiting for host']);
  groups.forEach(([team,title])=>{
    const panel=document.createElement('section');panel.className=`tug-lobby-team ${team}`;
    const heading=document.createElement('h3');const members=players.filter(p=>p.team===team);heading.textContent=`${teamDot(team)} ${title} · ${members.length}`;panel.appendChild(heading);
    const list=document.createElement('div');list.className='tug-player-chips';
    if(!members.length){const empty=document.createElement('span');empty.className='tug-empty-player';empty.textContent='No players yet';list.appendChild(empty)}
    members.sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)).forEach(player=>{
      const chip=document.createElement('article');chip.className='tug-player-chip';
      chip.appendChild(renderTugAvatarFigure(player,{team:player.team,compact:true,mini:true,state:'idle',facing:player.team==='blue'?'left':'right'}));
      const info=document.createElement('div');info.className='tug-chip-info';
      const name=document.createElement('strong');name.textContent=player.name;
      const role=document.createElement('span');role.textContent=tugAvatarData(player.avatar).name;
      info.append(name,role);
      chip.appendChild(info);
      if(tugRole==='host'){
        const controls=document.createElement('span');controls.className='tug-chip-controls';
        ['red','blue'].forEach(nextTeam=>{const assign=document.createElement('button');assign.type='button';assign.className=`tug-mini-team ${nextTeam}`;assign.textContent=nextTeam==='red'?'A':'B';assign.title=`Move ${player.name} to ${teamLabel(nextTeam)}`;assign.disabled=player.team===nextTeam;assign.onclick=()=>fb.update(tugPlayerRef(tugCode,player.id),{team:nextTeam}).catch(()=>{});controls.appendChild(assign)});
        const remove=document.createElement('button');remove.type='button';remove.className='tug-remove-player';remove.textContent='×';remove.title=`Remove ${player.name}`;remove.onclick=()=>fb.remove(tugPlayerRef(tugCode,player.id)).catch(()=>{});controls.appendChild(remove);chip.appendChild(controls);
      }
      list.appendChild(chip);
    });
    panel.appendChild(list);box.appendChild(panel);
  });
  const stats=tugTeamStats(players),unassigned=players.filter(p=>!['red','blue'].includes(p.team)).length;
  cq('#startTugRoom').disabled=tugRole==='host'&&(!stats.red.players.length||!stats.blue.players.length||unassigned>0);
  if(tugRole==='host'){
    if(unassigned) cq('#tugLobbyHint').textContent='Assign every waiting player to Red or Blue before starting.';
    else if(!stats.red.players.length||!stats.blue.players.length)cq('#tugLobbyHint').textContent='Both Team A and Team B need at least one player.';
    else cq('#tugLobbyHint').textContent='Both teams are ready. Start when your class is ready.';
  }
}
cq('#copyTugCode').onclick=async()=>{try{await navigator.clipboard.writeText(tugCode);showToast('Tug of War code copied')}catch{showToast(`Tug of War code: ${tugCode}`)}};
cq('#startTugRoom').onclick=async()=>{
  try{
    if(tugRole!=='host')return;
    const snap=await fb.get(tugRoomRef(tugCode));if(!snap.exists())throw new Error('Room not found.');
    const room=snap.val(),players=Object.values(room.players||{}),stats=tugTeamStats(players);
    if(room.hostUid!==currentUser.uid)throw new Error('Only the host can start this game.');
    if(!stats.red.players.length||!stats.blue.players.length)throw new Error('Both teams need at least one player.');
    if(players.some(p=>!['red','blue'].includes(p.team)))throw new Error('Assign every player to a team first.');
    const updates={status:'playing',winner:'',startedAt:Date.now(),finishedAt:0};
    Object.keys(room.players||{}).forEach(uid=>{updates[`players/${uid}/score`]=0;updates[`players/${uid}/index`]=0;updates[`players/${uid}/finished`]=false;updates[`players/${uid}/finishedAt`]=0;updates[`players/${uid}/correctChars`]=0;updates[`players/${uid}/attemptedChars`]=0;updates[`players/${uid}/errors`]=0;updates[`players/${uid}/wpm`]=0;updates[`players/${uid}/accuracy`]=100});
    await fb.update(tugRoomRef(tugCode),updates);
  }catch(error){cq('#tugLobbyHint').textContent=error.message}
};

function watchTugRoom(){
  if(tugUnsubscribe)tugUnsubscribe();
  tugUnsubscribe=fb.onValue(tugRoomRef(tugCode),snap=>{
    if(!snap.exists()){tugError('This Tug of War room is no longer available.');return}
    tugRoom=snap.val();cq('#tugConnection').textContent='Online';
    const players=Object.values(tugRoom.players||{});
    if(tugRoom.status==='waiting'){
      tugClassStarted=false;
      if(tugRole==='player'){const me=tugRoom.players?.[tugPlayerId];if(me)tugTeam=me.team}
      showTugLobby({players});return;
    }
    if(tugRoom.status==='playing'){
      if(tugRole==='host'){
        renderTugTeacherLive(tugRoom,players);
        const allFinished=players.length>0&&players.every(player=>player.finished);
        const outcome=tugOutcome(players,allFinished);
        if(outcome&&!tugFinishing){
          tugFinishing=true;
          fb.update(tugRoomRef(tugCode),{status:'finished',winner:outcome.winner,finishedAt:Date.now()}).finally(()=>tugFinishing=false);
        }
      }else if(tugRole==='player'){
        if(!tugClassStarted)beginTugPlayer(tugRoom);
        else updateTugPlayerArena(tugRoom,players);
      }
      return;
    }
    if(tugRoom.status==='finished'){
      if(tugRole==='host')renderTugTeacherResults(tugRoom,players);
      else renderTugPlayerFinished(tugRoom,players);
    }
  },()=>cq('#tugConnection').textContent='Reconnecting…');
}
function beginTugPlayer(room){
  const me=room.players?.[tugPlayerId];if(!me)return;
  tugClassStarted=true;customMode='tug';
  customItems=Array.isArray(room.items)?room.items:Object.values(room.items||{});
  customIndex=Math.max(0,Math.min(customItems.length,Number(me.index)||0));
  customScore=Number(me.score)||0;customValue='';customLanguage=room.language||typingLanguage;customDifficultyMode=normalizeTugDifficulty(room.difficulty);customKeyboardShifted=false;
  tugTeam=me.team;tugCorrectChars=Number(me.correctChars)||0;tugAttemptedChars=Number(me.attemptedChars)||0;tugErrors=Number(me.errors)||0;tugGameStartedAt=room.startedAt||Date.now();
  cq('#tugLobby').hidden=true;cq('#tugClassSetup').hidden=true;cq('#tugTeacherLive').hidden=true;customResults.hidden=true;cq('#customResultActions').hidden=true;customLive.hidden=false;
  cq('#adventureWorld').hidden=true;cq('#tugWorld').hidden=false;cq('#customStatusLabel').textContent='Prompt';cq('#customLifeLabel').textContent='Team';
  cq('#customTarget').lang=languageTagFor(customLanguage);cq('#customTyped').lang=languageTagFor(customLanguage);
  updateTugPlayerArena(room,Object.values(room.players||{}));nextCustomChallenge();
}
function updateTugAvatarRow(selector,players,team,pulseMap={}){
  const box=cq(selector);box.innerHTML='';
  players.filter(p=>p.team===team).sort((a,b)=>(b.score||0)-(a.score||0)).forEach(player=>{
    box.appendChild(renderTugAvatarFigure(player,{team,state:tugAvatarPose(player,'pull'),facing:team==='red'?'right':'left',showName:true,caption:`${Number(player.score)||0} pulls`,highlight:player.id===tugPlayerId,pulse:pulseMap[player.id]}));
  });
}
function updateTugPlayerArena(room,players){
  const stats=tugTeamStats(players),position=tugRopePosition(players),pulseMap=tugConsumeScoreBursts(players);
  cq('#tugPlayerRopeMarker').style.left=`${position}%`;
  updateTugAvatarRow('#tugRedAvatars',players,'red',pulseMap);updateTugAvatarRow('#tugBlueAvatars',players,'blue',pulseMap);
  const myStats=tugTeam==='red'?stats.red:stats.blue,other=tugTeam==='red'?stats.blue:stats.red;
  const lead=myStats.avg-other.avg;
  cq('#tugPlayerStatus').textContent=lead>.05?`${teamLabel(tugTeam)} is pulling ahead!`:lead<-.05?'The other team is pulling ahead — keep typing!':'The rope is nearly centered. Keep pulling!';
}
function tugProgressText(player,total){if(player.finished)return'Finished';const current=Math.min(total,Math.max(0,Number(player.index)||0)+1);return `Prompt ${current} / ${total}`}
function makeTugPlayerCard(player,total){
  const card=document.createElement('article');card.className=`tug-score-card ${player.team||''}`;
  const avatar=document.createElement('span');avatar.className='tug-score-avatar';avatar.appendChild(renderTugAvatarFigure(player,{team:player.team,compact:true,mini:true,state:player.finished?'hold':'ready',facing:player.team==='blue'?'left':'right'}));
  const info=document.createElement('div');const name=document.createElement('strong');name.textContent=player.name;const progress=document.createElement('span');progress.textContent=tugProgressText(player,total);info.append(name,progress);
  const metrics=document.createElement('div');metrics.className='tug-score-metrics';metrics.innerHTML=`<b>${Number(player.score)||0} pulls</b><span>${Number(player.wpm||0).toFixed(1)} WPM · ${Number(player.accuracy??100).toFixed(0)}%</span>`;
  card.append(avatar,info,metrics);if(player.finished)card.classList.add('finished');return card;
}
function renderTugScoreboard(players,total){
  const board=cq('#tugScoreboard');board.innerHTML='';
  ['red','blue'].forEach(team=>{
    const column=document.createElement('section');column.className=`tug-score-team ${team}`;
    const members=players.filter(p=>p.team===team).sort((a,b)=>(b.score||0)-(a.score||0)||(b.accuracy||0)-(a.accuracy||0));
    const heading=document.createElement('h3');heading.textContent=`${teamDot(team)} ${teamLabel(team)} · ${members.length}`;column.appendChild(heading);
    if(!members.length){const empty=document.createElement('div');empty.className='tug-score-empty';empty.textContent='No players';column.appendChild(empty)}
    members.forEach(player=>column.appendChild(makeTugPlayerCard(player,total)));board.appendChild(column);
  });
}
function renderTugTeacherArena(players){
  const stats=tugTeamStats(players),position=tugRopePosition(players),pulseMap=tugConsumeScoreBursts(players);
  cq('#tugTeacherRedScore').textContent=stats.red.avg.toFixed(1);cq('#tugTeacherBlueScore').textContent=stats.blue.avg.toFixed(1);cq('#tugTeacherRopeMarker').style.left=`${position}%`;
  const fill=(selector,members,team)=>{const box=cq(selector);box.innerHTML='';members.slice().sort((a,b)=>(b.score||0)-(a.score||0)).forEach(player=>{box.appendChild(renderTugAvatarFigure(player,{team,state:tugAvatarPose(player,'pull'),facing:team==='red'?'right':'left',showName:true,caption:`${Number(player.score)||0} pulls`,pulse:pulseMap[player.id]}))})};
  fill('#tugTeacherRedAvatars',stats.red.players,'red');fill('#tugTeacherBlueAvatars',stats.blue.players,'blue');
}
function renderTugTeacherLive(room,players){
  cq('#tugClassSetup').hidden=true;cq('#tugLobby').hidden=true;customLive.hidden=true;customResults.hidden=true;cq('#tugTeacherLive').hidden=false;cq('#tugTeacherResults').hidden=true;cq('#endTugRoom').hidden=false;cq('#tugLiveCode').textContent=tugCode;
  renderTugTeacherArena(players);renderTugScoreboard(players,room.challengeCount||room.items?.length||0);
}
function bestPlayer(players,key,secondary='score'){return players.slice().sort((a,b)=>(Number(b[key])||0)-(Number(a[key])||0)||(Number(b[secondary])||0)-(Number(a[secondary])||0))[0]}
function renderTugTeacherResults(room,players){
  cq('#tugClassSetup').hidden=true;cq('#tugLobby').hidden=true;customLive.hidden=true;customResults.hidden=true;cq('#tugTeacherLive').hidden=false;cq('#endTugRoom').hidden=true;cq('#tugTeacherResults').hidden=false;cq('#tugLiveCode').textContent=tugCode;
  renderTugTeacherArena(players);renderTugScoreboard(players,room.challengeCount||room.items?.length||0);
  const stats=tugTeamStats(players),winner=room.winner||tugOutcome(players,true)?.winner||'tie';
  cq('#tugTeacherResultTitle').textContent=winner==='tie'?'It’s a tie!':`${teamLabel(winner)} wins!`;
  cq('#tugTeacherSummary').textContent=`Team A: ${stats.red.avg.toFixed(1)} average pulls · Team B: ${stats.blue.avg.toFixed(1)} average pulls.`;
  const awards=cq('#tugAwards');awards.innerHTML='';
  const topSpeed=bestPlayer(players,'wpm'),topAccuracy=bestPlayer(players,'accuracy','score'),topPull=bestPlayer(players,'score','accuracy');
  [['⚡','Top Typist',topSpeed,topSpeed?`${Number(topSpeed.wpm||0).toFixed(1)} WPM`:'' ],['🎯','Highest Accuracy',topAccuracy,topAccuracy?`${Number(topAccuracy.accuracy??100).toFixed(0)}%`:'' ],['💪','Most Team Pulls',topPull,topPull?`${topPull.score||0} pulls`:'' ]].forEach(([icon,title,player,value])=>{if(!player)return;const card=document.createElement('div');card.innerHTML=`<span>${icon}</span><strong>${title}</strong><b></b><small>${value}</small>`;card.querySelector('b').textContent=player.name;awards.appendChild(card)});
}
function renderTugPlayerFinished(room,players){
  customLive.hidden=true;cq('#tugLobby').hidden=true;cq('#tugTeacherLive').hidden=true;customResults.hidden=false;cq('#customResultActions').hidden=true;
  const me=room.players?.[tugPlayerId],winner=room.winner||tugOutcome(players,true)?.winner||'tie',myTeam=me?.team||tugTeam,score=me?.score??customScore,accuracy=Number(me?.accuracy??currentTugAccuracy()).toFixed(0);
  const won=winner===myTeam,tie=winner==='tie';cq('#customResultIcon').textContent=tie?'🤝':won?'🏆':'🪢';
  cq('#customResultTitle').textContent=tie?'Tug of War tie!':won?`${teamLabel(myTeam)} wins!`:`${teamLabel(winner)} wins!`;
  cq('#customResultSummary').textContent=`You contributed ${score} pull point${score===1?'':'s'} with ${accuracy}% accuracy.`;
}
cq('#endTugRoom').onclick=async()=>{
  if(tugRole!=='host'||!tugCode)return;
  try{const snap=await fb.get(tugRoomRef(tugCode));if(!snap.exists())return;const room=snap.val(),players=Object.values(room.players||{}),winner=tugOutcome(players,true)?.winner||'tie';await fb.update(tugRoomRef(tugCode),{status:'finished',winner,finishedAt:Date.now()})}catch{}
};
cq('#tugPlayAgain').onclick=async()=>{
  if(tugRole!=='host'||!tugRoom)return;
  const updates={status:'waiting',winner:'',startedAt:0,finishedAt:0};
  Object.keys(tugRoom.players||{}).forEach(uid=>{updates[`players/${uid}/score`]=0;updates[`players/${uid}/index`]=0;updates[`players/${uid}/finished`]=false;updates[`players/${uid}/finishedAt`]=0;updates[`players/${uid}/correctChars`]=0;updates[`players/${uid}/attemptedChars`]=0;updates[`players/${uid}/errors`]=0;updates[`players/${uid}/wpm`]=0;updates[`players/${uid}/accuracy`]=100});
  await fb.update(tugRoomRef(tugCode),updates).catch(error=>tugError(error.message));
};
cq('#tugNewRoom').onclick=()=>{closeTugRoom();openCustomGame('tug')};

document.addEventListener('keydown',e=>{
  if(customStage.hidden||customLive.hidden||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Shift'){if(customMode==='tug'&&normalizeTugDifficulty(customDifficulty())==='medium'&&!customKeyboardShifted){customKeyboardShifted=true;renderCustomKeyboard()}return;}
  const key=physicalKey(e);
  if(key==='Backspace'){e.preventDefault();customBackspace();return}
  const match=rowsForLanguage(customGameLanguage()).flat().find(([mapped])=>mapped===key);
  if(match){e.preventDefault();acceptCustomInput(e.shiftKey?match[2]:match[1])}
  else if(e.key===' '){e.preventDefault();acceptCustomInput(' ')}
});
document.addEventListener('keyup',e=>{
  if(customStage.hidden||customLive.hidden||e.key!=='Shift')return;
  if(customMode==='tug'&&normalizeTugDifficulty(customDifficulty())==='medium'&&customKeyboardShifted){customKeyboardShifted=false;renderCustomKeyboard()}
});
window.addEventListener('typinglanguagechange',()=>{
  cq('#customWordsInput').lang=languageTag();cq('#tugWordsInput').lang=languageTag();
  if(!(customMode==='tug'&&tugRole==='player')){cq('#customTarget').lang=languageTag();cq('#customTyped').lang=languageTag()}
});
