/* Automatic Grouping for GLN Classroom Tools */
(() => {
  'use strict';
  const get = id => document.getElementById(id);
  if (!get('groupingPanel')) return;
  const cls=get('groupingClass'), roster=get('groupingRoster'), mode=get('groupingMode'), number=get('groupingNumber');
  const results=get('groupingResults'), summary=get('groupingSummary'), message=get('groupingMessage');
  const STORE='glnAutomaticGroupingV1', MAX=100;
  const parse=value=>String(value||'').split(/\r?\n/).map(n=>n.trim()).filter(Boolean);
  const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{return {}}};
  let saved=read(), active=String(saved.active||'manual'), pending=active==='manual'?'':active;
  let groups=[], previousRoster='', title='Custom roster', stale=false, restoring=false;
  function randomInt(max){
    if(max<=1)return 0;
    if(window.crypto?.getRandomValues){const u=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;do{crypto.getRandomValues(u)}while(u[0]>=limit);return u[0]%max}
    return Math.floor(Math.random()*max);
  }
  function createBalancedGroups(names, method, desired, choose=randomInt){
    const items=[...names], n=items.length;
    if(!n)return [];
    const limit=Math.max(1,Math.min(MAX,Math.floor(Number(desired)||1)));
    const count=method==='count'?Math.min(n,limit):Math.ceil(n/limit);
    for(let i=n-1;i>0;i--){const j=choose(i+1);[items[i],items[j]]=[items[j],items[i]]}
    const output=Array.from({length:count},()=>[]);
    items.forEach((name,index)=>output[index%count].push(name));
    return output;
  }
  window.GlnAutomaticGrouping={createBalancedGroups};
  const classes=()=>window.getSeatingClassLists?.()||[];
  function info(text='',kind=''){message.textContent=text;message.dataset.kind=kind}
  function setCount(){const n=parse(roster.value).length;get('groupingStudentCount').textContent=`${n} student${n===1?'':'s'}`;get('groupingCreate').disabled=n===0}
  function updateMode(){const byCount=mode.value==='count';get('groupingNumberLabel').textContent=byCount?'Number of groups':'Students per group';get('groupingMethodHelp').textContent=byCount?'Students are divided into the selected number of balanced groups.':'Creates balanced groups without leaving anyone out.'}
  function snapshot(){return parse(roster.value).join('\n')}
  function record(){
    if(restoring)return;
    saved.active=active;saved.entries??={};
    saved.entries[active]={roster:roster.value.slice(0,8000),mode:mode.value,number:Math.max(1,Math.min(MAX,Number(number.value)||4)),groups,previousRoster,title,stale,updated:Date.now()};
    const ordered=Object.keys(saved.entries).sort((a,b)=>(saved.entries[b]?.updated||0)-(saved.entries[a]?.updated||0));
    ordered.slice(25).forEach(k=>delete saved.entries[k]);
    try{localStorage.setItem(STORE,JSON.stringify(saved))}catch{}
    if(!window.__classroomToolsApplyingCloud)window.queueClassroomToolsCloudSync?.();
  }
  function render(){
    results.replaceChildren();
    const activeGroups=!stale&&groups.length>0;
    ['groupingShuffle','groupingCopy','groupingCsv','groupingPrint','groupingFull'].forEach(id=>get(id).disabled=!activeGroups);
    if(!activeGroups){
      summary.textContent=stale?'Roster or settings changed':'No groups created';
      const empty=document.createElement('div');empty.className='grouping-empty';
      const heading=document.createElement('strong');heading.textContent=stale?'Create groups again':'Ready to make groups';
      const text=document.createElement('p');text.textContent=stale?'Your roster or group settings changed. Create Groups to update the display.':'Choose a class, decide the group size, and click Create Groups.';
      empty.append(heading,text);results.append(empty);return;
    }
    const total=groups.reduce((n,x)=>n+x.length,0);
    summary.textContent=`${groups.length} groups · ${total} students`;
    groups.forEach((members,index)=>{
      const card=document.createElement('section');card.className='grouping-card';
      const heading=document.createElement('header');const name=document.createElement('h3');name.textContent=`Group ${index+1}`;
      const size=document.createElement('small');size.textContent=`${members.length} students`;heading.append(name,size);
      const list=document.createElement('ol');members.forEach(member=>{const row=document.createElement('li');row.textContent=member;list.append(row)});
      card.append(heading,list);results.append(card);
    });
  }
  function loadSource(key, saveOld=true){
    if(saveOld)record();active=key;
    const cl=classes().find(item=>item.id===key), old=saved.entries?.[key]||{};
    restoring=true;
    cls.value=key;
    title=cl?.className||'Custom roster';
    roster.value=typeof old.roster==='string'?old.roster:(cl?.roster||[]).join('\n');
    mode.value=old.mode==='count'?'count':'size';number.value=old.number||4;
    groups=Array.isArray(old.groups)?old.groups.filter(Array.isArray).map(items=>items.map(String)):[];
    previousRoster=String(old.previousRoster||'');stale=!!old.stale||(groups.length>0&&previousRoster!==snapshot());
    get('groupingReload').hidden=!cl;
    get('groupingRosterHelp').textContent=cl?'Loaded from Seating Chart. You can remove absent students here without changing the saved class.':'Enter one name per line. You can also copy names from Google Classroom.';
    updateMode();setCount();render();info('');restoring=false;
    if(saveOld)record();
  }
  function refreshSources(){
    const options=classes();const select=active;
    cls.replaceChildren(new Option('Custom roster (paste names)','manual'));
    options.forEach(c=>cls.add(new Option(`${c.className} (${(c.roster||[]).length})`,c.id)));
    const candidate=pending&&options.some(c=>c.id===pending)?pending:select;
    if(candidate===pending&&candidate!=='manual')pending='';
    const found=candidate==='manual'||options.some(c=>c.id===candidate);
    const next=found?candidate:'manual';
    if(next!==active||cls.value!==next)loadSource(next,false);
    else cls.value=next;
  }
  function dirty(){stale=!!groups.length;setCount();render();record()}
  function generate(){
    const names=parse(roster.value);const value=Number(number.value);
    if(!names.length){info('Add student names first.','error');return}
    if(names.length>MAX){info('A class can contain up to 100 names.','error');return}
    if(!Number.isInteger(value)||value<1||value>MAX){info('Enter a whole number from 1 to 100.','error');return}
    groups=createBalancedGroups(names,mode.value,value);previousRoster=snapshot();stale=false;
    record();render();info(`Created ${groups.length} balanced groups.`,'success');
  }
  function asText(){return `${title} — Groups\n\n`+groups.map((g,i)=>`Group ${i+1}\n`+g.join('\n')).join('\n\n')}
  const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';
  function csv(){
    const rows=['Group,Student'];groups.forEach((g,i)=>g.forEach(name=>rows.push(`${quote('Group '+(i+1))},${quote(name)}`)));
    const blob=new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
    link.download=`classroom-groups-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    info('CSV exported.','success');
  }
  cls.addEventListener('change',()=>{pending='';loadSource(cls.value)});
  roster.addEventListener('input',dirty);mode.addEventListener('change',()=>{updateMode();dirty()});number.addEventListener('change',dirty);
  get('groupingReload').addEventListener('click',()=>{const cl=classes().find(x=>x.id===active);if(!cl)return;roster.value=(cl.roster||[]).join('\n');dirty();info('Class roster reloaded.','success')});
  get('groupingCreate').addEventListener('click',generate);get('groupingShuffle').addEventListener('click',generate);
  get('groupingCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(asText());info('Groups copied to clipboard.','success')}catch{info('Clipboard unavailable. Try Export CSV.','error')}});
  get('groupingCsv').addEventListener('click',csv);
  get('groupingPrint').addEventListener('click',()=>{
    document.body.classList.add('print-grouping');
    window.print();
  });
  window.addEventListener('afterprint',()=>document.body.classList.remove('print-grouping'));
  get('groupingFull').addEventListener('click',async()=>{try{if(document.fullscreenElement===get('groupingDisplay'))await document.exitFullscreen();else await get('groupingDisplay').requestFullscreen()}catch{info('Full screen is unavailable on this device.','error')}});
  document.addEventListener('fullscreenchange',()=>{const full=document.fullscreenElement===get('groupingDisplay');get('groupingFull').textContent=full?'✕ Exit Full Screen':'⛶ Full Screen'});
  window.refreshClassroomGrouping=refreshSources;
  window.getClassroomGroupingSyncData=()=>saved;
  window.applyClassroomGroupingSyncData=data=>{
    if(!data||typeof data!=='object'||Array.isArray(data))return;
    saved={active:typeof data.active==='string'?data.active:'manual',entries:data.entries&&typeof data.entries==='object'&&!Array.isArray(data.entries)?data.entries:{}};
    active=saved.active;pending=active==='manual'?'':active;
    try{localStorage.setItem(STORE,JSON.stringify(saved))}catch{}
    refreshSources();loadSource(active==='manual'||classes().some(x=>x.id===active)?active:'manual',false);
  };
  window.addEventListener('gln:seating-classes-updated',refreshSources);
  refreshSources();loadSource(active==='manual'||classes().some(x=>x.id===active)?active:'manual',false);
})();
