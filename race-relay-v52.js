/* GLN Classroom Car Race v5.2 — sequential vocabulary team relay.
   A separate team-car presentation; preserves Solo and ordinary Team Race. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.GLNRaceRelayV52=api;
  if(typeof document!=='undefined')api.install();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const names=['Red','Blue','Green','Gold'];
  const paints=['red','blue','green','yellow'];
  const colors=['#f05262','#4c9bff','#3ac69d','#efbd46'];
  const $=id=>document.getElementById(id);
  const teamCount=room=>[2,3,4].includes(Number(room?.teamCount))?Number(room.teamCount):0;
  const listPlayers=room=>Object.values(room?.players||{});
  const sorted=players=>[...players].sort((a,b)=>(Number(a.joinedAt)||0)-(Number(b.joinedAt)||0)||String(a.id||'').localeCompare(String(b.id||'')));
  const percent=n=>Math.max(0,Math.min(100,Number(n)||0));
  const isRelay=room=>room?.relayMode===true;
  const isRound=room=>isRelay(room)&&room?.relayV52?.roundId===String(room?.roundId||'')&&room?.relayV52?.teams;
  function buildPlan(room,roundId){
    const count=teamCount(room),players=sorted(listPlayers(room)).filter(p=>p.roundEligible!==false);
    if(!count)return{error:'Select 2, 3, or 4 teams.'};
    const rosters=Array.from({length:count},(_,i)=>players.filter(p=>Number(p.team)===i+1));
    if(rosters.some(group=>group.length<2))return{error:'Team Relay needs at least two connected racers on every team. Balance teams or ask students to reconnect.'};
    const source=String(room.passage||'').replace(/^\u2060/,'').trim().split(/\s+/).filter(Boolean);
    if(!source.length)return{error:'Add vocabulary before starting the relay.'};
    // Each team receives the same word sequence. Only the handoff boundaries
    // differ, so unequal team sizes cannot change the total typing workload.
    const vocabulary=source.length<Math.max(...rosters.map(g=>g.length))
      ?Array.from({length:Math.max(...rosters.map(g=>g.length))},(_,i)=>source[i%source.length]):source;
    const prefix=String(room.passage||'').startsWith('\u2060')?'\u2060':'';
    const assignments={},teams={};
    rosters.forEach((roster,i)=>{
      const ids=roster.map(p=>String(p.id));
      teams[String(i+1)]={members:ids,legLengths:[],activeIndex:0,finishedAt:0};
      roster.forEach((p,index)=>{
        const from=Math.floor(index*vocabulary.length/roster.length),to=Math.floor((index+1)*vocabulary.length/roster.length);
        const legLength=vocabulary.slice(from,to).join('').length;
        teams[String(i+1)].legLengths.push(legLength);
        assignments[String(p.id)]={team:i+1,leg:index+1,passage:prefix+vocabulary.slice(from,to).join(' '),legLength};
      });
    });
    return{teams,assignments,roundId:String(roundId),totalWords:vocabulary.length};
  }
  function teamProgress(room){
    if(!isRound(room))return [];
    const entries=Object.entries(room.relayV52.teams);
    return entries.map(([key,t])=>{
      const members=t.members||[],players=members.map(id=>room.players?.[id]).filter(Boolean);
      const weights=members.map((id,i)=>Math.max(1,Number(t.legLengths?.[i])||Number(room.players?.[id]?.relayLegLength)||1));
      const total=weights.reduce((sum,len)=>sum+len,0)||1;
      const distance=members.reduce((sum,id,i)=>{const p=room.players?.[id];return sum+(!p||p.relaySkipped?0:percent(p.progress)*weights[i]/100);},0);
      const active=t.members?.[Number(t.activeIndex)||0],activePlayer=room.players?.[active];
      return{team:Number(key),name:`${names[Number(key)-1]} Team`,color:colors[Number(key)-1],
        progress:percent(distance/total*100),total:members.length,done:Math.min(members.length,Number(t.activeIndex)||0),
        activeUid:active||'',activeName:activePlayer?.name||'',activeConnected:activePlayer?(!activePlayer.presenceV51||Object.keys(activePlayer.connections||{}).length>0):false,
        finishedAt:Number(t.finishedAt)||0,players};
    }).sort((a,b)=>{
      if(a.finishedAt&&b.finishedAt&&a.finishedAt!==b.finishedAt)return a.finishedAt-b.finishedAt;
      if(Boolean(a.finishedAt)!==Boolean(b.finishedAt))return a.finishedAt?-1:1;
      return b.progress-a.progress||
        ((a.finishedAt&&b.finishedAt)?a.finishedAt-b.finishedAt:0)||a.team-b.team;
    });
  }
  function canType(room,uid){
    if(!isRound(room)||room.status!=='racing')return false;
    const p=room.players?.[uid],team=room.relayV52.teams[String(p?.team)];
    return !!(p&&p.roundEligible!==false&&!p.roundLocked&&!p.relaySkipped&&team&&
      team.members?.[Number(team.activeIndex)||0]===uid);
  }
  function advance(room,teamId,now,skip){
    if(!isRound(room)||!['racing','paused'].includes(room.status))return null;
    const team=room.relayV52.teams[String(teamId)];if(!team)return null;
    const index=Number(team.activeIndex)||0,id=team.members?.[index],member=room.players?.[id];
    if(!member&&!skip)return null;
    if(!skip&&!(Number(member.progress)>=100&&member.finishedAt))return null;
    if(skip&&member){member.relaySkipped=true;member.roundLocked=true;member.finishedAt=now;member.progress=0;}
    team.activeIndex=index+1;
    if(team.activeIndex>=team.members.length){
      team.finishedAt=now;
      // A fully typed team wins immediately. Skipped legs don't earn distance.
      const results=teamProgress(room),complete=results.find(t=>t.team===Number(teamId));
      if(complete&&complete.progress>=99.999){
        room.status='finished';room.endedAt=now;
        Object.values(room.players||{}).forEach(p=>{p.roundLocked=true;});
      }else if(results.every(t=>t.done===t.total)){
        room.status='finished';room.endedAt=now;
        Object.values(room.players||{}).forEach(p=>{p.roundLocked=true;});
      }
    }
    return room;
  }
  function install(){
    const form=$('createRaceForm'),teamsSelect=$('raceTeams');
    if(!form||!teamsSelect||$('raceV52Setup'))return;
    const label=document.createElement('label');label.id='raceV52Setup';label.className='race-v52-setting';
    label.innerHTML='<span>Team race format</span><select id="raceV52Format"><option value="team">Regular Team Race</option><option value="relay">Team Relay — take turns</option></select><small>Relay: one shared car per team. Each teammate types part of the same vocabulary list.</small>';
    const teamSetup=$('raceV5TeamSetup');(teamSetup||teamsSelect.closest('label')).after(label);
    const format=$('raceV52Format'),length=$('raceLengthMode');
    function refreshSettings(){
      label.hidden=!teamCount({teamCount:teamsSelect.value});
      const relay=!label.hidden&&format.value==='relay';
      if(relay){length.value='words';length.dispatchEvent(new Event('change'));}
      length.disabled=relay;
    }
    teamsSelect.addEventListener('change',refreshSettings);
    format.addEventListener('change',refreshSettings);
    refreshSettings();
    const oldSettings=raceSettings;
    raceSettings=()=>({...oldSettings(),relayMode:!label.hidden&&format.value==='relay'});
    const lobbyNote=document.createElement('p');lobbyNote.id='raceV52LobbyNote';lobbyNote.className='race-v52-lobby-note';lobbyNote.hidden=true;
    $('lobbyPlayers').after(lobbyNote);
    const board=document.createElement('section');board.id='raceV52Board';board.className='race-v52-board';board.hidden=true;
    $('raceDashboard').before(board);
    const practice=document.createElement('p');practice.id='raceV52Turn';practice.className='race-v52-turn';practice.hidden=true;
    $('racePlayerHud').after(practice);
    const results=document.createElement('section');results.id='raceV52Results';results.className='race-v52-results';results.hidden=true;
    $('racePodium').before(results);
    let lastRound='',pending=false,lastAdvance='',lastSkipped='',winningKey='';
    const teacher=room=>raceMode==='host'&&room?.hostUid===currentUser?.uid;
    const oldStart=$('startRace').onclick;
    $('startRace').onclick=async()=>{
      const room=raceRoomData;
      if(!isRelay(room))return oldStart?.();
      if(!teacher(room)||pending)return;
      pending=true;$('startRace').disabled=true;
      try{
        await syncRaceServerClock();const now=raceNow(),roundId=String(now);
        const ref=roomRef(raceCode);
        const result=await fb.runTransaction(ref,current=>{
          if(!current||current.hostUid!==currentUser.uid||current.status!=='waiting'||!current.relayMode)return;
          const roster=listPlayers(current);if(!roster.length)return;
          roster.forEach(p=>{p.roundEligible=!p.presenceV51||Object.keys(p.connections||{}).length>0;});
          const plan=buildPlan(current,roundId);if(plan.error)return;
          for(const [uid,assignment] of Object.entries(plan.assignments)){
            const p=current.players[uid];if(!p)continue;
            p.team=assignment.team;p.customPassage=assignment.passage;p.relayLeg=assignment.leg;
            p.relayLegLength=assignment.legLength;p.relaySkipped=false;
            p.typedCount=0;p.progress=0;p.errors=0;p.wpm=0;p.accuracy=100;
            p.finishedAt=0;p.reverseDebt=0;p.roundLocked=false;p.lastClientSequence=0;
            p.activeRoundId=roundId;
          }
          current.relayV52={roundId,teams:plan.teams,totalWords:plan.totalWords};
          current.status='racing';current.startedAt=now+4500;current.roundId=roundId;
          current.endedAt=0;current.pausedAt=0;current.reliabilityV51=true;
          return current;
        },{applyLocally:false});
        if(!result.committed){const plan=buildPlan((await fb.get(ref)).val()||room,roundId);throw new Error(plan.error||'Race changed; please try again.');}
      }catch(err){$('lobbyHint').textContent=err.message||'Could not start relay';}
      finally{pending=false;$('startRace').disabled=false;}
    };
    const oldAccept=acceptRaceInput,oldBackspace=raceBackspace,oldSend=sendRaceProgress;
    acceptRaceInput=value=>{if(isRelay(raceRoomData)&&!canType(raceRoomData,racePlayerId))return;oldAccept(value);};
    raceBackspace=()=>{if(isRelay(raceRoomData)&&!canType(raceRoomData,racePlayerId))return;oldBackspace();};
    sendRaceProgress=()=>{if(isRelay(raceRoomData)&&!canType(raceRoomData,racePlayerId))return Promise.resolve();return oldSend();};
    const oldLobby=renderLobbyPlayers;
    renderLobbyPlayers=players=>{oldLobby(players);lobbyNote.hidden=!isRelay(raceRoomData);
      if(!lobbyNote.hidden)lobbyNote.textContent='🏁 Team Relay: assign at least two racers per team. The teacher starts all teams together; only the active teammate types.';
    };
    const oldBegin=beginLiveRace;
    beginLiveRace=data=>{oldBegin(data);lastRound=String(data.roundId||'');};
    const oldRender=renderRace;
    async function handoff(team,skip=false){
      const room=raceRoomData;if(!teacher(room)||!isRound(room)||pending)return;
      const info=room.relayV52.teams[String(team)];if(!info)return;
      const index=Number(info.activeIndex)||0,id=info.members?.[index];if(!id)return;
      const key=`${room.roundId}:${team}:${index}:${skip?'skip':'auto'}`;
      if(skip){if(lastSkipped===key)return;lastSkipped=key;}
      else{if(lastAdvance===key)return;lastAdvance=key;}
      try{
        const at=raceNow();await fb.runTransaction(roomRef(raceCode),fresh=>{
          if(!fresh||fresh.hostUid!==currentUser.uid||String(fresh.roundId)!==String(room.roundId))return;
          const live=fresh.relayV52?.teams?.[String(team)];
          if(!live||Number(live.activeIndex)!==index||live.members?.[index]!==id)return;
          return advance(fresh,team,at,skip)||undefined;
        },{applyLocally:false});
      }catch(err){console.warn('Relay handoff failed',err);if(skip)lastSkipped='';else lastAdvance='';}
    }
    const track=document.createElement('div');track.className='race-v52-track';board.append(track);
    const cards=new Map();
    let resizeFrame=0;
    window.addEventListener('resize',()=>{
      if(resizeFrame)cancelAnimationFrame(resizeFrame);
      resizeFrame=requestAnimationFrame(()=>{
        resizeFrame=0;
        if(isRound(raceRoomData)&&!board.hidden)renderTeamCars(raceRoomData);
      });
    },{passive:true});
    function renderTeamCars(room){
      const teams=teamProgress(room),activeIds=new Set();
      teams.forEach((t,position)=>{
        const key=String(t.team);activeIds.add(key);
        let card=cards.get(key);
        if(!card){
          card=document.createElement('article');card.className='race-v52-team';card.style.setProperty('--team-accent',colors[t.team-1]);
          card.innerHTML=`<div class="race-v52-team-heading"><strong></strong><span class="race-v52-percent"></span></div><div class="race-v52-lane"><div class="race-v52-meter"></div><img alt="" src="gln-car-${paints[t.team-1]}-0.png" /></div><div class="race-v52-team-foot"><span></span><button type="button" class="race-v52-skip" hidden>Skip disconnected turn →</button></div>`;
          cards.set(key,card);track.append(card);
        }
        card.classList.toggle('is-leading',position===0&&t.progress>0);
        card.querySelector('strong').textContent=`${position+1}. ${t.name}`;
        card.querySelector('.race-v52-percent').textContent=`${Math.round(t.progress)}%`;
        card.querySelector('.race-v52-meter').style.width=`${t.progress}%`;
        // Align the shared team car to the relay finish stripe at 100%.
        const teamCar=card.querySelector('img');
        const percent=Math.max(0,Math.min(100,Number(t.progress)||0));
        const carWidth=teamCar.offsetWidth||85;
        const carLeft=`calc(${percent.toFixed(2)}% - ${(percent/100*(carWidth+6)).toFixed(2)}px)`;
        if(teamCar.style.left!==carLeft)teamCar.style.left=carLeft;
        const foot=card.querySelector('.race-v52-team-foot span');
        foot.textContent=t.done>=t.total?'All turns complete':`Turn ${t.done+1}/${t.total} · ${t.activeName||'Waiting'}`+(t.activeConnected?'':' · Offline');
        const skip=card.querySelector('button');skip.hidden=!teacher(room)||room.status==='finished'||t.done>=t.total;
        skip.disabled=pending;skip.onclick=()=>{if(confirm(`Skip ${t.activeName||'this student'}’s relay turn? The skipped section earns no distance.`))void handoff(t.team,true);};
      });
      for(const [key,card] of cards){if(!activeIds.has(key)){card.remove();cards.delete(key);}}
      const me=room.players?.[racePlayerId];
      practice.hidden=raceMode!=='player';
      if(!practice.hidden){
        const group=teams.find(t=>t.team===Number(me?.team));
        practice.textContent=me?.roundEligible===false?'Late join: watch this relay. You can race in the next round.'
          :room.status==='finished'?'Relay finished!'
          :group?.activeUid===racePlayerId?`🏎️ Your turn! Type your ${group.name} vocabulary section.`
          :me?.relaySkipped?'Your turn was skipped by the teacher.'
          :me?.finishedAt?'Great work! Your baton has been passed.'
          :`⏳ Waiting for ${group?.activeName||'your teammate'} to pass the baton…`;
      }
      $('raceTrack').hidden=true;$('raceLeaderboard').hidden=true;
      const lateNotice=$('raceV51Practice');if(lateNotice)lateNotice.hidden=true;
      $('raceV5TeamBoard').hidden=true;$('teamScoreboard').hidden=true;
      $('racePosition').textContent=teams.length?`${teams[0].name}: ${Math.round(teams[0].progress)}%`:'Relay starting';
      const myTurn=raceMode==='player'&&canType(room,racePlayerId);
      $('raceKeyboard')?.classList.toggle('race-v52-keyboard-locked',raceMode==='player'&&!myTurn);
      if(raceMode==='player'&&!myTurn&&room.status!=='finished')$('racePrompt').textContent='Waiting for your relay turn — your keyboard is locked.';
      if(teacher(room)&&room.status==='racing'){
        teams.forEach(t=>{
          const raw=room.players?.[t.activeUid];
          if(raw&&Number(raw.progress)>=100&&raw.finishedAt)void handoff(t.team);
        });
      }
      return teams;
    }
    function renderFinish(room,teams){
      const finished=room.status==='finished';results.hidden=!finished;
      $('racePodium').hidden=finished;$('raceOthers').hidden=finished;
      $('raceV5TeamResults').hidden=true;
      if(!finished)return;
      const key=JSON.stringify([room.roundId,room.endedAt,teams.map(t=>[t.team,t.progress,t.finishedAt])]);
      if(winningKey===key)return;winningKey=key;
      const winner=teams[0];results.replaceChildren();
      const heading=document.createElement('h2');heading.textContent=winner?`🏆 ${winner.name} wins the relay!`:'🏁 Team Relay Results';results.append(heading);
      const list=document.createElement('div');list.className='race-v52-results-list';
      teams.forEach((t,i)=>{const row=document.createElement('div');row.className='race-v52-result';row.style.setProperty('--team-accent',t.color);
        row.textContent=`${i+1}. ${t.name} · ${Math.round(t.progress)}% distance · ${t.done}/${t.total} turns completed`;list.append(row);});
      results.append(list);
      const winnerText=$('raceV3Winner');if(winnerText&&winner)winnerText.textContent=`🏆 ${winner.name} wins the Team Relay!`;
    }
    renderRace=room=>{
      oldRender(room);
      const active=isRound(room);
      board.hidden=!active;raceStage.classList.toggle('race-v52-mode',active);
      if(!active){
        $('raceTrack').hidden=false;$('raceLeaderboard').hidden=false;
        $('raceKeyboard')?.classList.remove('race-v52-keyboard-locked');practice.hidden=true;results.hidden=true;
        $('racePodium').hidden=false;$('raceOthers').hidden=false;
        return;
      }
      if(lastRound!==String(room.roundId)){lastRound=String(room.roundId);lastAdvance='';lastSkipped='';winningKey='';}
      const teams=renderTeamCars(room);renderFinish(room,teams);
    };
    const oldClose=closeRace;
    closeRace=()=>{cards.forEach(card=>card.remove());cards.clear();board.hidden=true;practice.hidden=true;results.hidden=true;lastRound='';lastAdvance='';lastSkipped='';winningKey='';raceStage.classList.remove('race-v52-mode');oldClose();};
  }
  return{buildPlan,teamProgress,canType,advance,install};
});
