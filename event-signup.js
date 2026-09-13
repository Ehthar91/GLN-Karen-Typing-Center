/* Event Sign Up — shareable time slots linked to Schedule Timer Special Schedules */
const EVENT_SIGNUP_IDS_KEY='glnEventSignupEventIdsV1';
const eventSignupList=document.querySelector('#eventSignupList');
const eventSignupStatus=document.querySelector('#eventSignupStatus');
const eventSignupForm=document.querySelector('#eventSignupForm');
const eventSignupEditorTitle=document.querySelector('#eventSignupEditorTitle');
const eventSignupName=document.querySelector('#eventSignupName');
const eventSignupDate=document.querySelector('#eventSignupDate');
const eventSignupDescription=document.querySelector('#eventSignupDescription');
const eventSignupLinkSchedule=document.querySelector('#eventSignupLinkSchedule');
const eventSignupOpen=document.querySelector('#eventSignupOpen');
const eventSignupAllowMultiple=document.querySelector('#eventSignupAllowMultiple');
const eventSignupActivityMode=document.querySelector('#eventSignupActivityMode');
const eventSignupSlotEditor=document.querySelector('#eventSignupSlotEditor');
const addEventSignupSlot=document.querySelector('#addEventSignupSlot');
const eventSlotGeneratorDate=document.querySelector('#eventSlotGeneratorDate');
const eventSlotGeneratorStart=document.querySelector('#eventSlotGeneratorStart');
const eventSlotGeneratorDuration=document.querySelector('#eventSlotGeneratorDuration');
const eventSlotGeneratorCount=document.querySelector('#eventSlotGeneratorCount');
const eventSlotGeneratorCapacity=document.querySelector('#eventSlotGeneratorCapacity');
const eventSlotGeneratorLabel=document.querySelector('#eventSlotGeneratorLabel');
const generateEventSignupSlots=document.querySelector('#generateEventSignupSlots');
const addEventSignupDay=document.querySelector('#addEventSignupDay');
const eventSlotGeneratorPreview=document.querySelector('#eventSlotGeneratorPreview');
const saveEventSignup=document.querySelector('#saveEventSignup');
const clearEventSignupForm=document.querySelector('#clearEventSignupForm');
const cancelEventSignupEdit=document.querySelector('#cancelEventSignupEdit');
const newEventSignup=document.querySelector('#newEventSignup');
const refreshEventSignups=document.querySelector('#refreshEventSignups');
const eventSignupTeacherView=document.querySelector('#eventSignupTeacherView');
const eventSignupPublicView=document.querySelector('#eventSignupPublicView');
const eventPublicTitle=document.querySelector('#eventPublicTitle');
const eventPublicDate=document.querySelector('#eventPublicDate');
const eventPublicDescription=document.querySelector('#eventPublicDescription');
const eventPublicMessage=document.querySelector('#eventPublicMessage');
const eventPublicSlots=document.querySelector('#eventPublicSlots');
const eventPublicForm=document.querySelector('#eventPublicForm');
const eventPublicSelectedSlot=document.querySelector('#eventPublicSelectedSlot');
const eventPublicParentName=document.querySelector('#eventPublicParentName');
const eventPublicEmail=document.querySelector('#eventPublicEmail');
const eventPublicPhone=document.querySelector('#eventPublicPhone');
const eventPublicSelectionList=document.querySelector('#eventPublicSelectionList');
const eventPublicSubmit=document.querySelector('#eventPublicSubmit');
const eventPublicCancelSignup=document.querySelector('#eventPublicCancelSignup');
const eventPublicSuccess=document.querySelector('#eventPublicSuccess');
const eventPublicSuccessText=document.querySelector('#eventPublicSuccessText');
const eventPublicManageLinkWrap=document.querySelector('#eventPublicManageLinkWrap');
const eventPublicFallbackNote=document.querySelector('#eventPublicFallbackNote');
const eventPublicManageLink=document.querySelector('#eventPublicManageLink');
const eventPublicCopyManageLink=document.querySelector('#eventPublicCopyManageLink');
const eventPublicStartAnother=document.querySelector('#eventPublicStartAnother');
const eventSignupSharedEditorView=document.querySelector('#eventSignupSharedEditorView');
const eventSharedEditorTitle=document.querySelector('#eventSharedEditorTitle');
const eventSharedEditorDate=document.querySelector('#eventSharedEditorDate');
const eventSharedEditorDescription=document.querySelector('#eventSharedEditorDescription');
const eventSharedEditorMessage=document.querySelector('#eventSharedEditorMessage');
const eventSharedEditorSlots=document.querySelector('#eventSharedEditorSlots');
const eventSharedCopySignup=document.querySelector('#eventSharedCopySignup');
const eventSharedSchedule=document.querySelector('#eventSharedSchedule');
let eventSignupIds=[];
let eventSignupCache=new Map();
let eventSignupWatchers=new Map();
let eventSignupEditorSlots=[];
let editingEventSignupId='';
let publicEventSignupId='';
let publicSelectedSlotIds=new Set();
let publicDraftStudentNames=new Map();
let publicDraftStudentGrades=new Map();
let publicDraftStudentTeachers=new Map();
let publicSelectionInitialized=false;
let publicEventData=null;
let publicEventUnsubscribe=null;
let publicOwnSignups=new Map();
let publicManageToken='';
let publicManageMode=false;
let publicSubmissionComplete=false;
let publicSubmittedManageLink='';
let sharedEditorEventId='';
let sharedEditorToken='';
let sharedEditorEventData=null;
let sharedEditorUnsubscribe=null;
function eventSignupId(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let text='';
  if(window.crypto?.getRandomValues){const bytes=new Uint8Array(10);crypto.getRandomValues(bytes);for(const byte of bytes)text+=alphabet[byte%alphabet.length]}
  else for(let i=0;i<10;i++)text+=alphabet[Math.floor(Math.random()*alphabet.length)];
  return text;
}
function eventSlotId(){return `slot-${Date.now()}-${Math.random().toString(36).slice(2,7)}`}
function eventSpotId(){return `spot-${Date.now()}-${Math.random().toString(36).slice(2,9)}`}
function eventFamilyId(){return `fam-${Date.now()}-${Math.random().toString(36).slice(2,10)}`}
function eventReservationId(){return `res-${Date.now()}-${Math.random().toString(36).slice(2,10)}`}
function eventManageToken(){
  if(window.crypto?.getRandomValues){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')}
  let token='';for(let i=0;i<64;i++)token+='abcdef0123456789'[Math.floor(Math.random()*16)];return token;
}
function eventManageLink(id,token){const url=new URL(eventPublicLink(id));url.searchParams.set('manage',token);return url.toString()}
function eventEditorLink(id,token){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('eventEditor',id);url.searchParams.set('editor',token);return url.toString()}
function defaultEventSlot(date=''){return{id:eventSlotId(),date:date||eventSignupDate?.value||localScheduleDateKey(new Date()),label:'',time:'',duration:15,capacity:1}}
function eventTimeToMinutes(value){const match=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));if(!match)return null;const hour=Number(match[1]),minute=Number(match[2]);if(hour<0||hour>23||minute<0||minute>59)return null;return hour*60+minute}
function eventMinutesToTime(value){const minutes=Math.max(0,Math.min(1439,Math.floor(Number(value)||0)));return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`}
function eventTimePlusMinutes(time,minutes){const start=eventTimeToMinutes(time);if(start===null)return'';const next=start+Math.max(1,Number(minutes)||15);return next>=1440?'':eventMinutesToTime(next)}
function nextEventSlot(){
  const existing=[...eventSignupEditorSlots].filter(slot=>slot.time).sort((a,b)=>`${slot.date||eventSignupDate?.value||''}|${slot.time}`.localeCompare(`${b.date||eventSignupDate?.value||''}|${b.time}`));const last=existing.at(-1);const next=defaultEventSlot(last?.date||eventSignupDate?.value||'');if(!last)return next;
  next.label=last.label||'';next.duration=Math.max(1,Math.min(480,Number(last.duration)||15));next.capacity=Math.max(1,Math.min(100,Number(last.capacity)||1));next.time=eventTimePlusMinutes(last.time,next.duration);return next;
}
function updateEventSlotGeneratorPreview(){
  if(!eventSlotGeneratorPreview)return;const date=eventSlotGeneratorDate?.value||eventSignupDate?.value||'';const start=eventSlotGeneratorStart?.value||'';const duration=Math.max(1,Math.min(480,Number(eventSlotGeneratorDuration?.value)||15));const count=Math.max(1,Math.min(96,Number(eventSlotGeneratorCount?.value)||1));const capacity=Math.max(1,Math.min(100,Number(eventSlotGeneratorCapacity?.value)||1));const startMinutes=eventTimeToMinutes(start);
  if(!date||startMinutes===null){eventSlotGeneratorPreview.textContent='Choose a date and first start time to preview the schedule.';return}
  const lastStart=startMinutes+(count-1)*duration;const end=lastStart+duration;if(end>1440){eventSlotGeneratorPreview.textContent='This batch would run past midnight. Reduce the slot count or length.';return}
  eventSlotGeneratorPreview.textContent=`${eventDateText(date)} · ${count} slot${count===1?'':'s'} · ${formatScheduleTime(start)}–${formatScheduleTime(eventMinutesToTime(end%1440||0))} · ${duration} min · max ${capacity} per slot`;
}
function generateEventSlotsFromBuilder(){
  const date=eventSlotGeneratorDate?.value||eventSignupDate?.value||'';const start=eventSlotGeneratorStart?.value||'';const duration=Math.max(1,Math.min(480,Number(eventSlotGeneratorDuration?.value)||15));const count=Math.max(1,Math.min(96,Number(eventSlotGeneratorCount?.value)||1));const capacity=Math.max(1,Math.min(100,Number(eventSlotGeneratorCapacity?.value)||1));const label=String(eventSlotGeneratorLabel?.value||'').trim().slice(0,50);const startMinutes=eventTimeToMinutes(start);
  if(!date){alert('Choose the date for these slots.');eventSlotGeneratorDate?.focus();return}
  if(startMinutes===null){alert('Choose the first start time.');eventSlotGeneratorStart?.focus();return}
  if(startMinutes+count*duration>1440){alert('Those slots would run past midnight. Reduce the number of slots or the slot length.');return}
  const current=eventSignupEditorSlots.filter(slot=>slot.time||String(slot.label||'').trim());const existingTimes=new Set(current.filter(slot=>slot.time).map(slot=>`${slot.date||eventSignupDate?.value||''}|${slot.time}`));const generated=[];let skipped=0;
  for(let i=0;i<count;i++){const time=eventMinutesToTime(startMinutes+i*duration);const key=`${date}|${time}`;if(existingTimes.has(key)){skipped++;continue}generated.push({id:eventSlotId(),date,label,time,duration,capacity});existingTimes.add(key)}
  if(!generated.length){alert('Those date/time slots are already in the slot list.');return}
  eventSignupEditorSlots=[...current,...generated];renderEventSlotEditor();updateEventSlotGeneratorPreview();showToast(`${generated.length} slot${generated.length===1?'':'s'} generated for ${eventDateText(date)}${skipped?` · ${skipped} duplicate${skipped===1?'':'s'} skipped`:''}`);
}
function eventDateKeyPlusDays(value,days=1){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));if(!match)return'';const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3])+days);return localScheduleDateKey(date)}
function setNextEventGeneratorDay(){const dates=eventSignupEditorSlots.map(slot=>slot.date||eventSignupDate?.value||'').filter(Boolean).sort();const base=dates.at(-1)||eventSlotGeneratorDate?.value||eventSignupDate?.value||localScheduleDateKey(new Date());const next=eventDateKeyPlusDays(base,1);if(eventSlotGeneratorDate)eventSlotGeneratorDate.value=next;if(eventSlotGeneratorStart&&!eventSlotGeneratorStart.value){const last=[...eventSignupEditorSlots].filter(slot=>slot.time).sort((a,b)=>`${a.date||''}|${a.time}`.localeCompare(`${b.date||''}|${b.time}`)).at(-1);eventSlotGeneratorStart.value=last?.time||''}updateEventSlotGeneratorPreview();eventSlotGeneratorStart?.focus();showToast(`Ready to add slots for ${eventDateText(next)}`)}
function safeEventIds(value){return [...new Set((Array.isArray(value)?value:[]).map(v=>String(v||'').trim()).filter(Boolean))].slice(0,100)}
function loadEventSignupIds(){try{eventSignupIds=safeEventIds(JSON.parse(localStorage.getItem(EVENT_SIGNUP_IDS_KEY)||'[]'))}catch{eventSignupIds=[]}}
function saveEventSignupIds(){localStorage.setItem(EVENT_SIGNUP_IDS_KEY,JSON.stringify(eventSignupIds));if(!window.__classroomToolsApplyingCloud)window.queueClassroomToolsCloudSync?.()}
function setEventStatus(text,type=''){if(!eventSignupStatus)return;eventSignupStatus.textContent=text;eventSignupStatus.classList.toggle('is-error',type==='error');eventSignupStatus.classList.toggle('is-ok',type==='ok')}
function eventDateText(value){const date=parseScheduleDateKey?.(value);return date?date.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric',year:'numeric'}):String(value||'')}
function eventPublicLink(id){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('signup',id);return url.toString()}
function eventSlotDate(slot,event){return String(slot?.date||event?.date||'')}
function eventSlotsArray(event){const fallback=String(event?.date||'');return Object.values(event?.slots||{}).filter(slot=>slot&&slot.id&&slot.time).map(slot=>({...slot,date:String(slot.date||fallback)})).sort((a,b)=>`${a.date||fallback}|${a.time}`.localeCompare(`${b.date||fallback}|${b.time}`))}
function eventDates(event){return [...new Set(eventSlotsArray(event).map(slot=>eventSlotDate(slot,event)).filter(Boolean))].sort()}
function eventDateSummary(event){const dates=eventDates(event);if(!dates.length)return eventDateText(event?.date);if(dates.length===1)return eventDateText(dates[0]);return `${eventDateText(dates[0])} – ${eventDateText(dates.at(-1))} · ${dates.length} days`}
function eventSlotsByDate(event){const groups=new Map();for(const slot of eventSlotsArray(event)){const date=eventSlotDate(slot,event);if(!groups.has(date))groups.set(date,[]);groups.get(date).push(slot)}return groups}
function eventSpotIds(slot){return Object.keys(slot?.spots||{}).filter(id=>slot.spots[id]===true)}
function eventClaimOwnerKey(value){if(typeof value==='string'&&value)return value;if(value&&typeof value==='object'&&value.active===true&&typeof value.token==='string'&&value.token)return value.token;return''}
function eventClaimsForSlot(event,slotId){return Object.entries(event?.claims?.[slotId]||{}).map(([spotId,value])=>{const ownerKey=eventClaimOwnerKey(value);return ownerKey?{spotId,ownerKey,value}:null}).filter(Boolean)}
function eventPublicFilledCount(event,slotId){return Object.values(event?.availability?.[slotId]||{}).filter(value=>value===true).length}
function modernReservationsForSlot(event,slotId){
  const results=[];
  for(const [manageToken,userReservations] of Object.entries(event?.reservations||{})){
    for(const [reservationId,item] of Object.entries(userReservations||{})){
      if(!item)continue;const actualSlotId=String(item.slotId||reservationId);if(actualSlotId===slotId)results.push({...item,_manageToken:manageToken,_reservationId:reservationId});
    }
  }
  return results.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
function legacySignupsForSlot(event,slotId){return Object.values(event?.signups?.[slotId]||{}).filter(Boolean).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))}
function eventSignupsForSlot(event,slotId){const modern=modernReservationsForSlot(event,slotId);return modern.length||event?.claims?.[slotId]?modern:legacySignupsForSlot(event,slotId)}
function eventFilledCount(event,slotId){const claims=eventClaimsForSlot(event,slotId);return claims.length||(!event?.claims?.[slotId]?legacySignupsForSlot(event,slotId).length:0)}
function eventSignupCount(event){return eventSlotsArray(event).reduce((sum,slot)=>sum+eventFilledCount(event,slot.id),0)}
function currentParticipantSignups(event,uid){
  const own=event?.reservations?.[uid]||{};const bySlot=new Map();
  for(const [reservationId,item] of Object.entries(own)){if(!item)continue;const slotId=String(item.slotId||reservationId);if(!bySlot.has(slotId))bySlot.set(slotId,item)}
  return eventSlotsArray(event).map(slot=>({slot,signup:bySlot.get(slot.id)})).filter(item=>item.signup);
}
function publicCurrentSignups(){return eventSlotsArray(publicEventData).map(slot=>({slot,signup:publicOwnSignups.get(slot.id)})).filter(item=>item.signup)}
function signupStudentName(item){return String(item?.studentName||item?.name||'').trim()}
function signupStudentGrade(item){return String(item?.studentGrade||item?.grade||'').trim()}
function signupStudentTeacher(item){return String(item?.studentTeacher||item?.teacher||'').trim()}
function buildSlotSpots(slot,existingEvent){
  const capacity=Math.max(1,Math.min(100,Number(slot.capacity)||1));
  const claimed=eventClaimsForSlot(existingEvent,slot.id).map(item=>item.spotId);
  const legacy=legacySignupsForSlot(existingEvent,slot.id);
  if(claimed.length+legacy.length>capacity)throw new Error(`${formatScheduleTime(slot.time)} already has ${claimed.length+legacy.length} signup${claimed.length+legacy.length===1?'':'s'}. Its maximum cannot be reduced below that number.`);
  const ids=[];
  const add=id=>{if(id&&!ids.includes(id)&&ids.length<capacity)ids.push(id)};
  claimed.forEach(add);
  eventSpotIds(existingEvent?.slots?.[slot.id]).forEach(add);
  while(ids.length<capacity)add(eventSpotId());
  return Object.fromEntries(ids.map(id=>[id,true]));
}
function normalizeExistingSignupData(existing,slotMap){
  const claims={};const reservations={};
  for(const [slotId,slot] of Object.entries(slotMap)){
    const allowedSpots=new Set(eventSpotIds(slot));const sourceClaims=existing?.claims?.[slotId]||{};
    for(const [spotId,value] of Object.entries(sourceClaims)){if(!allowedSpots.has(spotId))continue;const ownerKey=eventClaimOwnerKey(value);if(!ownerKey)continue;claims[slotId]??={};claims[slotId][spotId]=value}
  }
  for(const [ownerKey,ownerReservations] of Object.entries(existing?.reservations||{})){
    for(const [reservationId,item] of Object.entries(ownerReservations||{})){
      if(!item)continue;const slotId=String(item.slotId||reservationId);if(!slotMap[slotId])continue;const spotId=String(item.spotId||'');
      if(!spotId||eventClaimOwnerKey(claims?.[slotId]?.[spotId])!==ownerKey)continue;
      reservations[ownerKey]??={};reservations[ownerKey][reservationId]={...item,slotId,spotId};
    }
  }
  for(const [slotId,legacyMap] of Object.entries(existing?.signups||{})){
    if(!slotMap[slotId])continue;const free=eventSpotIds(slotMap[slotId]).filter(spotId=>!eventClaimOwnerKey(claims?.[slotId]?.[spotId]));
    for(const [uid,item] of Object.entries(legacyMap||{})){
      if(!item)continue;const already=Object.values(reservations?.[uid]||{}).some(res=>res&&String(res.slotId||'')===slotId);if(already)continue;const spotId=free.shift();if(!spotId)throw new Error(`${formatScheduleTime(slotMap[slotId].time)} has more existing signups than available spots.`);
      const reservationId=`legacy-${slotId}`;claims[slotId]??={};claims[slotId][spotId]=uid;reservations[uid]??={};reservations[uid][reservationId]={...item,uid,slotId,spotId,familyId:item.familyId||`legacy-${uid}`};
    }
  }
  return{claims,reservations};
}
function buildEventAvailability(slotMap,claims){
  const availability={};for(const [slotId,slot] of Object.entries(slotMap)){availability[slotId]={};for(const spotId of eventSpotIds(slot))availability[slotId][spotId]=Boolean(eventClaimOwnerKey(claims?.[slotId]?.[spotId]))}return availability;
}
function activityNameForEvent(event,participants){
  const names=participants.map(signupStudentName).filter(Boolean);
  if(event.activityMode==='event')return event.title||'Event';
  if(event.activityMode==='event-participant')return names.length?`${event.title||'Event'} – ${names.join(', ')}`:(event.title||'Event');
  return names.join(', ')||(event.title||'Event');
}
function syncEventToSpecialSchedule(id,event){
  if(!event)return;const owned=Boolean(currentUser&&event.ownerUid===currentUser.uid);if(!owned)return;
  const ownedSchedules=()=>classroomSchedules.filter(item=>item.type==='special'&&item.source==='event-signup'&&item.linkedEventId===id);
  if(!event.linkedSchedule){const removeIds=new Set(ownedSchedules().map(item=>item.id));if(removeIds.size){classroomSchedules=classroomSchedules.filter(item=>!removeIds.has(item.id));saveClassroomSchedules();renderScheduleTimers();updateScheduleTimerClock()}return}
  const desiredDates=eventDates(event);const touched=new Set();
  for(const date of desiredDates){const daySlots=eventSlotsByDate(event).get(date)||[];const slots=daySlots.map(slot=>{const participants=eventSignupsForSlot(event,slot.id);if(!participants.length)return null;return{id:`event-${id}-${slot.id}`,name:activityNameForEvent(event,participants),time:slot.time,duration:Math.max(1,Math.min(480,Number(slot.duration)||15))}}).filter(Boolean).sort((a,b)=>a.time.localeCompare(b.time));
    let index=classroomSchedules.findIndex(item=>item.type==='special'&&item.source==='event-signup'&&item.linkedEventId===id&&(item.linkedEventDate===date||(!item.linkedEventDate&&item.date===date)));
    if(!slots.length){if(index>=0){classroomSchedules.splice(index,1)}continue}
    const existing=index>=0?classroomSchedules[index]:null;const next={id:existing?.id||`event-special-${id}-${date}`,type:'special',source:'event-signup',linkedEventId:id,linkedEventDate:date,name:String(event.title||'Event Sign Up'),date,enabled:true,slots};
    if(index>=0)classroomSchedules[index]=next;else{classroomSchedules.push(next);index=classroomSchedules.length-1}touched.add(next.id);
  }
  const before=classroomSchedules.length;classroomSchedules=classroomSchedules.filter(item=>!(item.type==='special'&&item.source==='event-signup'&&item.linkedEventId===id&&!touched.has(item.id)));
  saveClassroomSchedules();renderScheduleTimers();updateScheduleTimerClock();
}
function removeLinkedEventSchedule(id){const before=classroomSchedules.length;classroomSchedules=classroomSchedules.filter(item=>item.linkedEventId!==id);if(classroomSchedules.length!==before){saveClassroomSchedules();renderScheduleTimers();updateScheduleTimerClock()}}
function sharedEditorSchedules(id){return classroomSchedules.filter(item=>item.type==='special'&&item.source==='event-signup-shared-editor'&&item.linkedEventId===id)}
function sharedEditorScheduleLinked(id){return sharedEditorSchedules(id).length>0}
function syncSharedEditorSchedule(id,event){
  if(!id||!event||!sharedEditorScheduleLinked(id))return;const groups=eventSlotsByDate(event);const desiredDates=eventDates(event);const touched=new Set();
  for(const date of desiredDates){const daySlots=groups.get(date)||[];const slots=daySlots.map(slot=>{const participants=eventSignupsForSlot(event,slot.id);if(!participants.length)return null;return{id:`shared-event-${id}-${slot.id}`,name:activityNameForEvent(event,participants),time:slot.time,duration:Math.max(1,Math.min(480,Number(slot.duration)||15))}}).filter(Boolean).sort((a,b)=>a.time.localeCompare(b.time));
    let index=classroomSchedules.findIndex(item=>item.type==='special'&&item.source==='event-signup-shared-editor'&&item.linkedEventId===id&&(item.linkedEventDate===date||(!item.linkedEventDate&&item.date===date)));const existing=index>=0?classroomSchedules[index]:null;const next={id:existing?.id||`shared-event-special-${id}-${date}-${Date.now()}`,type:'special',source:'event-signup-shared-editor',linkedEventId:id,linkedEventDate:date,name:String(event.title||'Event Sign Up'),date,enabled:true,slots};if(index>=0)classroomSchedules[index]=next;else{classroomSchedules.push(next);index=classroomSchedules.length-1}touched.add(next.id);
  }
  classroomSchedules=classroomSchedules.filter(item=>!(item.type==='special'&&item.source==='event-signup-shared-editor'&&item.linkedEventId===id&&!touched.has(item.id)));saveClassroomSchedules();renderScheduleTimers();updateScheduleTimerClock();
}
function updateSharedScheduleButton(){if(!eventSharedSchedule)return;const linked=sharedEditorScheduleLinked(sharedEditorEventId);eventSharedSchedule.textContent=linked?'Unlink from My Schedule Timer':'Link to My Schedule Timer';eventSharedSchedule.classList.toggle('danger',linked)}
function toggleSharedEditorSchedule(){
  if(!sharedEditorEventId||!sharedEditorEventData)return;if(sharedEditorScheduleLinked(sharedEditorEventId)){classroomSchedules=classroomSchedules.filter(item=>!(item.type==='special'&&item.source==='event-signup-shared-editor'&&item.linkedEventId===sharedEditorEventId));saveClassroomSchedules();renderScheduleTimers();updateScheduleTimerClock();updateSharedScheduleButton();sharedEditorMessage('Removed all days of this event from your Schedule Timer.','ok');return}
  for(const date of eventDates(sharedEditorEventData)){classroomSchedules.push({id:`shared-event-special-${sharedEditorEventId}-${date}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:'special',source:'event-signup-shared-editor',linkedEventId:sharedEditorEventId,linkedEventDate:date,name:String(sharedEditorEventData.title||'Event Sign Up'),date,enabled:true,slots:[]})}syncSharedEditorSchedule(sharedEditorEventId,sharedEditorEventData);updateSharedScheduleButton();sharedEditorMessage('Linked every event day to your Schedule Timer. Signup changes will keep each Special Schedule updated while this editor link is open.','ok')
}
function renderEventSlotEditor(){
  if(!eventSignupSlotEditor)return;eventSignupSlotEditor.innerHTML='';
  eventSignupEditorSlots.sort((a,b)=>`${a.date||eventSignupDate?.value||''}|${a.time||'99:99'}`.localeCompare(`${b.date||eventSignupDate?.value||''}|${b.time||'99:99'}`));
  eventSignupEditorSlots.forEach((slot,index)=>{
    const row=document.createElement('div');row.className='event-slot-editor';row.dataset.slotId=slot.id;
    const dateField=document.createElement('label');dateField.className='event-slot-field event-slot-date';dateField.innerHTML='<span>Date</span>';const date=document.createElement('input');date.type='date';date.required=true;date.value=slot.date||eventSignupDate?.value||'';date.addEventListener('change',()=>{slot.date=date.value;renderEventSlotEditor()});dateField.append(date);
    const labelField=document.createElement('label');labelField.className='event-slot-field event-slot-label';labelField.innerHTML='<span>Label (optional)</span>';const label=document.createElement('input');label.type='text';label.maxLength=50;label.placeholder='Conference';label.value=slot.label||'';label.addEventListener('input',()=>slot.label=label.value);labelField.append(label);
    const timeField=document.createElement('label');timeField.className='event-slot-field event-slot-time';timeField.innerHTML='<span>Start</span>';const time=document.createElement('input');time.type='time';time.required=true;time.value=slot.time||'';time.addEventListener('change',()=>{slot.time=time.value;renderEventSlotEditor()});timeField.append(time);
    const durationField=document.createElement('label');durationField.className='event-slot-field event-slot-duration';durationField.innerHTML='<span>Minutes</span>';const duration=document.createElement('input');duration.type='number';duration.min='1';duration.max='480';duration.value=slot.duration||15;duration.addEventListener('input',()=>slot.duration=Math.max(1,Math.min(480,Number(duration.value)||15)));durationField.append(duration);
    const capField=document.createElement('label');capField.className='event-slot-field event-slot-capacity';capField.innerHTML='<span>Max signups</span>';const cap=document.createElement('input');cap.type='number';cap.min='1';cap.max='100';cap.value=slot.capacity||1;cap.addEventListener('input',()=>slot.capacity=Math.max(1,Math.min(100,Number(cap.value)||1)));capField.append(cap);
    const remove=document.createElement('button');remove.type='button';remove.className='event-slot-editor-remove';remove.setAttribute('aria-label',`Remove time slot ${index+1}`);remove.textContent='×';remove.disabled=eventSignupEditorSlots.length===1;remove.addEventListener('click',()=>{eventSignupEditorSlots=eventSignupEditorSlots.filter(item=>item.id!==slot.id);renderEventSlotEditor()});
    row.append(dateField,labelField,timeField,durationField,capField,remove);eventSignupSlotEditor.append(row);
  });
}
function resetEventSignupEditor(){
  editingEventSignupId='';eventSignupEditorTitle.textContent='Create Event';cancelEventSignupEdit.hidden=true;saveEventSignup.textContent='Create Event';eventSignupForm.reset();eventSignupLinkSchedule.checked=true;eventSignupOpen.checked=true;if(eventSignupAllowMultiple)eventSignupAllowMultiple.checked=true;eventSignupActivityMode.value='participant';eventSignupDate.value=localScheduleDateKey(new Date());eventSignupEditorSlots=[defaultEventSlot(eventSignupDate.value)];if(eventSlotGeneratorDate)eventSlotGeneratorDate.value=eventSignupDate.value;if(eventSlotGeneratorStart)eventSlotGeneratorStart.value='';if(eventSlotGeneratorDuration)eventSlotGeneratorDuration.value='15';if(eventSlotGeneratorCount)eventSlotGeneratorCount.value='8';if(eventSlotGeneratorCapacity)eventSlotGeneratorCapacity.value='1';if(eventSlotGeneratorLabel)eventSlotGeneratorLabel.value='';renderEventSlotEditor();updateEventSlotGeneratorPreview();
}
function editEventSignup(id){
  const event=eventSignupCache.get(id);if(!event)return;
  editingEventSignupId=id;eventSignupEditorTitle.textContent='Edit Event';cancelEventSignupEdit.hidden=false;saveEventSignup.textContent='Update Event';eventSignupName.value=event.title||'';eventSignupDescription.value=event.description||'';eventSignupLinkSchedule.checked=event.linkedSchedule!==false;eventSignupOpen.checked=event.status!=='closed';if(eventSignupAllowMultiple)eventSignupAllowMultiple.checked=event.allowMultiple!==false;eventSignupActivityMode.value=event.activityMode||'participant';eventSignupEditorSlots=eventSlotsArray(event).map(slot=>({...slot}));if(!eventSignupEditorSlots.length)eventSignupEditorSlots=[defaultEventSlot(event.date||localScheduleDateKey(new Date()))];const firstSlot=eventSignupEditorSlots[0];const firstDate=firstSlot?.date||event.date||localScheduleDateKey(new Date());eventSignupDate.value=firstDate;if(eventSlotGeneratorDate)eventSlotGeneratorDate.value=firstDate;if(eventSlotGeneratorStart)eventSlotGeneratorStart.value=firstSlot?.time||'';if(eventSlotGeneratorDuration)eventSlotGeneratorDuration.value=String(firstSlot?.duration||15);if(eventSlotGeneratorCapacity)eventSlotGeneratorCapacity.value=String(firstSlot?.capacity||1);if(eventSlotGeneratorLabel)eventSlotGeneratorLabel.value=firstSlot?.label||'';updateEventSlotGeneratorPreview();renderEventSlotEditor();eventSignupName.focus();
}
function copyEventLink(id){const link=eventPublicLink(id);if(navigator.clipboard?.writeText)navigator.clipboard.writeText(link).then(()=>showToast('Signup link copied')).catch(()=>window.prompt('Copy this signup link:',link));else window.prompt('Copy this signup link:',link)}
function openEventLink(id){window.open(eventPublicLink(id),'_blank','noopener')}
async function copyEventEditorLink(id,event,forceNew=false){
  try{await initRaceFirebase();let token=event?.editorAccess?.active&&!forceNew?String(event.editorAccess.token||''):'';if(!/^[a-f0-9]{64}$/i.test(token)){token=eventManageToken();await fb.set(fb.ref(db,`eventSignups/${id}/editorAccess`),{token,active:true,createdAt:event?.editorAccess?.createdAt||Date.now(),updatedAt:Date.now()})}const link=eventEditorLink(id,token);if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(link);else window.prompt('Copy this editor link:',link);showToast(forceNew?'New editor link copied':'Editor link copied')}catch(error){setEventStatus(error?.message||'Could not create the editor link.','error')}}
