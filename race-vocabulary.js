/* GLN Classroom Car Race v4.1 — vocabulary progress and per-word feedback.
   Word order is not changed: existing per-student shuffling preserves the
   teacher-selected multiset, and each student's custom passage stays saved. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GLNRaceVocabulary = api;
  if (typeof document !== 'undefined') api.install();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const tokenize = text => [...String(text||'').matchAll(/\S+/gu)].map((match, index) =>
    ({text:match[0],start:match.index,end:match.index+match[0].length,index}));
  // Whitespace between words belongs to the word that preceded it. This
  // prevents a mistyped Space from being attributed to the next vocabulary word.
  function wordAt(words, offset) {
    if (!words.length) return -1;
    const point=Math.max(0,Number(offset)||0);
    for(let i=0;i<words.length;i++){
      if(point<=words[i].end)return i;
      if(i+1<words.length&&point<words[i+1].start)return i;
    }
    return words.length-1;
  }
  function sanitizeErrors(data,maxCount) {
    const result={};
    if (!data || typeof data!=='object') return result;
    for (const [key,value] of Object.entries(data)) {
      if (!/^(0|[1-9][0-9]*)$/.test(key)) continue;
      const i=Number(key),n=Number(value);
      if (i>=maxCount||!Number.isFinite(n)||n<=0) continue;
      result[i]=Math.min(10000,Math.floor(n));
    }
    return result;
  }
  const countErrors=errors=>Object.values(errors).reduce((sum,n)=>sum+n,0);
  function summarize(players,defaultPassage,decode) {
    const byWord=new Map();
    for (const player of players||[]) {
      const text=decode(player.customPassage||defaultPassage);
      const words=tokenize(text),errs=sanitizeErrors(player.wordErrors,words.length);
      for (const [key,number] of Object.entries(errs)) {
        const token=words[Number(key)];if (!token) continue;
        const word=token.text.normalize('NFC');
        if (!byWord.has(word)) byWord.set(word,{word,errors:0,racers:new Set()});
        const record=byWord.get(word);record.errors+=number;
        record.racers.add(String(player.id||player.name||''));
      }
    }
    return [...byWord.values()].map(item=>({word:item.word,errors:item.errors,students:item.racers.size}))
      .sort((a,b)=>b.errors-a.errors||b.students-a.students||a.word.localeCompare(b.word));
  }
  let wordErrors={},passageKey='',flashIndex=-1,flashTimer=null;
  let teacherBox=null,tracker=null,summary=null;
  const el=id=>document.getElementById(id);
  const activeWords=()=>tokenize(racePassageText);
  const serialize=()=>({...wordErrors});
  const reset=()=>{wordErrors={};passageKey='';flashIndex=-1;clearTimeout(flashTimer)};
  function restore({saved,player,roundId,passage}) {
    const words=tokenize(passage);
    passageKey=String(roundId)+':'+passage;
    const serverErrors=sanitizeErrors(player?.wordErrors,words.length);
    const validSaved=saved&&String(saved.roundId)===String(roundId)&&saved.passage===passage;
    const localErrors=validSaved?sanitizeErrors(saved.wordErrors,words.length):{};
    const useLocal=validSaved&&Number(saved.errors||0)>=Number(player?.errors||0);
    wordErrors=useLocal?localErrors:serverErrors;
    flashIndex=-1;
    updateProgress();
  }
  function onInput({beforeLength,beforeErrors}) {
    if (raceMode!=='player'||!racePassageText)return;
    if (raceErrors>beforeErrors) {
      const words=activeWords();
      const index=wordAt(words,beforeLength);
      if (index>=0)wordErrors[index]=(wordErrors[index]||0)+(raceErrors-beforeErrors);
      flashIndex=index;
      clearTimeout(flashTimer);
      flashTimer=setTimeout(()=>{flashIndex=-1;renderRacePassage()},650);
      renderRacePassage();
    }
    updateProgress();
  }
  function updateProgress() {
    if(!tracker)return;
    tracker.hidden=raceMode!=='player'||raceLive.hidden;
    if(tracker.hidden)return;
    const words=activeWords();
    if(!words.length){tracker.hidden=true;return}
    const completed=words.filter(word=>raceTyped.length>=word.end).length;
    const active=wordAt(words,raceTyped.length);
    const pos=Math.min(words.length,completed+1);
    el('raceV41WordCount').textContent=`${completed} / ${words.length} words complete`;
    el('raceV41CurrentWord').textContent=completed===words.length?'All words typed':`Word ${pos} of ${words.length}`;
    el('raceV41WordMeter').style.width=`${completed/words.length*100}%`;
    tracker.setAttribute('aria-label',`${completed} of ${words.length} words completed`);
  }
  function renderWords() {
    const box=el('racePassage');if(!box||raceMode!=='player')return;
    const words=activeWords();
    if(!words.length)return;
    const fragment=document.createDocumentFragment();
    const active=raceTyped.length>=racePassageText.length?-1:wordAt(words,raceTyped.length);
    let cursor=0;
    words.forEach((word,i)=>{
      if(word.start>cursor){
        const space=document.createElement('span');space.className='race-v41-space';
        space.textContent=racePassageText.slice(cursor,word.start);
        if(raceTyped.length>=word.start)space.classList.add('done');
        else if(raceTyped.length>=cursor){space.classList.add('current');}
        fragment.append(space);
      }
      const unit=document.createElement('span');unit.className='race-v41-word';
      unit.dataset.wordIndex=String(i);
      unit.classList.toggle('is-active',i===active);
      unit.classList.toggle('is-completed',raceTyped.length>=word.end);
      unit.classList.toggle('has-mistake',i===flashIndex);
      const taken=Math.max(0,Math.min(word.text.length,raceTyped.length-word.start));
      if(taken){const done=document.createElement('span');done.className='done';done.textContent=word.text.slice(0,taken);unit.append(done)}
      const remaining=word.text.slice(taken);
      if(i===active&&remaining){
        const currentUnit=raceNextTextUnit(remaining);
        const current=document.createElement('span');current.className='current';current.textContent=currentUnit;
        unit.append(current,document.createTextNode(remaining.slice(currentUnit.length)));
      }else if(remaining)unit.append(document.createTextNode(remaining));
      fragment.append(unit);cursor=word.end;
    });
    if(cursor<racePassageText.length)fragment.append(document.createTextNode(racePassageText.slice(cursor)));
    box.replaceChildren(fragment);
    updateProgress();
  }
  function appendStat(container,word,errors,subtitle) {
    const item=document.createElement('div');item.className='race-v41-word-stat';
    const label=document.createElement('strong');label.textContent=word;
    const data=document.createElement('span');data.textContent=`${errors} ${errors===1?'mistake':'mistakes'}${subtitle?' · '+subtitle:''}`;
    item.append(label,data);container.append(item);
  }
  function renderSummary() {
    if(!summary||!raceRoomData||raceResults.hidden)return;
    summary.replaceChildren();
    const heading=document.createElement('h3');heading.textContent=raceMode==='host'?'Vocabulary review · Class':'My vocabulary review';
    summary.append(heading);
    if(raceMode==='host'){
      const players=Array.isArray(raceRoomData.players)?raceRoomData.players:Object.values(raceRoomData.players||{});
      const list=summarize(players,raceRoomData.passage,value=>racePassageInfo(value).text);
      if(!list.length){const note=document.createElement('p');note.textContent='No vocabulary mistakes were recorded in this race.';summary.append(note)}
      else{
        const note=document.createElement('p');note.textContent='Most-missed words across racers (including shuffled word lists):';summary.append(note);
        list.slice(0,8).forEach(item=>appendStat(summary,item.word,item.errors,`${item.students} ${item.students===1?'racer':'racers'}`));
      }
    }else if(raceMode==='player'){
      const words=activeWords();
      const localEntries=Object.entries(wordErrors).map(([idx,errors])=>({word:words[Number(idx)]?.text,errors}))
        .filter(item=>item.word&&item.errors>0).sort((a,b)=>b.errors-a.errors).slice(0,8);
      if(!localEntries.length){const note=document.createElement('p');note.textContent='No vocabulary mistakes recorded. Nice work!';summary.append(note)}
      else localEntries.forEach(item=>appendStat(summary,item.word,item.errors,''));
    }else summary.hidden=true;
  }
  function install() {
    if(!el('racePassage')||!el('racePlayerHud')||!el('raceResults'))return;
    tracker=document.createElement('div');tracker.id='raceV41Tracker';tracker.className='race-v41-tracker';tracker.hidden=true;
    tracker.innerHTML='<div class="race-v41-tracker-top"><strong id="raceV41CurrentWord">Word 1</strong><span id="raceV41WordCount">0 / 0 words complete</span></div><div class="race-v41-meter"><i id="raceV41WordMeter"></i></div>';
    el('racePassage').before(tracker);
    summary=document.createElement('section');summary.id='raceV41Summary';summary.className='race-v41-summary';
    el('raceOthers').after(summary);
    // The underlying comparison and correct/incorrect key rules remain intact.
    // Only the progress presentation is replaced with a word-aware renderer.
    const originalRenderPassage=renderRacePassage;
    renderRacePassage=()=>{
      if(raceMode!=='player')return originalRenderPassage();
      renderWords();
    };
    const originalBeginLiveRace=beginLiveRace;
    beginLiveRace=data=>{
      if(raceMode==='player')reset();
      originalBeginLiveRace(data);
      if(raceMode==='player')renderRacePassage();
      else tracker.hidden=true;
    };
    const originalRenderRace=renderRace;
    renderRace=data=>{
      originalRenderRace(data);
      if(raceMode==='player')updateProgress();
      // Results may be opened before Firebase flips room status to finished.
      if(!raceResults.hidden)renderSummary();
    };
    const originalRenderResults=renderRaceResults;
    renderRaceResults=players=>{originalRenderResults(players);renderSummary()};
    const originalCloseRace=closeRace;
    closeRace=()=>{reset();originalCloseRace();summary.replaceChildren()};
    const randomLabel=el('raceRandomize')?.closest('label');
    if(randomLabel)randomLabel.title='Each student gets the same selected words, but in a different order.';
    const countHint=document.createElement('small');countHint.className='race-v41-list-count';
    const input=el('raceWordsInput');
    if(input){input.closest('label').append(countHint);
      const refresh=()=>{
        const count=tokenize(gameLanguageAuto.raceWords(input.value).passage).length;
        const chosen=Math.max(1,Math.min(100,Number(el('raceWordCount')?.value)||12));
        const shown=el('raceLengthMode')?.value==='words'?Math.min(chosen,count):count;
        countHint.textContent=count?`${count} words in list · ${shown} included in this race`:'Paste vocabulary words to begin';
      };
      input.addEventListener('input',refresh);
      el('raceSavedList')?.addEventListener('change',refresh);
      el('raceWordCount')?.addEventListener('input',refresh);
      el('raceLengthMode')?.addEventListener('change',refresh);
      refresh();
    }
  }
  return {tokenize,wordAt,sanitizeErrors,summarize,serialize,restore,onInput,reset,install};
});
