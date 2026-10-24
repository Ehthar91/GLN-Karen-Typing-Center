/* Dedicated GLN Unicode Type page. Keyboard maps shared with the main site. */
(() => {
  'use strict';
  const layouts=window.GLN_TYPING_LAYOUTS;
  if(!layouts){console.error('The shared GLN keyboard layout did not load.');return;}
  const $=id=>document.getElementById(id);
  const editor=$('typeEditor'), keyboard=$('typeKeyboard'), viewport=$('keyboardWrap');
  const settings={ksw:{title:'Type in Sgaw Karen',name:'Sgaw Karen',tag:'ksw',placeholder:'ဒိလီၤလံာ်ဖဲအံၤ...',help:'GLN Sgaw Karen Unicode layout · Hold Shift for the second layer.'},pwo:{title:'Type in Pwo Karen',name:'Pwo Karen',tag:'kjp',placeholder:'Type Pwo Karen here…',help:'Eastern Pwo Karen Unicode layout · Hold Shift for the second layer.'},en:{title:'Type in English',name:'English',tag:'en',placeholder:'Type here…',help:'Standard English QWERTY layout · Hold Shift for capital letters and symbols.'}};
  const validLang=['ksw','pwo','en'];
  const read=(key,fallback='')=>{try{return localStorage.getItem(key)??fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{return false}};
  const safeLang=value=>validLang.includes(value)?value:'ksw';
  const draftKey=value=>`glnStandaloneTypeDraftV1:${value}`;
  let lang=safeLang(read('typingLanguage','ksw'));
  let shifted=false, toastTimer=0, saveTimer=0, savedDraft='';
  let fontSize=Number(read('glnStandaloneTypeFontSize','32'));
  if(![24,32,40,48].includes(fontSize))fontSize=32;
  const keyLabels={Backspace:'⌫ Backspace',Enter:'↵ Enter',Tab:'Tab',Shift:'⇧ Shift',Search:'Search',Caps:'Caps Lock',Space:'Space',Ctrl:'Ctrl',Alt:'Alt'};

  const toast=message=>{const node=$('typeToast');node.textContent=message;node.classList.add('active');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('active'),2200)};
  const updateCount=()=>{const n=Array.from(editor.value).length;$('characterCount').textContent=`${n.toLocaleString()} ${n===1?'character':'characters'}`};
  const scheduleSave=()=>{clearTimeout(saveTimer);$('draftStatus').textContent='Saving on this device…';saveTimer=setTimeout(()=>{
    const okay=write(draftKey(lang),editor.value);
    if(okay){savedDraft=editor.value;$('draftStatus').textContent=editor.value?'Draft saved on this device':'Ready to type'}
    else $('draftStatus').textContent='Could not save draft — copy your text';
  },220)};
  editor.addEventListener('input',()=>{updateCount();scheduleSave()});
  // Ensure a draft survives navigation before the throttled save completes.
  window.addEventListener('pagehide',()=>write(draftKey(lang),editor.value));
  const persistNow=()=>{clearTimeout(saveTimer);write(draftKey(lang),editor.value)};
  const changeLanguage=(next,{initial=false}={})=>{
    next=safeLang(next);
    if(next===lang && !initial)return;
    if(lang!==next)persistNow();
    lang=next;write('typingLanguage',lang);
    editor.value=read(draftKey(lang));savedDraft=editor.value;
    editor.lang=settings[lang].tag;editor.placeholder=settings[lang].placeholder;
    $('typeTitle').textContent=settings[lang].title;
    $('keyboardDescription').textContent=`${settings[lang].name} layout · physical English keys`;
    $('keyboardHelp').textContent=settings[lang].help;
    $('draftStatus').textContent=editor.value?'Draft restored on this device':'Ready to type';
    $('languageSelector').querySelectorAll('[data-language]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.language===lang)));
    shifted=false;render();updateCount();
  };
  $('languageSelector').addEventListener('click',e=>{const b=e.target.closest('[data-language]');if(!b)return;changeLanguage(b.dataset.language);editor.focus()});

  function setShift(on){if(on===shifted)return;shifted=on;render()}
  $('normalLayer').addEventListener('click',()=>setShift(false));
  $('shiftLayer').addEventListener('click',()=>setShift(true));
  const makeKey=(code,normal,shiftValue,extraClass='')=>{
    const b=document.createElement('button');b.type='button';b.className=`typing-key ${extraClass}`;
    b.dataset.key=code;
    if(normal!==null){
      const face=shifted?shiftValue:normal;
      const cap=document.createElement('small');cap.className='key-physical';cap.textContent=code.length===1?code.toUpperCase():code;
      const value=document.createElement('span');value.className='key-output';value.textContent=face;
      b.append(cap,value);b.setAttribute('aria-label',`${code} types ${face}`);
      b.addEventListener('click',()=>insertValue(face));
    }else{
      b.textContent=keyLabels[code]||code;
      b.setAttribute('aria-label',keyLabels[code]||code);
      b.classList.add('modifier');
      if(code==='Shift'||code==='Caps')b.addEventListener('click',()=>setShift(!shifted));
      else if(code==='Backspace')b.addEventListener('click',()=>removeAtCursor());
      else if(code==='Enter')b.addEventListener('click',()=>insertValue('\n'));
      else if(code==='Tab')b.addEventListener('click',()=>insertValue('\t'));
      else if(code==='Space')b.addEventListener('click',()=>insertValue(' '));
      else b.disabled=true;
    }
    // Keep the editor's selection when clicking the on-screen keyboard.
    b.addEventListener('pointerdown',e=>e.preventDefault());
    return b;
  };
  function makeRow(items,className){const div=document.createElement('div');div.className=`typing-key-row ${className}`;
    for(const item of items){if(Array.isArray(item))div.append(makeKey(item[0],item[1],item[2]));else div.append(makeKey(item,null,null,({'Backspace':'backspace','Tab':'tab','Caps':'caps','Search':'caps','Enter':'enter','Shift':'shift','Space':'space','Ctrl':'small-mod','Alt':'small-mod'}[item]||'')));}
    keyboard.append(div);
  }
  function render(){
    $('normalLayer').setAttribute('aria-pressed',String(!shifted));$('shiftLayer').setAttribute('aria-pressed',String(shifted));
    keyboard.replaceChildren();const rows=layouts[lang];
    makeRow([...rows[0],'Backspace'],'typing-row-0');
    makeRow(['Tab',...rows[1]],'typing-row-1');
    makeRow([/CrOS/i.test(navigator.userAgent)?'Search':'Caps',...rows[2],'Enter'],'typing-row-2');
    makeRow(['Shift',...rows[3],'Shift'],'typing-row-3');
    makeRow(['Ctrl','Alt','Space','Alt','Ctrl'],'typing-row-4');
  }
  // Browser-native edit history where supported; selection-aware fallback otherwise.
  const insertValue=text=>{
    editor.focus();
    const start=editor.selectionStart,end=editor.selectionEnd;
    let successful=false;
    if(document.queryCommandSupported?.('insertText')){
      try{successful=document.execCommand('insertText',false,text)}catch{}
    }
    if(!successful){editor.setRangeText(text,start,end,'end');editor.dispatchEvent(new Event('input',{bubbles:true}))}
  };
  const previousGrapheme=(text,index)=>{
    if(!index)return 0;
    if(typeof Intl.Segmenter==='function'){
      const segments=Array.from(new Intl.Segmenter('my',{granularity:'grapheme'}).segment(text.slice(0,index)));
      return segments.length?segments[segments.length-1].index:0;
    }
    return index-Array.from(text.slice(0,index)).pop().length;
  };
  const removeAtCursor=()=>{
    editor.focus();const start=editor.selectionStart,end=editor.selectionEnd;
    const from=start===end?previousGrapheme(editor.value,start):start;
    editor.setRangeText('',from,end,'start');editor.dispatchEvent(new Event('input',{bubbles:true}));
  };
  const codeMap={Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'};
  const keyFromCode=e=>e.code.startsWith('Key')?e.code.slice(3).toLowerCase():e.code.startsWith('Digit')?e.code.slice(5):codeMap[e.code];
  editor.addEventListener('keydown',e=>{
    if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='Shift'){setShift(true);return}
    const key=keyFromCode(e),entry=layouts[lang].flat().find(row=>row[0]===key);
    if(!entry)return;
    if(lang!=='en'){e.preventDefault();insertValue(e.shiftKey?entry[2]:entry[1])}
    const btn=Array.from(keyboard.querySelectorAll('.typing-key[data-key]')).find(node=>node.dataset.key===key);
    if(btn){btn.classList.add('pressed');setTimeout(()=>btn.classList.remove('pressed'),110)}
  });
  editor.addEventListener('keyup',e=>{if(e.key==='Shift')setShift(false)});
  window.addEventListener('blur',()=>{if(shifted)setShift(false)});
  $('fontSize').value=String(fontSize);
  const applyFontSize=value=>{fontSize=Number(value);editor.style.fontSize=fontSize+'px';write('glnStandaloneTypeFontSize',String(fontSize))};
  $('fontSize').addEventListener('change',e=>applyFontSize(e.target.value));applyFontSize(fontSize);
  $('selectAllBtn').addEventListener('click',()=>{editor.focus();editor.select()});
  $('undoBtn').addEventListener('click',()=>{editor.focus();document.execCommand('undo');updateCount();scheduleSave()});
  $('clearBtn').addEventListener('click',()=>{
    if(!editor.value)return;
    if(!window.confirm('Clear this language’s saved draft?'))return;
    editor.value='';updateCount();persistNow();$('draftStatus').textContent='Draft cleared';editor.focus();toast('Draft cleared');
  });
  $('copyBtn').addEventListener('click',async()=>{
    if(!editor.value){toast('Type something before copying');return}
    try{await navigator.clipboard.writeText(editor.value)}catch{
      editor.focus();editor.select();if(!document.execCommand('copy')){toast('Select the text and copy it manually');return}
    }
    toast('Unicode text copied — paste it into Google Docs or another app');
  });
  $('downloadBtn').addEventListener('click',()=>{
    if(!editor.value){toast('Type something before downloading');return}
    const blob=new Blob(['\ufeff',editor.value],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`GLN-${lang==='ksw'?'Sgaw':lang==='pwo'?'Pwo':'English'}-Typing.txt`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('keyboardVisibility').addEventListener('click',()=>{
    const hide=!viewport.hidden;viewport.hidden=hide;$('keyboardVisibility').textContent=hide?'Show keyboard':'Hide keyboard';
    $('keyboardVisibility').setAttribute('aria-expanded',String(!hide));
  });
  const focus=$('focusMode');
  focus.addEventListener('click',async()=>{
    if(document.fullscreenElement){await document.exitFullscreen().catch(()=>{});return}
    if($('typeShell').requestFullscreen){try{await $('typeShell').requestFullscreen()}catch{toast('Fullscreen is not available in this browser')}}
    else toast('Fullscreen is not supported on this device');
  });
  document.addEventListener('fullscreenchange',()=>{
    const active=!!document.fullscreenElement;focus.setAttribute('aria-pressed',String(active));focus.textContent=active?'⤢ Exit full screen':'⛶ Full screen';
  });
  const theme=$('themeToggle');
  const applyTheme=value=>{const rgb=value!=='light';document.body.classList.toggle('theme-rgb',rgb);theme.textContent=rgb?'Gaming RGB':'Classic Light';theme.setAttribute('aria-pressed',String(rgb))};
  applyTheme(read('gln-interface-theme','rgb'));
  theme.addEventListener('click',()=>{const next=document.body.classList.contains('theme-rgb')?'light':'rgb';write('gln-interface-theme',next);applyTheme(next)});
  $('dismissTypeCreatorCredit').addEventListener('click',()=>$('typeCreatorCredit').classList.add('is-dismissed'));
  changeLanguage(lang,{initial:true});
})();