async function revokeEventEditorLink(id,event){if(!event?.editorAccess?.active)return;if(!confirm('Revoke the shared editor link? Anyone using the current editor link will lose access.'))return;try{await initRaceFirebase();await fb.update(fb.ref(db,`eventSignups/${id}/editorAccess`),{active:false,updatedAt:Date.now()});showToast('Editor link revoked')}catch(error){setEventStatus(error?.message||'Could not revoke the editor link.','error')}}
async function removeManagedReservation(eventId,reservation,source='owner'){
  const manageToken=String(reservation?._manageToken||reservation?.manageToken||'');const reservationId=String(reservation?._reservationId||'');const slotId=String(reservation?.slotId||'');const spotId=String(reservation?.spotId||'');if(!eventId||!manageToken||!reservationId||!slotId)return;const student=signupStudentName(reservation)||'this participant';if(!confirm(`Remove ${student} from this time slot?`))return;
  try{await initRaceFirebase();await fb.remove(fb.ref(db,`eventSignups/${eventId}/reservations/${manageToken}/${reservationId}`));if(spotId){await fb.set(fb.ref(db,`eventSignups/${eventId}/claims/${slotId}/${spotId}`),{token:manageToken,active:false,releasedAt:Date.now()});await fb.set(fb.ref(db,`eventSignups/${eventId}/availability/${slotId}/${spotId}`),false)}if(source==='editor')sharedEditorMessage(`${student} was removed. The time slot is available again.`,'ok');else showToast(`${student} removed`)}catch(error){const message=error?.code==='PERMISSION_DENIED'?'Firebase blocked this removal. Publish the Editor Link Firebase rules included with this build.':(error?.message||'Could not remove this signup.');if(source==='editor')sharedEditorMessage(message,'error');else setEventStatus(message,'error')}
}
function eventForManagerSource(eventId,source='owner'){
  return source==='editor'&&sharedEditorEventId===eventId?sharedEditorEventData:eventSignupCache.get(eventId);
}
function availableMoveDestinations(event,currentSlotId){
  return eventSlotsArray(event).filter(slot=>{
    if(slot.id===currentSlotId)return false;
    const spotIds=eventSpotIds(slot);if(!spotIds.length)return false;
    return spotIds.some(spotId=>!eventClaimOwnerKey(event?.claims?.[slot.id]?.[spotId]));
  }).map(slot=>{
    const total=eventSpotIds(slot).length||Number(slot.capacity||1);const filled=eventClaimsForSlot(event,slot.id).length;return{slot,spotsLeft:Math.max(0,total-filled),capacity:total};
  });
}
function chooseMoveDestination(event,reservation){
  const currentSlotId=String(reservation?.slotId||'');const choices=availableMoveDestinations(event,currentSlotId);if(!choices.length)return Promise.resolve(null);
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='event-move-dialog';const form=document.createElement('form');form.method='dialog';const header=document.createElement('div');header.className='event-move-dialog-head';const title=document.createElement('div');const eyebrow=document.createElement('small');eyebrow.textContent='MOVE APPOINTMENT';const heading=document.createElement('h3');heading.textContent=signupStudentName(reservation)||'Participant';title.append(eyebrow,heading);const close=document.createElement('button');close.type='submit';close.value='cancel';close.className='event-move-dialog-close';close.setAttribute('aria-label','Close');close.textContent='×';header.append(title,close);
    const hint=document.createElement('p');hint.textContent='Choose an available time. The current appointment stays protected until the new spot is secured.';const options=document.createElement('div');options.className='event-move-options';
    for(const choice of choices){const button=document.createElement('button');button.type='button';button.className='event-move-option';const time=document.createElement('strong');time.textContent=formatScheduleTime(choice.slot.time);const date=document.createElement('em');date.className='event-move-date';date.textContent=eventDateText(eventSlotDate(choice.slot,event));const copy=document.createElement('span');const label=document.createElement('b');label.textContent=choice.slot.label||`${choice.slot.duration||15} minute appointment`;const left=document.createElement('small');left.textContent=`${choice.spotsLeft} spot${choice.spotsLeft===1?'':'s'} available`;copy.append(label,left);button.append(time,date,copy);button.addEventListener('click',()=>{dialog.dataset.selectedSlotId=choice.slot.id;dialog.close('move')});options.append(button)}
    const cancel=document.createElement('button');cancel.type='submit';cancel.value='cancel';cancel.className='button ghost event-move-cancel';cancel.textContent='Cancel';form.append(header,hint,options,cancel);dialog.append(form);document.body.append(dialog);
    const finish=()=>{const value=dialog.returnValue==='move'?String(dialog.dataset.selectedSlotId||''):'';dialog.remove();resolve(value||null)};dialog.addEventListener('close',finish,{once:true});dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close('cancel')});dialog.showModal();
  });
}
async function claimManagedMoveSpot(eventId,event,slot,manageToken){
  const spotIds=eventSpotIds(slot);let lastPermission=null;
  for(const spotId of spotIds){if(eventClaimOwnerKey(event?.claims?.[slot.id]?.[spotId]))continue;const claimRef=fb.ref(db,`eventSignups/${eventId}/claims/${slot.id}/${spotId}`);const availabilityRef=fb.ref(db,`eventSignups/${eventId}/availability/${slot.id}/${spotId}`);
    try{await fb.set(claimRef,{token:manageToken,active:true,claimedAt:Date.now(),moved:true});try{await fb.set(availabilityRef,true)}catch(error){try{await fb.set(claimRef,{token:manageToken,active:false,releasedAt:Date.now()})}catch{}throw error}return spotId}catch(error){if(error?.code==='PERMISSION_DENIED'){lastPermission=error;continue}throw error}
  }
  if(lastPermission)throw lastPermission;const error=new Error(`${formatScheduleTime(slot.time)} is full.`);error.code='SLOT_FULL';throw error;
}
async function releaseManagedMoveSpot(eventId,slotId,spotId,manageToken){
  if(!slotId||!spotId||!manageToken)return;await fb.set(fb.ref(db,`eventSignups/${eventId}/claims/${slotId}/${spotId}`),{token:manageToken,active:false,releasedAt:Date.now(),moved:true});await fb.set(fb.ref(db,`eventSignups/${eventId}/availability/${slotId}/${spotId}`),false);
}
async function moveManagedReservation(eventId,reservation,source='owner'){
  const event=eventForManagerSource(eventId,source);const manageToken=String(reservation?._manageToken||reservation?.manageToken||'');const reservationId=String(reservation?._reservationId||'');const oldSlotId=String(reservation?.slotId||'');const oldSpotId=String(reservation?.spotId||'');if(!event||!eventId||!manageToken||!reservationId||!oldSlotId)return;
  if(!availableMoveDestinations(event,oldSlotId).length){const message='No other time slots currently have an open spot.';if(source==='editor')sharedEditorMessage(message,'error');else showToast(message);return}const destinationId=await chooseMoveDestination(event,reservation);if(!destinationId)return;const destination=eventSlotsArray(event).find(slot=>slot.id===destinationId);if(!destination)return;const student=signupStudentName(reservation)||'Participant';let newSpotId='';
  try{await initRaceFirebase();const latestSnap=await fb.get(fb.ref(db,`eventSignups/${eventId}`));if(!latestSnap.exists())throw new Error('This event no longer exists.');const latest=latestSnap.val();const latestDestination=eventSlotsArray(latest).find(slot=>slot.id===destinationId);if(!latestDestination)throw new Error('That time slot is no longer available.');newSpotId=await claimManagedMoveSpot(eventId,latest,latestDestination,manageToken);
    const {_manageToken,_reservationId,...stored}=reservation;const updated={...stored,manageToken,slotId:destinationId,spotId:newSpotId,updatedAt:Date.now()};await fb.set(fb.ref(db,`eventSignups/${eventId}/reservations/${manageToken}/${reservationId}`),updated);
    try{if(oldSpotId)await releaseManagedMoveSpot(eventId,oldSlotId,oldSpotId,manageToken)}catch(error){console.warn('Moved reservation but could not release old spot',error)}
    const message=`${student} moved to ${eventDateText(eventSlotDate(latestDestination,latest))} at ${formatScheduleTime(latestDestination.time)}.`;if(source==='editor')sharedEditorMessage(message,'ok');else showToast(message);
  }catch(error){if(newSpotId)try{await releaseManagedMoveSpot(eventId,destinationId,newSpotId,manageToken)}catch{}const message=error?.code==='SLOT_FULL'?'That time was just taken. Choose another available slot.':error?.code==='PERMISSION_DENIED'?'Firebase blocked this move. Publish the updated Editor Move Firebase rules included with this build.':(error?.message||'Could not move this signup.');if(source==='editor')sharedEditorMessage(message,'error');else setEventStatus(message,'error')}
}
function makeSignupManagerList(eventId,slot,signups,source='owner'){
  const list=document.createElement('div');list.className='event-manager-people';if(!signups.length){const empty=document.createElement('small');empty.className='event-manager-empty';empty.textContent='No one signed up yet';list.append(empty);return list}
  for(const item of signups){const row=document.createElement('div');row.className='event-manager-person';const copy=document.createElement('div');const student=document.createElement('b');student.textContent=signupStudentName(item)||'Unnamed student';const details=document.createElement('small');const parts=[];const grade=signupStudentGrade(item);const teacher=signupStudentTeacher(item);if(grade)parts.push(`Grade ${grade}`);if(teacher)parts.push(`Teacher: ${teacher}`);if(item.parentName)parts.push(`Parent/Guardian: ${item.parentName}`);if(item.email)parts.push(item.email);if(item.phone)parts.push(item.phone);details.textContent=parts.join(' · ')||'Participant';copy.append(student,details);const actions=document.createElement('div');actions.className='event-manager-actions';const move=document.createElement('button');move.type='button';move.className='event-manager-move';move.textContent='Move';move.addEventListener('click',()=>moveManagedReservation(eventId,item,source));const remove=document.createElement('button');remove.type='button';remove.className='event-manager-remove';remove.textContent='Remove';remove.addEventListener('click',()=>removeManagedReservation(eventId,item,source));actions.append(move,remove);row.append(copy,actions);list.append(row)}return list
}
function appendManagerDaySlots(container,event,eventId,source='owner'){
  for(const [date,daySlots] of eventSlotsByDate(event)){const day=document.createElement('section');day.className='event-manager-day';const dayHead=document.createElement('div');dayHead.className='event-manager-day-head';const dayTitle=document.createElement('strong');dayTitle.textContent=eventDateText(date);const count=document.createElement('small');count.textContent=`${daySlots.length} time slot${daySlots.length===1?'':'s'}`;dayHead.append(dayTitle,count);day.append(dayHead);
    for(const slot of daySlots){const signups=eventSignupsForSlot(event,slot.id);const row=document.createElement('div');row.className='event-slot-row event-slot-row-manager';const time=document.createElement('strong');time.textContent=formatScheduleTime(slot.time);const slotCopy=document.createElement('div');slotCopy.className='event-slot-copy';const label=document.createElement('b');label.textContent=slot.label||`${slot.duration||15} min slot`;slotCopy.append(label,makeSignupManagerList(eventId,slot,signups,source));const filled=eventFilledCount(event,slot.id);const availability=document.createElement('span');availability.className=`event-slot-availability${filled>=Number(slot.capacity||1)?' full':''}`;availability.textContent=`${filled}/${slot.capacity||1} filled`;row.append(time,slotCopy,availability);day.append(row)}container.append(day)
  }
}
function renderEventSignupList(){
  if(!eventSignupList)return;eventSignupList.innerHTML='';
  const events=eventSignupIds.map(id=>[id,eventSignupCache.get(id)]).filter(([,event])=>event).sort((a,b)=>`${eventDates(a[1])[0]||a[1].date||''}:${a[1].title||''}`.localeCompare(`${eventDates(b[1])[0]||b[1].date||''}:${b[1].title||''}`));
  if(!events.length){eventSignupList.innerHTML='<p class="event-signup-empty">No events yet. Create your first event.</p>';return}
  for(const [id,event] of events){
    const card=document.createElement('article');card.className=`event-card${event.status==='closed'?' is-closed':''}`;
    const head=document.createElement('div');head.className='event-card-head';const copy=document.createElement('div');const title=document.createElement('div');title.className='event-card-title';const name=document.createElement('strong');name.textContent=event.title||'Untitled Event';const status=document.createElement('span');status.className=`event-badge${event.status==='closed'?' is-closed':''}`;status.textContent=event.status==='closed'?'Closed':'Open';title.append(name,status);if(event.linkedSchedule){const linked=document.createElement('span');linked.className='event-badge is-linked';linked.textContent='Schedule linked';title.append(linked)}if(event.editorAccess?.active){const editorBadge=document.createElement('span');editorBadge.className='event-badge is-editor';editorBadge.textContent='Editor shared';title.append(editorBadge)}const dates=eventDates(event);const meta=document.createElement('small');meta.textContent=`${eventDateSummary(event)} · ${dates.length||1} day${dates.length===1?'':'s'} · ${eventSlotsArray(event).length} slots · ${eventSignupCount(event)} signup${eventSignupCount(event)===1?'':'s'}`;copy.append(title,meta);
    const actions=document.createElement('div');actions.className='event-card-actions';const share=document.createElement('button');share.type='button';share.className='primary';share.textContent='Copy signup link';share.addEventListener('click',()=>copyEventLink(id));const open=document.createElement('button');open.type='button';open.textContent='Open signup';open.addEventListener('click',()=>openEventLink(id));const editorLink=document.createElement('button');editorLink.type='button';editorLink.className='editor-link';editorLink.textContent=event.editorAccess?.active?'Copy editor link':'Create editor link';editorLink.addEventListener('click',()=>copyEventEditorLink(id,event));const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.addEventListener('click',()=>editEventSignup(id));actions.append(share,open,editorLink);if(event.editorAccess?.active){const regenerate=document.createElement('button');regenerate.type='button';regenerate.textContent='New editor link';regenerate.addEventListener('click',()=>{if(confirm('Generate a new editor link? The old editor link will stop working.'))copyEventEditorLink(id,event,true)});const revoke=document.createElement('button');revoke.type='button';revoke.className='danger';revoke.textContent='Revoke editor';revoke.addEventListener('click',()=>revokeEventEditorLink(id,event));actions.append(regenerate,revoke)}const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='Delete';del.addEventListener('click',()=>deleteEventSignup(id,event));actions.append(edit,del);head.append(copy,actions);
    const slots=document.createElement('div');slots.className='event-slot-summary';appendManagerDaySlots(slots,event,id,'owner');card.append(head,slots);eventSignupList.append(card);
  }
}

