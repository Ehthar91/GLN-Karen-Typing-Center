const editor=document.querySelector('#editor');const keyboard=document.querySelector('#keyboard');const count=document.querySelector('#count');const toast=document.querySelector('#toast');let shifted=false;let savedStart=0,savedEnd=0;
function isMobileDevice(){return matchMedia('(max-width:720px)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)}
function applyPhoneFit(){document.documentElement.classList.toggle('phone-fit',isMobileDevice())}
function clampSelection(){
  const n=editor.value.length;
  savedStart=Math.max(0,Math.min(savedStart,n));
  savedEnd=Math.max(savedStart,Math.min(savedEnd,n));
}

// Mobile uses one internal caret position. It is updated only when the user
// actually taps/selects text in the editor, never when a keyboard key is pressed.
function readUserSelection(){
  if(!isMobileDevice())return;
  try{
    const s=editor.selectionStart;
    const e=editor.selectionEnd;
    if(Number.isInteger(s)&&Number.isInteger(e)){
      savedStart=s; savedEnd=e; clampSelection();
    }
  }catch{}
  updateVisualCaret();
}

let visualCaret=null,caretMirror=null;
function ensureVisualCaret(){
  if(!isMobileDevice())return;
  const card=editor.closest('.editor-card');
  if(card && getComputedStyle(card).position==='static') card.style.position='relative';
  if(!visualCaret){
    visualCaret=document.createElement('div');
    visualCaret.className='mobile-visual-caret';
    (card||editor.parentElement).appendChild(visualCaret);
  }
  if(!caretMirror){
    caretMirror=document.createElement('div');
    caretMirror.className='mobile-caret-mirror';
    document.body.appendChild(caretMirror);
  }
}
function updateVisualCaret(){
  if(!isMobileDevice())return;
  ensureVisualCaret(); clampSelection();
  const card=editor.closest('.editor-card');
  if(!card||!visualCaret)return;
  const pos=savedStart;
  const cs=getComputedStyle(editor),er=editor.getBoundingClientRect(),cr=card.getBoundingClientRect(),m=caretMirror;
  ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','textTransform','textIndent','lineHeight','wordSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].forEach(k=>m.style[k]=cs[k]);
  m.style.width=er.width+'px'; m.style.boxSizing=cs.boxSizing; m.style.whiteSpace='pre-wrap'; m.style.overflowWrap='break-word'; m.style.wordBreak=cs.wordBreak;
  m.textContent='';
  m.appendChild(document.createTextNode(editor.value.slice(0,pos)));
  const marker=document.createElement('span'); marker.textContent='\u200b'; m.appendChild(marker);
  const line=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.8;
  const left=(er.left-cr.left)+marker.offsetLeft-editor.scrollLeft;
  const top=(er.top-cr.top)+marker.offsetTop-editor.scrollTop;
  const editorLeft=er.left-cr.left, editorTop=er.top-cr.top;
  const inside=left>=editorLeft+2&&left<=editorLeft+er.width-2&&top+line>=editorTop&&top<=editorTop+er.height;
  if(!inside){ visualCaret.classList.remove('show'); return; }
  visualCaret.style.left=Math.round(left)+'px';
  visualCaret.style.top=Math.round(top)+'px';
  visualCaret.style.height=Math.max(22,Math.min(line,editorTop+er.height-top-2))+'px';
  visualCaret.classList.add('show');
}

function putNativeSelectionAtSaved(){
  if(!isMobileDevice())return;
  clampSelection();
  try{editor.setSelectionRange(savedStart,savedEnd)}catch{}
  updateVisualCaret();
}

if(isMobileDevice()){
  editor.readOnly=false;
  editor.setAttribute('inputmode','none');
  editor.setAttribute('virtualkeyboardpolicy','manual');
  editor.removeAttribute('autofocus');
  // Only direct interaction with the editor is allowed to move our saved caret.
  editor.addEventListener('focus',()=>setTimeout(readUserSelection,0));
  editor.addEventListener('click',()=>setTimeout(readUserSelection,0));
  editor.addEventListener('touchend',()=>setTimeout(readUserSelection,30),{passive:true});
  editor.addEventListener('scroll',updateVisualCaret,{passive:true});
  addEventListener('resize',updateVisualCaret);
  addEventListener('scroll',updateVisualCaret,{passive:true});
}
addEventListener('resize',applyPhoneFit);applyPhoneFit();
// KarenKNU S'gaw Karen Unicode map: [English key, normal, shifted].
const rows=[
[['`','ပ','ြု'],['1','၁','ည'],['2','၂','ၥ'],['3','၃','£'],['4','၄','၃'],['5','၅','ရ'],['6','၆','၄'],['7','၇','ရ'],['8','၈','ဂ'],['9','၉','('],['0','ဝ',')'],['-','ြ','ြ'],['=','—','ှု']],
[['q','ဆ','ခ'],['w','တ','တ'],['e','န','န'],['r','မ','ၤ'],['t','အ','၎'],['y','ပ','၌'],['u','က','ၢ'],['i','င','ၢ်'],['o','သ','ၣ်'],['p','စ','ာ်'],['[','ဟ','ဧ'],[']','=','ဂ'],['\\','ၪ','ၑ']],
[['a','ေ','∕'],['s','ျ','ှ'],['d','ိ','ီ'],['f','်','ၠ'],['g','ါ','ွ'],['h','့','ံ'],['j','ြ','ဲ'],['k','ု','ု'],['l','ူ','ူ'],[';','း','ၤ'],["'",'ဒ','ီ']],
[['z','ဖ','ဇ'],['x','ထ','ဌ'],['c','ခ','ဃ'],['v','လ','ျ့'],['b','ဘ','ြ'],['n','ည','ဒ'],['m','ာ်','ျ့'],[',','ယ',','],['.','ၣ်','ၢ်'],['/','”','“']]
];
const special=[['Backspace','Backspace','⌫'],[' ','Space','Space'],['Enter','Enter','↵ Enter']];
function makePhoneShiftKey(){const b=document.createElement('button');b.type='button';b.className='key phone-modifier phone-shift'+(shifted?' active':'');b.dataset.code='Shift';b.setAttribute('aria-label',shifted?'Shift on':'Shift off');b.setAttribute('aria-pressed',String(shifted));b.innerHTML='<span class="shift-arrow">⇧</span>';b.addEventListener('pointerdown',e=>{if(isMobileDevice())e.preventDefault()});b.onclick=()=>{setShift(!shifted);putNativeSelectionAtSaved()};return b}
function render(){keyboard.innerHTML='';const mobile=isMobileDevice();rows.forEach((row,rowIndex)=>{const el=document.createElement('div');el.className='key-row'+(mobile&&rowIndex===0?' phone-top-row':'')+(mobile&&rowIndex===3?' phone-letter-bottom':'');if(mobile&&rowIndex===3)el.appendChild(makePhoneShiftKey());row.forEach(([latin,normal,shift])=>el.appendChild(makeKey(latin,shifted?shift:normal)));if(mobile&&rowIndex===0){const back=makeKey('Backspace','⌫','Backspace');back.classList.add('phone-modifier','phone-backspace','phone-backspace-top');el.appendChild(back)}keyboard.appendChild(el)});const bottom=document.createElement('div');bottom.className='key-row mobile-bottom-row';special.forEach(([value,label,display])=>{if(mobile&&value==='Backspace')return;const b=makeKey(label,display,value);b.classList.add('wide');if(value===' ')b.classList.add('space');bottom.appendChild(b)});keyboard.appendChild(bottom)}
function makeKey(label,char,value=char){const b=document.createElement('button');b.type='button';b.className='key';b.dataset.value=value;b.dataset.code=label;b.innerHTML=`<small>${label==='Space'?'':label}</small>${char}`;b.addEventListener('pointerdown',e=>{if(isMobileDevice())e.preventDefault()});b.addEventListener('click',()=>insert(value));return b}
function insert(value){const mobile=isMobileDevice();let start=mobile?savedStart:(editor.selectionStart??editor.value.length);let end=mobile?savedEnd:(editor.selectionEnd??start);if(mobile){clampSelection();start=savedStart;end=savedEnd}if(value==='Backspace'){if(start!==end){editor.setRangeText('',start,end,'end');savedStart=savedEnd=start}else if(start>0){const before=[...editor.value.slice(0,start)];const remove=before.at(-1)||'';const next=start-remove.length;editor.setRangeText('',next,start,'end');savedStart=savedEnd=next}}else{const text=value==='Enter'?'\n':value;editor.setRangeText(text,start,end,'end');savedStart=savedEnd=start+text.length}updateCount();if(mobile){if(shifted&&value!=='Backspace'&&value!=='Enter'&&value!==' '){setShift(false)}putNativeSelectionAtSaved()}else editor.focus()}
function updateCount(){const n=[...editor.value].length;count.textContent=`${n} ${n===1?'character':'characters'}`}
function setShift(on){shifted=on;document.querySelector('#normalMode').classList.toggle('active',!on);document.querySelector('#shiftMode').classList.toggle('active',on);render()}
document.querySelector('#normalMode').onclick=()=>setShift(false);document.querySelector('#shiftMode').onclick=()=>setShift(true);
function physicalKey(e){if(e.code.startsWith('Key'))return e.code.slice(3).toLowerCase();if(e.code.startsWith('Digit'))return e.code.slice(5);return({Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'}[e.code]||e.key.toLowerCase())}
editor.addEventListener('input',updateCount);editor.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Shift'){setShift(true);return}const key=physicalKey(e);const match=rows.flat().find(([mapped])=>mapped===key);if(match){e.preventDefault();insert(e.shiftKey?match[2]:match[1]);flashKey(match[0])}});editor.addEventListener('keyup',e=>{if(e.key==='Shift')setShift(false)});
function flashKey(code){const b=[...document.querySelectorAll('.key')].find(k=>k.dataset.code===code);if(b){b.classList.add('pressed');setTimeout(()=>b.classList.remove('pressed'),110)}}
document.querySelector('#copy').onclick=async()=>{if(!editor.value){showToast('Type something first');return}try{await navigator.clipboard.writeText(editor.value)}catch{editor.select();document.execCommand('copy')}document.querySelector('#copyText').textContent='Copied';showToast('Copied to clipboard');setTimeout(()=>document.querySelector('#copyText').textContent='Copy text',1400)};
document.querySelector('#clear').onclick=()=>{if(!editor.value)return;editor.value='';savedStart=savedEnd=0;updateCount();if(!isMobileDevice())editor.focus();putNativeSelectionAtSaved();showToast('Text cleared')};document.querySelector('#selectAll').onclick=()=>{editor.focus();editor.select();if(isMobileDevice()){savedStart=0;savedEnd=editor.value.length;updateVisualCaret()}};document.querySelector('#undo').onclick=()=>{editor.focus();document.execCommand('undo');updateCount()};document.querySelector('#toggleGuide').onclick=()=>{const g=document.querySelector('#guide');g.hidden=!g.hidden};
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1600)}render();updateCount();
