// Bus Call: caller authentication, classroom listeners, and 30-day code reservations.
(() => {
  const q=s=>document.querySelector(s);
  const panel=q('#busCallPanel');
  if(!panel)return;
  const connection=q('#busCallConnection'),setup=q('#busCallSetup'),callerConsole=q('#busCallerConsole'),teacherConsole=q('#busClassroomConsole'),errorEl=q('#busCallError');
  const popup=q('#busCallPopup'),popupGrid=q('#busPopupActiveGrid'),popupTime=q('#busPopupTime'),popupStage=q('#busPopupStage');
  let busDb=null,busUser=null,callerAuth=null,callerDatabase=null,googleCallerAuth=null,googleCallerDatabase=null;
  let role='',code='',room=null,unsubscribe=null,presenceDisconnect=null,lastCallId='',lastCombinedCallId='',lastAllClearId='',dismissedAllClearId='',seenAddOnIds=new Set(),audioContext=null,selectedStage='first',callerCodeEditing=false,lineupTarget='main';
  let callerDisconnect=null,callerHeartbeatTimer=null,sessionExpiryTimer=null,historyPruneBusy=false;
  let teacherDisplayName='',teacherPresenceAttached=false;
  const teacherSetup=q('#busTeacherSetup');
  const roleTabs=Array.from(panel.querySelectorAll('[data-bus-role]'));
  let fullscreenActive=false,fullscreenHome=null,popupHome=null,fullscreenFocus=null;
  function restoreFullscreen(){
    fullscreenActive=false;panel.classList.remove('bus-fullscreen');
    document.body.classList.remove('bus-fullscreen-open');
    if(popupHome){popupHome.replaceWith(popup);popupHome=null}
    if(fullscreenHome){fullscreenHome.replaceWith(panel);fullscreenHome=null}
    q('#busFullscreen').textContent='Full screen';q('#busFullscreen').setAttribute('aria-pressed','false');
    if(fullscreenFocus?.isConnected)fullscreenFocus.focus();
  }
  async function exitBusFullscreen(){
    if(document.fullscreenElement===panel){try{await document.exitFullscreen()}catch{}}
    restoreFullscreen();
  }
  async function toggleBusFullscreen(){
    if(fullscreenActive){await exitBusFullscreen();return}
    fullscreenFocus=document.activeElement;
    fullscreenHome=document.createComment('Bus Call panel position');panel.before(fullscreenHome);
    popupHome=document.createComment('Bus Call popup position');popup.before(popupHome);
    document.body.append(panel);panel.append(popup);
    fullscreenActive=true;panel.classList.add('bus-fullscreen');document.body.classList.add('bus-fullscreen-open');
    q('#busFullscreen').textContent='Exit full screen';q('#busFullscreen').setAttribute('aria-pressed','true');
    // The expanded view remains usable when native fullscreen is unavailable.
    try{if(panel.requestFullscreen)await panel.requestFullscreen();else q('#busFullscreen').textContent='Exit expanded view'}
    catch{if(fullscreenActive)q('#busFullscreen').textContent='Exit expanded view'}
    if(fullscreenActive)q(role==='caller'?'#busNumberInput':'#busFullscreen').focus();
  }
  q('#busFullscreen').addEventListener('click',toggleBusFullscreen);
  document.addEventListener('fullscreenchange',()=>{if(fullscreenActive&&document.fullscreenElement!==panel)restoreFullscreen()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&fullscreenActive){event.preventDefault();exitBusFullscreen()}});
  function selectRole(next){
    roleTabs.forEach(tab=>{
      const active=tab.dataset.busRole===next;
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      q('#'+tab.getAttribute('aria-controls')).hidden=!active;
    });
    setError('');
  }
  function updateRoleTabs(){
    teacherSetup.hidden=role==='teacher';
    roleTabs.forEach(tab=>{
      tab.disabled=!!role&&tab.dataset.busRole!==role;
      tab.title=tab.disabled?(role==='caller'?'Close the current room to switch roles.':'Leave the current room to switch roles.'):'';
    });
  }
  roleTabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>selectRole(tab.dataset.busRole));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const target=roleTabs[event.key==='Home'?0:event.key==='End'?roleTabs.length-1:(index+1)%roleTabs.length];
      if(!target.disabled){selectRole(target.dataset.busRole);target.focus()}
    });
  });
  const ROOM_MS=18*60*60*1000;
  const RESERVATION_MS=30*24*60*60*1000;
  const SESSION_IDLE_MS=60*60*1000;
  const HISTORY_RETENTION_MS=60*60*1000;
  const CALLER_HEARTBEAT_MS=60*1000;
  const lastCallerActivity=value=>Number(value?.callerLastActiveAt||value?.lastActivityAt||value?.createdAt)||0;
  const sessionDeadline=value=>{
    const disconnectedAt=Number(value?.callerDisconnectedAt)||0;
    if(disconnectedAt)return disconnectedAt+SESSION_IDLE_MS;
    const explicit=Number(value?.sessionExpiresAt)||0;
    if(explicit)return explicit;
    const heartbeatAt=Number(value?.callerHeartbeatAt)||0;
    if(heartbeatAt)return heartbeatAt+SESSION_IDLE_MS;
    // Older Bus Call rooms created before the liveness fields existed use their last caller activity as a safe migration fallback.
    const legacyActivity=lastCallerActivity(value);
    return legacyActivity?legacyActivity+SESSION_IDLE_MS:0;
  };
  const sessionExpired=value=>{const deadline=sessionDeadline(value);return !!deadline&&deadline<=Date.now()};
  const reservationExpired=value=>!!lastCallerActivity(value)&&lastCallerActivity(value)+RESERVATION_MS<=Date.now();
  const reservedMessage='This code is reserved for its caller until 30 days after their last activity. Use the original Google account or PIN, or choose a different code.';
  const normalizeCode=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  const randomCode=()=>Array.from({length:5},()=>CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join('');
  // Reservation-aware rules protect BUS_ rooms and allow reclaim only after 30 days.
  // BUS_ keeps these rooms isolated from normal 5-character quiz room codes.
  const roomKey=value=>`BUS_${normalizeCode(value)}`;
  const roomRef=value=>fb.ref(busDb,`quizRooms/${roomKey(value)}`);
  const listenerRef=(value,uid)=>fb.ref(busDb,`quizRooms/${roomKey(value)}/players/${uid}`);
  const setConnection=(text,state='')=>{connection.textContent=text;connection.classList.toggle('online',state==='online');connection.classList.toggle('problem',state==='problem')};
  const setError=text=>{errorEl.textContent=text||''};
  function confirmBusAction(message,{confirmLabel='Confirm',danger=true,title='Confirm action',icon='⚠️',large=false}={}){
    return new Promise(resolve=>{
      let overlay=q('#busInlineConfirm');
      if(!overlay){
        overlay=document.createElement('div');overlay.id='busInlineConfirm';overlay.className='bus-inline-confirm';overlay.hidden=true;
        overlay.innerHTML='<div class="bus-inline-confirm-card" role="dialog" aria-modal="true" aria-labelledby="busInlineConfirmTitle"><span class="bus-inline-confirm-icon" aria-hidden="true">⚠️</span><h3 id="busInlineConfirmTitle">Confirm action</h3><p id="busInlineConfirmMessage"></p><div class="bus-inline-confirm-actions"><button class="button ghost" id="busInlineConfirmCancel" type="button">Cancel</button><button class="button danger" id="busInlineConfirmOk" type="button">Confirm</button></div></div>';
        panel.append(overlay);
      }
      const messageEl=overlay.querySelector('#busInlineConfirmMessage'),titleEl=overlay.querySelector('#busInlineConfirmTitle'),iconEl=overlay.querySelector('.bus-inline-confirm-icon'),ok=overlay.querySelector('#busInlineConfirmOk'),cancel=overlay.querySelector('#busInlineConfirmCancel');
      messageEl.textContent=message;if(titleEl)titleEl.textContent=title;if(iconEl)iconEl.textContent=icon;ok.textContent=confirmLabel;ok.classList.toggle('danger',danger);ok.classList.toggle('primary',!danger);overlay.classList.toggle('large',!!large);
      overlay.hidden=false;
      const previous=document.activeElement;
      const finish=value=>{overlay.hidden=true;overlay.classList.remove('large');ok.removeEventListener('click',onOk);cancel.removeEventListener('click',onCancel);overlay.removeEventListener('click',onBackdrop);document.removeEventListener('keydown',onKey,true);if(previous?.isConnected)previous.focus();resolve(value)};
      const onOk=()=>finish(true),onCancel=()=>finish(false),onBackdrop=event=>{if(event.target===overlay)finish(false)},onKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false)}};
      ok.addEventListener('click',onOk);cancel.addEventListener('click',onCancel);overlay.addEventListener('click',onBackdrop);document.addEventListener('keydown',onKey,true);ok.focus();
    });
  }
  const cleanText=(value,max)=>String(value||'').trim().replace(/\s+/g,' ').slice(0,max);
  const parseBusNumbers=value=>{
    const parts=String(value||'').trim().split(/[\s,]+/).map(part=>cleanText(part,18)).filter(Boolean);
    const seen=new Set(),numbers=[];
    for(const part of parts){const key=part.toUpperCase();if(seen.has(key))continue;seen.add(key);numbers.push(part)}
    return numbers;
  };
  const busNumberKey=value=>cleanText(value,18).toUpperCase();
  const valuesArray=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
  function schoolBusRosterNumbers(value){
    const raw=valuesArray(value?.schoolBusRoster);
    const seen=new Set(),numbers=[];
    raw.forEach(item=>{const number=cleanText(item,18),key=busNumberKey(number);if(number&&key&&!seen.has(key)){seen.add(key);numbers.push(number)}});
    return numbers;
  }
  function callBusNumbers(call){
    const listed=valuesArray(call?.numbers).map(item=>cleanText(item,18)).filter(Boolean);
    if(listed.length)return listed;
    const fallback=String(call?.number||'').replace(/\s*\+\s*/g,' ');
    return parseBusNumbers(fallback);
  }
  function recentHistoryItems(history){
    const cutoff=Date.now()-HISTORY_RETENTION_MS;
    return Object.values(history||{}).filter(item=>item&&(!Number(item.calledAt)||Number(item.calledAt)>cutoff));
  }
  function calledBusSet(history){
    const called=new Set();
    recentHistoryItems(history).forEach(item=>callBusNumbers(item).forEach(number=>called.add(busNumberKey(number))));
    return called;
  }
  function stagesByBusFromCalls(calls){
    const map=new Map();
    (calls||[]).forEach(call=>{
      const stages=callStagesFor(call);
      callBusNumbers(call).forEach(number=>{
        const key=busNumberKey(number);if(!key)return;
        if(!map.has(key))map.set(key,new Set());
        stages.forEach(stage=>map.get(key).add(stage));
      });
    });
    return map;
  }
  function duplicateBusInfo(numbers,requestedStages){
    const requested=normalizeStageList(requestedStages);
    const active=stagesByBusFromCalls(allActiveCalls(room));
    const history=stagesByBusFromCalls(recentHistoryItems(room?.history));
    const duplicates=[];
    numbers.forEach(number=>{
      const key=busNumberKey(number),seen=new Set();
      (active.get(key)||[]).forEach(stage=>seen.add(stage));
      (history.get(key)||[]).forEach(stage=>seen.add(stage));
      const repeated=requested.filter(stage=>seen.has(stage));
      if(repeated.length)duplicates.push({number,stages:repeated});
    });
    return duplicates;
  }
  async function confirmDuplicateSend(numbers,{kind='Bus',stages=['first']}={}){
    const requested=normalizeStageList(stages),duplicates=duplicateBusInfo(numbers,requested);
    if(!duplicates.length)return true;
    const details=duplicates.map(item=>`${item.number} — ${stageListLabel(item.stages)} already sent`).join(' • ');
    const callLabel=stageListLabel(requested);
    const subject=numbers.length===1?`${kind} ${numbers[0]}`:`One or more ${kind.toLowerCase()} numbers`;
    return confirmBusAction(`${subject} already received part of this ${callLabel}. ${details}. Send anyway?`,{confirmLabel:'Send Anyway',danger:false,title:'Call stage already sent',icon:'⚠️'});
  }
  function setLineupTarget(target){
    lineupTarget=target==='addon'?'addon':'main';
    const main=q('#busNumberInput'),addOn=q('#busAddOnNumberInput'),label=q('#busRosterTargetLabel');
    main?.classList.toggle('bus-lineup-target',lineupTarget==='main');
    addOn?.classList.toggle('bus-lineup-target',lineupTarget==='addon');
    if(label)label.textContent=lineupTarget==='addon'?'Add-On Bus':'Main Bus';
    if(room)renderSchoolBusRoster(room);
  }
  function addRosterBusToTarget(number){
    const input=q(lineupTarget==='addon'?'#busAddOnNumberInput':'#busNumberInput');if(!input)return;
    const current=parseBusNumbers(input.value);
    if(!current.some(item=>busNumberKey(item)===busNumberKey(number)))current.push(number);
    input.value=current.join(' ');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
  }
  function renderSchoolBusRoster(value){
    const roster=schoolBusRosterNumbers(value),called=calledBusSet(value?.history),remaining=roster.filter(number=>!called.has(busNumberKey(number)));
    const input=q('#busSchoolRosterInput'),count=q('#busRosterRemainingCount'),progress=q('#busRosterProgressText'),list=q('#busRosterRemainingList'),clear=q('#clearBusSchoolRoster');
    if(input&&document.activeElement!==input)input.value=roster.join(' ');
    if(clear)clear.hidden=!roster.length;
    if(!count||!progress||!list)return;
    list.innerHTML='';
    if(!roster.length){
      count.textContent='Bus list not set';progress.textContent='Enter your school bus numbers to track what is still waiting to be called.';
      const empty=document.createElement('span');empty.className='bus-roster-empty';empty.textContent='No school bus lineup saved yet.';list.append(empty);return;
    }
    const calledCount=roster.length-remaining.length;
    count.textContent=`${remaining.length} bus${remaining.length===1?'':'es'} left`;
    progress.textContent=`${calledCount} of ${roster.length} bus${roster.length===1?'':'es'} called in the current history window.`;
    if(!remaining.length){const done=document.createElement('span');done.className='bus-roster-complete';done.textContent='✓ All school buses have been called.';list.append(done);return}
    const mainSelected=new Set(parseBusNumbers(q('#busNumberInput')?.value||'').map(busNumberKey));
    const addOnSelected=new Set(parseBusNumbers(q('#busAddOnNumberInput')?.value||'').map(busNumberKey));
    remaining.forEach(number=>{
      const chip=document.createElement('button');chip.type='button';chip.className='bus-roster-chip';chip.textContent=number;chip.title=`Add Bus ${number} to ${lineupTarget==='addon'?'Add-On Bus':'Main Bus'}`;
      const key=busNumberKey(number);if(mainSelected.has(key))chip.classList.add('selected-main');if(addOnSelected.has(key))chip.classList.add('selected-addon');
      chip.addEventListener('click',()=>addRosterBusToTarget(number));list.append(chip)
    });
  }
  function renderTeacherSchoolBusRoster(value){
    const panel=q('#busTeacherRosterPanel'),count=q('#busTeacherRosterCount'),list=q('#busTeacherRosterList');if(!panel||!count||!list)return;
    const roster=schoolBusRosterNumbers(value),called=calledBusSet(value?.history),remaining=roster.filter(number=>!called.has(busNumberKey(number)));
    panel.hidden=!roster.length;if(!roster.length){list.innerHTML='';count.textContent='0 buses';return}
    count.textContent=remaining.length?`${remaining.length} bus${remaining.length===1?'':'es'}`:'All called';list.innerHTML='';
    if(!remaining.length){const done=document.createElement('span');done.className='bus-teacher-roster-done';done.textContent='✓ All school buses have been called.';list.append(done);return}
    remaining.forEach(number=>{const chip=document.createElement('span');chip.className='bus-teacher-roster-chip';chip.textContent=number;list.append(chip)});
  }
  function renderPopupSchoolBusRoster(value){
    const panel=q('#busPopupRoster'),count=q('#busPopupRosterCount'),list=q('#busPopupRosterList');if(!panel||!count||!list)return;
    const roster=schoolBusRosterNumbers(value),called=calledBusSet(value?.history),remaining=roster.filter(number=>!called.has(busNumberKey(number)));
    panel.hidden=!roster.length;if(!roster.length){count.textContent='';list.innerHTML='';return}
    count.textContent=remaining.length?`${remaining.length} LEFT`:'ALL CALLED';list.innerHTML='';
    if(!remaining.length){const done=document.createElement('span');done.className='bus-popup-roster-done';done.textContent='✓ All school buses called';list.append(done);return}
    remaining.forEach(number=>{const chip=document.createElement('span');chip.className='bus-popup-roster-chip';chip.textContent=number;list.append(chip)});
  }
  const callStageLabel=stage=>({first:'First Call',second:'Second Call',last:'Last Call'}[stage]||'Bus Call');
  const callStageClass=stage=>['first','second','last'].includes(stage)?stage:'first';
  const callStageOrder=['first','second','last'];
  const normalizeStageList=value=>{
    const raw=Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[value]);
    const selected=new Set(raw.filter(stage=>callStageOrder.includes(stage)));
    return callStageOrder.filter(stage=>selected.has(stage));
  };
  const callStagesFor=call=>{
    const stages=normalizeStageList(call?.stages);
    return stages.length?stages:normalizeStageList(call?.stage||'first');
  };
  function busesMissingLastCall(value){
    const roster=schoolBusRosterNumbers(value);
    if(!roster.length)return {roster:[],missing:[],verified:false};
    const stages=stagesByBusFromCalls(recentHistoryItems(value?.history));
    const missing=roster.filter(number=>!(stages.get(busNumberKey(number))||new Set()).has('last'));
    return {roster,missing,verified:true};
  }
  const stageListLabel=stages=>normalizeStageList(stages).map(callStageLabel).join(' + ')||'Bus Call';
  const callStagesLabel=call=>stageListLabel(callStagesFor(call));
  function setCallStage(stage){
    selectedStage=callStageClass(stage);
    panel.querySelectorAll('[data-bus-call-stage]').forEach(button=>{
      const active=button.dataset.busCallStage===selectedStage;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    const send=q('#sendBusCall');
    if(send)send.textContent=`Send ${callStageLabel(selectedStage)}`;
  }
  const friendlyError=error=>{const raw=String(error?.message||'');const code=String(error?.code||'');if(code.includes('permission-denied')||code.includes('PERMISSION_DENIED')||/permission denied/i.test(raw))return 'Firebase blocked the live room. If Classroom Quiz also cannot connect, check Firebase Realtime Database rules.';if(code.includes('operation-not-allowed')||/operation-not-allowed/i.test(raw))return 'Anonymous Firebase access is turned off. Enable Anonymous sign-in in Firebase Authentication.';if(/network|failed to fetch|offline/i.test(raw))return 'Could not reach Firebase. Check the internet connection and try again.';return raw||'Could not connect to the live Bus Call service.'};
  const formatTime=value=>{const date=new Date(Number(value)||Date.now());return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
  function saveTeacherPrefs(){try{localStorage.setItem('glnBusCallCode',code||normalizeCode(q('#busTeacherCodeInput').value));localStorage.setItem('glnBusCallTeacherName',q('#busTeacherNameInput').value.trim());localStorage.setItem('glnBusCallSound',q('#busSoundEnabled').checked?'1':'0')}catch{}}
  function restorePrefs(){try{q('#busTeacherCodeInput').value=normalizeCode(localStorage.getItem('glnBusCallCode')||'');q('#busTeacherNameInput').value=localStorage.getItem('glnBusCallTeacherName')||'';q('#busSoundEnabled').checked=localStorage.getItem('glnBusCallSound')!=='0'}catch{}}
  function getSavedCallerCode(){try{return normalizeCode(localStorage.getItem('glnBusCallerCode')||'')}catch{return ''}}
  function saveCallerCode(value){const saved=normalizeCode(value);if(!saved)return;try{localStorage.setItem('glnBusCallerCode',saved)}catch{}}
  function updateCallerResumeUi(){
    const saved=getSavedCallerCode(),card=q('#busCallerSavedRoom'),field=q('#busCallerCodeField'),choice=q('#busCallerRoomChoice'),savedCode=q('#busCallerSavedRoomCode'),pinHelp=q('#busCallerPinHelp'),start=q('#startBusCaller');
    if(!saved){callerCodeEditing=true;card.hidden=true;field.hidden=false;start.textContent='Start / Reopen Caller Room';pinHelp.textContent='Choose a PIN for a new room. Keep it private; classroom teachers only need the room code.';return}
    card.hidden=false;savedCode.textContent=saved;field.hidden=!callerCodeEditing;
    choice.textContent=callerCodeEditing?`Use ${saved} instead`:'Use a different room code';
    if(!callerCodeEditing){q('#busCallerCodeInput').value=saved;start.textContent=`Reopen ${saved} with PIN`;pinHelp.textContent=`Enter your caller PIN to reopen ${saved}. The room code is already remembered on this device.`}
    else{start.textContent='Start / Reopen Caller Room';pinHelp.textContent=`Enter a different room code below, or choose “Use ${saved} instead” to reopen your saved room.`}
  }
  function clearSessionExpiryTimer(){if(sessionExpiryTimer){clearTimeout(sessionExpiryTimer);sessionExpiryTimer=null}}
  function clearCallerHeartbeat(){if(callerHeartbeatTimer){clearInterval(callerHeartbeatTimer);callerHeartbeatTimer=null}}
  function stopWatch(){if(unsubscribe){unsubscribe();unsubscribe=null}clearSessionExpiryTimer()}
  async function stopPresence(remove=true){
    teacherPresenceAttached=false;
    if(presenceDisconnect){try{await presenceDisconnect.cancel()}catch{}presenceDisconnect=null}
    if(remove&&role==='teacher'&&code&&busUser&&fb){try{await fb.remove(listenerRef(code,busUser.uid))}catch{}}
  }
  async function ensureTeacherPresence(){
    if(role!=='teacher'||!code||!busUser||!fb||teacherPresenceAttached)return;
    teacherPresenceAttached=true;
    const ref=listenerRef(code,busUser.uid);
    try{
      await fb.set(ref,{id:busUser.uid,name:teacherDisplayName||'Classroom',connected:true,joinedAt:Date.now(),lastSeen:Date.now()});
      if(presenceDisconnect){try{await presenceDisconnect.cancel()}catch{}}
      presenceDisconnect=fb.onDisconnect(ref);
      await presenceDisconnect.remove();
    }catch(error){
      teacherPresenceAttached=false;
      if(presenceDisconnect){try{await presenceDisconnect.cancel()}catch{}presenceDisconnect=null}
      throw error;
    }
  }
  async function pruneExpiredHistory(){
    if(historyPruneBusy||role!=='caller'||!code||!room?.history)return;
    const cutoff=Date.now()-HISTORY_RETENTION_MS,updates={};
    Object.entries(room.history).forEach(([key,item])=>{const calledAt=Number(item?.calledAt)||0;if(calledAt&&calledAt<=cutoff)updates[`history/${key}`]=null});
    if(!Object.keys(updates).length)return;
    historyPruneBusy=true;try{await fb.update(roomRef(code),updates)}catch{}finally{historyPruneBusy=false}
  }
  async function writeCallerHeartbeat(){
    if(role!=='caller'||!code||!busUser||!fb)return;
    await fb.update(roomRef(code),{callerHeartbeatAt:fb.serverTimestamp(),callerDisconnectedAt:null,sessionExpiresAt:Date.now()+SESSION_IDLE_MS,callerLastActiveAt:fb.serverTimestamp()});
    await pruneExpiredHistory();
  }
  async function startCallerLiveness(){
    clearCallerHeartbeat();
    if(callerDisconnect){try{await callerDisconnect.cancel()}catch{}callerDisconnect=null}
    if(role!=='caller'||!code||!busUser||!fb)return;
    const disconnectRef=fb.ref(busDb,`quizRooms/${roomKey(code)}/callerDisconnectedAt`);
    callerDisconnect=fb.onDisconnect(disconnectRef);
    try{await callerDisconnect.set(fb.serverTimestamp())}catch{}
    await writeCallerHeartbeat();
    callerHeartbeatTimer=setInterval(()=>{writeCallerHeartbeat().catch(()=>{})},CALLER_HEARTBEAT_MS);
  }
  async function stopCallerLiveness({markDisconnected=false}={}){
    clearCallerHeartbeat();clearSessionExpiryTimer();
    if(callerDisconnect){try{await callerDisconnect.cancel()}catch{}callerDisconnect=null}
    if(markDisconnected&&role==='caller'&&code&&busUser&&fb){try{await fb.update(roomRef(code),{callerDisconnectedAt:fb.serverTimestamp(),sessionExpiresAt:Date.now()+SESSION_IDLE_MS,callerLastActiveAt:fb.serverTimestamp()})}catch{}}
  }
  function renderTeacherWaiting(detail='The caller has not started the dismissal room yet. Keep this screen open and it will connect automatically when the caller comes online.'){
    clearSessionExpiryTimer();popup.hidden=true;renderActiveCallBoard({});
    const label=q('#busBoardLabel');if(label)label.textContent='WAITING FOR CALLER';
    const waiting=q('.bus-classroom-waiting');if(waiting)waiting.classList.remove('has-active-calls');
    q('#busTeacherConnectionText').textContent='Waiting for caller';setConnection('Waiting for caller');
    q('#busWaitingTitle').textContent='Waiting for the caller…';q('#busWaitingDetail').textContent=detail;
  }
  function expireSessionUi(){
    clearSessionExpiryTimer();
    if(role==='teacher'){
      stopPresence(true).catch(()=>{});
      renderTeacherWaiting('The previous live session ended after the caller was offline for an hour. You can stay here — this screen will reconnect automatically when the caller starts today’s dismissal.');
    }else if(role==='caller'){
      popup.hidden=true;renderActiveCallBoard({});const endedLabel=q('#busBoardLabel');if(endedLabel)endedLabel.textContent='SESSION ENDED';setConnection('Session ended');
      clearCallerHeartbeat();
      setError('This caller session expired after one hour without an active caller connection. Reopen the room to start a fresh session.');
      stopWatch();
    }
  }
  function scheduleSessionExpiry(value){
    clearSessionExpiryTimer();const deadline=sessionDeadline(value);if(!deadline)return false;
    const remaining=deadline-Date.now();
    if(remaining<=0){expireSessionUi();return true}
    sessionExpiryTimer=setTimeout(()=>{if(room&&sessionExpired(room))expireSessionUi()},Math.min(remaining+100,2147483000));
    return false;
  }
  function resetUi(){if(fullscreenActive)exitBusFullscreen();clearCallerHeartbeat();clearSessionExpiryTimer();if(callerDisconnect){try{callerDisconnect.cancel().catch(()=>{})}catch{}callerDisconnect=null}setup.hidden=false;callerConsole.hidden=true;teacherConsole.hidden=true;popup.hidden=true;const activeAddOns=q('#busActiveAddOns');if(activeAddOns)activeAddOns.hidden=true;const addOnPanel=q('#busAddOnPanel');if(addOnPanel)addOnPanel.hidden=true;const addOnToggle=q('#toggleBusAddOn');if(addOnToggle){addOnToggle.setAttribute('aria-expanded','false');addOnToggle.textContent='＋ Add-On Buses'}role='';code='';room=null;teacherDisplayName='';teacherPresenceAttached=false;lastCallId='';lastCombinedCallId='';lastAllClearId='';dismissedAllClearId='';seenAddOnIds=new Set();setConnection('Not connected');setError('');updateRoleTabs()}
  function renderHistory(history={}){
    const list=q('#busCallHistory');
    const cutoff=Date.now()-HISTORY_RETENTION_MS;
    const items=Object.values(history||{}).filter(item=>item&&(!Number(item.calledAt)||Number(item.calledAt)>cutoff)).sort((a,b)=>(b.calledAt||0)-(a.calledAt||0)).slice(0,20);
    list.innerHTML='';
    if(!items.length){const p=document.createElement('p');p.textContent='No buses called yet.';list.append(p);return}
    items.forEach(item=>{
      const row=document.createElement('div');row.className='bus-history-row';
      const bus=document.createElement('b');
      const combinedNumbers=Array.isArray(item.numbers)?item.numbers.filter(Boolean):[];
      if(item.isCombined)bus.textContent=`ALL: ${combinedNumbers.join(' + ')||item.number||'—'}`;
      else if(item.isAddOnBatch||item.isMainBatch)bus.textContent=combinedNumbers.join(' + ')||item.number||'—';
      else bus.textContent=item.number||'—';
      const detail=document.createElement('span');detail.className='bus-history-detail';
      if(item.isCombined){const together=document.createElement('strong');together.className='bus-history-addon bus-history-combined';together.textContent='ALL TOGETHER';detail.append(together)}
      if(item.isAddOn){const addOn=document.createElement('strong');addOn.className='bus-history-addon';addOn.textContent=item.isAddOnBatch?'ADD-ON GROUP':'ADD-ON';detail.append(addOn)}
      callStagesFor(item).forEach(stageName=>{const stage=document.createElement('strong');stage.className=`bus-history-stage ${callStageClass(stageName)}`;stage.textContent=callStageLabel(stageName);detail.append(stage)});
      if(item.note){const note=document.createElement('em');note.textContent=item.note;detail.append(note)}
      const time=document.createElement('time');time.textContent=formatTime(item.calledAt);
      row.append(bus,detail,time);list.append(row)
    })
  }
  function activeAddOnCalls(value){
    return Object.values(value?.addOnCalls||{}).filter(Boolean).sort((a,b)=>(a.calledAt||0)-(b.calledAt||0));
  }
  function activeRegularCalls(value){
    const call=value?.currentCall;
    if(!call)return [];
    const numbers=Array.isArray(call.numbers)&&call.numbers.length?call.numbers:[call.number];
    return numbers.map((number,index)=>({...call,id:`${call.id||'main'}-main-${index}`,number:cleanText(number,18),isAddOn:false,isMain:true})).filter(item=>item.number);
  }
  function allActiveCalls(value){
    const all=[...activeRegularCalls(value),...activeAddOnCalls(value)];
    const seen=new Set();
    return all.filter(item=>{const key=cleanText(item.number,18).toUpperCase();if(!key||seen.has(key))return false;seen.add(key);return true});
  }
  function fitCardNumbers(root){
    if(!root)return;
    requestAnimationFrame(()=>{
      root.querySelectorAll('.bus-display-call-card>strong,.bus-popup-call-tile>strong').forEach(number=>{
        const card=number.parentElement,rect=card.getBoundingClientRect(),text=String(number.textContent||'—');
        if(!rect.width||!rect.height)return;
        const chars=Math.max(2.4,text.length),byWidth=(rect.width-20)/(chars*.58),byHeight=(rect.height-34)*.56;
        const size=Math.max(22,Math.min(byWidth,byHeight,360));
        number.style.setProperty('font-size',`${size}px`,'important');
      });
    });
  }
  function stageKey(stages){return normalizeStageList(stages).join(',')}
  function stageFlashClass(stages){
    const normalized=normalizeStageList(stages);
    return normalized.includes('last')?'last':normalized.includes('second')?'second':'first';
  }
  function makeDisplayCallCard(call,{popupTile=false,mainStages=[]}={}){
    const card=document.createElement('div');card.className=popupTile?'bus-popup-call-tile':'bus-display-call-card';
    card.classList.add(call?.isAddOn?'addon':'regular');
    const callStages=callStagesFor(call),differentFromMain=Boolean(call?.isAddOn&&mainStages.length&&stageKey(callStages)!==stageKey(mainStages));
    if(differentFromMain)card.classList.add('addon-stage-different');
    const label=document.createElement('span');label.className='bus-call-tile-label';label.textContent=`${callStagesLabel(call).toUpperCase()} • ${call?.isAddOn?'ADD-ON BUS':'MAIN BUS'}`;
    if(differentFromMain)label.classList.add('bus-tile-stage-flash',stageFlashClass(callStages));
    const number=document.createElement('strong');number.textContent=cleanText(call?.number,18)||'—';number.style.setProperty('--bus-digits',Math.max(3,number.textContent.length));
    const note=document.createElement('p');note.textContent=cleanText(call?.note,80);note.hidden=!note.textContent;
    card.append(label,number,note);return card;
  }
  function bestGridShape(count,width,height){
    let best={cols:1,rows:Math.max(1,count),score:0};
    for(let cols=1;cols<=Math.max(1,count);cols++){
      const rows=Math.ceil(count/cols),cellW=width/cols,cellH=height/rows;
      const score=Math.min(cellW,cellH*1.65);
      if(score>best.score)best={cols,rows,score};
    }
    return best;
  }
  function fitBoardGrid(count){
    const grid=q('#busActiveCallGrid');if(!grid||count<1)return;
    const width=Math.max(320,grid.clientWidth||window.innerWidth-48),height=Math.max(260,(fullscreenActive?window.innerHeight-230:Math.min(window.innerHeight*.68,720)));
    const shape=bestGridShape(count,width,height);
    grid.style.setProperty('--board-cols',shape.cols);grid.style.setProperty('--board-rows',shape.rows);
  }
  function renderActiveCallBoard(value){
    const grid=q('#busActiveCallGrid');if(!grid)return;
    const calls=allActiveCalls(value);grid.innerHTML='';
    if(!calls.length){
      grid.dataset.count='1';
      const card=document.createElement('div');card.className='bus-board-current bus-display-call-card regular';card.id='busRegularCallCard';
      const label=document.createElement('span');label.id='busBoardLabel';label.textContent='WAITING FOR THE NEXT BUS';
      const number=document.createElement('strong');number.id='busBoardNumber';number.textContent='—';
      const note=document.createElement('p');note.id='busBoardNote';note.className='bus-display-call-note';note.hidden=true;
      card.append(label,number,note);grid.append(card);fitBoardGrid(1);fitCardNumbers(grid);return;
    }
    grid.dataset.count=String(Math.min(calls.length,36));
    const mainStages=value?.currentCall?callStagesFor(value.currentCall):[];
    calls.forEach(call=>grid.append(makeDisplayCallCard(call,{mainStages})));fitBoardGrid(calls.length);fitCardNumbers(grid);
  }
  function fitPopupGrid(count){
    if(!popupGrid||count<1)return;
    const width=Math.max(320,popupGrid.clientWidth||window.innerWidth-24),height=Math.max(180,popupGrid.clientHeight||window.innerHeight-170),shape=bestGridShape(count,width,height);
    popupGrid.style.setProperty('--popup-cols',shape.cols);popupGrid.style.setProperty('--popup-rows',shape.rows);
    popupGrid.dataset.count=String(count);
  }
  function showActivePopup(value,{heading='🚌 ACTIVE BUS CALLS',timeLabel='Called just now',test=false}={}){
    if(!popupGrid)return;
    popup.classList.remove('all-clear');popup.dataset.allClearId='';
    const calls=allActiveCalls(value);if(!calls.length)return;
    const headingEl=q('#busPopupHeading');if(headingEl)headingEl.textContent=heading;
    const newest=calls.reduce((latest,item)=>Number(item.calledAt||0)>Number(latest?.calledAt||0)?item:latest,calls[0]);
    const mainCall=value?.currentCall||null,bannerCall=mainCall||newest,mainStages=mainCall?callStagesFor(mainCall):[];
    const bannerStages=callStagesFor(bannerCall),flashClass=stageFlashClass(bannerStages);
    popupStage.textContent=callStagesLabel(bannerCall).toUpperCase();
    popupStage.className=`bus-popup-stage bus-stage-flash ${flashClass}`;
    popupTime.textContent=test?'Test alert':timeLabel;
    renderPopupSchoolBusRoster(value);
    popupGrid.innerHTML='';calls.forEach(call=>popupGrid.append(makeDisplayCallCard(call,{popupTile:true,mainStages})));
    popup.hidden=false;
    requestAnimationFrame(()=>{fitPopupGrid(calls.length);fitCardNumbers(popupGrid)});
    if(!test)beep();
  }
  function showAllClearPopup(event,value=room){
    if(!popupGrid||!event)return;
    popup.classList.add('all-clear');popup.dataset.allClearId=String(event.id||'');dismissedAllClearId='';
    const heading=q('#busPopupHeading');if(heading)heading.textContent='✅ DISMISSAL ALL CLEAR';
    popupStage.textContent='ALL CLEAR';popupStage.className='bus-popup-stage bus-all-clear-stage';
    popupTime.textContent=`Sent at ${formatTime(event.calledAt)}`;
    const rosterPanel=q('#busPopupRoster');if(rosterPanel)rosterPanel.hidden=true;
    popupGrid.innerHTML='';
    const display=document.createElement('div');display.className='bus-all-clear-display';
    const title=document.createElement('strong');title.textContent='ALL CLEAR';
    const detail=document.createElement('span');detail.textContent='Dismissal is complete.';
    display.append(title,detail);
    const incomplete=valuesArray(event.missingLastCalls).map(item=>cleanText(item,18)).filter(Boolean);
    if(incomplete.length){const note=document.createElement('p');note.textContent=`Sent with ${incomplete.length} bus${incomplete.length===1?'':'es'} not yet recorded for Last Call: ${incomplete.join(', ')}`;display.append(note)}
    popupGrid.append(display);popup.hidden=false;
    requestAnimationFrame(()=>fitCardNumbers(popupGrid));
    beep();
  }
  function renderActiveAddOns(value){
    const wrap=q('#busActiveAddOns'),list=q('#busActiveAddOnList');
    if(!wrap||!list)return;
    const items=activeAddOnCalls(value);
    wrap.hidden=!items.length;list.innerHTML='';
    items.forEach(item=>{
      const row=document.createElement('div');row.className='bus-active-addon-row bus-display-call-card';
      const label=document.createElement('span');label.className='bus-active-addon-label';label.textContent=`${callStagesLabel(item).toUpperCase()} • ADD-ON BUS`;
      const number=document.createElement('strong');number.textContent=cleanText(item.number,18)||'—';number.style.setProperty('--bus-digits',Math.max(3,number.textContent.length));
      const meta=document.createElement('p');meta.className='bus-active-addon-meta';
      const note=cleanText(item.note,80);meta.textContent=note;meta.hidden=!note;
      row.append(label,number,meta);list.append(row);
    });
  }
  function renderCallerBusTools(value){
    const addOns=activeAddOnCalls(value),regulars=activeRegularCalls(value);
    const addOnSummary=q('#busCallerAddOnSummary'),addOnSummaryText=q('#busCallerAddOnSummaryText');
    if(addOnSummary&&addOnSummaryText){
      addOnSummary.hidden=!addOns.length;
      addOnSummaryText.textContent=addOns.length?addOns.map(item=>`Bus ${cleanText(item.number,18)||'—'}`).join(' • '):'—';
    }
    const bulk=q('#busBulkCallPanel'),bulkSummary=q('#busBulkCallSummary');
    const canBulk=regulars.length>0&&addOns.length>0;
    if(bulk)bulk.hidden=!canBulk;
    if(bulkSummary&&canBulk){
      const all=allActiveCalls(value);
      bulkSummary.textContent=`${all.length} active buses: ${all.map(item=>cleanText(item.number,18)||'—').join(' • ')}`;
    }
  }
  function renderCaller(value){
    const activeAt=lastCallerActivity(value);
    q('#busCodeReservation').textContent=activeAt?`Code reserved until ${new Date(activeAt+RESERVATION_MS).toLocaleDateString()}. Using caller controls renews it for 30 days.`:'This code is reserved for its caller.';
    const listeners=Object.values(value.players||{}).filter(item=>item?.connected!==false);
    q('#busListenerCount').textContent=`${listeners.length} classroom${listeners.length===1?'':'s'} online`;
    renderHistory(value.history);renderCallerBusTools(value);renderSchoolBusRoster(value);
    const addOns=activeAddOnCalls(value),suffix=addOns.length?` • ${addOns.length} add-on bus${addOns.length===1?'':'es'} also active.`:'';
    if(value.combinedCall){
      const combined=value.combinedCall,numbers=Array.isArray(combined.numbers)?combined.numbers.filter(Boolean):[];
      q('#busCallerStatus').textContent=`${callStagesLabel(combined)} sent together for ${numbers.length||allActiveCalls(value).length} active buses at ${formatTime(combined.calledAt)}.`
    }else if(value.currentCall){
      const current=value.currentCall;
      const regularNumbers=activeRegularCalls(value).map(item=>item.number);q('#busCallerStatus').textContent=`${callStagesLabel(current)} for ${regularNumbers.length>1?'Buses':'Bus'} ${regularNumbers.join(', ')} was sent at ${formatTime(current.calledAt)}.${suffix}`
    }else if(value.allClear){
      q('#busCallerStatus').textContent=`ALL CLEAR was sent at ${formatTime(value.allClear.calledAt)}.`
    }else q('#busCallerStatus').textContent=addOns.length?`${addOns.length} add-on bus${addOns.length===1?' is':'es are'} active. Ready for a regular bus call.`:'Ready to call a bus.'
  }
  function beep(){if(!q('#busSoundEnabled').checked)return;try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const now=audioContext.currentTime;[0,.18].forEach((delay,index)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=index?880:660;gain.gain.setValueAtTime(.0001,now+delay);gain.gain.exponentialRampToValueAtTime(.18,now+delay+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.16);osc.connect(gain).connect(audioContext.destination);osc.start(now+delay);osc.stop(now+delay+.18)})}catch{}}
  function showPopup(call,{test=false,value=room}={}){
    const data=value||{currentCall:call};
    showActivePopup(data,{heading:call?.isAddOn?'🚌 ADD-ON BUS — ALL ACTIVE BUSES':'🚌 BUS CALL — ALL ACTIVE BUSES',timeLabel:test?'Test alert':`${callStagesLabel(call)} • Called at ${formatTime(call?.calledAt)}`,test});
  }
  function showAddOnBatchPopup(calls,value=room){
    const items=Array.isArray(calls)?calls.filter(Boolean):[];if(!items.length)return;
    showActivePopup(value||room,{heading:'🚌 ADD-ON BUSES — ALL ACTIVE BUSES',timeLabel:`${callStagesLabel(items[0])} • Called at ${formatTime(items[0]?.calledAt)}`});
  }
  function showCombinedPopup(call,value=room){
    if(!call)return;
    showActivePopup(value||room,{heading:'🚌 ALL ACTIVE BUSES',timeLabel:`${callStagesLabel(call)} • Called at ${formatTime(call.calledAt)}`});
  }
  function renderTeacher(value){
    renderTeacherSchoolBusRoster(value);renderPopupSchoolBusRoster(value);
    const regular=value.currentCall||null,regulars=activeRegularCalls(value),addOns=activeAddOnCalls(value),active=allActiveCalls(value);
    const hasActive=active.length>0,waiting=q('.bus-classroom-waiting');
    if(waiting)waiting.classList.toggle('has-active-calls',hasActive);
    renderActiveCallBoard(value);
    q('#busTeacherConnectionText').textContent='Connected';

    const unseenAddOns=addOns.filter(call=>!seenAddOnIds.has(String(call.id)));
    addOns.forEach(call=>seenAddOnIds.add(String(call.id)));
    const regularIsNew=regular&&String(regular.id)!==lastCallId;
    if(regularIsNew)lastCallId=String(regular.id);
    const combined=value.combinedCall||null,combinedIsNew=combined&&String(combined.id)!==lastCombinedCallId;
    if(combinedIsNew)lastCombinedCallId=String(combined.id);
    const allClear=value.allClear||null,allClearIsNew=allClear&&String(allClear.id)!==lastAllClearId;
    if(allClearIsNew)lastAllClearId=String(allClear.id);

    if(allClearIsNew){
      showAllClearPopup(allClear,value);
    }else if(combinedIsNew){
      showCombinedPopup(combined,value);
    }else if(unseenAddOns.length>1){
      showAddOnBatchPopup(unseenAddOns,value);
    }else if(unseenAddOns.length===1){
      showPopup(unseenAddOns[0],{value});
    }else if(regularIsNew){
      showPopup(regular,{value});
    }

    if(regulars.length){
      q('#busWaitingTitle').textContent=`${callStagesLabel(regular)}: ${regulars.length>1?'Buses':'Bus'} ${regulars.map(item=>item.number).join(', ')}`;
      q('#busWaitingDetail').textContent=`Main bus call sent at ${formatTime(regular.calledAt)}${regular.note?` • ${regular.note}`:''}${addOns.length?` • ${addOns.length} add-on bus${addOns.length===1?'':'es'} also active.`:''}`;
    }else if(addOns.length){
      q('#busWaitingTitle').textContent=`${addOns.length} add-on bus${addOns.length===1?'':'es'} active`;
      q('#busWaitingDetail').textContent='The main bus call is clear. Add-on buses remain active.';
    }else if(value.allClear){
      if(dismissedAllClearId===String(value.allClear.id||''))popup.hidden=true;
      q('#busWaitingTitle').textContent='ALL CLEAR';
      q('#busWaitingDetail').textContent=`Dismissal all clear was sent at ${formatTime(value.allClear.calledAt)}.`;
    }else{
      popup.hidden=true;
      q('#busWaitingTitle').textContent='Waiting for the next bus';
      q('#busWaitingDetail').textContent='A full-screen alert will appear with every active bus when the caller sends a bus number.';
    }
  }
  function watchRoom(){
    stopWatch();
    unsubscribe=fb.onValue(roomRef(code),snap=>{
      if(!snap.exists()){
        room=null;
        if(role==='teacher'){
          stopPresence(false).catch(()=>{});setError('');renderTeacherSchoolBusRoster({});
          renderTeacherWaiting('This room is not live yet. Keep this screen open and it will connect automatically as soon as the caller starts this room.');
          return;
        }
        setError('This Bus Call room was closed or no longer exists.');setConnection('Room closed','problem');renderActiveCallBoard({});const closedLabel=q('#busBoardLabel');if(closedLabel)closedLabel.textContent='ROOM CLOSED';stopWatch();popup.hidden=true;return;
      }
      room=snap.val()||{};
      if(role==='teacher')renderTeacherSchoolBusRoster(room);
      if(role==='caller'&&room.hostUid!==busUser.uid){stopWatch();resetUi();setError('This code now belongs to another caller. Choose a different code.');return}
      const inactive=room.status==='closed'||(room.expiresAt&&room.expiresAt<Date.now())||sessionExpired(room);
      if(inactive&&role==='teacher'){
        stopPresence(true).catch(()=>{});setError('');
        renderTeacherWaiting(room.status==='closed'?'The caller has not started today’s dismissal yet. Keep this screen open and it will reconnect automatically when the caller reopens the room.':'The previous live session is no longer active. Keep this screen open and it will reconnect automatically when the caller starts today’s dismissal.');
        return;
      }
      if(room.status==='closed'){popup.hidden=true;renderActiveCallBoard({});const closedLabel=q('#busBoardLabel');if(closedLabel)closedLabel.textContent='ROOM CLOSED';setConnection('Room closed');return}
      if(room.expiresAt&&room.expiresAt<Date.now()){setError('This Bus Call room has expired. Start or join a new room.');setConnection('Room expired','problem');popup.hidden=true;renderActiveCallBoard({});const expiredLabel=q('#busBoardLabel');if(expiredLabel)expiredLabel.textContent='ROOM EXPIRED';return}
      if(sessionExpired(room)){expireSessionUi();return}
      scheduleSessionExpiry(room);setConnection(role==='caller'?'Caller online':'Listening','online');
      if(role==='caller')renderCaller(room);else{ensureTeacherPresence().catch(error=>setError(friendlyError(error)));renderTeacher(room)}
    },err=>{setConnection('Connection problem','problem');setError(err?.message||'Could not stay connected to the Bus Call room.')})
  }
  async function ensureFirebase(){setConnection('Connecting…');await initRaceFirebase();busDb=db;busUser=currentUser;setConnection('Connected','online')}
  async function callerIdentity(roomCode,pin,canCreate,accountKey=roomCode.toLowerCase()){
    if(!callerAuth){
      const [{firebaseConfig},appMod]=await Promise.all([import('./firebase-config.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js')]);
      const app=appMod.getApps().find(app=>app.name==='bus-caller-pin')||appMod.initializeApp(firebaseConfig,'bus-caller-pin');
      callerAuth=fb.getAuth(app);callerDatabase=fb.getDatabase(app);
      await fb.setPersistence(callerAuth,fb.inMemoryPersistence);
    }
    const email=`bus-${accountKey}@bus-caller.invalid`;
    try{return (await fb.signInWithEmailAndPassword(callerAuth,email,pin)).user}
    catch(error){
      if(!['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].includes(error.code))throw error;
      if(!canCreate)throw new Error('Incorrect caller PIN, or this older room has no PIN yet. Use the original caller browser to set one, or ask your Firebase administrator to reset the room.');
      try{return (await fb.createUserWithEmailAndPassword(callerAuth,email,pin)).user}
      catch(createError){if(createError.code==='auth/email-already-in-use')throw new Error('This room code already has a caller PIN. Enter its original PIN, or choose a different room code.');throw createError}
    }
  }
  async function googleCallerIdentity(){
    if(!googleCallerAuth){
      const [{firebaseConfig},appMod]=await Promise.all([import('./firebase-config.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js')]);
      const app=appMod.getApps().find(app=>app.name==='bus-caller-google')||appMod.initializeApp(firebaseConfig,'bus-caller-google');
      googleCallerAuth=fb.getAuth(app);googleCallerDatabase=fb.getDatabase(app);
      await fb.setPersistence(googleCallerAuth,fb.inMemoryPersistence);
    }
    const provider=new fb.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    return (await fb.signInWithPopup(googleCallerAuth,provider)).user;
  }
  function callerAccountUi(){
    const google=busUser?.providerData?.some(provider=>provider.providerId==='google.com');
    q('#busCallerAccount').textContent=google?`Google account: ${busUser.email||busUser.displayName||'Connected'} — no PIN needed.`:'Caller PIN access';
    q('#connectBusGoogle').hidden=!!google;
  }
  function callerAuthError(error,method='pin'){
    if(error.code==='auth/popup-closed-by-user'||error.code==='auth/cancelled-popup-request')return 'Google sign-in was canceled. Your room has not changed.';
    if(error.code==='auth/popup-blocked')return 'Allow popups for this site, then try Google sign-in again.';
    if(error.code==='auth/unauthorized-domain')return 'This website address must be added to Firebase Authentication → Settings → Authorized domains before Google sign-in can work.';
    if(['auth/operation-not-allowed','auth/admin-restricted-operation'].includes(error.code))return `Enable ${method==='google'?'Google':'Email/Password'} in Firebase Authentication → Sign-in method.`;
    if(error.code==='auth/too-many-requests')return 'Too many sign-in attempts. Please wait before trying again.';
    return friendlyError(error);
  }
  async function connectCallerGoogle(){
    if(role!=='caller'||!code)return;
    const button=q('#connectBusGoogle');if(button.disabled)return;button.disabled=true;setError('');
    try{
      const user=await googleCallerIdentity();
      // Only the authenticated current room owner can transfer this room.
      await stopCallerLiveness();stopWatch();
      await fb.update(roomRef(code),{hostUid:user.uid,pinAccountKey:null,callerLastActiveAt:fb.serverTimestamp(),callerHeartbeatAt:fb.serverTimestamp(),callerDisconnectedAt:null,sessionExpiresAt:Date.now()+SESSION_IDLE_MS});
      stopWatch();busDb=googleCallerDatabase;busUser=user;
      callerAccountUi();await startCallerLiveness();watchRoom();
    }catch(error){if(role==='caller'&&code)watchRoom();setError(callerAuthError(error,'google'))}
    finally{button.disabled=false}
  }
  async function createCallerRoom(method='pin'){
    const buttons=[q('#startBusCaller'),q('#startBusGoogle')];
    if(buttons.some(button=>button.disabled))return;
    setError('');
    const pin=q('#busCallerPinInput').value;
    if(method==='pin'&&!/^\d{8,12}$/.test(pin)){setError('Enter a caller PIN with 8–12 digits.');q('#busCallerPinInput').focus();return}
    buttons.forEach(button=>button.disabled=true);
    try{
      await ensureFirebase();
      const saved=getSavedCallerCode();
      const selected=(!callerCodeEditing&&saved)?saved:(normalizeCode(q('#busCallerCodeInput').value)||randomCode());
      q('#busCallerCodeInput').value=selected;
      const originalDb=busDb,originalUser=busUser;
      const existing=(await fb.get(roomRef(selected))).val();
      const released=existing&&reservationExpired(existing);
      const accountKey=method==='pin'?((!existing||released)?`${selected.toLowerCase()}-${crypto.randomUUID().replaceAll('-','')}`:(existing.pinAccountKey||selected.toLowerCase())):null;
      const user=method==='google'?await googleCallerIdentity():await callerIdentity(selected,pin,!existing||released||existing.hostUid===originalUser.uid,accountKey);
      if(existing&&existing.hostUid!==user.uid&&!released){
        if(existing.hostUid!==originalUser.uid)throw new Error(reservedMessage);
        await fb.update(fb.ref(originalDb,`quizRooms/${roomKey(selected)}`),{hostUid:user.uid,callerLastActiveAt:fb.serverTimestamp()});
      }
      busDb=method==='google'?googleCallerDatabase:callerDatabase;busUser=user;
      // Re-check the latest reservation inside the transaction, including after a competing renewal.
      const result=await fb.runTransaction(roomRef(selected),value=>{
        if(value&&value.hostUid!==user.uid&&!reservationExpired(value))return;
        const active=value&&value.hostUid===user.uid&&value.status!=='closed'&&(!value.expiresAt||value.expiresAt>Date.now())&&!sessionExpired(value);
        const preservedRoster=value&&value.hostUid===user.uid?schoolBusRosterNumbers(value):[];
        const next=active?{...value}:{hostUid:user.uid,status:'open',createdAt:fb.serverTimestamp(),expiresAt:Date.now()+ROOM_MS,...(preservedRoster.length?{schoolBusRoster:preservedRoster}:{})};
        next.callerLastActiveAt=fb.serverTimestamp();next.callerHeartbeatAt=fb.serverTimestamp();next.callerDisconnectedAt=null;next.sessionExpiresAt=Date.now()+SESSION_IDLE_MS;
        if(accountKey)next.pinAccountKey=accountKey;else delete next.pinAccountKey;
        return next;
      },{applyLocally:false});
      if(!result.committed)throw new Error(reservedMessage);
      role='caller';selectRole('caller');updateRoleTabs();code=selected;
      setup.hidden=true;callerConsole.hidden=false;teacherConsole.hidden=true;
      q('#busCallerRoomCode').textContent=code;q('#busCallerPinInput').value='';
      saveCallerCode(code);callerCodeEditing=false;updateCallerResumeUi();
      resetCallerCallControls({main:true,addOn:true});callerAccountUi();await startCallerLiveness();watchRoom();q('#busNumberInput').focus();
    }catch(error){
      setConnection('Could not connect','problem');
      setError(callerAuthError(error,method));
    }finally{buttons.forEach(button=>button.disabled=false)}
  }
  async function joinTeacherRoom(){
    setError('');const requested=normalizeCode(q('#busTeacherCodeInput').value),name=cleanText(q('#busTeacherNameInput').value,32)||'Classroom';
    try{
      if(requested.length<4)throw new Error('Enter the shared Bus Call room code.');
      await ensureFirebase();
      role='teacher';selectRole('teacher');updateRoleTabs();code=requested;teacherDisplayName=name;teacherPresenceAttached=false;lastCallId='';lastCombinedCallId='';lastAllClearId='';dismissedAllClearId='';seenAddOnIds=new Set();
      setup.hidden=true;callerConsole.hidden=true;teacherConsole.hidden=false;q('#busTeacherRoomCode').textContent=code;q('#busTeacherCodeInput').value=code;saveTeacherPrefs();
      renderTeacherWaiting();watchRoom();
    }catch(error){setConnection('Could not join','problem');setError(friendlyError(error))}
  }
  function resetCallerCallControls({main=false,addOn=false}={}){
    if(main){
      q('#busNumberInput').value='';
      q('#busCallNoteInput').value='';
      setCallStage('first');
    }
    if(addOn){
      q('#busAddOnNumberInput').value='';
      q('#busAddOnNoteInput').value='';
      setAddOnStages(['first']);
    }
  }
  async function sendCall(){
    if(role!=='caller'||!code)return;
    const numbers=parseBusNumbers(q('#busNumberInput').value),note=cleanText(q('#busCallNoteInput').value,80),sentStage=selectedStage;
    if(!numbers.length){setError('Enter one or more main bus numbers. Separate multiple buses with spaces.');q('#busNumberInput').focus();return}
    if(numbers.length>12){setError('Enter up to 12 main buses at one time.');q('#busNumberInput').focus();return}
    if(!await confirmDuplicateSend(numbers,{kind:'Bus',stages:[sentStage]})){q('#busNumberInput').focus();return}
    setError('');const button=q('#sendBusCall');button.disabled=true;
    try{
      const id=`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,stamp=fb.serverTimestamp();
      const call={id,number:numbers[0],numbers,note,stage:sentStage,stages:[sentStage],isMainBatch:numbers.length>1,calledAt:stamp};
      const historyKey=fb.push(fb.ref(busDb,`quizRooms/${roomKey(code)}/history`)).key;
      const history={...call,number:numbers.join(' + ')};
      await fb.update(roomRef(code),{currentCall:call,combinedCall:null,allClear:null,[`history/${historyKey}`]:history,lastActivityAt:stamp,callerLastActiveAt:stamp});
      q('#busCallNoteInput').value='';if(sentStage==='first')setCallStage('second');else if(sentStage==='second')setCallStage('last');q('#busNumberInput').focus();q('#busNumberInput').select();
    }catch(error){setError(friendlyError(error))}finally{button.disabled=false}
  }
  function getAddOnStages(){
    const button=panel.querySelector('[data-bus-addon-preset].active');
    return normalizeStageList(button?.dataset.busAddonPreset?.split(',')||[])
  }
  function setAddOnStages(stages){
    const normalized=normalizeStageList(stages),key=normalized.join(',');
    let matched=false;
    panel.querySelectorAll('[data-bus-addon-preset]').forEach(button=>{
      const active=button.dataset.busAddonPreset===key;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
      if(active)matched=true
    });
    if(!matched&&key!=='first')return setAddOnStages(['first']);
    const send=q('#sendBusAddOn');if(send){const chosen=getAddOnStages();send.textContent=chosen.length?`Send Add-On • ${stageListLabel(chosen)}`:'Choose a call option'}
  }
  function selectAddOnPreset(preset){
    setError('');setAddOnStages(String(preset||'').split(','))
  }
  function setAddOnPanel(open){
    const addOn=q('#busAddOnPanel'),toggle=q('#toggleBusAddOn');if(!addOn||!toggle)return;
    addOn.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Hide Add-On Buses':'＋ Add-On Buses';
    if(open){setAddOnStages(getAddOnStages().length?getAddOnStages():['first']);setTimeout(()=>q('#busAddOnNumberInput')?.focus(),0)}
  }
  async function sendAddOnCall(){
    if(role!=='caller'||!code)return;
    const raw=q('#busAddOnNumberInput').value,numbers=parseBusNumbers(raw),note=cleanText(q('#busAddOnNoteInput').value,80),stages=getAddOnStages();
    if(!numbers.length){setError('Enter one or more add-on bus numbers. Separate multiple buses with spaces.');q('#busAddOnNumberInput').focus();return}
    if(numbers.length>12){setError('Enter up to 12 add-on buses at one time.');q('#busAddOnNumberInput').focus();return}
    if(!stages.length){setError('Select at least one call type for the add-on bus.');return}
    if(!await confirmDuplicateSend(numbers,{kind:'Add-On Bus',stages})){q('#busAddOnNumberInput').focus();return}
    setError('');const button=q('#sendBusAddOn');button.disabled=true;
    try{
      const stamp=fb.serverTimestamp(),updates={combinedCall:null,allClear:null,lastActivityAt:stamp,callerLastActiveAt:stamp};
      const existing=activeAddOnCalls(room),existingByNumber=new Map(existing.map(item=>[cleanText(item.number,18).toUpperCase(),item]));
      const created=[];
      numbers.forEach((number,index)=>{
        const previous=existingByNumber.get(number.toUpperCase());
        if(previous?.id)updates[`addOnCalls/${previous.id}`]=null;
        const id=`${Date.now()}-${index}-${Math.random().toString(36).slice(2,7)}`;
        const call={id,number,note,stage:stages[0],stages,isAddOn:true,calledAt:stamp};
        updates[`addOnCalls/${id}`]=call;created.push(call);
      });
      const historyKey=fb.push(fb.ref(busDb,`quizRooms/${roomKey(code)}/history`)).key;
      updates[`history/${historyKey}`]={id:`addon-batch-${Date.now()}`,number:numbers.join(' + '),numbers,note,stage:stages[0],stages,isAddOn:true,isAddOnBatch:numbers.length>1,calledAt:stamp};
      await fb.update(roomRef(code),updates);
      q('#busAddOnNoteInput').value='';q('#busAddOnNumberInput').focus();q('#busAddOnNumberInput').select();
      q('#busCallerStatus').textContent=numbers.length>1?`${numbers.length} add-on buses sent together: ${numbers.join(', ')}.`:`Add-on Bus ${numbers[0]} sent.`;
    }catch(error){setError(friendlyError(error))}finally{button.disabled=false}
  }
  function prepareNewAddOn(){
    setError('');setAddOnPanel(true);q('#busAddOnNumberInput').value='';q('#busAddOnNoteInput').value='';setAddOnStages(['first']);
    q('#busAddOnNumberInput').focus();
  }
  async function callAllActiveBuses(stage){
    if(role!=='caller'||!code)return;
    stage=callStageClass(stage);
    if(!['second','last'].includes(stage))return;
    const regular=room?.currentCall||null,addOns=activeAddOnCalls(room);
    if(!activeRegularCalls(room).length){setError('Call the main bus first before using an All Active Buses call.');return}
    if(!addOns.length){setError('Add at least one add-on bus before using an All Active Buses call.');return}
    const buttons=[q('#busCallAllSecond'),q('#busCallAllLast')];buttons.forEach(button=>button.disabled=true);setError('');
    try{
      const stamp=fb.serverTimestamp(),id=`all-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      const numbers=allActiveCalls(room).map(item=>cleanText(item.number,18)).filter(Boolean);
      const combined={id,number:numbers.join(' + '),numbers,stage,stages:[stage],isCombined:true,calledAt:stamp};
      const updates={currentCall:{...regular,stage,stages:[stage],calledAt:stamp},combinedCall:combined,allClear:null,lastActivityAt:stamp,callerLastActiveAt:stamp};
      addOns.forEach(item=>{updates[`addOnCalls/${item.id}`]={...item,stage,stages:[stage],calledAt:stamp}});
      const historyKey=fb.push(fb.ref(busDb,`quizRooms/${roomKey(code)}/history`)).key;updates[`history/${historyKey}`]=combined;
      await fb.update(roomRef(code),updates);
      if(stage==='second')setCallStage('last');
    }catch(error){setError(friendlyError(error))}finally{buttons.forEach(button=>button.disabled=false)}
  }
  async function clearCurrent(){
    if(role!=='caller'||!code)return;
    try{
      await fb.update(roomRef(code),{currentCall:null,combinedCall:null,lastActivityAt:fb.serverTimestamp(),callerLastActiveAt:fb.serverTimestamp()});
      resetCallerCallControls({main:true});
      q('#busCallerStatus').textContent=activeAddOnCalls(room).length?'Main buses cleared. Active add-on buses stay on. First Call is ready.':'Main buses cleared. First Call is ready.';
    }catch(error){setError(friendlyError(error))}
  }
  async function clearAddOns(){
    if(role!=='caller'||!code)return;
    const count=activeAddOnCalls(room).length;
    if(!count){resetCallerCallControls({addOn:true});q('#busCallerStatus').textContent='No active add-on buses to clear. Add-On is reset to First Call.';return}
    if(!await confirmBusAction(`Clear ${count} active add-on bus${count===1?'':'es'}? The regular bus call will stay on.`,{confirmLabel:'Clear Add-On Buses'}))return;
    try{
      await fb.update(roomRef(code),{addOnCalls:null,combinedCall:null,lastActivityAt:fb.serverTimestamp(),callerLastActiveAt:fb.serverTimestamp()});
      resetCallerCallControls({addOn:true});
      q('#busCallerStatus').textContent='Active add-on buses cleared. Regular buses stay on. Add-On is reset to First Call.';
    }catch(error){setError(friendlyError(error))}
  }
  async function clearAllBuses(){
    if(role!=='caller'||!code)return;
    const regular=room?.currentCall||null,addOns=activeAddOnCalls(room);
    if(!regular&&!addOns.length){resetCallerCallControls({main:true,addOn:true});q('#busCallerStatus').textContent='No active buses to clear. Call controls reset to First Call.';return}
    const count=allActiveCalls(room).length;
    if(!await confirmBusAction(`Clear all ${count} active bus${count===1?'':'es'} from classroom screens?`,{confirmLabel:'Clear All Buses'}))return;
    try{
      await fb.update(roomRef(code),{currentCall:null,addOnCalls:null,combinedCall:null,lastActivityAt:fb.serverTimestamp(),callerLastActiveAt:fb.serverTimestamp()});
      resetCallerCallControls({main:true,addOn:true});
      q('#busCallerStatus').textContent='All active buses cleared. Main and Add-On controls reset to First Call.';
      q('#busNumberInput').focus();
    }catch(error){setError(friendlyError(error))}
  }
  async function sendAllClear(){
    if(role!=='caller'||!code)return;
    let latest=room;
    try{latest=(await fb.get(roomRef(code))).val()||room}catch{}
    const check=busesMissingLastCall(latest);
    if(!check.verified){
      const ok=await confirmBusAction('The School Bus Lineup is not set, so Bus Call cannot verify that every school bus received Last Call. Send ALL CLEAR anyway?',{confirmLabel:'Send All Clear Anyway',danger:true,title:'Cannot verify Last Calls',icon:'⚠️',large:true});
      if(!ok)return;
    }else if(check.missing.length){
      const preview=check.missing.slice(0,30).join(', '),more=check.missing.length>30?` + ${check.missing.length-30} more`:'';
      const ok=await confirmBusAction(`${check.missing.length} bus${check.missing.length===1?' has':'es have'} not yet been recorded for Last Call: ${preview}${more}. Send ALL CLEAR anyway?`,{confirmLabel:'Send All Clear Anyway',danger:true,title:'Some buses still need Last Call',icon:'⚠️',large:true});
      if(!ok)return;
    }
    const button=q('#sendBusAllClear');if(button)button.disabled=true;setError('');
    try{
      const id=`all-clear-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,stamp=fb.serverTimestamp();
      const event={id,calledAt:stamp,missingLastCalls:check.missing||[],verifiedAgainstRoster:check.verified};
      await fb.update(roomRef(code),{allClear:event,currentCall:null,addOnCalls:null,combinedCall:null,lastActivityAt:stamp,callerLastActiveAt:stamp});
      lastAllClearId=id;resetCallerCallControls({main:true,addOn:true});setAddOnPanel(false);
      showAllClearPopup({...event,calledAt:Date.now()},room);
      q('#busCallerStatus').textContent='ALL CLEAR sent to every connected classroom.';
    }catch(error){setError(friendlyError(error))}finally{if(button)button.disabled=false}
  }
  async function saveSchoolBusRoster(){
    if(role!=='caller'||!code)return;
    const input=q('#busSchoolRosterInput'),numbers=parseBusNumbers(input?.value||'');
    if(!numbers.length){setError('Enter at least one school bus number. Separate buses with spaces.');input?.focus();return}
    if(numbers.length>150){setError('Enter up to 150 school buses in the lineup.');input?.focus();return}
    const button=q('#saveBusSchoolRoster');button.disabled=true;setError('');
    try{
      await fb.update(roomRef(code),{schoolBusRoster:numbers,callerLastActiveAt:fb.serverTimestamp(),lastActivityAt:fb.serverTimestamp()});
      q('#busCallerStatus').textContent=`School bus lineup saved: ${numbers.length} bus${numbers.length===1?'':'es'}.`;
    }catch(error){setError(friendlyError(error))}finally{button.disabled=false}
  }
  async function clearSchoolBusRoster(){
    if(role!=='caller'||!code)return;
    const roster=schoolBusRosterNumbers(room);
    if(!roster.length){q('#busSchoolRosterInput').value='';renderSchoolBusRoster(room);return}
    if(!await confirmBusAction('Clear the saved school bus lineup? This does not clear active buses or Recent Calls.',{confirmLabel:'Clear Bus List'}))return;
    try{await fb.update(roomRef(code),{schoolBusRoster:null,callerLastActiveAt:fb.serverTimestamp(),lastActivityAt:fb.serverTimestamp()});q('#busCallerStatus').textContent='School bus lineup cleared.'}catch(error){setError(friendlyError(error))}
  }
  async function clearHistory(){if(role!=='caller'||!code)return;if(!await confirmBusAction('Clear the recent Bus Call history for this room? The school bus tracker will reset every saved bus to not called yet.',{confirmLabel:'Clear History'}))return;try{await fb.update(roomRef(code),{history:null,callerLastActiveAt:fb.serverTimestamp()});q('#busCallerStatus').textContent='Recent call history cleared. The school bus tracker is reset.'}catch(error){setError(friendlyError(error))}}
  async function changeRoomCode(){
    if(role!=='caller'||!code||q('#changeBusRoomCode').disabled||q('#connectBusGoogle').disabled||q('#sendBusCall').disabled)return;
    const entered=prompt('Enter a new room code (4–8 letters or numbers). Your current code will remain reserved.', '');
    if(entered===null)return;
    const selected=entered.trim().toUpperCase();
    if(!/^[A-Z0-9]{4,8}$/.test(selected)){setError('Use 4–8 letters or numbers for the new code. Your current code has not changed.');return}
    if(selected===code){setError('That is already your room code. Nothing has changed.');return}
    const previous=code;
    if(!confirm(`Change from ${previous} to ${selected}?\n\nThis starts a new session. Teachers must join ${selected}.\n${previous} stays reserved until 30 days after its last caller activity. Its saved history will be kept.\n\nChoose OK only if you intend to change the room code.`))return;
    const controls=['#changeBusRoomCode','#connectBusGoogle','#sendBusCall','#sendBusAddOn','#toggleBusAddOn','#clearBusCall','#clearAllBuses','#sendBusAllClear','#clearBusHistory','#closeBusRoom','#leaveBusCaller'].map(q);
    controls.forEach(button=>button.disabled=true);
    setError('');let claimed=false;
    try{
      const source=(await fb.get(roomRef(previous))).val();
      if(!source||source.hostUid!==busUser.uid)throw new Error('You no longer own the current room. No code was changed.');
      const result=await fb.runTransaction(roomRef(selected),value=>{
        // Never overwrite another active reservation, including a different room owned by this caller.
        if(value&&!reservationExpired(value))return;
        const next={hostUid:busUser.uid,status:'open',createdAt:fb.serverTimestamp(),expiresAt:Date.now()+ROOM_MS,callerLastActiveAt:fb.serverTimestamp(),callerHeartbeatAt:fb.serverTimestamp(),callerDisconnectedAt:null,sessionExpiresAt:Date.now()+SESSION_IDLE_MS};
        const sourceRoster=schoolBusRosterNumbers(source);if(sourceRoster.length)next.schoolBusRoster=sourceRoster;
        if(source.pinAccountKey)next.pinAccountKey=source.pinAccountKey;
        else if(!busUser.providerData?.some(provider=>provider.providerId==='google.com'))next.pinAccountKey=previous.toLowerCase();
        return next;
      },{applyLocally:false});
      if(!result.committed)throw new Error('That code is already reserved. Your current code has not changed.');
      claimed=true;
      // Retain the old reservation; its live calls are ended when switching room codes.
      await stopCallerLiveness();
      await fb.update(roomRef(previous),{status:'closed',currentCall:null,addOnCalls:null,combinedCall:null,allClear:null,players:null,closedAt:fb.serverTimestamp()});
      stopWatch();code=selected;
      q('#busCallerRoomCode').textContent=code;q('#busCallerCodeInput').value=code;
      q('#busNumberInput').value='';q('#busCallNoteInput').value='';q('#busAddOnNumberInput').value='';q('#busAddOnNoteInput').value='';setCallStage('first');setAddOnStages(['first']);setAddOnPanel(false);
      saveCallerCode(code);callerCodeEditing=false;updateCallerResumeUi();
      await startCallerLiveness();watchRoom();q('#busNumberInput').focus();
    }catch(error){
      setError(claimed?`The new code ${selected} is reserved for you, but the old session could not be closed. You are still in ${previous}. Both reservations were kept. You can leave and reopen ${selected} with the same sign-in.`:friendlyError(error));
    }finally{controls.forEach(button=>button.disabled=false)}
  }
  async function closeRoom(){
    if(role!=='caller'||!code||!confirm(`Close room ${code}? Calls will be cleared. Your code stays reserved for 30 days.`))return;
    try{
      await stopCallerLiveness();
      await fb.update(roomRef(code),{status:'closed',currentCall:null,addOnCalls:null,combinedCall:null,allClear:null,history:null,players:null,closedAt:fb.serverTimestamp(),callerDisconnectedAt:fb.serverTimestamp(),callerLastActiveAt:fb.serverTimestamp()});
      stopWatch();resetUi();
    }catch(error){setError(friendlyError(error))}
  }
  async function leaveRoom(){stopWatch();await stopPresence(true);if(role==='caller'){await stopCallerLiveness({markDisconnected:true});for(const session of [callerAuth,googleCallerAuth]){if(session){try{await fb.signOut(session)}catch{}}}}resetUi();restorePrefs()}
  function dismissCallPopup(){
    if(popup.classList.contains('all-clear'))dismissedAllClearId=String(popup.dataset.allClearId||room?.allClear?.id||'');
    popup.hidden=true;
  }
  q('#saveBusSchoolRoster').addEventListener('click',saveSchoolBusRoster);
  q('#clearBusSchoolRoster').addEventListener('click',clearSchoolBusRoster);
  q('#busSchoolRosterInput').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();saveSchoolBusRoster()}});
  q('#busNumberInput').addEventListener('input',()=>{if(room)renderSchoolBusRoster(room)});
  q('#busAddOnNumberInput').addEventListener('input',()=>{if(room)renderSchoolBusRoster(room)});
  q('#busNumberInput').addEventListener('focus',()=>setLineupTarget('main'));
  q('#busNumberInput').addEventListener('click',()=>setLineupTarget('main'));
  q('#busAddOnNumberInput').addEventListener('focus',()=>setLineupTarget('addon'));
  q('#busAddOnNumberInput').addEventListener('click',()=>setLineupTarget('addon'));
  q('#changeBusRoomCode').addEventListener('click',changeRoomCode);
  q('#leaveBusCaller').addEventListener('click',leaveRoom);
  q('#busCallerRoomChoice').addEventListener('click',()=>{const saved=getSavedCallerCode();if(!saved)return;callerCodeEditing=!callerCodeEditing;if(callerCodeEditing){q('#busCallerCodeInput').value='';setTimeout(()=>q('#busCallerCodeInput').focus(),0)}else q('#busCallerCodeInput').value=saved;updateCallerResumeUi()});
  q('#startBusGoogle').addEventListener('click',()=>createCallerRoom('google'));q('#connectBusGoogle').addEventListener('click',connectCallerGoogle);q('#startBusCaller').addEventListener('click',()=>createCallerRoom('pin'));q('#joinBusRoom').addEventListener('click',joinTeacherRoom);q('#sendBusCall').addEventListener('click',sendCall);q('#busNumberInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendCall()}});q('#clearBusCall').addEventListener('click',clearCurrent);q('#clearAllBuses').addEventListener('click',clearAllBuses);q('#sendBusAllClear').addEventListener('click',sendAllClear);q('#clearBusHistory').addEventListener('click',clearHistory);q('#closeBusRoom').addEventListener('click',closeRoom);q('#leaveBusRoom').addEventListener('click',leaveRoom);q('#copyBusRoomCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code);showToast('Bus Call room code copied')}catch{showToast(`Room code: ${code}`)}});q('#dismissBusPopup').addEventListener('click',dismissCallPopup);q('#dismissBusPopupMain').addEventListener('click',dismissCallPopup);q('#testBusAlert').addEventListener('click',()=>{try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)()}catch{}const testValue=allActiveCalls(room).length?room:{currentCall:{id:'test',number:'123',numbers:['123'],note:'This is a test alert.',stage:selectedStage,stages:[selectedStage],calledAt:Date.now()}};showActivePopup(testValue,{heading:'🚌 TEST — ALL ACTIVE BUSES',timeLabel:'Test alert',test:true})});q('#busSoundEnabled').addEventListener('change',saveTeacherPrefs);
  q('#toggleBusAddOn').addEventListener('click',()=>setAddOnPanel(q('#busAddOnPanel').hidden));
  q('#cancelBusAddOn').addEventListener('click',()=>setAddOnPanel(false));
  q('#clearBusAddOns').addEventListener('click',clearAddOns);
  q('#sendBusAddOn').addEventListener('click',sendAddOnCall);
  q('#newBusAddOn').addEventListener('click',prepareNewAddOn);
  q('#busCallAllSecond').addEventListener('click',()=>callAllActiveBuses('second'));
  q('#busCallAllLast').addEventListener('click',()=>callAllActiveBuses('last'));
  q('#busAddOnNumberInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendAddOnCall()}});
  panel.querySelectorAll('[data-bus-addon-preset]').forEach(button=>button.addEventListener('click',()=>selectAddOnPreset(button.dataset.busAddonPreset)));
  panel.querySelectorAll('[data-bus-call-stage]').forEach(button=>button.addEventListener('click',()=>setCallStage(button.dataset.busCallStage)));
  ['#busCallerCodeInput','#busTeacherCodeInput'].forEach(sel=>q(sel).addEventListener('input',e=>{const pos=e.target.selectionStart;e.target.value=normalizeCode(e.target.value);try{e.target.setSelectionRange(pos,pos)}catch{}}));
  window.addEventListener('resize',()=>{if(!popup.hidden){fitPopupGrid(popupGrid?.children.length||0);fitCardNumbers(popupGrid)}const activeCount=allActiveCalls(room).length;if(activeCount){fitBoardGrid(activeCount);fitCardNumbers(q('#busActiveCallGrid'))}});
  window.addEventListener('beforeunload',()=>{if(role==='teacher'&&code&&busUser&&fb){try{fb.update(listenerRef(code,busUser.uid),{connected:false,lastSeen:Date.now()})}catch{}}/* Caller disconnect is handled server-side by Firebase onDisconnect. */});
  window.openBusCall=()=>setCalculatorMode('bus-call');
  window.refreshBusCall=()=>{if(role&&code)watchRoom()};
  try{q('#busCallerCodeInput').value=getSavedCallerCode()}catch{}
  q('#busCallerPinInput').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();createCallerRoom()}});
  restorePrefs();
  callerCodeEditing=!getSavedCallerCode();updateCallerResumeUi();
  setCallStage('first');
  setAddOnStages(['first']);
  setLineupTarget('main');
})();