function subscribeTeacherEvent(id){
  if(eventSignupWatchers.has(id)||!fb||!db)return;
  const unsub=fb.onValue(fb.ref(db,`eventSignups/${id}`),snapshot=>{
    if(!snapshot.exists()){eventSignupCache.delete(id);eventSignupIds=eventSignupIds.filter(item=>item!==id);saveEventSignupIds();removeLinkedEventSchedule(id);eventSignupWatchers.get(id)?.();eventSignupWatchers.delete(id);renderEventSignupList();return}
    const event=snapshot.val();eventSignupCache.set(id,event);renderEventSignupList();syncEventToSpecialSchedule(id,event);
  },error=>setEventStatus(error?.code==='PERMISSION_DENIED'?'Event Sign Up needs the included Firebase database rules before shared events can load.':(error?.message||'Could not load Event Sign Up.'),'error'));
  eventSignupWatchers.set(id,unsub);
}
async function refreshEventSignupManager(){
  if(publicEventSignupId||sharedEditorEventId)return;
  try{await initRaceFirebase();eventSignupIds.forEach(subscribeTeacherEvent);setEventStatus(eventSignupIds.length?'Events are live. Signup changes will appear automatically.':'Ready. Create an event to get a public signup link.','ok');renderEventSignupList()}
  catch(error){setEventStatus(error?.message||'Could not connect to Event Sign Up.','error')}
}
async function saveEventFromForm(event){
  event.preventDefault();
  const title=eventSignupName.value.trim();const defaultDate=eventSignupDate.value;const description=eventSignupDescription.value.trim();
  const slots=eventSignupEditorSlots.map(slot=>({...slot,date:String(slot.date||defaultDate),label:String(slot.label||'').trim(),duration:Math.max(1,Math.min(480,Number(slot.duration)||15)),capacity:Math.max(1,Math.min(100,Number(slot.capacity)||1))})).filter(slot=>slot.time&&slot.date);
  if(!title||!defaultDate){alert('Enter an event name and first event date.');return}
  if(!slots.length||slots.length!==eventSignupEditorSlots.length){alert('Add a date and start time for every signup slot.');return}
  const seen=new Set();for(const slot of slots){const key=`${slot.date}|${slot.time}`;if(seen.has(key)){alert(`There is more than one slot at ${formatScheduleTime(slot.time)} on ${eventDateText(slot.date)}. Change or remove the duplicate.`);return}seen.add(key)}
  const primaryDate=[...new Set(slots.map(slot=>slot.date))].sort()[0]||defaultDate;
  try{
    await initRaceFirebase();const id=editingEventSignupId||eventSignupId();const ref=fb.ref(db,`eventSignups/${id}`);let existing={};
    if(editingEventSignupId){const snap=await fb.get(ref);if(snap.exists())existing=snap.val()}
    const slotMap={};for(const slot of slots){slot.spots=buildSlotSpots(slot,existing);slotMap[slot.id]=slot}
    const migrated=normalizeExistingSignupData(existing,slotMap);const availability=buildEventAvailability(slotMap,migrated.claims);
    const data={ownerUid:existing.ownerUid||currentUser.uid,title,date:primaryDate,description,status:eventSignupOpen.checked?'open':'closed',linkedSchedule:eventSignupLinkSchedule.checked,allowMultiple:eventSignupAllowMultiple?eventSignupAllowMultiple.checked:true,activityMode:eventSignupActivityMode.value||'participant',slots:slotMap,claims:migrated.claims,availability,reservations:migrated.reservations,...(existing.editorAccess?{editorAccess:existing.editorAccess}:{}),...(existing.editorSessions?{editorSessions:existing.editorSessions}:{}),createdAt:existing.createdAt||Date.now(),updatedAt:Date.now(),capacityModel:'claimable-spots-v6-multiday'};
    await fb.set(ref,data);
    if(!eventSignupIds.includes(id)){eventSignupIds.push(id);saveEventSignupIds()}
    eventSignupCache.set(id,data);subscribeTeacherEvent(id);syncEventToSpecialSchedule(id,data);renderEventSignupList();resetEventSignupEditor();setEventStatus(`Saved “${title}” across ${eventDates(data).length} day${eventDates(data).length===1?'':'s'}.`,'ok');showToast('Event saved');
  }catch(error){setEventStatus(error?.code==='PERMISSION_DENIED'?'Firebase blocked Event Sign Up. Publish the current Realtime Database rules included with this build.':(error?.message||'Could not save the event.'),'error')}
}
async function deleteEventSignup(id,event){
  if(!confirm(`Delete ${event.title||'this event'} and all of its signups?`))return;
  try{await initRaceFirebase();await fb.remove(fb.ref(db,`eventSignups/${id}`));eventSignupIds=eventSignupIds.filter(item=>item!==id);saveEventSignupIds();eventSignupCache.delete(id);eventSignupWatchers.get(id)?.();eventSignupWatchers.delete(id);removeLinkedEventSchedule(id);renderEventSignupList();if(editingEventSignupId===id)resetEventSignupEditor();showToast('Event deleted')}
  catch(error){setEventStatus(error?.message||'Could not delete the event.','error')}
}
function sharedEditorMessage(text,type=''){if(!eventSharedEditorMessage)return;eventSharedEditorMessage.textContent=text;eventSharedEditorMessage.classList.toggle('is-ok',type==='ok');eventSharedEditorMessage.classList.toggle('is-error',type==='error')}
function renderSharedEditor(){
  const event=sharedEditorEventData;if(!event||!eventSharedEditorSlots)return;eventSharedEditorTitle.textContent=event.title||'Event Sign Up';eventSharedEditorDate.textContent=eventDateSummary(event);eventSharedEditorDescription.textContent=event.description||'Manage participant signups for this event.';eventSharedEditorSlots.innerHTML='';
  for(const [date,daySlots] of eventSlotsByDate(event)){const day=document.createElement('section');day.className='event-shared-day';const dayHead=document.createElement('div');dayHead.className='event-shared-day-head';const title=document.createElement('strong');title.textContent=eventDateText(date);const count=document.createElement('small');count.textContent=`${daySlots.length} time slot${daySlots.length===1?'':'s'}`;dayHead.append(title,count);day.append(dayHead);for(const slot of daySlots){const signups=eventSignupsForSlot(event,slot.id);const card=document.createElement('article');card.className='event-shared-slot';const head=document.createElement('div');head.className='event-shared-slot-head';const time=document.createElement('strong');time.textContent=formatScheduleTime(slot.time);const copy=document.createElement('div');const label=document.createElement('b');label.textContent=slot.label||`${slot.duration||15} minute appointment`;const filled=document.createElement('small');filled.textContent=`${eventFilledCount(event,slot.id)}/${slot.capacity||1} filled`;copy.append(label,filled);head.append(time,copy);card.append(head,makeSignupManagerList(sharedEditorEventId,slot,signups,'editor'));day.append(card)}eventSharedEditorSlots.append(day)}
  updateSharedScheduleButton();
}
async function openSharedEventEditor(id,token){
  sharedEditorEventId=id;sharedEditorToken=token;sharedEditorEventData=null;publicEventSignupId='';if(publicEventUnsubscribe){publicEventUnsubscribe();publicEventUnsubscribe=null}if(sharedEditorUnsubscribe){sharedEditorUnsubscribe();sharedEditorUnsubscribe=null}document.body.classList.add('event-signup-public-mode');openCalculator('event-signup');eventSignupTeacherView.hidden=true;eventSignupPublicView.hidden=true;eventSignupSharedEditorView.hidden=false;sharedEditorMessage('Verifying editor link…');
  try{await initRaceFirebase();if(!currentUser)throw new Error('Firebase sign-in is not ready.');const base=`eventSignups/${id}`;await fb.set(fb.ref(db,`${base}/editorSessions/${currentUser.uid}`),{token,createdAt:Date.now(),lastUsedAt:Date.now()});const snap=await fb.get(fb.ref(db,base));if(!snap.exists())throw new Error('This event no longer exists.');sharedEditorEventData=snap.val();renderSharedEditor();sharedEditorMessage('Editor access verified. You can view signups, move participants to open times, and remove registrations. Only the event owner can edit or delete the event.','ok');sharedEditorUnsubscribe=fb.onValue(fb.ref(db,base),next=>{if(!next.exists()){sharedEditorMessage('This event was deleted by the owner.','error');sharedEditorEventData=null;eventSharedEditorSlots.innerHTML='';return}sharedEditorEventData=next.val();renderSharedEditor();syncSharedEditorSchedule(id,sharedEditorEventData)},error=>sharedEditorMessage(error?.code==='PERMISSION_DENIED'?'This editor link was revoked or is no longer valid.':(error?.message||'Editor access was lost.'),'error'))}
  catch(error){sharedEditorMessage(error?.code==='PERMISSION_DENIED'?'This editor link is invalid, expired, or has been revoked.':(error?.message||'Could not open the shared editor link.'),'error');eventSharedEditorSlots.innerHTML=''}
}
function publicMessage(text,type=''){eventPublicMessage.textContent=text;eventPublicMessage.classList.toggle('is-ok',type==='ok');eventPublicMessage.classList.toggle('is-error',type==='error')}
function resetPublicFormFields(){eventPublicParentName.value='';eventPublicEmail.value='';eventPublicPhone.value='';publicSelectedSlotIds=new Set();publicDraftStudentNames=new Map();publicDraftStudentGrades=new Map();publicDraftStudentTeachers=new Map();publicOwnSignups=new Map();publicSelectionInitialized=true}
function applyPrivateReservationData(raw){
  publicOwnSignups=new Map();publicSelectedSlotIds=new Set();publicDraftStudentNames=new Map();publicDraftStudentGrades=new Map();publicDraftStudentTeachers=new Map();let first=null;
  for(const [reservationId,item] of Object.entries(raw||{})){if(!item)continue;const slotId=String(item.slotId||reservationId);if(!publicEventData?.slots?.[slotId])continue;const record={...item,_reservationId:reservationId};publicOwnSignups.set(slotId,record);publicSelectedSlotIds.add(slotId);publicDraftStudentNames.set(slotId,signupStudentName(record));publicDraftStudentGrades.set(slotId,signupStudentGrade(record));publicDraftStudentTeachers.set(slotId,signupStudentTeacher(record));if(!first)first=record}
  if(first){eventPublicParentName.value=first.parentName||'';eventPublicEmail.value=first.email||'';eventPublicPhone.value=first.phone||''}
  publicSelectionInitialized=true;
}
function initializePublicSelection(){if(publicSelectionInitialized)return;publicSelectedSlotIds=new Set();publicDraftStudentNames=new Map();publicDraftStudentGrades=new Map();publicDraftStudentTeachers=new Map();publicOwnSignups=new Map();publicSelectionInitialized=true}
function showPublicSuccess(link,count,parentName){
  publicSubmissionComplete=true;publicSubmittedManageLink=link;if(eventPublicSuccess){eventPublicSuccess.hidden=false;if(eventPublicSuccessText)eventPublicSuccessText.textContent=`${count} appointment${count===1?'':'s'} saved for ${parentName}.`;if(eventPublicManageLink)eventPublicManageLink.value=link;if(eventPublicManageLinkWrap)eventPublicManageLinkWrap.hidden=false;if(eventPublicCopyManageLink)eventPublicCopyManageLink.hidden=false;if(eventPublicFallbackNote)eventPublicFallbackNote.textContent='This is your private link to manage or cancel your signup. Save it somewhere safe.'}publicMessage('Signup confirmed. Save your private management link below.','ok');renderPublicEvent();
}
function startFreshPublicSignup(){
  publicSubmissionComplete=false;publicSubmittedManageLink='';if(eventPublicSuccess)eventPublicSuccess.hidden=true;resetPublicFormFields();renderPublicEvent();publicMessage(publicEventData?.allowMultiple===false?'Choose one time slot, then enter the parent/guardian and student information.':'Choose one or more time slots. Parent/guardian information is entered once; each time gets its own student details.');eventPublicSlots?.scrollIntoView({behavior:'smooth',block:'start'});
}
function copyPrivateManageLink(){const link=publicSubmittedManageLink||eventPublicManageLink?.value||'';if(!link)return;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(link).then(()=>showToast('Private manage link copied')).catch(()=>window.prompt('Copy this private manage link:',link));else window.prompt('Copy this private manage link:',link)}
function renderPublicSelection(){
  if(!eventPublicSelectionList)return;eventPublicSelectionList.innerHTML='';const slots=eventSlotsArray(publicEventData).filter(slot=>publicSelectedSlotIds.has(slot.id));
  eventPublicSelectedSlot.textContent=slots.length?`${slots.length} appointment${slots.length===1?'':'s'} selected. Enter the student details for each time.`:'Choose a time slot above.';
  for(const slot of slots){
    const item=document.createElement('div');item.className='event-public-selection-item';item.dataset.slotId=slot.id;
    const timeWrap=document.createElement('div');timeWrap.className='event-public-selection-time';const eyebrow=document.createElement('span');eyebrow.textContent='SELECTED TIME';const time=document.createElement('strong');time.textContent=formatScheduleTime(slot.time);const details=document.createElement('small');details.textContent=`${eventDateText(eventSlotDate(slot,publicEventData))} · ${slot.duration||15} minutes${slot.label?` · ${slot.label}`:''}`;timeWrap.append(eyebrow,time,details);
    const fields=document.createElement('div');fields.className='event-public-student-fields';
    const studentLabel=document.createElement('label');studentLabel.innerHTML='<span>Student Name</span>';const student=document.createElement('input');student.type='text';student.maxLength=60;student.required=true;student.autocomplete='off';student.placeholder='Student name';student.value=publicDraftStudentNames.has(slot.id)?publicDraftStudentNames.get(slot.id):signupStudentName(publicOwnSignups.get(slot.id));student.addEventListener('input',()=>publicDraftStudentNames.set(slot.id,student.value));studentLabel.append(student);
    const gradeLabel=document.createElement('label');gradeLabel.innerHTML='<span>Grade <em>optional</em></span>';const grade=document.createElement('input');grade.type='text';grade.maxLength=20;grade.autocomplete='off';grade.placeholder='Enter grade';grade.setAttribute('aria-label','Student grade');grade.value=publicDraftStudentGrades.has(slot.id)?publicDraftStudentGrades.get(slot.id):signupStudentGrade(publicOwnSignups.get(slot.id));grade.addEventListener('input',()=>publicDraftStudentGrades.set(slot.id,grade.value));gradeLabel.append(grade);
    const teacherLabel=document.createElement('label');teacherLabel.innerHTML='<span>Teacher <em>optional</em></span>';const teacher=document.createElement('input');teacher.type='text';teacher.maxLength=60;teacher.autocomplete='off';teacher.placeholder='Teacher name';teacher.value=publicDraftStudentTeachers.has(slot.id)?publicDraftStudentTeachers.get(slot.id):signupStudentTeacher(publicOwnSignups.get(slot.id));teacher.addEventListener('input',()=>publicDraftStudentTeachers.set(slot.id,teacher.value));teacherLabel.append(teacher);
    fields.append(studentLabel,gradeLabel,teacherLabel);
    const remove=document.createElement('button');remove.type='button';remove.className='event-public-selection-remove';remove.textContent=publicOwnSignups.has(slot.id)?'Remove':'×';remove.setAttribute('aria-label',`Remove ${formatScheduleTime(slot.time)} appointment`);remove.addEventListener('click',()=>{publicDraftStudentNames.set(slot.id,student.value);publicDraftStudentGrades.set(slot.id,grade.value);publicDraftStudentTeachers.set(slot.id,teacher.value);publicSelectedSlotIds.delete(slot.id);renderPublicEvent()});
    item.append(timeWrap,fields,remove);eventPublicSelectionList.append(item);
  }
  if(eventPublicSubmit){eventPublicSubmit.textContent=publicManageMode?'Save changes':(slots.length>1?`Save ${slots.length} signups`:'Save signup');eventPublicSubmit.disabled=!slots.length}
}
function renderPublicEvent(){
  const event=publicEventData;if(!event)return;initializePublicSelection();eventPublicTitle.textContent=event.title||'Event Sign Up';eventPublicDate.textContent=eventDateSummary(event);eventPublicDescription.textContent=event.description||'Choose an available time slot below.';
  if(eventPublicSuccess)eventPublicSuccess.hidden=!publicSubmissionComplete;if(publicSubmissionComplete&&!publicManageMode){eventPublicSlots.hidden=true;eventPublicForm.hidden=true;eventPublicCancelSignup.hidden=true;return}
  eventPublicSlots.hidden=false;eventPublicSlots.innerHTML='';const own=publicCurrentSignups();eventPublicCancelSignup.hidden=!(publicManageMode&&own.length);eventPublicCancelSignup.textContent=own.length>1?'Cancel all appointments':'Cancel appointment';
  if(publicManageMode){publicMessage(own.length?'Private management link verified. You can change or cancel only this signup.':'This private management link has no active appointments. You can choose a new time if the event is still open.',own.length?'ok':'')}
  else if(event.status==='closed')publicMessage('This event is closed for new signups.','error');else publicMessage(event.allowMultiple===false?'Choose one time slot, then enter the parent/guardian and student information.':'Choose one or more time slots. Parent/guardian information is entered once; each time gets its own student details.');
  let publicDay='';for(const slot of eventSlotsArray(event)){
    const slotDate=eventSlotDate(slot,event);if(slotDate!==publicDay){publicDay=slotDate;const heading=document.createElement('div');heading.className='event-public-day-heading';const strong=document.createElement('strong');strong.textContent=eventDateText(slotDate);const small=document.createElement('small');small.textContent='Choose an available time';heading.append(strong,small);eventPublicSlots.append(heading)}
    const selected=publicSelectedSlotIds.has(slot.id);const mine=publicOwnSignups.has(slot.id);const spotIds=eventSpotIds(slot);const filled=eventPublicFilledCount(event,slot.id);const capacity=spotIds.length||Number(slot.capacity||1);const full=capacity>0&&filled>=capacity&&!mine;
    const row=document.createElement('div');row.className=`event-public-slot${selected?' is-selected':''}${full?' is-full':''}`;const time=document.createElement('strong');time.textContent=formatScheduleTime(slot.time);const copy=document.createElement('div');const label=document.createElement('b');label.textContent=slot.label||`${slot.duration||15} minute appointment`;const availability=document.createElement('small');
    if(mine)availability.textContent=`${filled}/${capacity} filled · Your appointment`;else if(full)availability.textContent=`${filled}/${capacity} filled · FULL`;else availability.textContent=`${filled}/${capacity} filled · ${Math.max(0,capacity-filled)} spot${capacity-filled===1?'':'s'} left`;
    copy.append(label,availability);const choose=document.createElement('button');choose.type='button';choose.textContent=selected?'Selected':full?'Full':'Choose';choose.disabled=(event.status==='closed'&&!mine)||full;choose.addEventListener('click',()=>{if(selected){publicSelectedSlotIds.delete(slot.id)}else{if(event.allowMultiple===false)publicSelectedSlotIds.clear();publicSelectedSlotIds.add(slot.id)}renderPublicEvent();if(!selected)setTimeout(()=>eventPublicSelectionList?.querySelector(`[data-slot-id="${slot.id}"] input`)?.focus(),0)});row.append(time,copy,choose);eventPublicSlots.append(row)
  }
  const hasSelection=publicSelectedSlotIds.size>0;eventPublicForm.hidden=!(hasSelection||own.length);if(hasSelection||own.length)renderPublicSelection();else if(eventPublicSelectionList)eventPublicSelectionList.innerHTML='';
}
async function claimEventSpot(slot,token){
  const spotIds=eventSpotIds(slot);if(!spotIds.length)throw new Error('This event needs to be updated by the organizer before it can accept new signups.');let lastPermission=null;
  for(const spotId of spotIds){if(publicEventData?.availability?.[slot.id]?.[spotId]===true)continue;const claimRef=fb.ref(db,`eventSignups/${publicEventSignupId}/claims/${slot.id}/${spotId}`);const availabilityRef=fb.ref(db,`eventSignups/${publicEventSignupId}/availability/${slot.id}/${spotId}`);
    try{await fb.set(claimRef,{token,active:true,claimedAt:Date.now()});try{await fb.set(availabilityRef,true)}catch(error){try{await fb.set(claimRef,{token,active:false,releasedAt:Date.now()})}catch{}throw error}publicEventData.availability??={};publicEventData.availability[slot.id]??={};publicEventData.availability[slot.id][spotId]=true;return spotId}catch(error){if(error?.code==='PERMISSION_DENIED'){lastPermission=error;continue}throw error}
  }
  if(lastPermission&&eventPublicFilledCount(publicEventData,slot.id)<spotIds.length)throw lastPermission;const error=new Error(`${formatScheduleTime(slot.time)} is full.`);error.code='SLOT_FULL';throw error;
}
async function releaseClaim(slotId,spotId,token){
  if(!slotId||!spotId||!token)return;const claimRef=fb.ref(db,`eventSignups/${publicEventSignupId}/claims/${slotId}/${spotId}`);const availabilityRef=fb.ref(db,`eventSignups/${publicEventSignupId}/availability/${slotId}/${spotId}`);
  await fb.set(claimRef,{token,active:false,releasedAt:Date.now()});await fb.set(availabilityRef,false);if(publicEventData?.availability?.[slotId])publicEventData.availability[slotId][spotId]=false;
}
async function savePublicSignup(event){
  event.preventDefault();if(!publicEventData||!publicSelectedSlotIds.size)return;const parentName=eventPublicParentName.value.trim().replace(/\s+/g,' ').slice(0,60);const email=eventPublicEmail.value.trim().toLowerCase().slice(0,120);const phone=eventPublicPhone.value.trim().replace(/\s+/g,' ').slice(0,30);
  if(!parentName){eventPublicParentName.focus();return}if(!email||!eventPublicEmail.checkValidity()){eventPublicEmail.focus();return}
  const selectedSlots=eventSlotsArray(publicEventData).filter(slot=>publicSelectedSlotIds.has(slot.id));if(!selectedSlots.length)return;const students=new Map();const grades=new Map();const teachers=new Map();for(const slot of selectedSlots){const raw=String(publicDraftStudentNames.has(slot.id)?publicDraftStudentNames.get(slot.id):signupStudentName(publicOwnSignups.get(slot.id))).trim().replace(/\s+/g,' ').slice(0,60);if(!raw){const input=eventPublicSelectionList.querySelector(`[data-slot-id="${slot.id}"] input`);input?.focus();publicMessage(`Enter the student name for ${eventDateText(eventSlotDate(slot,publicEventData))} at ${formatScheduleTime(slot.time)}.`,'error');return}students.set(slot.id,raw);const grade=String(publicDraftStudentGrades.has(slot.id)?publicDraftStudentGrades.get(slot.id):signupStudentGrade(publicOwnSignups.get(slot.id))).trim().slice(0,20);const teacher=String(publicDraftStudentTeachers.has(slot.id)?publicDraftStudentTeachers.get(slot.id):signupStudentTeacher(publicOwnSignups.get(slot.id))).trim().replace(/\s+/g,' ').slice(0,60);grades.set(slot.id,grade);teachers.set(slot.id,teacher)}
  const token=publicManageMode?publicManageToken:eventManageToken();const newlyClaimed=[];
  try{
    await initRaceFirebase();const now=Date.now();const claimedBySlot=new Map();for(const slot of selectedSlots){const previous=publicOwnSignups.get(slot.id);if(previous?.spotId){claimedBySlot.set(slot.id,previous.spotId);continue}const spotId=await claimEventSpot(slot,token);claimedBySlot.set(slot.id,spotId);newlyClaimed.push({slotId:slot.id,spotId})}
    const reservationUpdates={};const nextRecords=[];for(const [slotId,previous] of publicOwnSignups){if(publicSelectedSlotIds.has(slotId))continue;if(previous?._reservationId)reservationUpdates[previous._reservationId]=null}
    for(const slot of selectedSlots){const previous=publicOwnSignups.get(slot.id);const studentName=students.get(slot.id);const studentGrade=grades.get(slot.id)||'';const studentTeacher=teachers.get(slot.id)||'';const spotId=claimedBySlot.get(slot.id);const reservationId=previous?._reservationId||eventReservationId();const record={manageToken:token,slotId:slot.id,spotId,name:studentName,studentName,parentName,email,phone,...(studentGrade?{studentGrade}:{}),...(studentTeacher?{studentTeacher}:{}),createdAt:previous?.createdAt||now,updatedAt:now};reservationUpdates[reservationId]=record;nextRecords.push([reservationId,record])}
    await fb.update(fb.ref(db,`eventSignups/${publicEventSignupId}/reservations/${token}`),reservationUpdates);
    for(const [slotId,previous] of publicOwnSignups){if(publicSelectedSlotIds.has(slotId))continue;if(previous?.spotId)await releaseClaim(slotId,previous.spotId,token)}
    if(publicManageMode){applyPrivateReservationData(Object.fromEntries(nextRecords));renderPublicEvent();publicMessage('Your signup changes were saved.','ok')}
    else{const link=eventManageLink(publicEventSignupId,token);resetPublicFormFields();showPublicSuccess(link,selectedSlots.length,parentName)}
  }catch(error){for(const item of newlyClaimed)try{await releaseClaim(item.slotId,item.spotId,token)}catch{}const message=error?.code==='SLOT_FULL'?'One of the selected times was just taken. Choose another available time and try again.':error?.code==='PERMISSION_DENIED'?'Firebase blocked the private-link signup. Publish the updated Event Sign Up database rules included with this build.':(error?.message||'Could not save your signup.');publicMessage(message,'error')}
}
async function cancelPublicSignup(){
  if(!publicManageMode)return;const existing=publicCurrentSignups();if(!existing.length||!confirm(`Cancel ${existing.length===1?'this appointment':`all ${existing.length} appointments`}?`))return;
  try{const token=publicManageToken;const updates={};for(const item of existing)if(item.signup?._reservationId)updates[item.signup._reservationId]=null;await fb.update(fb.ref(db,`eventSignups/${publicEventSignupId}/reservations/${token}`),updates);for(const item of existing)if(item.signup?.spotId)await releaseClaim(item.slot.id,item.signup.spotId,token);publicOwnSignups=new Map();publicSelectedSlotIds=new Set();publicDraftStudentNames=new Map();publicDraftStudentGrades=new Map();publicDraftStudentTeachers=new Map();renderPublicEvent();publicMessage('Your signup was cancelled. The released time is available again.','ok')}
  catch(error){publicMessage(error?.code==='PERMISSION_DENIED'?'This private management link could not be verified.':(error?.message||'Could not cancel this signup.'),'error')}
}
async function loadPrivateSignup(id,token){
  publicOwnSignups=new Map();if(!token)return;try{const snap=await fb.get(fb.ref(db,`eventSignups/${id}/reservations/${token}`));if(snap.exists())applyPrivateReservationData(snap.val());else{publicSelectionInitialized=true;publicMessage('This private management link has no active appointments.','error')}}catch(error){publicSelectionInitialized=true;publicMessage(error?.code==='PERMISSION_DENIED'?'This private management link is not valid for the current Event Sign Up rules.':(error?.message||'Could not open this private management link.'),'error')}
}
async function openPublicEvent(id,manageToken=''){
  publicEventSignupId=id;sharedEditorEventId='';publicManageToken=manageToken;publicManageMode=Boolean(manageToken);publicSubmissionComplete=false;publicSubmittedManageLink='';publicSelectedSlotIds=new Set();publicDraftStudentNames=new Map();publicDraftStudentGrades=new Map();publicDraftStudentTeachers=new Map();publicSelectionInitialized=false;publicOwnSignups=new Map();if(eventPublicSuccess)eventPublicSuccess.hidden=true;document.body.classList.add('event-signup-public-mode');openCalculator('event-signup');eventSignupTeacherView.hidden=true;eventSignupSharedEditorView.hidden=true;eventSignupPublicView.hidden=false;
  try{
    await initRaceFirebase();const base=`eventSignups/${id}`;const [titleSnap,dateSnap,descriptionSnap,statusSnap,allowMultipleSnap,slotsSnap,availabilitySnap]=await Promise.all([fb.get(fb.ref(db,`${base}/title`)),fb.get(fb.ref(db,`${base}/date`)),fb.get(fb.ref(db,`${base}/description`)),fb.get(fb.ref(db,`${base}/status`)),fb.get(fb.ref(db,`${base}/allowMultiple`)),fb.get(fb.ref(db,`${base}/slots`)),fb.get(fb.ref(db,`${base}/availability`))]);
    if(!titleSnap.exists()){eventPublicTitle.textContent='Event not found';eventPublicSlots.innerHTML='';publicMessage('This signup link is no longer available.','error');return}
    publicEventData={title:titleSnap.val(),date:dateSnap.val(),description:descriptionSnap.val()||'',status:statusSnap.val()||'open',allowMultiple:allowMultipleSnap.exists()?allowMultipleSnap.val():true,slots:slotsSnap.val()||{},availability:availabilitySnap.val()||{}};
    if(publicManageMode)await loadPrivateSignup(id,manageToken);else publicSelectionInitialized=true;renderPublicEvent();if(publicEventUnsubscribe)publicEventUnsubscribe();
    const unsubTitle=fb.onValue(fb.ref(db,`${base}/title`),snap=>{publicEventData.title=snap.val()||'Event Sign Up';renderPublicEvent()});const unsubDate=fb.onValue(fb.ref(db,`${base}/date`),snap=>{publicEventData.date=snap.val()||'';renderPublicEvent()});const unsubDescription=fb.onValue(fb.ref(db,`${base}/description`),snap=>{publicEventData.description=snap.val()||'';renderPublicEvent()});const unsubStatus=fb.onValue(fb.ref(db,`${base}/status`),snap=>{publicEventData.status=snap.val()||'open';renderPublicEvent()});const unsubAllowMultiple=fb.onValue(fb.ref(db,`${base}/allowMultiple`),snap=>{publicEventData.allowMultiple=snap.exists()?snap.val():true;if(publicEventData.allowMultiple===false&&publicSelectedSlotIds.size>1){const keep=publicSelectedSlotIds.values().next().value;publicSelectedSlotIds=new Set(keep?[keep]:[])}renderPublicEvent()});const unsubSlots=fb.onValue(fb.ref(db,`${base}/slots`),snap=>{publicEventData.slots=snap.val()||{};renderPublicEvent()});const unsubAvailability=fb.onValue(fb.ref(db,`${base}/availability`),snap=>{publicEventData.availability=snap.val()||{};renderPublicEvent()});
    let unsubOwn=()=>{};if(publicManageMode)unsubOwn=fb.onValue(fb.ref(db,`${base}/reservations/${manageToken}`),snap=>{applyPrivateReservationData(snap.exists()?snap.val():{});renderPublicEvent()});publicEventUnsubscribe=()=>{unsubTitle();unsubDate();unsubDescription();unsubStatus();unsubAllowMultiple();unsubSlots();unsubAvailability();unsubOwn()};
  }catch(error){publicMessage(error?.code==='PERMISSION_DENIED'?'This Event Sign Up needs the updated private-link Firebase database rules before the public link can open.':(error?.message||'Could not load this event.'),'error')}
}
window.openEventSignupById=id=>{setCalculatorMode('event-signup');setTimeout(()=>{editEventSignup(id);document.querySelector('#eventSignupPanel')?.scrollIntoView({behavior:'smooth',block:'start'})},0)};
window.refreshEventSignupManager=refreshEventSignupManager;
if(addEventSignupSlot)addEventSignupSlot.addEventListener('click',()=>{eventSignupEditorSlots.push(nextEventSlot());renderEventSlotEditor()});
if(generateEventSignupSlots)generateEventSignupSlots.addEventListener('click',generateEventSlotsFromBuilder);
if(addEventSignupDay)addEventSignupDay.addEventListener('click',setNextEventGeneratorDay);
[eventSlotGeneratorDate,eventSlotGeneratorStart,eventSlotGeneratorDuration,eventSlotGeneratorCount,eventSlotGeneratorCapacity].forEach(input=>{input?.addEventListener('input',updateEventSlotGeneratorPreview);input?.addEventListener('change',updateEventSlotGeneratorPreview)});
eventSignupDate?.addEventListener('change',()=>{if(eventSlotGeneratorDate&&!eventSlotGeneratorDate.value)eventSlotGeneratorDate.value=eventSignupDate.value;for(const slot of eventSignupEditorSlots)if(!slot.date)slot.date=eventSignupDate.value;renderEventSlotEditor();updateEventSlotGeneratorPreview()});
if(eventSignupForm)eventSignupForm.addEventListener('submit',saveEventFromForm);
if(clearEventSignupForm)clearEventSignupForm.addEventListener('click',resetEventSignupEditor);
if(cancelEventSignupEdit)cancelEventSignupEdit.addEventListener('click',resetEventSignupEditor);
if(newEventSignup)newEventSignup.addEventListener('click',()=>{resetEventSignupEditor();eventSignupName.focus()});
if(refreshEventSignups)refreshEventSignups.addEventListener('click',refreshEventSignupManager);
if(eventPublicForm)eventPublicForm.addEventListener('submit',savePublicSignup);
if(eventPublicCancelSignup)eventPublicCancelSignup.addEventListener('click',cancelPublicSignup);
if(eventPublicCopyManageLink)eventPublicCopyManageLink.addEventListener('click',copyPrivateManageLink);
if(eventPublicStartAnother)eventPublicStartAnother.addEventListener('click',startFreshPublicSignup);
if(eventSharedCopySignup)eventSharedCopySignup.addEventListener('click',()=>{if(sharedEditorEventId)copyEventLink(sharedEditorEventId)});
if(eventSharedSchedule)eventSharedSchedule.addEventListener('click',toggleSharedEditorSchedule);
loadEventSignupIds();resetEventSignupEditor();renderEventSignupList();
// Add Event Sign Up references to the shared Classroom Tools Google-sync payload.
const previousGetClassroomToolsSyncData=window.getClassroomToolsSyncData;
window.getClassroomToolsSyncData=()=>{const base=previousGetClassroomToolsSyncData?previousGetClassroomToolsSyncData():{};return{...base,eventSignup:{eventIds:[...eventSignupIds]}}};
const previousApplyClassroomToolsSyncData=window.applyClassroomToolsSyncData;
window.applyClassroomToolsSyncData=data=>{previousApplyClassroomToolsSyncData?.(data);if(data?.eventSignup&&Array.isArray(data.eventSignup.eventIds)){eventSignupIds=safeEventIds(data.eventSignup.eventIds);localStorage.setItem(EVENT_SIGNUP_IDS_KEY,JSON.stringify(eventSignupIds));if(!publicEventSignupId&&!sharedEditorEventId)refreshEventSignupManager()}};
const eventUrlParams=new URLSearchParams(location.search);const signupParam=eventUrlParams.get('signup');const manageParam=eventUrlParams.get('manage')||'';const editorEventParam=eventUrlParams.get('eventEditor');const editorTokenParam=eventUrlParams.get('editor')||'';
if(editorEventParam&&/^[A-Z2-9]{6,20}$/i.test(editorEventParam)&&/^[a-f0-9]{64}$/i.test(editorTokenParam)){setTimeout(()=>openSharedEventEditor(editorEventParam.toUpperCase(),editorTokenParam.toLowerCase()),0)}else if(signupParam&&/^[A-Z2-9]{6,20}$/i.test(signupParam)){const safeManage=/^[a-f0-9]{64}$/i.test(manageParam)?manageParam.toLowerCase():'';setTimeout(()=>openPublicEvent(signupParam.toUpperCase(),safeManage),0)}else if(eventSignupIds.length)setTimeout(refreshEventSignupManager,350);
