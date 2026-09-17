// Bus Call: caller authentication, classroom listeners, and 30-day code reservations.
(() => {
  const q=s=>document.querySelector(s);
  const panel=q('#busCallPanel');
  if(!panel)return;
  const connection=q('#busCallConnection'),setup=q('#busCallSetup'),callerConsole=q('#busCallerConsole'),teacherConsole=q('#busClassroomConsole'),errorEl=q('#busCallError');
  const popup=q('#busCallPopup'),popupNumber=q('#busPopupNumber'),popupNote=q('#busPopupNote'),popupTime=q('#busPopupTime');
  let busDb=null,busUser=null,callerAuth=null,callerDatabase=null,googleCallerAuth=null,googleCallerDatabase=null;
  let role='',code='',room=null,unsubscribe=null,presenceDisconnect=null,lastCallId='',audioContext=null;
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
  const lastCallerActivity=value=>Number(value?.callerLastActiveAt||value?.lastActivityAt||value?.createdAt)||0;
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
  const cleanText=(value,max)=>String(value||'').trim().replace(/\s+/g,' ').slice(0,max);
  const friendlyError=error=>{const raw=String(error?.message||'');const code=String(error?.code||'');if(code.includes('permission-denied')||code.includes('PERMISSION_DENIED')||/permission denied/i.test(raw))return 'Firebase blocked the live room. If Classroom Quiz also cannot connect, check Firebase Realtime Database rules.';if(code.includes('operation-not-allowed')||/operation-not-allowed/i.test(raw))return 'Anonymous Firebase access is turned off. Enable Anonymous sign-in in Firebase Authentication.';if(/network|failed to fetch|offline/i.test(raw))return 'Could not reach Firebase. Check the internet connection and try again.';return raw||'Could not connect to the live Bus Call service.'};
  const formatTime=value=>{const date=new Date(Number(value)||Date.now());return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
  function saveTeacherPrefs(){try{localStorage.setItem('glnBusCallCode',code||normalizeCode(q('#busTeacherCodeInput').value));localStorage.setItem('glnBusCallTeacherName',q('#busTeacherNameInput').value.trim());localStorage.setItem('glnBusCallSound',q('#busSoundEnabled').checked?'1':'0')}catch{}}
  function restorePrefs(){try{q('#busTeacherCodeInput').value=normalizeCode(localStorage.getItem('glnBusCallCode')||'');q('#busTeacherNameInput').value=localStorage.getItem('glnBusCallTeacherName')||'';q('#busSoundEnabled').checked=localStorage.getItem('glnBusCallSound')!=='0'}catch{}}
  function stopWatch(){if(unsubscribe){unsubscribe();unsubscribe=null}}
  async function stopPresence(remove=true){if(presenceDisconnect){try{await presenceDisconnect.cancel()}catch{}presenceDisconnect=null}if(remove&&role==='teacher'&&code&&busUser&&fb){try{await fb.remove(listenerRef(code,busUser.uid))}catch{}}}
  function resetUi(){if(fullscreenActive)exitBusFullscreen();setup.hidden=false;callerConsole.hidden=true;teacherConsole.hidden=true;popup.hidden=true;role='';code='';room=null;lastCallId='';setConnection('Not connected');setError('');updateRoleTabs()}
  function renderHistory(history={}){const list=q('#busCallHistory');const items=Object.values(history||{}).filter(Boolean).sort((a,b)=>(b.calledAt||0)-(a.calledAt||0)).slice(0,20);list.innerHTML='';if(!items.length){const p=document.createElement('p');p.textContent='No buses called yet.';list.append(p);return}items.forEach(item=>{const row=document.createElement('div');row.className='bus-history-row';const bus=document.createElement('b');bus.textContent=item.number||'—';const note=document.createElement('span');note.textContent=item.note||'Bus called';const time=document.createElement('time');time.textContent=formatTime(item.calledAt);row.append(bus,note,time);list.append(row)})}
  function renderCaller(value){const activeAt=lastCallerActivity(value);q('#busCodeReservation').textContent=activeAt?`Code reserved until ${new Date(activeAt+RESERVATION_MS).toLocaleDateString()}. Using caller controls renews it for 30 days.`:'This code is reserved for its caller.';const listeners=Object.values(value.players||{}).filter(item=>item?.connected!==false);q('#busListenerCount').textContent=`${listeners.length} classroom${listeners.length===1?'':'s'} online`;renderHistory(value.history);if(value.currentCall){q('#busCallerStatus').textContent=`Bus ${value.currentCall.number} was called at ${formatTime(value.currentCall.calledAt)}.`}else q('#busCallerStatus').textContent='Ready to call a bus.'}
  function beep(){if(!q('#busSoundEnabled').checked)return;try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const now=audioContext.currentTime;[0,.18].forEach((delay,index)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=index?880:660;gain.gain.setValueAtTime(.0001,now+delay);gain.gain.exponentialRampToValueAtTime(.18,now+delay+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.16);osc.connect(gain).connect(audioContext.destination);osc.start(now+delay);osc.stop(now+delay+.18)})}catch{}}
  function showPopup(call,{test=false}={}){if(!call)return;popupNumber.textContent=cleanText(call.number,18)||'123';popupNumber.style.setProperty('--bus-digits',Math.max(3,popupNumber.textContent.length));const note=cleanText(call.note,80);popupNote.textContent=note;popupNote.hidden=!note;popupTime.textContent=test?'Test alert':`Called at ${formatTime(call.calledAt)}`;popup.hidden=false;if(!test)beep()}
  function renderTeacher(value){const latest=value.currentCall;q('#busBoardNumber').textContent=latest?cleanText(latest.number,18):'—';q('#busBoardLabel').textContent=latest?'LATEST BUS':'WAITING FOR THE NEXT BUS';q('#busBoardNumber').style.setProperty('--bus-digits',Math.max(3,String(latest?.number||'').length));q('#busTeacherConnectionText').textContent='Connected';const call=value.currentCall;if(!call){popup.hidden=true;q('#busWaitingTitle').textContent='Waiting for the next bus';q('#busWaitingDetail').textContent='A large alert will appear on this screen when the caller sends a bus number.';return}if(String(call.id)!==lastCallId){lastCallId=String(call.id);showPopup(call);q('#busWaitingTitle').textContent=`Last call: Bus ${call.number}`;q('#busWaitingDetail').textContent=`Called at ${formatTime(call.calledAt)}${call.note?` • ${call.note}`:''}`}}
  function watchRoom(){stopWatch();unsubscribe=fb.onValue(roomRef(code),snap=>{if(!snap.exists()){setError('This Bus Call room was closed or no longer exists.');setConnection('Room closed','problem');q('#busBoardNumber').textContent='—';q('#busBoardLabel').textContent='ROOM CLOSED';stopPresence(false);stopWatch();popup.hidden=true;return}room=snap.val()||{};if(role==='caller'&&room.hostUid!==busUser.uid){stopWatch();resetUi();setError('This code now belongs to another caller. Choose a different code.');return}if(room.status==='closed'){popup.hidden=true;q('#busBoardNumber').textContent='—';q('#busBoardLabel').textContent='ROOM CLOSED';setConnection('Room closed');if(role==='teacher'){q('#busWaitingTitle').textContent='Room closed';q('#busWaitingDetail').textContent='The caller ended this session. Leave and join again when it reopens.';stopPresence(false);stopWatch()}return}if(room.expiresAt&&room.expiresAt<Date.now()){setError('This Bus Call room has expired. Start or join a new room.');setConnection('Room expired','problem');popup.hidden=true;q('#busBoardNumber').textContent='—';q('#busBoardLabel').textContent='ROOM EXPIRED';return}setConnection(role==='caller'?'Caller online':'Listening','online');if(role==='caller')renderCaller(room);else renderTeacher(room)},err=>{setConnection('Connection problem','problem');setError(err?.message||'Could not stay connected to the Bus Call room.')})}
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
      stopWatch();
      await fb.update(roomRef(code),{hostUid:user.uid,pinAccountKey:null,callerLastActiveAt:fb.serverTimestamp()});
      stopWatch();busDb=googleCallerDatabase;busUser=user;
      callerAccountUi();watchRoom();
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
      const selected=normalizeCode(q('#busCallerCodeInput').value)||randomCode();
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
        const active=value&&value.hostUid===user.uid&&value.status!=='closed'&&(!value.expiresAt||value.expiresAt>Date.now());
        const next=active?{...value}:{hostUid:user.uid,status:'open',createdAt:fb.serverTimestamp(),expiresAt:Date.now()+ROOM_MS};
        next.callerLastActiveAt=fb.serverTimestamp();
        if(accountKey)next.pinAccountKey=accountKey;else delete next.pinAccountKey;
        return next;
      },{applyLocally:false});
      if(!result.committed)throw new Error(reservedMessage);
      role='caller';selectRole('caller');updateRoleTabs();code=selected;
      setup.hidden=true;callerConsole.hidden=false;teacherConsole.hidden=true;
      q('#busCallerRoomCode').textContent=code;q('#busCallerPinInput').value='';
      try{localStorage.setItem('glnBusCallerCode',code)}catch{}
      callerAccountUi();watchRoom();q('#busNumberInput').focus();
    }catch(error){
      setConnection('Could not connect','problem');
      setError(callerAuthError(error,method));
    }finally{buttons.forEach(button=>button.disabled=false)}
  }
  async function joinTeacherRoom(){setError('');const requested=normalizeCode(q('#busTeacherCodeInput').value),name=cleanText(q('#busTeacherNameInput').value,32)||'Classroom';try{if(requested.length<4)throw new Error('Enter the shared Bus Call room code.');await ensureFirebase();const snap=await fb.get(roomRef(requested));if(!snap.exists())throw new Error('Bus Call room not found. Check the room code.');const value=snap.val();if(value.status==='closed'||(value.expiresAt&&value.expiresAt<Date.now()))throw new Error('This Bus Call room is no longer active.');role='teacher';selectRole('teacher');updateRoleTabs();code=requested;lastCallId='';setup.hidden=true;callerConsole.hidden=true;teacherConsole.hidden=false;q('#busTeacherRoomCode').textContent=code;q('#busTeacherCodeInput').value=code;saveTeacherPrefs();const ref=listenerRef(code,busUser.uid);await fb.set(ref,{id:busUser.uid,name,connected:true,joinedAt:Date.now(),lastSeen:Date.now()});presenceDisconnect=fb.onDisconnect(ref);await presenceDisconnect.remove();watchRoom()}catch(error){setConnection('Could not join','problem');setError(friendlyError(error))}}
  async function sendCall(){if(role!=='caller'||!code)return;const number=cleanText(q('#busNumberInput').value,18),note=cleanText(q('#busCallNoteInput').value,80);if(!number){setError('Enter a bus number first.');q('#busNumberInput').focus();return}setError('');const button=q('#sendBusCall');button.disabled=true;try{const id=`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,call={id,number,note,calledAt:fb.serverTimestamp()};const historyKey=fb.push(fb.ref(busDb,`quizRooms/${roomKey(code)}/history`)).key;await fb.update(roomRef(code),{currentCall:call,[`history/${historyKey}`]:call,lastActivityAt:fb.serverTimestamp(),callerLastActiveAt:fb.serverTimestamp()});q('#busNumberInput').value='';q('#busCallNoteInput').value='';q('#busNumberInput').focus()}catch(error){setError(friendlyError(error))}finally{button.disabled=false}}
  async function clearCurrent(){if(role!=='caller'||!code)return;try{await fb.update(roomRef(code),{currentCall:null,lastActivityAt:fb.serverTimestamp(),callerLastActiveAt:fb.serverTimestamp()});q('#busCallerStatus').textContent='Current call cleared.'}catch(error){setError(friendlyError(error))}}
  async function clearHistory(){if(role!=='caller'||!code||!confirm('Clear the recent Bus Call history for this room?'))return;try{await fb.update(roomRef(code),{history:null,callerLastActiveAt:fb.serverTimestamp()})}catch(error){setError(friendlyError(error))}}
  async function changeRoomCode(){
    if(role!=='caller'||!code||q('#changeBusRoomCode').disabled||q('#connectBusGoogle').disabled||q('#sendBusCall').disabled)return;
    const entered=prompt('Enter a new room code (4–8 letters or numbers). Your current code will remain reserved.', '');
    if(entered===null)return;
    const selected=entered.trim().toUpperCase();
    if(!/^[A-Z0-9]{4,8}$/.test(selected)){setError('Use 4–8 letters or numbers for the new code. Your current code has not changed.');return}
    if(selected===code){setError('That is already your room code. Nothing has changed.');return}
    const previous=code;
    if(!confirm(`Change from ${previous} to ${selected}?\n\nThis starts a new session. Teachers must join ${selected}.\n${previous} stays reserved until 30 days after its last caller activity. Its saved history will be kept.\n\nChoose OK only if you intend to change the room code.`))return;
    const controls=['#changeBusRoomCode','#connectBusGoogle','#sendBusCall','#clearBusCall','#clearBusHistory','#closeBusRoom','#leaveBusCaller'].map(q);
    controls.forEach(button=>button.disabled=true);
    setError('');let claimed=false;
    try{
      const source=(await fb.get(roomRef(previous))).val();
      if(!source||source.hostUid!==busUser.uid)throw new Error('You no longer own the current room. No code was changed.');
      const result=await fb.runTransaction(roomRef(selected),value=>{
        // Never overwrite another active reservation, including a different room owned by this caller.
        if(value&&!reservationExpired(value))return;
        const next={hostUid:busUser.uid,status:'open',createdAt:fb.serverTimestamp(),expiresAt:Date.now()+ROOM_MS,callerLastActiveAt:fb.serverTimestamp()};
        if(source.pinAccountKey)next.pinAccountKey=source.pinAccountKey;
        else if(!busUser.providerData?.some(provider=>provider.providerId==='google.com'))next.pinAccountKey=previous.toLowerCase();
        return next;
      },{applyLocally:false});
      if(!result.committed)throw new Error('That code is already reserved. Your current code has not changed.');
      claimed=true;
      // Retain the old reservation and its history; never delete the old room record.
      await fb.update(roomRef(previous),{status:'closed',currentCall:null,players:null,closedAt:fb.serverTimestamp()});
      stopWatch();code=selected;
      q('#busCallerRoomCode').textContent=code;q('#busCallerCodeInput').value=code;
      q('#busNumberInput').value='';q('#busCallNoteInput').value='';
      try{localStorage.setItem('glnBusCallerCode',code)}catch{}
      watchRoom();q('#busNumberInput').focus();
    }catch(error){
      setError(claimed?`The new code ${selected} is reserved for you, but the old session could not be closed. You are still in ${previous}. Both reservations were kept. You can leave and reopen ${selected} with the same sign-in.`:friendlyError(error));
    }finally{controls.forEach(button=>button.disabled=false)}
  }
  async function closeRoom(){
    if(role!=='caller'||!code||!confirm(`Close room ${code}? Calls will be cleared. Your code stays reserved for 30 days.`))return;
    try{
      await fb.update(roomRef(code),{status:'closed',currentCall:null,history:null,players:null,closedAt:fb.serverTimestamp(),callerLastActiveAt:fb.serverTimestamp()});
      stopWatch();resetUi();
    }catch(error){setError(friendlyError(error))}
  }
  async function leaveRoom(){stopWatch();await stopPresence(true);if(role==='caller'){try{await fb.update(roomRef(code),{callerLastActiveAt:fb.serverTimestamp()})}catch{}for(const session of [callerAuth,googleCallerAuth]){if(session){try{await fb.signOut(session)}catch{}}}}resetUi();restorePrefs()}
  q('#changeBusRoomCode').addEventListener('click',changeRoomCode);
  q('#leaveBusCaller').addEventListener('click',leaveRoom);
  q('#startBusGoogle').addEventListener('click',()=>createCallerRoom('google'));q('#connectBusGoogle').addEventListener('click',connectCallerGoogle);q('#startBusCaller').addEventListener('click',()=>createCallerRoom('pin'));q('#joinBusRoom').addEventListener('click',joinTeacherRoom);q('#sendBusCall').addEventListener('click',sendCall);q('#busNumberInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendCall()}});q('#clearBusCall').addEventListener('click',clearCurrent);q('#clearBusHistory').addEventListener('click',clearHistory);q('#closeBusRoom').addEventListener('click',closeRoom);q('#leaveBusRoom').addEventListener('click',leaveRoom);q('#copyBusRoomCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code);showToast('Bus Call room code copied')}catch{showToast(`Room code: ${code}`)}});q('#dismissBusPopup').addEventListener('click',()=>popup.hidden=true);q('#dismissBusPopupMain').addEventListener('click',()=>popup.hidden=true);q('#testBusAlert').addEventListener('click',()=>{try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)()}catch{}beep();showPopup({number:'123',note:'This is a test alert.',calledAt:Date.now()},{test:true})});q('#busSoundEnabled').addEventListener('change',saveTeacherPrefs);
  ['#busCallerCodeInput','#busTeacherCodeInput'].forEach(sel=>q(sel).addEventListener('input',e=>{const pos=e.target.selectionStart;e.target.value=normalizeCode(e.target.value);try{e.target.setSelectionRange(pos,pos)}catch{}}));
  window.addEventListener('beforeunload',()=>{if(role==='teacher'&&code&&busUser&&fb){try{fb.update(listenerRef(code,busUser.uid),{connected:false,lastSeen:Date.now()})}catch{}}});
  window.openBusCall=()=>setCalculatorMode('bus-call');
  window.refreshBusCall=()=>{if(role&&code)watchRoom()};
  try{q('#busCallerCodeInput').value=normalizeCode(localStorage.getItem('glnBusCallerCode')||'')}catch{}
  q('#busCallerPinInput').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();createCallerRoom()}});
  restorePrefs();
})();
