/* GLN Classroom Car Race v4.0 — teacher-selected educational scoring.
   Load after v3.2's race-experience.js to preserve the existing racing UI. */
(() => {
  'use strict';
  const scoring = window.GLNRaceScoring;
  if (!scoring) { console.error('Race v4 scoring file is missing.'); return; }
  const $ = id => document.getElementById(id);
  const currentMode = () => scoring.normalizeMode(raceRoomData?.scoringMode);
  const pts = (player, mode) => scoring.score(player, mode).toFixed(1);

  // Add the field to the already-initialized teacher builder without changing
  // existing selectors and game settings. Speed is the compatibility default.
  const settingsRow = document.querySelector('#createRaceForm .race-tool-row');
  const label = document.createElement('label');
  label.className = 'race-v4-field';
  label.htmlFor = 'raceScoringMode';
  label.append(document.createTextNode('Scoring mode'));
  const select = document.createElement('select');
  select.id = 'raceScoringMode';
  for (const [value, title] of Object.entries(scoring.modes)) select.add(new Option(title, value));
  select.value = 'speed';
  label.append(select);
  const explainer = document.createElement('p');
  explainer.id = 'raceScoringHint';
  explainer.className = 'race-v4-hint';
  explainer.textContent = scoring.details.speed;
  select.addEventListener('change', () => { explainer.textContent = scoring.details[select.value]; });
  settingsRow.append(label);
  settingsRow.after(explainer);
  const priorSettings = raceSettings;
  raceSettings = function () {
    return { ...priorSettings(), scoringMode: scoring.normalizeMode(select.value) };
  };

  // Every screen, export, podium and the overtaking animation reads the same
  // room scoring mode. Legacy rooms without this field remain Speed mode.
  raceRankPlayers = players => scoring.rank(players, currentMode(), raceRoomData?.lengthMode || 'words');

  const badge = document.createElement('span');
  badge.id = 'raceV4Mode';
  badge.className = 'race-v4-mode';
  badge.textContent = 'Speed Race';
  badge.title = scoring.details.speed;
  document.querySelector('.race-status').append(badge);
  const lobbyMode = document.createElement('p');
  lobbyMode.className = 'race-v4-lobby-mode';
  lobbyMode.id = 'raceV4LobbyMode';
  document.querySelector('.lobby-copy').append(lobbyMode);
  const refreshLobbyMode = () => {
    const mode = raceRoomData ? currentMode() : scoring.normalizeMode(select.value);
    lobbyMode.textContent = `Scoring: ${scoring.modes[mode]}`;
  };
  const originalLobbyPlayers = renderLobbyPlayers;
  renderLobbyPlayers = players => { originalLobbyPlayers(players); refreshLobbyMode(); };
  const originalShowLobby = showRaceLobby;
  showRaceLobby = data => {
    originalShowLobby(data);
    refreshLobbyMode();
    const summary = document.querySelector('.lobby-copy .race-settings-summary');
    if (summary && raceMode === 'host') {
      // The source may append a new summary after repeated snapshots.
      summary.textContent += ' · ' + scoring.modes[currentMode()];
    }
  };

  const hud = $('racePlayerHud');
  if (hud) {
    const errors = document.createElement('span');
    errors.className = 'race-v4-errors';
    errors.innerHTML = 'Mistakes <strong id="raceV4Mistakes">0</strong>';
    hud.append(errors);
  }
  const info = document.createElement('p');
  info.className = 'race-v4-results-detail';
  info.id = 'raceV4ResultsDetail';
  ($('raceV3Winner') || $('raceResultsTitle')).after(info);

  const originalRenderResults = renderRaceResults;
  renderRaceResults = players => {
    originalRenderResults(players);
    const mode = currentMode();
    info.textContent = `${scoring.modes[mode]} · ${scoring.details[mode]}`;
    $('raceResults').dataset.scoringMode = mode;
    // The podium order is always silver, gold, bronze. Match by place,
    // never by display name, which may be duplicated after host renames.
    document.querySelectorAll('#racePodium .podium-place').forEach(card => {
      const place = Number(card.querySelector('.podium-block')?.dataset.place);
      const player = players[place - 1];
      const block = card.querySelector('.podium-block');
      if (!block || !player) return;
      let metric = block.querySelector('.race-v4-points');
      if (!metric) { metric = document.createElement('div'); metric.className = 'race-v4-points'; block.append(metric); }
      metric.textContent = mode === 'speed'
        ? `${Math.round(Number(player.progress)||0)}% complete · ${Math.max(0,Math.round(Number(player.errors)||0))} mistakes`
        : `${pts(player,mode)} points · ${Math.max(0,Math.round(Number(player.errors)||0))} mistakes`;
    });
    // Update the existing Other Racers rows rather than adding duplicate rows.
    [...$('raceOtherList').children].forEach((row, i) => {
      const player = players[i + 3];
      const stat = row.lastElementChild;
      if (!player || !stat) return;
      stat.textContent = `${Math.round(Number(player.wpm)||0)} WPM · ${Math.round(Number(player.accuracy??100))}% · ` +
        (mode === 'speed' ? `${Math.round(Number(player.progress)||0)}% done` : `${pts(player,mode)} pts`) +
        ` · ${Math.max(0,Math.round(Number(player.errors)||0))} mistakes`;
    });
  };

  const originalRender = renderRace;
  renderRace = data => {
    originalRender(data);
    const mode = scoring.normalizeMode(data.scoringMode);
    badge.textContent = scoring.modes[mode];
    badge.title = scoring.details[mode];
    const current = (data.players || []).find(p => p.id === racePlayerId);
    if (current && $('raceV4Mistakes')) $('raceV4Mistakes').textContent = String(Math.max(0, Math.round(Number(current.errors) || 0)));
    const ranked = scoring.rank(data.players, mode, data.lengthMode || 'words');
    const rows = $('raceLeaderboardList');
    [...rows.children].forEach((row, position) => {
      const player = ranked[position];
      const stats = row.querySelector('.race-standing-stats');
      if (!player || !stats) return;
      stats.textContent = mode === 'speed'
        ? `${Math.round(Number(player.progress)||0)}% · ${Math.round(Number(player.wpm)||0)} WPM`
        : `${pts(player,mode)} pts · ${Math.round(Number(player.accuracy??100))}%`;
    });
  };

  // Existing team races show average progress. For educational modes, show
  // each team's average of the same individual score used in the leaderboard.
  const previousEnhanceLanes = enhanceRaceLanes;
  enhanceRaceLanes = players => {
    previousEnhanceLanes(players);
    const mode = currentMode();
    const teamCount = Number(raceRoomData?.teamCount)||0;
    const board = $('teamScoreboard');
    if (mode === 'speed' || !board || !teamCount) return;
    for (let team=1;team<=teamCount;team++) {
      const members = (players||[]).filter(player => Number(player.team) === team);
      const average = members.length
        ? members.reduce((total,p) => total + scoring.score(p,mode),0)/members.length : 0;
      const item = board.children[team-1];
      if (item) item.textContent = `Team ${team}: ${average.toFixed(1)} pts`;
    }
  };

  // CSV exports use exactly the same ranking and mode as the final podium.
  // Protect cells from spreadsheet-formula injection in student-entered names.
  const csvField = value => {
    let str = String(value ?? '');
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(str)) str = "'" + str;
    return '"' + str.replace(/"/g, '""') + '"';
  };
  $('raceExportResults').onclick = () => {
    if (raceMode !== 'host' || !raceRoomData) return;
    const mode = currentMode();
    const players = scoring.rank(Object.values(raceRoomData.players||{}), mode, raceRoomData.lengthMode||'words');
    const rows = [
      ['Place','Name','Team','Mode','Score','WPM','Accuracy (%)','Progress (%)','Mistakes','Correct code units'],
      ...players.map((p,i) => [i+1,p.name||'',p.team?`Team ${p.team}`:'',scoring.modes[mode],pts(p,mode),
        Math.round(Number(p.wpm)||0),Math.round(Number(p.accuracy??100)),
        Math.round(Number(p.progress)||0),Math.round(Number(p.errors)||0),Math.round(Number(p.typedCount)||0)])
    ];
    const blob = new Blob(['\ufeff' + rows.map(row=>row.map(csvField).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url;link.download=`classroom-race-${raceCode}-v4.csv`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
})();
