/* GLN Classroom Car Race v5.0 — teacher-managed, balanced team competition.
   A lightweight additive layer over v4.2.1. No new Firebase rules or assets. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GLNRaceTeams = api;
  if (typeof document !== 'undefined') api.install();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const names = ['Red', 'Blue', 'Green', 'Gold'];
  const colors = ['#f05262', '#4c9bff', '#3ac69d', '#efbd46'];
  const clampTeamCount = value => [2, 3, 4].includes(Number(value)) ? Number(value) : 0;
  const validTeam = (value, count) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= count;
  const sanitize = value => Math.max(0, Math.min(100, Number(value) || 0));
  const fallbackScore = (p, mode) => mode === 'speed' ? sanitize(p?.progress) : sanitize(p?.progress) * Math.pow(sanitize(p?.accuracy ?? 100) / 100, mode === 'accuracy' ? 4 : 1.3);
  const activeScore = (p, mode) => mode === 'speed' ? sanitize(p?.progress) : (typeof window !== 'undefined' && window.GLNRaceScoring?.score ? window.GLNRaceScoring.score(p, mode) : fallbackScore(p, mode));
  function assign(players, teamCount) {
    const count = clampTeamCount(teamCount);
    if (!count) return 0;
    const sizes = Array(count).fill(0);
    (players || []).forEach(p => { if (validTeam(p?.team, count)) sizes[Number(p.team) - 1]++; });
    const smallest = Math.min(...sizes);
    return sizes.indexOf(smallest) + 1;
  }
  function balance(players, teamCount) {
    const count = clampTeamCount(teamCount);
    if (!count) return {};
    const sorted = [...(players || [])].sort((a, b) => (Number(a.joinedAt) || 0) - (Number(b.joinedAt) || 0) || String(a.id).localeCompare(String(b.id)));
    return Object.fromEntries(sorted.map((p, i) => [String(p.id), i % count + 1]));
  }
  function standings(players, teamCount, mode = 'speed') {
    const count = clampTeamCount(teamCount);
    if (!count) return [];
    const groups = Array.from({ length: count }, (_, i) => ({ team: i + 1, name: `${names[i]} Team`, color: colors[i], members: [], score: 0, progress: 0, accuracy: 0 }));
    (players || []).forEach(p => { if (validTeam(p?.team, count)) groups[Number(p.team) - 1].members.push(p); });
    groups.forEach(t => {
      if (!t.members.length) return;
      const total = (fn) => t.members.reduce((sum, p) => sum + fn(p), 0);
      t.score = total(p => activeScore(p, mode)) / t.members.length;
      t.progress = total(p => sanitize(p.progress)) / t.members.length;
      t.accuracy = total(p => sanitize(p.accuracy ?? 100)) / t.members.length;
    });
    return groups.sort((a, b) => {
      if (!a.members.length || !b.members.length) return Number(Boolean(b.members.length)) - Number(Boolean(a.members.length));
      return b.score - a.score || b.progress - a.progress || b.accuracy - a.accuracy || a.team - b.team;
    });
  }
  const $ = id => document.getElementById(id);
  function install() {
    const form = $('createRaceForm'), teamsSelect = $('raceTeams'), join = $('joinRaceForm');
    if (!form || !teamsSelect || !join || $('raceV5TeamSetup')) return;
    const teamSetup = document.createElement('section');
    teamSetup.id = 'raceV5TeamSetup'; teamSetup.className = 'race-v5-setup';
    teamSetup.innerHTML = '<label>Team assignment<select id="raceV5Assignment"><option value="balanced">Automatically balance teams</option><option value="teacher">Teacher assigns in the lobby</option></select></label><p>Teams are color-coded on the track. Teachers can reassign racers before starting.</p>';
    teamsSelect.closest('label').after(teamSetup);
    function updateTeamSetup() { teamSetup.hidden = !clampTeamCount(teamsSelect.value); }
    teamsSelect.addEventListener('change', updateTeamSetup); updateTeamSetup();
    const oldSettings = raceSettings;
    raceSettings = () => ({ ...oldSettings(), teamAssignment: $('raceV5Assignment').value });

    const lobbyPanel = document.createElement('section');
    lobbyPanel.id = 'raceV5LobbyTeams'; lobbyPanel.className = 'race-v5-lobby'; lobbyPanel.hidden = true;
    lobbyPanel.innerHTML = '<div class="race-v5-lobby-header"><strong>Team lineup</strong><button type="button" id="raceV5Balance">Balance teams</button></div><div id="raceV5LobbyCounts" class="race-v5-lobby-counts"></div><p class="race-v5-note">Use the team dropdown beside a racer to move them before the race starts.</p>';
    $('lobbyPlayers').before(lobbyPanel);
    const balanceButton = $('raceV5Balance');
    const liveBoard = document.createElement('section');
    liveBoard.id = 'raceV5TeamBoard'; liveBoard.className = 'race-v5-team-board'; liveBoard.hidden = true;
    liveBoard.setAttribute('aria-label', 'Live team standings');
    $('raceDashboard').before(liveBoard);
    const resultsPanel = document.createElement('section');
    resultsPanel.id = 'raceV5TeamResults'; resultsPanel.className = 'race-v5-team-results'; resultsPanel.hidden = true;
    $('racePodium').before(resultsPanel);
    const playerBadge = document.createElement('span');
    playerBadge.id = 'raceV5PlayerTeam'; playerBadge.className = 'race-v5-player-badge'; playerBadge.hidden = true;
    $('racePlayerHud').prepend(playerBadge);
    let lastTeamResultsKey = ''; 

    const getRoom = () => typeof raceRoomData === 'object' ? raceRoomData : null;
    const getPlayers = room => Object.values(room?.players || {});
    const getMode = room => window.GLNRaceScoring?.normalizeMode(room?.scoringMode) || 'speed';
    const teacherReady = room => raceMode === 'host' && room?.status === 'waiting' && room.hostUid === currentUser?.uid;
    function notify(message) { if (typeof showToast === 'function') showToast(message); }
    function teamText(team) { return names[team - 1] + ' Team'; }
    function updateLobby(players) {
      const room = getRoom(), count = clampTeamCount(room?.teamCount);
      lobbyPanel.hidden = !count || !!raceLobby.hidden;
      if (!count || lobbyPanel.hidden) return;
      const current = standings(players, count, getMode(room)).sort((a, b) => a.team - b.team);
      const wrap = $('raceV5LobbyCounts'); wrap.replaceChildren();
      current.forEach(t => {
        const chip = document.createElement('span'); chip.className = 'race-v5-team-count';
        chip.style.setProperty('--team-accent', t.color);
        chip.textContent = `${t.name} · ${t.members.length} ${t.members.length === 1 ? 'racer' : 'racers'}`;
        wrap.append(chip);
      });
      const editable = teacherReady(room);
      balanceButton.hidden = !editable;
      const chips = [...$('lobbyPlayers').querySelectorAll('.lobby-player-chip')];
      chips.forEach((chip, i) => {
        const p = players[i]; if (!p) return;
        const team = validTeam(p.team, count) ? Number(p.team) : 0;
        chip.dataset.team = String(team);
        chip.style.setProperty('--team-accent', team ? colors[team - 1] : 'transparent');
        let control = chip.querySelector('.race-v5-assign');
        if (!editable) { if (control) control.remove(); return; }
        if (!control) {
          control = document.createElement('select'); control.className = 'race-v5-assign';
          control.setAttribute('aria-label', `Assign team for ${p.name || 'racer'}`);
          for (let n = 1; n <= count; n++) control.add(new Option(teamText(n), String(n)));
          chip.append(control);
        }
        control.value = String(team || 1);
        control.onchange = async () => {
          const next = Number(control.value);
          if (!teacherReady(getRoom()) || !validTeam(next, count)) return;
          control.disabled = true;
          try {
            const snap = await fb.get(roomRef(raceCode));
            if (!snap.exists() || snap.val().hostUid !== currentUser.uid || snap.val().status !== 'waiting' || !snap.val().players?.[p.id]) return;
            await fb.update(playerRef(raceCode, p.id), {team: next});
          } catch (error) { console.warn('Team assignment failed', error); notify('Could not change team. Try again.'); }
          finally { control.disabled = false; }
        };
      });
    }
    balanceButton.onclick = async () => {
      const room = getRoom(); if (!teacherReady(room)) return;
      balanceButton.disabled = true;
      try {
        const snap = await fb.get(roomRef(raceCode));
        const fresh = snap.val(); if (!fresh || !teacherReady(fresh)) return;
        const mapping = balance(getPlayers(fresh), fresh.teamCount);
        const changes = {};
        for (const [uid, team] of Object.entries(mapping)) changes[`players/${uid}/team`] = team;
        if (Object.keys(changes).length) await fb.update(roomRef(raceCode), changes);
        notify('Teams balanced');
      } catch (error) { console.warn('Team balance failed', error); notify('Could not balance teams'); }
      finally { balanceButton.disabled = false; }
    };
    const oldRenderLobby = renderLobbyPlayers;
    renderLobbyPlayers = players => { oldRenderLobby(players); updateLobby(players); };
    const oldShowLobby = showRaceLobby;
    showRaceLobby = data => { oldShowLobby(data); updateLobby(data.players || []); };

    function renderBoard(room, players) {
      const count = clampTeamCount(room.teamCount);
      const active = Boolean(count) && !raceLive.hidden;
      liveBoard.hidden = !active;
      raceStage.classList.toggle('race-v5-team-mode', active);
      if (!active) { playerBadge.hidden = true; return; }
      const ranked = standings(players, count, getMode(room));
      const mode = getMode(room);
      liveBoard.replaceChildren();
      const heading = document.createElement('div'); heading.className = 'race-v5-board-header';
      const title = document.createElement('strong'); title.textContent = '🏁 Team Standings';
      const rule = document.createElement('span'); rule.textContent = mode === 'speed' ? 'Average car progress' : 'Average performance points';
      heading.append(title, rule); liveBoard.append(heading);
      const list = document.createElement('div'); list.className = 'race-v5-board-list';
      ranked.forEach((team, place) => {
        const card = document.createElement('div'); card.className = 'race-v5-team-card';
        card.dataset.team = String(team.team); card.style.setProperty('--team-accent', team.color);
        if (team.members.length && place === 0) card.classList.add('is-leading');
        const label = document.createElement('strong'); label.textContent = `${team.members.length ? place + 1 + '. ' : '— '}${team.name}`;
        const stat = document.createElement('span');
        stat.textContent = team.members.length ? `${team.score.toFixed(1)}${mode === 'speed' ? '%' : ' pts'} · ${team.members.length} ${team.members.length === 1 ? 'racer' : 'racers'}` : 'Waiting for racers';
        const track = document.createElement('div'); track.className = 'race-v5-team-meter';
        const bar = document.createElement('i'); bar.style.width = `${Math.max(0, Math.min(100, team.score))}%`;
        track.append(bar); card.append(label, stat, track); list.append(card);
      });
      liveBoard.append(list);
      const me = players.find(p => p.id === racePlayerId);
      const team = Number(me?.team);
      playerBadge.hidden = raceMode !== 'player' || !validTeam(team, count);
      if (!playerBadge.hidden) {
        playerBadge.textContent = teamText(team);
        playerBadge.style.setProperty('--team-accent', colors[team - 1]);
      }
      // Keep each student's chosen car paint. Team color belongs to the lane stripe and label.
      $('raceTrack').querySelectorAll('.race-lane').forEach(lane => {
        const p = players.find(item => String(item.id) === lane.dataset.playerId);
        const t = Number(p?.team);
        lane.dataset.team = validTeam(t, count) ? String(t) : '';
        lane.style.setProperty('--team-accent', validTeam(t, count) ? colors[t - 1] : 'transparent');
      });
      $('raceLeaderboardList')?.querySelectorAll('.race-leaderboard-row').forEach(row => {
        const p = players.find(item => String(item.id) === row.dataset.uid);
        const t = Number(p?.team);
        row.style.setProperty('--team-accent', validTeam(t, count) ? colors[t - 1] : 'transparent');
        row.classList.toggle('has-team', validTeam(t, count));
      });
    }
    function renderResults(room, players) {
      const count = clampTeamCount(room.teamCount);
      resultsPanel.hidden = !count || room.status !== 'finished';
      if (resultsPanel.hidden) { lastTeamResultsKey = ''; return; }
      const ranked = standings(players, count, getMode(room));
      const winner = ranked.find(t => t.members.length);
      if (!winner) return;
      const key = JSON.stringify([raceCode, room.roundId, players.map(p => [p.id, p.team, p.progress, p.accuracy]), room.status]);
      if (lastTeamResultsKey === key) return;
      lastTeamResultsKey = key;
      resultsPanel.replaceChildren();
      const tied = ranked.filter(t => t.members.length && Math.abs(t.score - winner.score) < 1e-7 && Math.abs(t.progress - winner.progress) < 1e-7 && Math.abs(t.accuracy - winner.accuracy) < 1e-7);
      const heading = document.createElement('h3'); heading.textContent = tied.length > 1 ? `🤝 Tie: ${tied.map(t => t.name).join(' & ')}` : `🏆 ${winner.name} wins!`;
      heading.style.setProperty('--team-accent', winner.color);
      const sub = document.createElement('p'); sub.textContent = 'Team scores use the average of every member, so teams of different sizes can compete fairly.';
      const lineup = document.createElement('div'); lineup.className = 'race-v5-results-lineup';
      ranked.filter(t => t.members.length).forEach((t, i) => {
        const pill = document.createElement('div'); pill.className = 'race-v5-results-team';
        pill.style.setProperty('--team-accent', t.color);
        const name = document.createElement('strong'); name.textContent = `${i + 1}. ${t.name}`;
        const score = document.createElement('span'); score.textContent = `${t.score.toFixed(1)} ${getMode(room) === 'speed' ? '% progress' : 'points'} · ${t.members.length} ${t.members.length === 1 ? 'racer' : 'racers'}`;
        pill.append(name, score); lineup.append(pill);
      });
      resultsPanel.append(heading, sub, lineup);
      const announcement = $('raceV3Winner');
      if (announcement && tied.length > 1) announcement.textContent = `🤝 Team race tied: ${tied.map(t => t.name).join(' & ')}`;
      else if (announcement) announcement.textContent = raceMode === 'player'
        ? (Number(players.find(p => p.id === racePlayerId)?.team) === winner.team ? `🎉 Your ${winner.name} won!` : `🏆 ${winner.name} won the team race!`)
        : `🏆 ${winner.name} wins the team race!`;
    }
    const oldRenderRace = renderRace;
    renderRace = room => {
      oldRenderRace(room);
      const players = room.players || [];
      renderBoard(room, players);
      renderResults(room, players);
    };
    const oldOpenRace = openRace;
    openRace = () => { lastTeamResultsKey = ''; oldOpenRace(); };
    const oldCloseRace = closeRace;
    closeRace = () => {
      liveBoard.hidden = true; lobbyPanel.hidden = true; resultsPanel.hidden = true;
      playerBadge.hidden = true; raceStage.classList.remove('race-v5-team-mode');
      oldCloseRace();
    };
  }
  return { names, colors, assign, balance, standings, install };
});
