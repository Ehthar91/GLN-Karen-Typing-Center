/* GLN Conference Sign-Up v1.9 — name formats in both roster and display */
(function(){
  'use strict';
  let panel, tableBody, tableHead, statusEl, searchEl, dateEl, gradeEl, sortEl, titleEl, metaEl, countEl, capacityEl, permissionsEl, filterCountEl, columnsPanel, columnsButton, displayButton, queueBanner, queueActions, nameFormatControl, nameFormatSelect;
  let active=null, selectedRows=[], viewerUnsubscribe=[], managerQueueUnsubscribe=null, syncing=new Map(), pendingSync=new Map(), savedManagerColumns=null;
  const html=(tag,cls='',text='')=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined&&text!==null)element.textContent=String(text);return element};
  const button=(label,cls,action)=>{const element=html('button',cls,label);element.type='button';element.addEventListener('click',action);return element};
  const safeId=id=>/^[A-Z2-9]{6,20}$/i.test(String(id||''));
  const rosterPath=id=>`eventSignupPublicRosters/${id}`; // Shared data includes organizer-approved student names, but NEVER contact, interpreter details or private tokens.
  const QUEUE_FIELDS=['Queue','Date','Time','Student','Grade','Teacher','Parent/Guardian','Contact','Interpreter','Status','Actions'];
  const PUBLIC_COLUMNS=['Queue','Date','Time','Student','Grade','Teacher','Status'];
  const DEFAULT_PUBLIC=['Queue','Date','Time','Student','Grade','Status'];
  const DEFAULT_STAFF=['Date','Time','Student','Grade','Teacher','Parent/Guardian','Contact','Interpreter','Status','Actions'];
  const DEFAULT_DISPLAY=['Queue','Time','Student','Status'];
  const uniqueKey=row=>`${row.slotId}/${row.spotId}`;
  const publicInitials=name=>String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,3).map(part=>part[0].toUpperCase()+'.').join(' ');
  const NAME_FORMATS=[['first-last','First Name + Last Initial'],['full','Full Name'],['initials','Initials Only'],['first-middle-last','First Name + Middle Initial + Last Initial']];
  const DEFAULT_NAME_FORMAT='first-middle-last';
  const nameParts=name=>String(name||'').trim().split(/\s+/u).filter(Boolean);
  const initial=part=>part?`${Array.from(part)[0].toLocaleUpperCase()}.`:'';
  function formatStudentName(name,format=DEFAULT_NAME_FORMAT){
    const parts=nameParts(name);if(!parts.length)return '—';
    if(format==='full')return parts.join(' ');
    if(format==='initials')return parts.map(initial).join(' ');
    if(format==='first-middle-last'&&parts.length>=3)return `${parts[0]} ${initial(parts[1])} ${initial(parts.at(-1))}`;
    return parts.length>=2?`${parts[0]} ${initial(parts.at(-1))}`:parts[0];
  }
  const nameFormatKey=id=>`glnConferenceRosterV19:nameFormat:${id}`;
  function loadNameFormat(){
    let saved='';try{saved=localStorage.getItem(nameFormatKey(active.id))||''}catch{}
    active.nameFormat=NAME_FORMATS.some(([key])=>key===saved)?saved:DEFAULT_NAME_FORMAT;
  }
  function setNameFormat(format){
    if(!active||!NAME_FORMATS.some(([key])=>key===format))return;
    active.nameFormat=format;
    try{localStorage.setItem(nameFormatKey(active.id),format)}catch{}
    render();
  }
  const toPublicRow=row=>({slotId:row.slotId,spotId:row.spotId,date:row.date,time:row.time,timeRange:row.timeRange,slotLabel:row.slotLabel||'',studentName:String(row.studentName||'').trim().slice(0,60),studentInitials:publicInitials(row.studentName),studentGrade:row.studentGrade||'',studentTeacher:row.studentTeacher||''});
  function linkFor(id,token){const url=new URL(location.href);url.hash='';url.search='';url.searchParams.set('eventRoster',id);url.searchParams.set('viewer',token);return url.toString()}
  function rowFromRecord(slot,event,record){
    return{slotId:String(slot.id||''),spotId:String(record.spotId||''),date:eventSlotDate(slot,event),time:String(slot.time||''),timeRange:eventSlotTimeRange(slot),slotLabel:String(slot.label||''),studentName:signupStudentName(record),studentGrade:signupStudentGrade(record),studentTeacher:signupStudentTeacher(record),parentName:String(record.parentName||''),email:String(record.email||''),phone:String(record.phone||''),interpreterNeeded:record.interpreterNeeded===true,interpreterLanguage:String(record.interpreterLanguage||''),createdAt:Number(record.createdAt)||0,updatedAt:Number(record.updatedAt)||0};
  }
  function managerRows(event){
    const rows=[];
    for(const slot of eventSlotsArray(event)){
      const signups=eventSignupsForSlot(event,slot.id);
      signups.forEach((record,index)=>{
        const row=rowFromRecord(slot,event,record);if(!row.spotId)row.spotId=`legacy-${index+1}`;
        rows.push({...row,_record:record,_slot:slot});
      });
    }
    return rows;
  }
  function projection(event){
    const rows={};for(const item of managerRows(event)){
      const { _record,_slot,...row}=item;
      if(!rows[row.slotId])rows[row.slotId]={};rows[row.slotId][row.spotId]=toPublicRow(row);
    }
    return{title:String(event.title||'Conference Sign-Up'),dateSummary:eventDateSummary(event),capacity:eventSlotsArray(event).reduce((sum,slot)=>sum+Math.max(1,eventSpotIds(slot).length||Number(slot.capacity)||1),0),rows};
  }
  function sanitizeRows(roster){
    const all=[];for(const bySlot of Object.values(roster?.rows||{}))for(const row of Object.values(bySlot||{}))if(row&&row.slotId&&row.spotId&&row.date&&row.time)all.push(row);
    return all;
  }
  async function managerSync(id,event,force=false){
    if(!safeId(id)||!event||!fb||!db||!currentUser)return;
    const next=projection(event),signature=JSON.stringify(next);
    if(!force&&syncing.get(id)===signature)return;
    // This organizer-approved snapshot includes student names, but never parent contacts, interpreter data, or private tokens.
    const rootRef=fb.ref(db,rosterPath(id));
    await fb.update(rootRef,{title:next.title,dateSummary:next.dateSummary,capacity:next.capacity,rows:Object.keys(next.rows).length?next.rows:null,updatedAt:Date.now()});
    syncing.set(id,signature);
  }
  function managerChanged(id,event,source){
    if(!event||!safeId(id))return;
    if(active?.id===id&&active.source===source){active.event=event;active.title=event.title||'Conference Sign-Up';active.rows=managerRows(event);active.capacity=projection(event).capacity;render();}
    if(pendingSync.has(id))clearTimeout(pendingSync.get(id));
    pendingSync.set(id,setTimeout(()=>{
      pendingSync.delete(id);
      managerSync(id,event).catch(error=>console.warn('Roster sync: verify Firebase roster rules',error));
    },350));
  }
  async function parentChanges(id,event,token,added,removed){
    if(!id||!token||!fb||!db||!currentUser)return;
    const sessionRef=fb.ref(db,`eventSignups/${id}/rosterWriteSessions/${currentUser.uid}`);
    await fb.set(sessionRef,{token,createdAt:Date.now()});
    for(const item of removed||[]){
      if(item.slotId&&item.spotId)await fb.remove(fb.ref(db,`${rosterPath(id)}/rows/${item.slotId}/${item.spotId}`));
    }
    for(const record of added||[]){
      const slot=eventSlotsArray(event).find(s=>s.id===record.slotId);
      if(!slot||!record.spotId)continue;
      await fb.set(fb.ref(db,`${rosterPath(id)}/rows/${slot.id}/${record.spotId}`),toPublicRow(rowFromRecord(slot,event,record)));
    }
  }
  function managerRemoval(id,record){
    if(record?.slotId&&record?.spotId)fb.remove(fb.ref(db,`${rosterPath(id)}/rows/${record.slotId}/${record.spotId}`)).catch(err=>console.warn('Roster removal sync',err));
  }
  function managerMove(id,newRecord,oldRecord,slot,event){
    const oldSlotId=oldRecord?.slotId,oldSpotId=oldRecord?.spotId;
    (async()=>{
      if(oldSlotId&&oldSpotId)await fb.remove(fb.ref(db,`${rosterPath(id)}/rows/${oldSlotId}/${oldSpotId}`));
      if(slot&&newRecord?.spotId)await fb.set(fb.ref(db,`${rosterPath(id)}/rows/${slot.id}/${newRecord.spotId}`),toPublicRow(rowFromRecord(slot,event,newRecord)));
    })().catch(err=>console.warn('Roster move sync',err));
  }
  function showNotice(message,error=false){if(!statusEl)return;statusEl.textContent=message;statusEl.classList.toggle('is-error',error)}
  async function copyText(value){
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);if(typeof showToast==='function')showToast('Roster viewer link copied');return}}
    catch{}
    window.prompt('Copy the read-only conference roster link:',value);
  }
  async function createViewerLink(id,event,replace=false){
    try{
      if(replace&&!confirm('Replace the roster viewer link? The old viewer link will stop working.'))return;
      await initRaceFirebase();await managerSync(id,event,true);
      let token=event?.rosterAccess?.active&&!replace?String(event.rosterAccess.token||''):'';
      if(!/^[0-9a-f]{64}$/i.test(token)){
        token=eventManageToken();
        await fb.set(fb.ref(db,`eventSignups/${id}/rosterAccess`),{token,active:true,createdAt:Date.now(),updatedAt:Date.now()});
        if(replace)await fb.remove(fb.ref(db,`eventSignups/${id}/rosterSessions`));
      }
      await copyText(linkFor(id,token));
    }catch(error){
      const description=error?.code==='PERMISSION_DENIED'?'Publish the v1.7 Firebase Realtime Database rules first.':(error?.message||'Could not create roster link.');
      if(typeof setEventStatus==='function')setEventStatus(description,'error');alert(description);
    }
  }
  async function revokeViewerLink(id,event){
    if(!event?.rosterAccess?.active||!confirm('Revoke the roster viewer link? Staff using the existing link will lose roster access.'))return;
    try{
      await initRaceFirebase();
      await fb.update(fb.ref(db,`eventSignups/${id}/rosterAccess`),{active:false,updatedAt:Date.now()});
      await fb.remove(fb.ref(db,`eventSignups/${id}/rosterSessions`));
      if(typeof showToast==='function')showToast('Roster viewer link revoked');
    }catch(error){alert(error?.message||'Could not revoke roster access')}
  }
  function addOwnerButtons(id,event,container){
    container.append(button('View all sign-ups','event-roster-open-button',()=>openManager(id,'owner')));
    container.append(button(event.rosterAccess?.active?'Copy roster viewer link':'Create roster viewer link','event-roster-share-button',()=>createViewerLink(id,event)));
    if(event.rosterAccess?.active){
      container.append(button('New roster link','',()=>createViewerLink(id,event,true)));
      container.append(button('Revoke roster link','danger',()=>revokeViewerLink(id,event)));
    }
  }
  function addEditorButtons(){
    const target=document.querySelector('.event-shared-editor-toolbar>div:last-child');if(!target)return;
    if(!target.querySelector('.event-roster-open-button'))target.append(button('View all sign-ups','button ghost event-roster-open-button',()=>openManager(sharedEditorEventId,'editor')));
    target.querySelector('.event-roster-share-button')?.remove();
    const access=sharedEditorEventData?.rosterAccess;
    if(access?.active&&/^[a-f0-9]{64}$/i.test(access.token||''))target.append(button('Copy roster viewer link','button ghost event-roster-share-button',()=>copyText(linkFor(sharedEditorEventId,access.token))));
  }
  function isStaff(){return !!active&&(active.source!=='viewer'||active.staffAuthorized===true)}
  function isManager(){return !!active&&active.source!=='viewer'}
  function allowedColumns(){return active?.displayMode?PUBLIC_COLUMNS:(isStaff()?QUEUE_FIELDS.filter(c=>!(c==='Actions'&&!isManager())):PUBLIC_COLUMNS)}
  function columnStorageKey(){return `glnConferenceRosterV17:${active?.id||'none'}:${isStaff()?'staff':'public'}`}
  function loadColumns(){
    const allowed=allowedColumns();let preferences=null;
    try{preferences=JSON.parse(localStorage.getItem(columnStorageKey())||'null')}catch{}
    const defaultList=isStaff()?DEFAULT_STAFF:DEFAULT_PUBLIC;
    active.columns=new Set((Array.isArray(preferences)?preferences:defaultList).filter(c=>allowed.includes(c)));
    if(!active.columns.size)active.columns.add('Time');
  }
  function saveColumns(){
    if(!active)return;
    try{localStorage.setItem(active.displayMode?`glnConferenceRosterV17:display:${active.id}`:columnStorageKey(),JSON.stringify([...active.columns]))}catch{}
  }
  function toggleColumns(){columnsPanel.hidden=!columnsPanel.hidden;columnsButton.setAttribute('aria-expanded',String(!columnsPanel.hidden));}
  function refreshColumnSettings(){
    columnsPanel.replaceChildren();const heading=html('div','event-roster-column-heading');heading.append(html('strong','','Show or hide columns'),html('small','',isStaff()?'Staff-only fields remain protected by Firebase permissions.':'Only privacy-limited information is available on the shareable link.'));
    columnsPanel.append(heading);
    const checks=html('div','event-roster-column-checks');
    for(const name of allowedColumns()){
      const label=html('label','event-roster-checkbox');const control=html('input');control.type='checkbox';control.checked=active.columns.has(name);control.addEventListener('change',()=>{
        if(control.checked)active.columns.add(name);else active.columns.delete(name);
        if(!active.columns.size){active.columns.add(name);control.checked=true;showNotice('Keep at least one column visible.',true);statusEl.hidden=false;return}
        saveColumns();render();
      });label.append(control,html('span','',name==='Student'&&!isStaff()&&!active.displayMode?'Student initials':name));checks.append(label);
    }
    columnsPanel.append(checks);
    columnsPanel.append(button('Restore default columns','event-roster-secondary',()=>{active.columns=new Set((isStaff()?DEFAULT_STAFF:DEFAULT_PUBLIC).filter(c=>allowedColumns().includes(c)));saveColumns();render()}));
  }
  async function setDisplayMode(enabled){
    if(!active)return;
    active.displayMode=enabled;
    if(enabled){active.preDisplayColumns=new Set(active.columns);active.preDisplayDate=dateEl.value;dateEl.value=activeDay();let displayPrefs=null;try{displayPrefs=JSON.parse(localStorage.getItem(`glnConferenceRosterV17:display:${active.id}`)||'null')}catch{}active.columns=new Set((Array.isArray(displayPrefs)?displayPrefs:DEFAULT_DISPLAY).filter(c=>PUBLIC_COLUMNS.includes(c)));if(!active.columns.size)active.columns.add('Time');columnsPanel.hidden=true;columnsButton.setAttribute('aria-expanded','false')}
    else if(active.preDisplayColumns){active.columns=active.preDisplayColumns;active.preDisplayColumns=null;dateEl.value=active.preDisplayDate||'';active.preDisplayDate=null}
    panel.classList.toggle('is-display',enabled);displayButton.textContent=enabled?'Exit Display':'Display Mode';
    render();
    try{if(enabled&&panel.requestFullscreen)await panel.requestFullscreen();else if(!enabled&&document.fullscreenElement===panel)await document.exitFullscreen()}catch{}
  }
  function queueRows(day){return active.rows.filter(row=>row.date===day).slice().sort(chronology)}
  function chronology(a,b){return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)||String(a.spotId||'').localeCompare(String(b.spotId||''))}
  function activeDay(){
    if(dateEl.value)return dateEl.value;
    const local=new Date(),today=[local.getFullYear(),String(local.getMonth()+1).padStart(2,'0'),String(local.getDate()).padStart(2,'0')].join('-');
    const dates=[...new Set(active.rows.map(r=>r.date))].sort();return dates.includes(today)?today:dates.find(d=>d>today)||dates[0]||'';
  }
  function queueIndex(row){const rows=queueRows(row.date);return rows.findIndex(item=>uniqueKey(item)===uniqueKey(row))}
  function currentStatus(row){
    const q=active?.queue||{};
    if(!q.date||row.date!==q.date)return 'Scheduled';
    if(q.done)return 'Finished';
    const list=queueRows(row.date),index=list.findIndex(item=>uniqueKey(item)===uniqueKey(row));
    const current=list.findIndex(item=>uniqueKey(item)===q.currentKey);
    if(current<0)return 'Scheduled';
    if(index===current)return 'Now Serving';if(index===current+1)return 'Up Next';
    return index<current?'Earlier':'Scheduled';
  }
  function updateQueueBanner(){
    queueBanner.replaceChildren();if(!active)return;
    const q=active.queue||{},list=q.date?queueRows(q.date):[];
    const current=list.findIndex(row=>uniqueKey(row)===q.currentKey),next=current>=0?list[current+1]:null;
    const make=(kind,row)=>{const card=html('div',`event-roster-queue-card ${kind}`);card.append(html('small','',kind==='now'?'NOW SERVING':'UP NEXT'),html('strong','',row?`#${String(queueIndex(row)+1).padStart(2,'0')} · ${row.timeRange||formatScheduleTime(row.time)}`:'—'));return card};
    if(current>=0&&!q.done){queueBanner.append(make('now',list[current]),make('next',next))}
    else{const info=html('p','event-roster-queue-notice',q.done?'Conference queue finished for the selected day.':'Queue has not been started. Appointment times are scheduled times, not live waiting estimates.');queueBanner.append(info)}
    queueBanner.hidden=false;
  }
  async function advanceQueue(reset=false){
    if(!isManager()||!active?.id)return;
    const day=activeDay(),list=queueRows(day);if(!day||!list.length){showNotice('There are no confirmed appointments for this date.',true);statusEl.hidden=false;return}
    if(reset&&!confirm('Reset the Now Serving indicator for this conference day?'))return;
    const q=active.queue||{},at=q.date===day?list.findIndex(row=>uniqueKey(row)===q.currentKey):-1;
    const next=reset?null:list[at+1]||null;
    const value={date:day,currentKey:next?uniqueKey(next):'',done:!reset&&!next,updatedAt:Date.now()};
    try{await initRaceFirebase();await fb.set(fb.ref(db,`${rosterPath(active.id)}/queue`),value);active.queue=value;render()}catch(error){showNotice('Could not update Now Serving: '+(error?.message||'permission denied'),true);statusEl.hidden=false}
  }
  function updateQueueActions(){
    queueActions.replaceChildren();queueActions.hidden=!isManager();if(!isManager())return;
    const day=activeDay(),q=active.queue||{};
    const activeHere=q.date===day&&q.currentKey&&!q.done;
    queueActions.append(button(activeHere?'Next Appointment':'Start Queue','event-roster-queue-action',()=>advanceQueue(false)),button('Reset Queue','event-roster-secondary',()=>advanceQueue(true)));
    queueActions.append(html('span','event-roster-queue-guidance',`Controls apply to ${day||'the selected day'}. Queue position is staff-controlled, not estimated from the clock.`));
  }
  function ensureUI(){
    if(panel)return;
    panel=html('section','event-roster-overlay');panel.id='eventRosterOverlay';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Conference sign-up roster');
    const shell=html('div','event-roster-shell');const header=html('header','event-roster-header');
    const left=html('div','event-roster-heading');left.append(html('small','event-roster-eyebrow','PARENT-TEACHER CONFERENCES'),titleEl=html('h2','','All Sign-Ups'),metaEl=html('p','','Confirmed appointments only'));
    const right=html('div','event-roster-header-actions');
    columnsButton=button('Columns','event-roster-secondary event-roster-columns-toggle',toggleColumns);columnsButton.setAttribute('aria-expanded','false');
    displayButton=button('Display Mode','event-roster-secondary event-roster-display-toggle',()=>setDisplayMode(!active?.displayMode));
    nameFormatControl=html('label','event-roster-name-format');nameFormatControl.append(html('span','','Name Format'));nameFormatSelect=html('select');nameFormatSelect.setAttribute('aria-label','Student name format for roster and display');for(const [value,label] of NAME_FORMATS){const opt=html('option','',label);opt.value=value;nameFormatSelect.append(opt)}nameFormatSelect.addEventListener('change',()=>setNameFormat(nameFormatSelect.value));nameFormatControl.append(nameFormatSelect);
    right.append(columnsButton,nameFormatControl,displayButton,button('Export CSV','event-roster-secondary event-roster-export',exportCSV),button('Print','event-roster-secondary event-roster-print',()=>window.print()),button('Close','event-roster-close',closeRoster));header.append(left,right);
    columnsPanel=html('div','event-roster-column-panel');columnsPanel.hidden=true;
    const stats=html('div','event-roster-stats');for(const [key,title] of [['count','Signed up'],['capacity','Total spots']]){
      const card=html('div','event-roster-stat');card.append(html('small','',title));const value=html('strong','event-roster-stat-value','0');if(key==='count')countEl=value;else capacityEl=value;card.append(value);stats.append(card);
    }
    queueBanner=html('div','event-roster-queue-banner');queueActions=html('div','event-roster-queue-actions');
    const tools=html('div','event-roster-toolbar');
    const searchLabel=html('label','event-roster-search');searchLabel.append(html('span','','Search visible roster fields'));searchEl=html('input');searchEl.type='search';searchEl.placeholder='Search sign-ups…';searchEl.addEventListener('input',render);searchLabel.append(searchEl);
    const dateLabel=html('label');dateLabel.append(html('span','','Date'));dateEl=html('select');dateEl.addEventListener('change',render);dateLabel.append(dateEl);
    const gradeLabel=html('label');gradeLabel.append(html('span','','Grade'));gradeEl=html('select');gradeEl.addEventListener('change',render);gradeLabel.append(gradeEl);
    const sortLabel=html('label');sortLabel.append(html('span','','Sort by'));sortEl=html('select');sortEl.addEventListener('change',render);sortLabel.append(sortEl);
    tools.append(searchLabel,dateLabel,gradeLabel,sortLabel);
    statusEl=html('p','event-roster-alert');statusEl.setAttribute('role','status');statusEl.hidden=true;
    const body=html('div','event-roster-table-wrap');const table=html('table','event-roster-table');tableHead=html('thead');tableBody=html('tbody');table.append(tableHead,tableBody);body.append(table);
    const footer=html('footer','event-roster-footer');filterCountEl=html('span','','Showing 0 sign-ups');permissionsEl=html('span','','Shared roster · Limited information');footer.append(filterCountEl,permissionsEl);
    shell.append(header,columnsPanel,stats,queueBanner,queueActions,tools,statusEl,body,footer);panel.append(shell);document.body.append(panel);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel&&!panel.hidden&&active?.source!=='viewer'&&!document.querySelector('dialog[open]'))closeRoster()});
    document.addEventListener('fullscreenchange',()=>{if(panel&&!panel.hidden&&active?.displayMode&&!document.fullscreenElement){active.displayMode=false;if(active.preDisplayColumns){active.columns=active.preDisplayColumns;active.preDisplayColumns=null;dateEl.value=active.preDisplayDate||'';active.preDisplayDate=null}panel.classList.remove('is-display');displayButton.textContent='Display Mode';render()}});
  }
  function fillSelect(select,values,allLabel){
    const old=select.value;select.replaceChildren();const all=html('option','',allLabel);all.value='';select.append(all);
    for(const value of values){const option=html('option','',value);option.value=value;select.append(option)}
    if(values.includes(old))select.value=old;
  }
  function filterRows(){
    if(!active)return[];
    const q=searchEl.value.trim().toLowerCase(),date=dateEl.value,grade=gradeEl.value,order=sortEl.value;
    const matches=row=>{
      const vals=[row.date,row.time,row.timeRange,row.slotLabel];
      if(isStaff())vals.push(row.studentName,row.studentInitials,row.studentGrade,row.studentTeacher,row.parentName,row.email,row.phone,row.interpreterLanguage);
      else vals.push(row.studentName,row.studentInitials,row.studentGrade,row.studentTeacher);
      vals.push(formatStudentName(row.studentName||'',active.nameFormat));
      return vals.join(' ').toLowerCase().includes(q);
    };
    const rows=active.rows.filter(row=>(!date||row.date===date)&&(!grade||row.studentGrade===grade)&&(!q||matches(row)));
    const by=key=>(a,b)=>String(a[key]||'').localeCompare(String(b[key]||''),undefined,{numeric:true,sensitivity:'base'});
    rows.sort(order==='student'?by('studentName'):order==='grade'?by('studentGrade'):order==='teacher'?by('studentTeacher'):order==='parent'&&isStaff()?by('parentName'):order==='date-desc'?(a,b)=>-chronology(a,b):chronology);
    return rows;
  }
  function cellValue(row,column){
    switch(column){
      case 'Queue':return `#${String(queueIndex(row)+1).padStart(2,'0')}`;
      case 'Date':return eventSlotFullDateText(row.date);
      case 'Time':return row.timeRange||formatScheduleTime(row.time);
      case 'Student':return row.studentName?formatStudentName(row.studentName,active.nameFormat):(row.studentInitials||'—');
      case 'Grade':return row.studentGrade||'—';
      case 'Teacher':return row.studentTeacher||'—';
      case 'Parent/Guardian':return isStaff()?(row.parentName||'—'):'—';
      case 'Contact':return isStaff()?[row.email||'',row.phone||''].filter(Boolean).join(' · '):'—';
      case 'Interpreter':return isStaff()?(row.interpreterNeeded?`Yes${row.interpreterLanguage?' · '+row.interpreterLanguage:''}`:'No'):'—';
      case 'Status':return currentStatus(row);
      case 'Actions':return '';
    }
    return '';
  }
  function render(){
    if(!panel||!active)return;
    titleEl.textContent=active.title||'Conference Sign-Up';
    if(nameFormatSelect&&active.nameFormat)nameFormatSelect.value=active.nameFormat;
    metaEl.textContent=active.displayMode?(activeDay()?`${eventSlotFullDateText(activeDay())} · Appointments in scheduled order`:'Appointment schedule · No signed-up appointments'):(active.source==='viewer'?(isStaff()?'Staff access verified · One shared roster link':'Read-only shared roster · Student names shared by organizer · Family contacts protected'):'All sign-ups · Confirmed reservations only · Empty slots hidden');
    countEl.textContent=active.rows.length.toLocaleString();capacityEl.textContent=active.capacity!=null?Number(active.capacity).toLocaleString():'—';
    fillSelect(dateEl,[...new Set(active.rows.map(row=>row.date).filter(Boolean))].sort(),'All dates');
    fillSelect(gradeEl,[...new Set(active.rows.map(row=>row.studentGrade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),'All grades');
    const options=[['date','Date / time ↑'],['date-desc','Date / time ↓'],['student','Student A–Z'],['grade','Grade'],['teacher','Teacher']];if(isStaff())options.push(['parent','Parent A–Z']);
    const currentSort=sortEl.value||'date';sortEl.replaceChildren();for(const [value,label] of options){const option=html('option','',label);option.value=value;sortEl.append(option)}sortEl.value=options.some(option=>option[0]===currentSort)?currentSort:'date';
    selectedRows=filterRows();tableBody.replaceChildren();tableHead.replaceChildren();const allowed=allowedColumns();const visible=[...QUEUE_FIELDS].filter(c=>allowed.includes(c)&&active.columns.has(c));
    const heading=html('tr');visible.forEach(name=>{const th=html('th','',name);th.dataset.rosterColumn=name;heading.append(th)});tableHead.append(heading);
    if(!selectedRows.length){const tr=html('tr');const cell=html('td','event-roster-empty',active.rows.length?'No sign-ups match your search or filters.':'No one has signed up yet.');cell.colSpan=Math.max(1,visible.length);tr.append(cell);tableBody.append(tr)}
    for(const row of selectedRows){
      const tr=html('tr');for(const name of visible){const td=html('td',name==='Student'?'event-roster-student':name==='Actions'?'event-roster-row-actions':name==='Status'?`event-roster-status status-${currentStatus(row).toLowerCase().replace(/\W+/g,'-')}`:'');td.dataset.rosterColumn=name;
        if(name==='Actions'&&isManager()&&row._record)td.append(button('Move','event-roster-move',()=>moveManagedReservation(active.id,row._record,active.source)),button('Remove','event-roster-remove',()=>removeManagedReservation(active.id,row._record,active.source)));
        else td.textContent=cellValue(row,name);tr.append(td)}tableBody.append(tr);
    }
    filterCountEl.textContent=`Showing ${selectedRows.length} of ${active.rows.length} confirmed sign-ups`;
    permissionsEl.textContent=isManager()?'Verified manager · Move/Remove available':isStaff()?'Verified staff · Full details (read-only on this link)':'Shared viewer · Student names may be visible · Family contacts and interpreter details excluded';
    panel.classList.toggle('is-viewer',!isManager());panel.classList.toggle('is-staff-viewer',active.source==='viewer'&&isStaff());
    refreshColumnSettings();updateQueueBanner();updateQueueActions();
  }
  function stopSubscriptions(){for(const stop of viewerUnsubscribe)try{stop()}catch{}viewerUnsubscribe=[];if(managerQueueUnsubscribe){managerQueueUnsubscribe();managerQueueUnsubscribe=null}}
  function showRoster(data){
    ensureUI();stopSubscriptions();active={...data,queue:data.queue||{},displayMode:false,staffAuthorized:!!data.staffAuthorized};
    loadColumns();loadNameFormat();searchEl.value='';dateEl.value='';gradeEl.value='';sortEl.value='date';columnsPanel.hidden=true;columnsButton.setAttribute('aria-expanded','false');
    panel.classList.remove('is-display');displayButton.textContent='Display Mode';panel.hidden=false;document.body.classList.add('event-roster-open');statusEl.hidden=true;render();
  }
  function closeRoster(){if(!panel)return;if(active?.source==='viewer'){stopSubscriptions();location.href=new URL(location.pathname,location.origin).toString();return}stopSubscriptions();panel.hidden=true;document.body.classList.remove('event-roster-open');active=null;}
  function openManager(id,source){
    const event=source==='editor'?sharedEditorEventData:eventSignupCache.get(id);if(!event)return;
    const data=projection(event);showRoster({id,source,event,title:data.title,rows:managerRows(event),capacity:data.capacity});
    const path=rosterPath(id);managerQueueUnsubscribe=fb.onValue(fb.ref(db,`${path}/queue`),snapshot=>{if(active?.id===id&&active.source===source){active.queue=snapshot.val()||{};render()}},()=>{});
    managerSync(id,event,true).catch(error=>console.warn('Could not update public roster snapshot',error));
  }
  function csvEscape(value){const source=String(value??'');const safe=/^[\s]*[=+@\-\t\r]/.test(source)?`'${source}`:source;return `"${safe.replaceAll('"','""')}"`}
  function exportCSV(){
    if(!active)return;const cols=QUEUE_FIELDS.filter(c=>allowedColumns().includes(c)&&active.columns.has(c)&&c!=='Actions');
    const csv='\uFEFF'+[cols,...selectedRows.map(row=>cols.map(col=>cellValue(row,col)))].map(items=>items.map(csvEscape).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`conference-signups-${active.id}.csv`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  async function openViewer(id,token){
    showRoster({id,source:'viewer',title:'Conference Roster',rows:[],capacity:null});statusEl.hidden=false;showNotice('Checking the roster viewer link…');
    try{
      await initRaceFirebase();if(!currentUser)throw new Error('Authentication unavailable');
      const sessionRef=fb.ref(db,`eventSignups/${id}/rosterSessions/${currentUser.uid}`);
      await fb.set(sessionRef,{token,createdAt:Date.now()});
      const ref=fb.ref(db,rosterPath(id));
      const unsub=fb.onValue(ref,snapshot=>{
        const value=snapshot.val()||{};if(active?.source!=='viewer'||active.id!==id)return;
        if(!snapshot.exists()){statusEl.hidden=false;showNotice('No published roster yet. Ask the conference organizer to open the editor once to publish existing reservations.')}
        else statusEl.hidden=true;
        active.publicRows=sanitizeRows(value);if(!active.staffAuthorized)active.rows=active.publicRows;
        active.title=value.title||'Conference Sign-Up Roster';active.queue=value.queue||{};active.capacity=Number.isFinite(Number(value.capacity))?Number(value.capacity):null;
        render();
      },error=>{
        statusEl.hidden=false;showNotice(error?.code==='PERMISSION_DENIED'?'Roster access has been revoked or the v1.7 Firebase rules are not installed.':(error?.message||'Could not load roster.'),true);active.rows=[];render();
      });
      viewerUnsubscribe.push(unsub);
      viewerUnsubscribe.push(fb.onValue(sessionRef,snapshot=>{
        if(snapshot.exists())return;
        statusEl.hidden=false;showNotice('This roster viewer link has been revoked.',true);if(active?.source==='viewer'){active.rows=[];render()}unsub();
      }));
      // A viewer with independently verified owner/editor authorization may see private fields on this SAME URL.
      // A roster token alone cannot grant the eventSignups read permission.
      try{
        const restrictedRef=fb.ref(db,`eventSignups/${id}`),staffSnap=await fb.get(restrictedRef);
        if(staffSnap.exists()&&active?.source==='viewer'&&active.id===id){
          active.staffAuthorized=true;active.event=staffSnap.val();active.rows=managerRows(active.event);loadColumns();render();
          const staffUnsub=fb.onValue(restrictedRef,next=>{if(active?.source!=='viewer'||active.id!==id)return;if(next.exists()){active.event=next.val();active.rows=managerRows(active.event);render()}},()=>{if(active?.source!=='viewer'||active.id!==id)return;active.staffAuthorized=false;active.rows=active.publicRows||[];loadColumns();render()});
          viewerUnsubscribe.push(staffUnsub);
        }
      }catch{/* Viewer access remains privacy-limited. */}
    }catch(error){statusEl.hidden=false;showNotice(error?.code==='PERMISSION_DENIED'?'This roster viewer link is invalid, revoked, or v1.7 Firebase rules are not installed.':(error?.message||'Unable to open roster.'),true)}
  }
  window.GLNConferenceRoster={addOwnerButtons,addEditorButtons,managerChanged,parentChanges,managerRemoval,managerMove,openViewer,openManager,managerSync};
  // Recreate owner actions now that this extension has loaded after event-signup.js.
  if(typeof renderEventSignupList==='function'&&eventSignupIds.length)renderEventSignupList();
})();
