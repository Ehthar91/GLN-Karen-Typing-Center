/* GLN Conference Sign-Up v1.6 — protected read-only roster + manager spreadsheet */
(function(){
  'use strict';
  let panel, tableBody, statusEl, searchEl, dateEl, gradeEl, sortEl, titleEl, metaEl, countEl, capacityEl, permissionsEl, filterCountEl;
  let active=null, selectedRows=[], viewerUnsubscribe=[], syncing=new Map(), pendingSync=new Map();
  const html=(tag,cls='',text='')=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined&&text!==null)element.textContent=String(text);return element};
  const button=(label,cls,action)=>{const element=html('button',cls,label);element.type='button';element.addEventListener('click',action);return element};
  const safeId=id=>/^[A-Z2-9]{6,20}$/i.test(String(id||''));
  const rosterPath=id=>`eventSignupRosters/${id}`;
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
      if(!rows[row.slotId])rows[row.slotId]={};rows[row.slotId][row.spotId]=row;
    }
    return{title:String(event.title||'Conference Sign-Up'),dateSummary:eventDateSummary(event),capacity:eventSlotsArray(event).reduce((sum,slot)=>sum+Math.max(1,eventSpotIds(slot).length||Number(slot.capacity)||1),0),rows};
  }
  function sanitizeRows(roster){
    const all=[];for(const bySlot of Object.values(roster?.rows||{}))for(const row of Object.values(bySlot||{}))if(row&&row.slotId&&row.studentName)all.push(row);
    return all;
  }
  async function managerSync(id,event,force=false){
    if(!safeId(id)||!event||!fb||!db||!currentUser)return;
    const next=projection(event),signature=JSON.stringify(next);
    if(!force&&syncing.get(id)===signature)return;
    // Only managers have permission to write the sanitized snapshot; this never includes private tokens.
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
      await fb.set(fb.ref(db,`${rosterPath(id)}/rows/${slot.id}/${record.spotId}`),rowFromRecord(slot,event,record));
    }
  }
  function managerRemoval(id,record){
    if(record?.slotId&&record?.spotId)fb.remove(fb.ref(db,`${rosterPath(id)}/rows/${record.slotId}/${record.spotId}`)).catch(err=>console.warn('Roster removal sync',err));
  }
  function managerMove(id,newRecord,oldRecord,slot,event){
    const oldSlotId=oldRecord?.slotId,oldSpotId=oldRecord?.spotId;
    (async()=>{
      if(oldSlotId&&oldSpotId)await fb.remove(fb.ref(db,`${rosterPath(id)}/rows/${oldSlotId}/${oldSpotId}`));
      if(slot&&newRecord?.spotId)await fb.set(fb.ref(db,`${rosterPath(id)}/rows/${slot.id}/${newRecord.spotId}`),rowFromRecord(slot,event,newRecord));
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
      const description=error?.code==='PERMISSION_DENIED'?'Publish the v1.6 Firebase Realtime Database rules first.':(error?.message||'Could not create roster link.');
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
  function ensureUI(){
    if(panel)return;
    panel=html('section','event-roster-overlay');panel.id='eventRosterOverlay';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Conference sign-up roster');
    const shell=html('div','event-roster-shell');const header=html('header','event-roster-header');
    const left=html('div','event-roster-heading');left.append(html('small','event-roster-eyebrow','PARENT-TEACHER CONFERENCES'),titleEl=html('h2','','All Sign-Ups'),metaEl=html('p','','Only confirmed appointments · No empty time slots'));
    const right=html('div','event-roster-header-actions');right.append(button('Export CSV','event-roster-secondary',exportCSV),button('Print','event-roster-secondary',()=>window.print()),button('Close','event-roster-close',closeRoster));header.append(left,right);
    const stats=html('div','event-roster-stats');
    for(const [key,title] of [['count','Signed up'],['capacity','Total spots']]){
      const card=html('div','event-roster-stat');card.append(html('small','',title));const value=html('strong','event-roster-stat-value','0');if(key==='count')countEl=value;else capacityEl=value;card.append(value);stats.append(card);
    }
    const tools=html('div','event-roster-toolbar');
    const searchLabel=html('label','event-roster-search');searchLabel.append(html('span','','Search students, parents, teachers, or contact details'));searchEl=html('input');searchEl.type='search';searchEl.placeholder='Search sign-ups…';searchEl.addEventListener('input',render);searchLabel.append(searchEl);
    const dateLabel=html('label');dateLabel.append(html('span','','Date'));dateEl=html('select');dateEl.addEventListener('change',render);dateLabel.append(dateEl);
    const gradeLabel=html('label');gradeLabel.append(html('span','','Grade'));gradeEl=html('select');gradeEl.addEventListener('change',render);gradeLabel.append(gradeEl);
    const sortLabel=html('label');sortLabel.append(html('span','','Sort by'));sortEl=html('select');
    for(const [value,label] of [['date','Date / time ↑'],['date-desc','Date / time ↓'],['student','Student A–Z'],['parent','Parent A–Z'],['grade','Grade'],['teacher','Teacher']]){const option=html('option','',label);option.value=value;sortEl.append(option)}sortEl.addEventListener('change',render);sortLabel.append(sortEl);
    tools.append(searchLabel,dateLabel,gradeLabel,sortLabel);
    statusEl=html('p','event-roster-alert');statusEl.setAttribute('role','status');statusEl.hidden=true;
    const body=html('div','event-roster-table-wrap');const table=html('table','event-roster-table');const thead=html('thead');const headings=html('tr');
    for(const label of ['Date','Time','Student','Grade','Teacher','Parent/Guardian','Contact','Interpreter','Actions']){const cell=html('th','',label);cell.dataset.rosterColumn=label;headings.append(cell)}
    thead.append(headings);tableBody=html('tbody');table.append(thead,tableBody);body.append(table);
    const footer=html('footer','event-roster-footer');filterCountEl=html('span','','Showing 0 sign-ups');permissionsEl=html('span','','Private roster · Share only with authorized school staff');footer.append(filterCountEl,permissionsEl);
    shell.append(header,stats,tools,statusEl,body,footer);panel.append(shell);document.body.append(panel);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel&&!panel.hidden&&active?.source!=='viewer'&&!document.querySelector('dialog[open]'))closeRoster()});
  }
  function fillSelect(select,values,allLabel){
    const old=select.value;select.replaceChildren();const all=html('option','',allLabel);all.value='';select.append(all);
    for(const value of values){const option=html('option','',value);option.value=value;select.append(option)}
    if(values.includes(old))select.value=old;
  }
  function filterRows(){
    if(!active)return[];
    const q=searchEl.value.trim().toLowerCase(),date=dateEl.value,grade=gradeEl.value,order=sortEl.value;
    const rows=active.rows.filter(row=>(!date||row.date===date)&&(!grade||row.studentGrade===grade)&&(!q||[row.studentName,row.studentGrade,row.studentTeacher,row.parentName,row.email,row.phone,row.interpreterLanguage,row.date,row.timeRange].join(' ').toLowerCase().includes(q)));
    const by=(key)=>(a,b)=>String(a[key]||'').localeCompare(String(b[key]||''),undefined,{numeric:true,sensitivity:'base'});
    const chronology=(a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)||by('studentName')(a,b);
    rows.sort(order==='student'?by('studentName'):order==='parent'?by('parentName'):order==='grade'?by('studentGrade'):order==='teacher'?by('studentTeacher'):order==='date-desc'?(a,b)=>-chronology(a,b):chronology);
    return rows;
  }
  function render(){
    if(!panel||!active)return;
    titleEl.textContent=active.title||'Conference Sign-Up';metaEl.textContent=active.source==='viewer'?'View-only conference roster · Confirmed reservations only':'All sign-ups · Confirmed reservations only · Empty slots are hidden';
    countEl.textContent=active.rows.length.toLocaleString();capacityEl.textContent=active.capacity!=null?Number(active.capacity).toLocaleString():'—';
    fillSelect(dateEl,[...new Set(active.rows.map(row=>row.date).filter(Boolean))].sort(),'All dates');
    fillSelect(gradeEl,[...new Set(active.rows.map(row=>row.studentGrade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),'All grades');
    selectedRows=filterRows();tableBody.replaceChildren();
    const manager=active.source!=='viewer';panel.classList.toggle('is-viewer',!manager);
    if(!selectedRows.length){const tr=html('tr');const cell=html('td','event-roster-empty',active.rows.length?'No sign-ups match your search or filters.':'No one has signed up yet.');cell.colSpan=9;tr.append(cell);tableBody.append(tr)}
    for(const row of selectedRows){
      const tr=html('tr');
      const values=[eventSlotFullDateText(row.date),row.timeRange||formatScheduleTime(row.time),row.studentName||'—',row.studentGrade||'—',row.studentTeacher||'—',row.parentName||'—',null,row.interpreterNeeded?`Yes${row.interpreterLanguage?' · '+row.interpreterLanguage:''}`:'No'];
      values.forEach((value,index)=>{
        const td=html('td');if(index===2)td.className='event-roster-student';
        if(index===6){const contact=html('div','event-roster-contact');if(row.email)contact.append(html('span','',row.email));if(row.phone)contact.append(html('span','',row.phone));td.append(contact)}else td.textContent=value;tr.append(td);
      });
      const actions=html('td','event-roster-row-actions');if(manager&&row._record){actions.append(button('Move','event-roster-move',()=>moveManagedReservation(active.id,row._record,active.source)),button('Remove','event-roster-remove',()=>removeManagedReservation(active.id,row._record,active.source)))}tr.append(actions);tableBody.append(tr);
    }
    filterCountEl.textContent=`Showing ${selectedRows.length} of ${active.rows.length} confirmed sign-ups`;
    permissionsEl.textContent=manager?'Manage reservations using Move or Remove.':'VIEW ONLY · No editing, moving, or deleting';
  }
  function showRoster(data){ensureUI();active=data;searchEl.value='';dateEl.value='';gradeEl.value='';sortEl.value='date';panel.hidden=false;document.body.classList.add('event-roster-open');statusEl.hidden=true;render()}
  function closeRoster(){if(!panel)return;if(active?.source==='viewer'){for(const stop of viewerUnsubscribe)stop();viewerUnsubscribe=[];location.href=new URL(location.pathname,location.origin).toString();return}panel.hidden=true;document.body.classList.remove('event-roster-open');active=null;}
  function openManager(id,source){
    const event=source==='editor'?sharedEditorEventData:eventSignupCache.get(id);
    if(!event)return;
    const data=projection(event);showRoster({id,source,event,title:data.title,rows:managerRows(event),capacity:data.capacity});
    managerSync(id,event,true).catch(error=>console.warn('Could not update shared roster snapshot',error));
  }
  function csvEscape(value){const source=String(value??'');const safe=/^[\s]*[=+@\-\t\r]/.test(source)?`'${source}`:source;return `"${safe.replaceAll('"','""')}"`}
  function exportCSV(){
    if(!active)return;const cols=['Date','Time','Student Name','Grade','Teacher','Parent/Guardian','Email','Phone','Interpreter Needed','Interpreter Language'];
    const data=selectedRows.map(row=>[row.date,row.timeRange,row.studentName,row.studentGrade,row.studentTeacher,row.parentName,row.email,row.phone,row.interpreterNeeded?'Yes':'No',row.interpreterLanguage]);
    const csv='\uFEFF'+[cols,...data].map(items=>items.map(csvEscape).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`conference-signups-${active.id}.csv`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  async function openViewer(id,token){
    showRoster({id,source:'viewer',title:'Conference Roster',rows:[],capacity:null});statusEl.hidden=false;showNotice('Checking the private roster viewer link…');
    try{
      await initRaceFirebase();if(!currentUser)throw new Error('Authentication unavailable');
      const sessionRef=fb.ref(db,`eventSignups/${id}/rosterSessions/${currentUser.uid}`);
      await fb.set(sessionRef,{token,createdAt:Date.now()});
      const ref=fb.ref(db,rosterPath(id));
      let first=true;
      const unsub=fb.onValue(ref,snapshot=>{
        const value=snapshot.val()||{};
        if(!snapshot.exists())showNotice('This roster has no published reservations yet.');else{statusEl.hidden=true;}
        if(active?.source!=='viewer'||active.id!==id)return;
        active.title=value.title||'Conference Sign-Up Roster';active.rows=sanitizeRows(value);active.capacity=Number.isFinite(Number(value.capacity))?Number(value.capacity):null;render();first=false;
      },error=>{
        statusEl.hidden=false;showNotice(error?.code==='PERMISSION_DENIED'?'Roster access has been revoked or its Firebase rules have not been published.':(error?.message||'Could not load roster.'),true);active.rows=[];render();
      });
      viewerUnsubscribe.push(unsub);
      viewerUnsubscribe.push(fb.onValue(sessionRef,snapshot=>{
        if(snapshot.exists())return;
        statusEl.hidden=false;showNotice('This roster viewer link has been revoked.','error');if(active?.source==='viewer'){active.rows=[];render()}
        unsub();
      }));
    }catch(error){statusEl.hidden=false;showNotice(error?.code==='PERMISSION_DENIED'?'This roster viewer link is invalid, revoked, or the Firebase roster rules are not installed.':(error?.message||'Unable to open roster.'),true)}
  }
  window.GLNConferenceRoster={addOwnerButtons,addEditorButtons,managerChanged,parentChanges,managerRemoval,managerMove,openViewer,openManager,managerSync};
  // Recreate owner actions now that this extension has loaded after event-signup.js.
  if(typeof renderEventSignupList==='function'&&eventSignupIds.length)renderEventSignupList();
})();
