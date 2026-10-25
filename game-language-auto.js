/* GLN games: local display-keyboard choice for mixed-language prompts.
   Does not modify typed Unicode, scores, room language, or keyboard mappings. */
(function(){
'use strict';
const names={ksw:'Sgaw Karen',pwo:'Pwo Karen',en:'English'};
const normalize=value=>['ksw','pwo','en'].includes(value)?value:'ksw';
const myanmar=/[\u1000-\u109f\ua9e0-\ua9ff\uaa60-\uaa7f]/u;
const latin=/[A-Za-z\u00c0-\u024f]/u;
const sgawDistinct=/[ၥၢၣၤၪၑ၎၌]|ရှ|ာ်/u;
const pwoDistinct=/[ေၞၟၯၰၜၚဳႋ္ာ]|ါဲ/u;
// Sgaw and Pwo share many characters: ambiguity must keep the room's Karen default.
function detect(text,fallback='ksw'){
  const source=String(text||'');fallback=normalize(fallback);
  const karenFallback=fallback==='en'?'ksw':fallback;
  if(myanmar.test(source)){
    const sgaw=sgawDistinct.test(source),pwo=pwoDistinct.test(source.replace(/ာ်/g,''));
    if(sgaw&&!pwo)return'ksw';
    if(pwo&&!sgaw)return'pwo';
    return karenFallback;
  }
  if(latin.test(source))return'en';
  return fallback;
}
// For adjacent English/Karen runs without spaces, switch at the script boundary too.
function at(text,index,fallback='ksw',hints=[]){
  text=String(text||'');const pos=Math.max(0,Math.min(text.length,Number(index)||0));
  const overrides=Array.isArray(hints)?hints:[];
  for(const item of overrides){
    if(item&&Number(item.start)<=pos&&pos<Number(item.end)&&names[item.language])return item.language;
  }
  // Split at whitespace or transitions between Latin and Myanmar. Unicode combining
  // marks are retained with their respective script run when possible.
  const pieces=[];let start=-1,mode='';
  const chars=Array.from(text);
  let offset=0;
  function kind(char){if(myanmar.test(char))return'myanmar';if(latin.test(char))return'latin';if(/\s/u.test(char))return'space';return'neutral'}
  for(const c of chars){
    let category=kind(c);
    if(category==='neutral'&&mode)category=mode;
    if(category==='space'){
      if(start>=0)pieces.push({start,end:offset,text:text.slice(start,offset)});
      start=-1;mode='';
    }else if(start<0){start=offset;mode=category}
    else if(category!==mode&&category!=='neutral'&&mode!=='neutral'){
      pieces.push({start,end:offset,text:text.slice(start,offset)});start=offset;mode=category;
    }else if(mode==='neutral')mode=category;
    offset+=c.length;
  }
  if(start>=0)pieces.push({start,end:text.length,text:text.slice(start)});
  const piece=pieces.find(p=>p.start<=pos&&p.end>pos)||pieces.find(p=>p.start>=pos)||pieces[pieces.length-1];
  if(!piece)return normalize(fallback);
  // Overrides should be checked against the whole run, including leading spaces.
  const override=overrides.find(x=>x&&x.start<piece.end&&x.end>piece.start&&names[x.language]);
  return override?override.language:detect(piece.text,fallback);
}
function explicitEntry(value){
  const match=String(value||'').match(/^\s*\[(sgaw|sgaw karen|ksw|pwo|pwo karen|english|en)\]\s*/i);
  const language=match?(/^(sgaw|sgaw karen|ksw)$/i.test(match[1])?'ksw':/^(pwo|pwo karen)$/i.test(match[1])?'pwo':'en'):null;
  return{text:match?String(value).slice(match[0].length).trim():String(value||'').trim(),language};
}
function raceWords(value){
  const raw=String(value||'').replace(/[,;\n\r\t]+/g,' ').trim().split(/\s+/).filter(Boolean);
  const parts=[],hints=[];let pending=null,pos=0;
  for(let i=0;i<raw.length;i++){
    const entire=explicitEntry(raw[i]);
    if(entire.language&&!entire.text){pending=entire.language;continue}
    const language=entire.language||pending;pending=null;
    const word=entire.text;
    if(!word)continue;
    if(parts.length)pos++;
    const start=pos;parts.push(word);pos+=word.length;
    if(language)hints.push({start,end:pos,language});
  }
  return{passage:parts.join(' ').slice(0,800),hints:hints.filter(h=>h.end<=800)};
}
window.GLN_GAME_LANGUAGE_AUTO=Object.freeze({normalize,names,detect,at,explicitEntry,raceWords});
})();
