/* GLN Classroom Car Race v4.0 — shared, deterministic scoring.
   No DOM / Firebase dependencies; safe to test in Node and browsers. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GLNRaceScoring = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const modes = { speed: 'Speed Race', accuracy: 'Accuracy Challenge', balanced: 'Balanced Race' };
  const details = {
    speed: 'Correct typing progress determines position. In a word race, the first student to finish wins.',
    accuracy: 'Correct progress matters, but mistakes carry a strong penalty. In word races, finished passages always rank ahead of unfinished passages.',
    balanced: 'Correct progress and accuracy both contribute to the score. In word races, finished passages always rank ahead of unfinished passages.'
  };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : min));
  const normalizeMode = value => Object.prototype.hasOwnProperty.call(modes, value) ? value : 'speed';
  const percent = player => clamp(player?.progress, 0, 100) / 100;
  const precision = player => clamp(player?.accuracy ?? 100, 0, 100) / 100;
  function score(player, mode) {
    const progress = percent(player), accuracy = precision(player);
    if (!progress) return 0; // 100% placeholder accuracy cannot win without typing.
    switch (normalizeMode(mode)) {
      case 'accuracy': return 100 * Math.sqrt(progress) * Math.pow(accuracy, 4);
      case 'balanced': return 100 * progress * Math.pow(accuracy, 1.3);
      default: return 100 * progress;
    }
  }
  function compareFallback(a, b) {
    return (Number(a.joinedAt) || 0) - (Number(b.joinedAt) || 0)
      || String(a.id || '').localeCompare(String(b.id || ''));
  }
  function rank(players, mode = 'speed', lengthMode = 'words') {
    mode = normalizeMode(mode);
    return [...(players || [])].sort((a, b) => {
      const aFinished = Number(a.finishedAt) > 0, bFinished = Number(b.finishedAt) > 0;
      if (mode === 'speed') {
        // Maintain the existing v3.2 Speed Race ranking for compatibility.
        if (aFinished && bFinished && a.finishedAt !== b.finishedAt) return a.finishedAt - b.finishedAt;
        if (aFinished !== bFinished) return aFinished ? -1 : 1;
        const diff = Number(b.progress || 0) - Number(a.progress || 0);
        if (Math.abs(diff) > .0001) return diff;
        const accuracy = Number(b.accuracy ?? 100) - Number(a.accuracy ?? 100);
        if (accuracy) return accuracy;
        const speed = Number(b.wpm || 0) - Number(a.wpm || 0);
        return speed || compareFallback(a, b);
      }
      // A complete passage is a qualification in word races. In timed races
      // nobody has to finish the whole passage to qualify.
      if (lengthMode !== 'time') {
        const completedA = percent(a) >= 1, completedB = percent(b) >= 1;
        if (completedA !== completedB) return completedA ? -1 : 1;
      }
      const points = score(b, mode) - score(a, mode);
      if (Math.abs(points) > 1e-8) return points;
      const accuracy = precision(b) - precision(a);
      if (accuracy) return accuracy;
      const progress = percent(b) - percent(a);
      if (progress) return progress;
      const speed = Number(b.wpm || 0) - Number(a.wpm || 0);
      if (speed) return speed;
      if (aFinished && bFinished && a.finishedAt !== b.finishedAt) return a.finishedAt - b.finishedAt;
      return compareFallback(a, b);
    });
  }
  return { modes, details, normalizeMode, score, rank };
});
