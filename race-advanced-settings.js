/* Classroom Car Race v4.2 — synchronized, teacher-selected accuracy challenge settings.
   Read-only game settings stored in each Firebase race room; older rooms retain defaults. */
(function (root, factory) {
  const api=factory();
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  if (root) root.GLNRaceAdvancedSettings=api;
  if (typeof document!=='undefined') api.install();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const defaults=Object.freeze({reversePerError:3,reverseCap:15,accuracyTarget:90,reverseFeedback:true});
  const permitted={reversePerError:[1,2,3,5],reverseCap:[10,15,25],accuracyTarget:[80,90,95,100]};
  function read(room){
    room=room||{};
    const result={};
    for(const [key,options] of Object.entries(permitted)){
      const numeric=Number(room[key]);
      result[key]=options.includes(numeric)?numeric:defaults[key];
    }
    result.reverseFeedback=room.reverseFeedback!==false;
    return result;
  }
  const limitDebt=(value,room)=>Math.min(read(room).reverseCap,Math.max(0,Number(value)||0));
  const addError=(value,room)=>Math.min(read(room).reverseCap,limitDebt(value,room)+read(room).reversePerError);
  const belowTarget=(player,room)=>Boolean((Number(player?.typedCount)||0)>0 && Number(player?.accuracy??100)<read(room).accuracyTarget);
  const $=id=>document.getElementById(id);
  function install(){
    const scoring=$('raceScoringMode'),form=$('createRaceForm');
    if(!scoring||!form||$('raceV42Settings'))return;
    const panel=document.createElement('section');panel.id='raceV42Settings';panel.className='race-v42-settings';
    panel.innerHTML='<div class="race-v42-heading"><strong>Accuracy Challenge options</strong><small>Shared with every racer</small></div>'+
      '<div class="race-v42-grid">'+
      '<label>Reverse per wrong key<select id="raceReverseStep"><option value="1">Easy · 1%</option><option value="2">Normal · 2%</option><option value="3" selected>Standard · 3%</option><option value="5">Hard · 5%</option></select></label>'+
      '<label>Maximum reverse debt<select id="raceReverseCap"><option value="10">10%</option><option value="15" selected>15%</option><option value="25">25%</option></select></label>'+
      '<label>Accuracy target<select id="raceAccuracyTarget"><option value="80">80%</option><option value="90" selected>90%</option><option value="95">95%</option><option value="100">100%</option></select></label>'+
      '</div><label class="race-v42-checkbox"><input id="raceReverseFeedback" type="checkbox" checked> Show brake and reverse flash effects</label>'+
      '<p class="race-v42-note">Accuracy is a learning goal, not a minimum to finish. Turning effects off does not remove the reverse penalty.</p>';
    const hint=$('raceScoringHint');
    (hint||scoring.closest('label')).after(panel);
    const updateVisibility=()=>{panel.hidden=scoring.value!=='accuracy'};
    scoring.addEventListener('change',updateVisibility);updateVisibility();
    const previousSettings=raceSettings;
    raceSettings=()=>({ ...previousSettings(),
      ...read({reversePerError:$('raceReverseStep').value,reverseCap:$('raceReverseCap').value,
        accuracyTarget:$('raceAccuracyTarget').value,reverseFeedback:$('raceReverseFeedback').checked}) });

    const lobby=document.createElement('p');lobby.id='raceV42Lobby';lobby.className='race-v42-lobby';
    document.querySelector('.lobby-copy')?.append(lobby);
    const previousShowLobby=showRaceLobby;
    showRaceLobby=data=>{previousShowLobby(data);refreshLobby()};
    const previousRenderLobby=renderLobbyPlayers;
    renderLobbyPlayers=players=>{previousRenderLobby(players);refreshLobby()};
    function refreshLobby(){
      const room=typeof raceRoomData!=='undefined'?raceRoomData:null;
      if(!room||room.scoringMode!=='accuracy'){lobby.hidden=true;return}
      const options=read(room);
      lobby.hidden=false;
      lobby.textContent=`Accuracy settings · −${options.reversePerError}% per mistake · ${options.reverseCap}% maximum · ${options.accuracyTarget}% goal${options.reverseFeedback?'':' · effects off'}`;
    }

    const liveSummary=document.createElement('div');liveSummary.id='raceV42TeacherSettings';
    liveSummary.className='race-v42-teacher-settings';liveSummary.hidden=true;
    $('raceLeaderboard')?.querySelector('.race-leaderboard-title')?.after(liveSummary);
    const goal=document.createElement('span');goal.className='race-v42-goal';goal.id='raceV42Goal';goal.hidden=true;
    $('racePlayerHud')?.append(goal);
    const previousRender=renderRace;
    renderRace=data=>{
      previousRender(data);
      const enabled=data.scoringMode==='accuracy';
      const options=read(data),host=raceMode==='host';
      liveSummary.hidden=!enabled||!host;
      if(!liveSummary.hidden)liveSummary.textContent=`Goal ${options.accuracyTarget}% · Reverse −${options.reversePerError}% per mistake (max ${options.reverseCap}%)`;
      const player=(data.players||[]).find(p=>p.id===racePlayerId);
      goal.hidden=!enabled||host||!player;
      if(!goal.hidden){
        const below=belowTarget(player,data);
        goal.classList.toggle('is-below-goal',below);
        goal.textContent=below?`⚠ Below ${options.accuracyTarget}% goal`:`✓ Accuracy goal: ${options.accuracyTarget}%`;
      }
      const nodes=$('raceLeaderboardList');
      if(nodes){
        [...nodes.children].forEach(node=>{
          let extra=node.querySelector('.race-v42-racer-info');
          if(!enabled||!host){if(extra)extra.remove();return}
          if(!extra){extra=document.createElement('small');extra.className='race-v42-racer-info';node.querySelector('.race-standing-main')?.append(extra)}
          const item=(data.players||[]).find(p=>String(p.id)===node.dataset.uid);
          if(!item){extra.textContent='';return}
          const debt=limitDebt(item.reverseDebt,data);
          const text=`${Math.max(0,Math.floor(Number(item.errors)||0))} mistakes · −${debt.toFixed(1)}% reverse`;
          extra.textContent=belowTarget(item,data)?`${text} · Below goal`:text;
          extra.classList.toggle('is-below-goal',belowTarget(item,data));
        });
      }
    };
  }
  return {defaults,read,limitDebt,addError,belowTarget,install};
});
