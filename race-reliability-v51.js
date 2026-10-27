/* GLN Classroom Car Race v5.1 — live connection recovery, fair roster, atomic restarts.
   Loaded after all earlier race modules. No historical student data is stored. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GLNRaceReliability = api;
  if (typeof document !== 'undefined') api.install();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const eligible = player => player?.roundEligible !== false;
  const connected = player => !player?.presenceV51 || Object.keys(player.connections || {}).length > 0;
  const liveRoster = room => Object.values(room?.players || {}).filter(connected);
  const sortedRoster = room => Object.values(room?.players || {}).sort((a,b) => (Number(a.joinedAt)||0)-(Number(b.joinedAt)||0)||String(a.id).localeCompare(String(b.id)));
  const counts = players => ({ online:players.filter(connected).length, offline:players.filter(p=>!connected(p)).length, late:players.filter(p=>!eligible(p)).length });
  function applyProgress(previous,{roundId,managed,sequence,payload}) {
    if(!previous||previous.finishedAt||previous.roundLocked)return;
    if(managed&&String(previous.activeRoundId||'')!==String(roundId))return;
    if(Number(previous.lastClientSequence||0)>=Number(sequence))return;
    return {...previous,...payload,lastClientSequence:sequence};
  }
  function install() {
    if (!$('raceJoinForm') && !$('joinRaceForm')) return;
    if ($('raceV51LobbyStatus')) return;
    const lobbyStatus = document.createElement('div');
    lobbyStatus.id='raceV51LobbyStatus'; lobbyStatus.className='race-v51-status';
    lobbyStatus.setAttribute('role','status');
    $('lobbyPlayers').before(lobbyStatus);
    const liveStatus = document.createElement('div');
    liveStatus.id='raceV51LiveStatus';liveStatus.className='race-v51-status';
    liveStatus.setAttribute('role','status');
    $('raceTrack').before(liveStatus);
    const playerStatus = document.createElement('div');
    playerStatus.id='raceV51Practice';playerStatus.className='race-v51-practice';playerStatus.hidden=true;
    $('racePlayerHud').after(playerStatus);
    const roundStartingButton = $('startRace'), againButton = $('raceAgain'), endButton = $('raceEnd'), joinForm = $('joinRaceForm');
    let presenceKey = null, presenceRef = null, pendingPresence = null;
    let localSubscription = null;
    let roundRequestPending = false;
    const tabId = 'tab_'+Math.random().toString(36).slice(2,10)+'_'+Date.now().toString(36);
    function notify(message) { if (typeof showToast === 'function') showToast(message); }
    function disconnectPresence() {
      const ref = presenceRef;
      presenceRef=null;presenceKey=null;
      if (ref && fb && fb.remove) {
        // Keep server onDisconnect cleanup armed until the socket actually drops;
        // cancelling it first could leave a ghost-online student on tab close.
        try { void fb.remove(ref).catch(()=>{}); } catch {}
      }
    }
    async function registerPresence() {
      if (!fb || !currentUser || !raceCode || raceMode!=='player' || racePlayerId!==currentUser.uid) return;
      const sessionKey = raceCode+':'+currentUser.uid;
      if (presenceKey===sessionKey || pendingPresence===sessionKey) return;
      disconnectPresence();pendingPresence=sessionKey;
      const ref = fb.ref(db,`rooms/${raceCode}/players/${currentUser.uid}/connections/${tabId}`);
      try {
        // Register the server-side cleanup BEFORE declaring this tab online.
        await fb.onDisconnect(ref).remove();
        if (pendingPresence!==sessionKey || raceCode!==sessionKey.split(':')[0] || raceMode!=='player') {
          await fb.onDisconnect(ref).cancel().catch(()=>{});
          return;
        }
        await fb.update(playerRef(raceCode,currentUser.uid),{presenceV51:true});
        if(pendingPresence!==sessionKey || raceMode!=='player') {
          await fb.onDisconnect(ref).cancel().catch(()=>{});
          return;
        }
        await fb.set(ref,true);
        if(pendingPresence!==sessionKey || raceMode!=='player') {
          await fb.remove(ref).catch(()=>{});
          await fb.onDisconnect(ref).cancel().catch(()=>{});
          return;
        }
        presenceKey=sessionKey;presenceRef=ref;
      } catch (error) {
        console.warn('Car Race: presence could not be registered',error);
      } finally { if(pendingPresence===sessionKey) pendingPresence=null; }
    }
    function showStatus(room, players) {
      const {online,offline,late}=counts(players);
      const label=`${online} connected / ${players.length} racers`;
      lobbyStatus.textContent=room.status==='waiting' ? `● ${label}${offline?' · '+offline+' offline':''}` : '';
      liveStatus.textContent=`● ${label}${offline?' · '+offline+' offline — progress stays on the track':''}${late?' · '+late+' late join'+(late===1?'':'s')+' (practice only)':''}`;
      lobbyStatus.classList.toggle('has-offline',offline>0);
      liveStatus.classList.toggle('has-offline',offline>0);
      const me=players.find(p=>p.id===racePlayerId);
      playerStatus.hidden=!(raceMode==='player' && me && !eligible(me) && room.status!=='waiting');
      if(!playerStatus.hidden)playerStatus.textContent='Late join: you can practice this round. Your result will count in the next race.';
    }
    const oldRank = raceRankPlayers;
    raceRankPlayers = players => oldRank((players||[]).filter(eligible)).concat(oldRank((players||[]).filter(p=>!eligible(p))));
    const oldResults = renderRaceResults;
    renderRaceResults = players => oldResults((players||[]).filter(eligible));
    const oldRender = renderRace;
    renderRace = room => { oldRender(room); showStatus(room,room.players||[]); };
    const oldLobby = renderLobbyPlayers;
    renderLobbyPlayers = players => {
      oldLobby(players);
      const room = raceRoomData;
      if (room) showStatus(room, players||[]);
      // Mark students who disconnected without removing their progress or team.
      const chips=Array.from($('lobbyPlayers').children);
      players.forEach((p,i) => {
        const chip=chips[i]; if(!chip || !chip.classList.contains('lobby-player-chip'))return;
        chip.classList.toggle('race-v51-offline',!connected(p));
        if(!connected(p))chip.title=`${p.name||'Racer'} is offline; their place is preserved`;
      });
    };
    const oldClose = closeRace;
    closeRace = () => {
      if (localSubscription){localSubscription();localSubscription=null;}
      pendingPresence=null;disconnectPresence();
      playerStatus.hidden=true;liveStatus.textContent='';lobbyStatus.textContent='';
      oldClose();
    };
    watchRace = () => {
      if (!fb || !raceCode) return;
      if (raceUnsubscribe){raceUnsubscribe();raceUnsubscribe=null;}
      if (localSubscription){localSubscription();localSubscription=null;}
      let subscribedCode=raceCode;
      localSubscription=fb.onValue(fb.ref(db,'.info/connected'),snapshot=>{
        if(raceCode!==subscribedCode)return;
        const online=snapshot.val()===true;
        if(!online) {
          $('raceConnection').textContent='Reconnecting…';
          $('raceConnection').dataset.connectionState='offline';
          // onDisconnect removes the tab's connection record at the server.
          presenceKey=null;presenceRef=null;
        } else {
          $('raceConnection').dataset.connectionState='online';
          $('raceConnection').textContent='Online';
          if(raceMode==='player')void registerPresence();
        }
      },()=>{});
      // A single room subscription owns screen transitions. Do NOT reset players
      // from individual devices: the host resets all players atomically instead.
      raceUnsubscribe=fb.onValue(roomRef(subscribedCode),snap=>{
        if(raceCode!==subscribedCode)return;
        if(!snap.exists()){
          $('raceConnection').textContent='Room closed';return;
        }
        const room=snap.val();raceRoomData=room;
        if($('raceConnection').dataset.connectionState!=='offline')$('raceConnection').textContent='Online';
        const players=Object.values(room.players||{});
        const removed=room.removedPlayers?.[racePlayerId];
        if(raceMode==='player' && (removed || !room.players?.[racePlayerId])) {
          showRaceRemoved(removed || {allowRejoin:false});return;
        }
        renderRemovedPlayers(room);
        if(room.status==='waiting'){
          const returning=raceLastStatus!=='waiting';raceLastStatus='waiting';
          if(returning){
            raceTyped='';raceErrors=0;raceFinishing=false;
            showRaceLobby({players});
          } else {
            renderLobbyPlayers(players);
            if(raceLobby.hidden && raceMode==='player')showRaceLobby({players});
          }
          return;
        }
        raceLastStatus=room.status;
        const data={...room,players};
        try {
          if (raceLive.hidden)beginLiveRace(data);
          renderRace(data);
          $('raceStartupError')?.remove();
        } catch(error) {
          console.error('GLN Car Race v5.1: display could not start',error);
          let notice=$('raceStartupError');
          if(!notice){notice=document.createElement('div');notice.id='raceStartupError';notice.className='race-v51-error';$('raceTrack').before(notice);}
          notice.textContent='Race display error: '+(error.message||'Please refresh the game.');
        }
      },error=>{
        $('raceConnection').textContent='Reconnecting…';
        console.warn('GLN Car Race: room listener interrupted',error);
      });
      if(raceMode==='player')void registerPresence();
    };
    // Join by UID transaction. Rejoining must never write a new zero-progress
    // record over a student's existing player, mistakes, team, or passage.
    joinForm.onsubmit=async event=>{
      event.preventDefault();raceError('');
      const code=$('raceCodeInput').value.trim().toUpperCase();
      const name=cleanName($('raceNameInput').value);
      const button=joinForm.querySelector('[type="submit"]');
      if(button)button.disabled=true;
      try{
        if(!/^[A-Z2-9]{5}$/.test(code))throw new Error('Enter a valid five-character room code.');
        if(!name)throw new Error('Enter your name.');
        await initRaceFirebase();
        const snap=await fb.get(roomRef(code));
        if(!snap.exists())throw new Error('Room not found. Check the code.');
        const room=snap.val(), players=Object.values(room.players||{});
        const existing=room.players?.[currentUser.uid], removed=room.removedPlayers?.[currentUser.uid];
        if(room.expiresAt && Number(room.expiresAt)<raceNow())throw new Error('This room has expired.');
        if(removed && !removed.allowRejoin)throw new Error('The host removed you from this race.');
        if(!existing && room.status==='finished')throw new Error('This race has ended. Ask the teacher to restart.');
        if(!existing && room.status!=='waiting' && !(room.allowLate && ['racing','paused'].includes(room.status)))throw new Error('This race has already started.');
        if(!existing && players.length>=30)throw new Error('The room is full (30 racers).');
        if(!existing && players.some(p=>String(p.name||'').toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('This name is already in the race. Add an initial.');
        const info=racePassageInfo(room.passage);
        const customPassage=room.randomize?storedRacePassage(shuffleRaceWords(info.text),gameLanguageAuto.normalize(room.keyboardLanguage||info.language)):room.passage;
        const late=room.status!=='waiting';
        const newPlayer={id:currentUser.uid,name,progress:0,typedCount:0,errors:0,reverseDebt:0,wpm:0,accuracy:100,
          color:Number($('raceCarColor').value)||0,avatar:Number($('raceAvatar').value)||0,
          team:window.GLNRaceTeams?.assign(players,room.teamCount)||(room.teamCount?(players.length%room.teamCount)+1:0),
          customPassage,joinedAt:raceNow(),finishedAt:0,roundEligible:!late,
          activeRoundId:late?String(room.roundId||''):'',roundLocked:false,presenceV51:true};
        const result=await fb.runTransaction(playerRef(code,currentUser.uid),current=>current||newPlayer,{applyLocally:false});
        if(!result.committed)throw new Error('Could not join. Please retry.');
        const me=result.snapshot.val();
        if(removed?.allowRejoin)await fb.remove(fb.ref(db,`rooms/${code}/removedPlayers/${currentUser.uid}`));
        raceCode=code;racePlayerId=currentUser.uid;racePlayerName=me.name||name;raceMode='player';raceWasRemoved=false;
        removedScreen.hidden=true;raceRoomData=room;
        raceRoomLanguage=gameLanguageAuto.normalize(room.keyboardLanguage||info.language);
        raceLanguage=raceRoomLanguage;raceKeyboardMode=room.keyboardMode==='auto'?'auto':raceRoomLanguage;
        showRaceLobby({players:existing?players:[...players,me]});watchRace();
      }catch(error){raceError(error.message||'Unable to join this race.');}
      finally{if(button)button.disabled=false;}
    };
    // Atomically freeze the scored roster and move everyone to a new round.
    roundStartingButton.onclick=async()=>{
      if(raceMode!=='host'||!raceCode||roundRequestPending)return;
      roundRequestPending=true;roundStartingButton.disabled=true;
      try{
        await initRaceFirebase();
        const snap=await fb.get(roomRef(raceCode));if(!snap.exists())throw new Error('Room not found.');
        const room=snap.val();
        if(room.hostUid!==currentUser.uid||room.status!=='waiting')throw new Error('This race cannot be started now.');
        const members=Object.entries(room.players||{});
        if(!members.length)throw new Error('Wait for students to join.');
        if(!members.some(([,p])=>connected(p)))throw new Error('No connected students. Ask students to reconnect.');
        await syncRaceServerClock();const now=raceNow(), roundId=String(now);
        const changes={status:'racing',startedAt:now+4500,roundId,endedAt:0,pausedAt:0,reliabilityV51:true};
        for (const [uid,p] of members){
          changes[`players/${uid}/activeRoundId`]=roundId;
          changes[`players/${uid}/roundEligible`]=connected(p);
          changes[`players/${uid}/roundLocked`]=false;
        }
        await fb.update(roomRef(raceCode),changes);
      }catch(error){$('lobbyHint').textContent=error.message;}
      finally{roundRequestPending=false;roundStartingButton.disabled=false;}
    };
    // End Race seals every participant's result in the same atomic write.
    // This prevents delayed Chromebook updates from changing manual results.
    endButton.onclick=async()=>{
      if(raceMode!=='host'||!raceCode||roundRequestPending)return;
      roundRequestPending=true;endButton.disabled=true;
      try{
        const snap=await fb.get(roomRef(raceCode));if(!snap.exists())return;
        const room=snap.val();
        if(room.hostUid!==currentUser?.uid||!['racing','paused'].includes(room.status))return;
        const changes={status:'finished',endedAt:raceNow()};
        for(const uid of Object.keys(room.players||{}))changes[`players/${uid}/roundLocked`]=true;
        await fb.update(roomRef(raceCode),changes);
      }catch(error){console.warn('Car Race: End Race failed',error);notify('Could not end race. Try again.');}
      finally{roundRequestPending=false;endButton.disabled=false;}
    };
    // One host-owned multi-path write resets the room and ALL player data.
    againButton.onclick=async()=>{
      if(raceMode!=='host'||!raceCode||roundRequestPending)return;
      roundRequestPending=true;againButton.disabled=true;
      try{
        const snap=await fb.get(roomRef(raceCode));if(!snap.exists())throw new Error('Room not found.');
        const room=snap.val();if(room.hostUid!==currentUser?.uid)throw new Error('Only the teacher can restart.');
        const changes={status:'waiting',startedAt:0,roundId:0,endedAt:0,pausedAt:0};
        for (const uid of Object.keys(room.players||{})){
          const prefix=`players/${uid}/`;
          Object.assign(changes,{
            [prefix+'progress']:0,[prefix+'typedCount']:0,[prefix+'errors']:0,
            [prefix+'reverseDebt']:0,[prefix+'wordErrors']:null,[prefix+'wpm']:0,
            [prefix+'accuracy']:100,[prefix+'finishedAt']:0,[prefix+'activeRoundId']:'',
            [prefix+'lastClientSequence']:0,[prefix+'roundEligible']:true,[prefix+'roundLocked']:false
          });
        }
        await fb.update(roomRef(raceCode),changes);
        raceFinishing=false;
      }catch(error){$('raceStatusText').textContent=error.message;}
      finally{roundRequestPending=false;againButton.disabled=false;}
    };
  }
  return {eligible,connected,liveRoster,counts,applyProgress};
});
