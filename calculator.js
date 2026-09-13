const navTools=document.querySelector('#navTools');
const calculatorView=document.querySelector('#calculatorView');
const dashboardPanel=document.querySelector('#classroomDashboardPanel');
const calculatorPanel=document.querySelector('#calculatorPanel');
const numberGeneratorPanel=document.querySelector('#numberGeneratorPanel');
const scheduleTimerPanel=document.querySelector('#scheduleTimerPanel');
const wheelPanel=document.querySelector('#wheelPanel');
const eventSignupPanel=document.querySelector('#eventSignupPanel');
const seatingPanel=document.querySelector('#seatingPanel');
const showDashboard=document.querySelector('#showDashboard');
const showCalculator=document.querySelector('#showCalculator');
const showNumberGenerator=document.querySelector('#showNumberGenerator');
const showScheduleTimer=document.querySelector('#showScheduleTimer');
const showQuiz=document.querySelector('#showQuiz');
const showWheel=document.querySelector('#showWheel');
const showEventSignup=document.querySelector('#showEventSignup');
const showSeating=document.querySelector('#showSeating');
const calculatorTitle=document.querySelector('#calculator-title');
const calculatorHint=document.querySelector('#calculatorHint');
const calculatorEyebrow=document.querySelector('#calculatorEyebrow');
function setCalculatorMode(mode){
  const dashboard=mode==='dashboard';
  const calculator=mode==='calculator';
  const numberGenerator=mode==='number-generator';
  const scheduleTimer=mode==='schedule-timer';
  const quiz=mode==='quiz';
  const wheel=mode==='wheel';
  const eventSignup=mode==='event-signup';
  const seating=mode==='seating';
  dashboardPanel.hidden=!dashboard;
  calculatorPanel.hidden=!calculator;
  numberGeneratorPanel.hidden=!numberGenerator;
  scheduleTimerPanel.hidden=!scheduleTimer;
  quizView.hidden=!quiz;
  wheelPanel.hidden=!wheel;
  eventSignupPanel.hidden=!eventSignup;
  seatingPanel.hidden=!seating;
  showDashboard.classList.toggle('active',dashboard);
  showCalculator.classList.toggle('active',calculator);
  showNumberGenerator.classList.toggle('active',numberGenerator);
  showScheduleTimer.classList.toggle('active',scheduleTimer);
  showQuiz.classList.toggle('active',quiz);
  showWheel.classList.toggle('active',wheel);
  showEventSignup.classList.toggle('active',eventSignup);
  showSeating.classList.toggle('active',seating);
  calculatorTitle.textContent=dashboard?'Classroom Dashboard':seating?'Seating Chart':eventSignup?'Event Sign Up':wheel?'Random Wheel':quiz?'Quiz':scheduleTimer?'Schedule Timer':numberGenerator?'Number Generator':'Graphing & Scientific Calculator';
  calculatorHint.textContent=dashboard?'Choose a class, see today’s schedule, and open your classroom tools from one place.':seating?'Create, arrange, and print a classroom seating plan.':eventSignup?'Create shareable signup events and link filled time slots to Special Schedules.':wheel?'Paste a list, spin, and select someone or something at random.':quiz?'Create, practice, and run classroom quizzes.':scheduleTimer?'Create multiple timers that start automatically at their scheduled times.':numberGenerator?'Generate classroom numbers from any range, with an optional no-repeat mode.':'Choose GLN TI-84 or GLN TI-30XS inside the calculator.';
  if(dashboard)setTimeout(()=>{refreshDashboardClasses();updateClassroomDashboard()},0);
  if(numberGenerator)setTimeout(()=>{numberGeneratorMin.focus();queueFitNumberGeneratorResult()},0);
  if(scheduleTimer)setTimeout(()=>{renderScheduleTimers();updateScheduleTimerClock()},0);
  if(wheel)setTimeout(()=>{refreshWheelSeatingClasses();drawWheel()},0);
  if(eventSignup)setTimeout(()=>window.refreshEventSignupManager?.(),0);
  if(seating)setTimeout(()=>window.renderSeatingChart?.(),0);
}
showDashboard.onclick=()=>setCalculatorMode('dashboard');
showCalculator.onclick=()=>setCalculatorMode('calculator');
showNumberGenerator.onclick=()=>setCalculatorMode('number-generator');
showScheduleTimer.onclick=()=>setCalculatorMode('schedule-timer');
showQuiz.onclick=()=>openQuiz();
showWheel.onclick=()=>setCalculatorMode('wheel');
showEventSignup.onclick=()=>setCalculatorMode('event-signup');
showSeating.onclick=()=>setCalculatorMode('seating');

const numberGeneratorMin=document.querySelector('#numberGeneratorMin');
const numberGeneratorMax=document.querySelector('#numberGeneratorMax');
const numberGeneratorResult=document.querySelector('#numberGeneratorResult');
const numberGeneratorStatus=document.querySelector('#numberGeneratorStatus');
const numberGeneratorHistory=document.querySelector('#numberGeneratorHistory');
const numberNoRepeats=document.querySelector('#numberNoRepeats');
const numberUseCommas=document.querySelector('#numberUseCommas');
const NUMBER_GENERATOR_LIMIT=9999999999;
const MAX_SAFE_RANDOM_RANGE=9007199254740992;
let generatedNumberHistory=[];
let numberNoRepeatSignature='';
let numberNoRepeatRemaining=0;
let numberNoRepeatSwaps=new Map();
function parseGeneratorInteger(value,fallback){
  const cleaned=String(value??'').replace(/,/g,'').trim();
  if(!cleaned)return fallback;
  const parsed=Number(cleaned);
  return Number.isFinite(parsed)?Math.trunc(parsed):fallback;
}
function formatGeneratorNumber(value){
  const integer=Math.trunc(Number(value));
  if(!Number.isFinite(integer))return '—';
  return numberUseCommas?.checked?integer.toLocaleString('en-US'):String(integer);
}
function normalizedNumberRange(){
  let min=parseGeneratorInteger(numberGeneratorMin.value,1),max=parseGeneratorInteger(numberGeneratorMax.value,30);
  min=Math.max(-NUMBER_GENERATOR_LIMIT,Math.min(NUMBER_GENERATOR_LIMIT,min));
  max=Math.max(-NUMBER_GENERATOR_LIMIT,Math.min(NUMBER_GENERATOR_LIMIT,max));
  if(min>max)[min,max]=[max,min];
  numberGeneratorMin.value=formatGeneratorNumber(min);numberGeneratorMax.value=formatGeneratorNumber(max);
  return{min,max,size:max-min+1};
}
function secureRandomOffset(range){
  if(range<=1)return 0;
  if(range>MAX_SAFE_RANDOM_RANGE)throw new Error('Range is too large.');
  if(window.crypto?.getRandomValues){
    const values=new Uint32Array(2);
    const limit=Math.floor(MAX_SAFE_RANDOM_RANGE/range)*range;
    let value;
    do{
      window.crypto.getRandomValues(values);
      value=(values[0]&0x1fffff)*4294967296+values[1];
    }while(value>=limit);
    return value%range;
  }
  return Math.floor(Math.random()*range);
}
function secureRandomInt(min,max){return min+secureRandomOffset(max-min+1)}
function resetNumberPool(){numberNoRepeatSignature='';numberNoRepeatRemaining=0;numberNoRepeatSwaps=new Map()}
function prepareNoRepeatSampler(min,max){
  const signature=`${min}:${max}`;
  const size=max-min+1;
  if(numberNoRepeatSignature===signature&&numberNoRepeatRemaining>0)return;
  numberNoRepeatSignature=signature;
  numberNoRepeatRemaining=size;
  numberNoRepeatSwaps=new Map();
}
function takeNoRepeatNumber(min,max){
  prepareNoRepeatSampler(min,max);
  if(numberNoRepeatRemaining<=0){resetNumberPool();prepareNoRepeatSampler(min,max)}
  const pickIndex=secureRandomOffset(numberNoRepeatRemaining);
  const lastIndex=numberNoRepeatRemaining-1;
  const chosenOffset=numberNoRepeatSwaps.has(pickIndex)?numberNoRepeatSwaps.get(pickIndex):pickIndex;
  const lastOffset=numberNoRepeatSwaps.has(lastIndex)?numberNoRepeatSwaps.get(lastIndex):lastIndex;
  if(pickIndex!==lastIndex)numberNoRepeatSwaps.set(pickIndex,lastOffset);
  else numberNoRepeatSwaps.delete(pickIndex);
  numberNoRepeatSwaps.delete(lastIndex);
  numberNoRepeatRemaining--;
  return min+chosenOffset;
}
function renderNumberHistory(){
  numberGeneratorHistory.innerHTML='';
  if(!generatedNumberHistory.length){const li=document.createElement('li');li.textContent='No numbers yet';numberGeneratorHistory.append(li);return}
  generatedNumberHistory.forEach(value=>{const li=document.createElement('li');li.textContent=formatGeneratorNumber(value);numberGeneratorHistory.append(li)});
}
function fitNumberGeneratorResult(){
  if(!numberGeneratorResult)return;
  const el=numberGeneratorResult;
  el.classList.add('number-result-fitted');
  el.style.fontSize='';
  const minSize=28;
  const maxWidth=Math.max(0, el.clientWidth-4);
  if(!maxWidth)return;
  let current=parseFloat(getComputedStyle(el).fontSize)||72;
  let measured=el.scrollWidth;
  if(!measured)return;
  if(measured>maxWidth){
    let next=Math.max(minSize, Math.floor(current*((maxWidth)/measured)));
    el.style.fontSize=`${next}px`;
    current=next;
    measured=el.scrollWidth;
    let guard=0;
    while(measured>maxWidth && current>minSize && guard<8){
      current=Math.max(minSize,current-2);
      el.style.fontSize=`${current}px`;
      measured=el.scrollWidth;
      guard++;
    }
  }
}
const queueFitNumberGeneratorResult=(()=>{
  let raf=0;
  return()=>{
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{raf=0;fitNumberGeneratorResult()});
  };
})();
function generateClassroomNumber(){
  const{min,max,size}=normalizedNumberRange();
  if(size<1)return;
  let result;
  if(numberNoRepeats.checked){
    result=takeNoRepeatNumber(min,max);
    const left=numberNoRepeatRemaining;
    numberGeneratorStatus.textContent=left?`${formatGeneratorNumber(left)} number${left===1?'':'s'} remaining before reset.`:'All numbers in this range have now been used. The next Generate starts a new round.';
  }else{
    result=secureRandomInt(min,max);
    numberGeneratorStatus.textContent=`Generated from ${formatGeneratorNumber(min)} to ${formatGeneratorNumber(max)}.`;
  }
  numberGeneratorResult.textContent=formatGeneratorNumber(result);
  queueFitNumberGeneratorResult();
  generatedNumberHistory.unshift(result);generatedNumberHistory=generatedNumberHistory.slice(0,100);renderNumberHistory();
  numberGeneratorPanel.classList.remove('number-pop');void numberGeneratorPanel.offsetWidth;numberGeneratorPanel.classList.add('number-pop');
}
function resetNumberGenerator(){
  numberGeneratorMin.value='1';numberGeneratorMax.value='30';numberNoRepeats.checked=false;numberUseCommas.checked=true;numberGeneratorResult.textContent='—';numberGeneratorStatus.textContent='Choose a range, then generate a number.';generatedNumberHistory=[];renderNumberHistory();resetNumberPool();queueFitNumberGeneratorResult();
}
document.querySelector('#generateNumber').onclick=generateClassroomNumber;
document.querySelector('#resetNumberGenerator').onclick=resetNumberGenerator;
document.querySelector('#clearNumberHistory').onclick=()=>{generatedNumberHistory=[];renderNumberHistory()};
numberNoRepeats.onchange=()=>{resetNumberPool();numberGeneratorStatus.textContent=numberNoRepeats.checked?'No Repeats is on. Each number will be used once per round.':'Repeats are allowed.'};
numberUseCommas.onchange=()=>{
  const currentResult=generatedNumberHistory[0];
  const min=parseGeneratorInteger(numberGeneratorMin.value,1),max=parseGeneratorInteger(numberGeneratorMax.value,30);
  numberGeneratorMin.value=formatGeneratorNumber(Math.max(-NUMBER_GENERATOR_LIMIT,Math.min(NUMBER_GENERATOR_LIMIT,min)));
  numberGeneratorMax.value=formatGeneratorNumber(Math.max(-NUMBER_GENERATOR_LIMIT,Math.min(NUMBER_GENERATOR_LIMIT,max)));
  numberGeneratorResult.textContent=currentResult===undefined?'—':formatGeneratorNumber(currentResult);
  renderNumberHistory();
  queueFitNumberGeneratorResult();
};
[numberGeneratorMin,numberGeneratorMax].forEach(input=>{
  input.addEventListener('focus',()=>input.select());
  input.addEventListener('change',()=>{normalizedNumberRange();resetNumberPool()});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();generateClassroomNumber()}})
});
document.querySelectorAll('[data-number-max]').forEach(button=>button.addEventListener('click',()=>{
  const max=Number(button.dataset.numberMax);
  numberGeneratorMin.value=formatGeneratorNumber(1);numberGeneratorMax.value=formatGeneratorNumber(max);resetNumberPool();numberGeneratorResult.textContent='—';numberGeneratorStatus.textContent=`Quick range set to ${formatGeneratorNumber(1)}–${formatGeneratorNumber(max)}. Press Generate when ready.`;queueFitNumberGeneratorResult();
}));
window.addEventListener('resize',queueFitNumberGeneratorResult);
renderNumberHistory();
queueFitNumberGeneratorResult();

// Scheduled Classroom Timer
const SCHEDULE_TIMER_STORAGE_KEY='glnScheduleTimersV1';
const scheduleClock=document.querySelector('#scheduleClock');
const scheduleActiveState=document.querySelector('#scheduleActiveState');
const scheduleActiveName=document.querySelector('#scheduleActiveName');
const scheduleCountdown=document.querySelector('#scheduleCountdown');
const scheduleActiveRange=document.querySelector('#scheduleActiveRange');
const scheduleProgress=document.querySelector('#scheduleProgress');
const scheduleNext=document.querySelector('#scheduleNext');
const scheduleSpecialDay=document.querySelector('#scheduleSpecialDay');
const stopScheduleTimer=document.querySelector('#stopScheduleTimer');
const scheduleActiveCard=document.querySelector('#scheduleActiveCard');
const scheduleFullscreen=document.querySelector('#scheduleFullscreen');
const scheduleTodayToggle=document.querySelector('#scheduleTodayToggle');
const scheduleDayDrawer=document.querySelector('#scheduleDayDrawer');
const scheduleDayDrawerClose=document.querySelector('#scheduleDayDrawerClose');
const scheduleDayList=document.querySelector('#scheduleDayList');
const scheduleTimerForm=document.querySelector('#scheduleTimerForm');
const scheduleName=document.querySelector('#scheduleName');
const scheduleStartTime=document.querySelector('#scheduleStartTime');
const scheduleDuration=document.querySelector('#scheduleDuration');
const scheduleEnabled=document.querySelector('#scheduleEnabled');
const weeklyScheduleList=document.querySelector('#weeklyScheduleList');
const specialScheduleList=document.querySelector('#specialScheduleList');
const scheduleEditorTitle=document.querySelector('#scheduleEditorTitle');
const saveScheduleTimer=document.querySelector('#saveScheduleTimer');
const cancelScheduleEdit=document.querySelector('#cancelScheduleEdit');
const clearScheduleTimers=document.querySelector('#clearScheduleTimers');
const scheduleTypeWeekly=document.querySelector('#scheduleTypeWeekly');
const scheduleTypeSpecial=document.querySelector('#scheduleTypeSpecial');
const scheduleTypeHelp=document.querySelector('#scheduleTypeHelp');
const scheduleWeeklyEditor=document.querySelector('#scheduleWeeklyEditor');
const scheduleWeeklyFields=document.querySelector('#scheduleWeeklyFields');
const scheduleSpecialEditor=document.querySelector('#scheduleSpecialEditor');
const specialScheduleName=document.querySelector('#specialScheduleName');
const specialScheduleDate=document.querySelector('#specialScheduleDate');
const specialSlotList=document.querySelector('#specialSlotList');
const addSpecialSlot=document.querySelector('#addSpecialSlot');
let classroomSchedules=[];
let editingScheduleId='';
let scheduleEditorType='weekly';
let specialEditorSlots=[];
let manualTimer=null;
const dismissedScheduleOccurrences=new Set();
function localScheduleDateKey(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function parseScheduleDateKey(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  if(!match)return null;
  const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
  return Number.isNaN(date.getTime())?null:date;
}
function formatScheduleDate(value){
  const date=parseScheduleDateKey(value);return date?date.toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'}):'Choose a date';
}
function makeScheduleId(prefix='schedule'){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function normalizeWeeklySchedule(item){
  if(!item||!item.id||!item.time||!item.duration)return null;
  return{id:item.id,type:'weekly',name:String(item.name||'Activity'),time:item.time,duration:Math.max(1,Math.min(480,Number(item.duration)||1)),days:Array.isArray(item.days)?item.days.map(Number).filter(day=>day>=0&&day<=6):[],enabled:item.enabled!==false};
}
function normalizeSpecialSlot(slot,index=0){
  if(!slot||!slot.time||!slot.duration)return null;
  return{id:slot.id||`slot-${index}-${Math.random().toString(36).slice(2,7)}`,name:String(slot.name||'Activity'),time:slot.time,duration:Math.max(1,Math.min(480,Number(slot.duration)||1))};
}
function normalizeSpecialSchedule(item){
  if(!item||!item.id||!item.date||!Array.isArray(item.slots))return null;
  const slots=item.slots.map(normalizeSpecialSlot).filter(Boolean).sort((a,b)=>a.time.localeCompare(b.time));
  if(!slots.length)return null;
  return{id:item.id,type:'special',name:String(item.name||'Special Schedule'),date:item.date,enabled:item.enabled!==false,slots,source:String(item.source||''),linkedEventId:String(item.linkedEventId||'')};
}
function migrateStoredSchedules(saved){
  const normalized=[];const legacyGroups=new Map();let migrated=false;
  (Array.isArray(saved)?saved:[]).forEach(item=>{
    if(item?.type==='special'){
      const special=normalizeSpecialSchedule(item);if(special)normalized.push(special);return;
    }
    if(item?.type==='one-day'&&item.date&&item.time&&item.duration){
      migrated=true;
      const key=`${item.date}|${item.enabled!==false}`;
      if(!legacyGroups.has(key))legacyGroups.set(key,[]);
      legacyGroups.get(key).push(item);return;
    }
    const weekly=normalizeWeeklySchedule(item);if(weekly)normalized.push(weekly);
  });
  legacyGroups.forEach((items,key)=>{
    const [date,enabledText]=key.split('|');
    const slots=items.map((item,index)=>normalizeSpecialSlot({id:`legacy-${item.id||index}`,name:item.name,time:item.time,duration:item.duration},index)).filter(Boolean);
    if(!slots.length)return;
    const name=items.length===1?`${items[0].name} – Special`:`Special Schedule · ${formatScheduleDate(date)}`;
    normalized.push({id:makeScheduleId('special'),type:'special',name,date,enabled:enabledText==='true',slots:slots.sort((a,b)=>a.time.localeCompare(b.time))});
  });
  return{items:normalized,migrated};
}
function loadClassroomSchedules(){
  try{
    const saved=JSON.parse(localStorage.getItem(SCHEDULE_TIMER_STORAGE_KEY)||'[]');
    const result=migrateStoredSchedules(saved);classroomSchedules=result.items;if(result.migrated)saveClassroomSchedules();
  }catch{classroomSchedules=[]}
  deactivateExpiredSpecialSchedules();
}
function saveClassroomSchedules(){
  localStorage.setItem(SCHEDULE_TIMER_STORAGE_KEY,JSON.stringify(classroomSchedules));
  if(!window.__classroomToolsApplyingCloud)window.queueClassroomToolsCloudSync?.();
}
function deactivateExpiredSpecialSchedules(now=new Date()){
  const today=localScheduleDateKey(now);let changed=false;
  classroomSchedules.forEach(entry=>{if(entry.type==='special'&&entry.enabled&&entry.date<today){entry.enabled=false;changed=true}});
  if(changed)saveClassroomSchedules();return changed;
}
function scheduleDayChecks(){return [...document.querySelectorAll('.schedule-days input[type="checkbox"]')]}
function selectedScheduleDays(){return scheduleDayChecks().filter(input=>input.checked).map(input=>Number(input.value))}
function scheduleDayText(days){
  const normalized=[...new Set(days||[])].sort((a,b)=>a-b);const weekdays=[1,2,3,4,5];
  if(weekdays.every(day=>normalized.includes(day))&&normalized.length===5)return 'Mon–Fri';
  if(normalized.length===7)return 'Every day';
  const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];return normalized.map(day=>names[day]).join(', ');
}
function formatScheduleTime(time){
  const [hourText,minuteText]=String(time||'00:00').split(':');let hour=Number(hourText)||0;const minute=Number(minuteText)||0;const suffix=hour>=12?'PM':'AM';hour=hour%12||12;
  return `${hour}:${String(minute).padStart(2,'0')} ${suffix}`;
}
function formatScheduleClock(date=new Date()){return date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})}
function formatTimerRemaining(ms){
  const total=Math.max(0,Math.ceil(ms/1000));const hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),seconds=total%60;
  return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`:`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}
function weeklyOccurrence(entry,date){
  if(!entry.enabled||!(entry.days||[]).includes(date.getDay()))return null;
  const [hour,minute]=entry.time.split(':').map(Number);const start=new Date(date);start.setHours(hour||0,minute||0,0,0);const end=new Date(start.getTime()+Number(entry.duration)*60000);const dateKey=localScheduleDateKey(date);
  return{entry,slot:null,type:'weekly',displayName:entry.name,start,end,key:`${entry.id}:${dateKey}`,duration:entry.duration,time:entry.time};
}
function specialOccurrences(entry,date){
  if(!entry.enabled||entry.type!=='special'||entry.date!==localScheduleDateKey(date))return[];
  return entry.slots.map(slot=>{
    const [hour,minute]=slot.time.split(':').map(Number);const start=new Date(date);start.setHours(hour||0,minute||0,0,0);const end=new Date(start.getTime()+Number(slot.duration)*60000);
    return{entry,slot,type:'special',displayName:slot.name,start,end,key:`${entry.id}:${slot.id}:${entry.date}`,duration:slot.duration,time:slot.time};
  });
}
function enabledSpecialSchedulesForDate(date){
  const dateKey=typeof date==='string'?date:localScheduleDateKey(date);return classroomSchedules.filter(entry=>entry.type==='special'&&entry.enabled&&entry.date===dateKey);
}
function allOccurrencesForDate(date){
  const specials=enabledSpecialSchedulesForDate(date);
  if(specials.length)return specials.flatMap(entry=>specialOccurrences(entry,date)).sort((a,b)=>a.start-b.start);
  return classroomSchedules.filter(entry=>entry.type==='weekly').map(entry=>weeklyOccurrence(entry,date)).filter(Boolean).sort((a,b)=>a.start-b.start);
}
function getUpcomingSchedule(now=new Date()){
  const candidates=[];
  for(let add=0;add<8;add++){
    const date=new Date(now);date.setDate(now.getDate()+add);
    allOccurrencesForDate(date).forEach(occurrence=>{if(occurrence.start>now&&!dismissedScheduleOccurrences.has(occurrence.key))candidates.push(occurrence)});
  }
  classroomSchedules.filter(entry=>entry.type==='special'&&entry.enabled).forEach(entry=>{
    const date=parseScheduleDateKey(entry.date);if(!date||date<=now)return;
    specialOccurrences(entry,date).forEach(occurrence=>{if(occurrence.start>now&&!dismissedScheduleOccurrences.has(occurrence.key))candidates.push(occurrence)});
  });
  return candidates.sort((a,b)=>a.start-b.start||(a.type==='special'?-1:1))[0]||null;
}
function getActiveScheduledOccurrence(now=new Date()){
  const active=allOccurrencesForDate(now).filter(item=>now>=item.start&&now<item.end&&!dismissedScheduleOccurrences.has(item.key));
  return active.sort((a,b)=>a.start-b.start)[0]||null;
}
function defaultSpecialSlot(){return{id:makeScheduleId('slot'),name:'',time:'',duration:5}}
function setScheduleEditorType(type,{keepSpecial=false}={}){
  scheduleEditorType=type==='special'?'special':'weekly';const special=scheduleEditorType==='special';
  scheduleTypeWeekly?.classList.toggle('active',!special);scheduleTypeWeekly?.setAttribute('aria-pressed',String(!special));
  scheduleTypeSpecial?.classList.toggle('active',special);scheduleTypeSpecial?.setAttribute('aria-pressed',String(special));
  if(scheduleWeeklyEditor)scheduleWeeklyEditor.hidden=special;if(scheduleSpecialEditor)scheduleSpecialEditor.hidden=!special;
  if(special&&!keepSpecial){if(!specialScheduleDate.value)specialScheduleDate.value=localScheduleDateKey(new Date());if(!specialEditorSlots.length)specialEditorSlots=[defaultSpecialSlot()];renderSpecialSlotEditor()}
  scheduleTypeHelp.textContent=special?'Create one named special day with multiple timed activities. It replaces the weekly schedule for that date.':'Repeat one activity on selected weekdays.';
  saveScheduleTimer.textContent=special?(editingScheduleId?'Update special schedule':'Save special schedule'):(editingScheduleId?'Update weekly schedule':'Add weekly schedule');
}
function renderSpecialSlotEditor(){
  if(!specialSlotList)return;specialSlotList.innerHTML='';
  specialEditorSlots.sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  specialEditorSlots.forEach((slot,index)=>{
    const row=document.createElement('div');row.className='special-slot-editor-row';row.dataset.slotId=slot.id;
    const nameLabel=document.createElement('label');nameLabel.innerHTML='<span>Activity</span>';const name=document.createElement('input');name.type='text';name.maxLength=60;name.placeholder='Activity name';name.value=slot.name||'';name.addEventListener('input',()=>slot.name=name.value);nameLabel.append(name);
    const timeLabel=document.createElement('label');timeLabel.innerHTML='<span>Start</span>';const time=document.createElement('input');time.type='time';time.value=slot.time||'';time.addEventListener('change',()=>{slot.time=time.value;renderSpecialSlotEditor()});timeLabel.append(time);
    const durationLabel=document.createElement('label');durationLabel.innerHTML='<span>Minutes</span>';const duration=document.createElement('input');duration.type='number';duration.min='1';duration.max='480';duration.step='1';duration.value=slot.duration||5;duration.addEventListener('input',()=>slot.duration=Math.max(1,Math.min(480,Number(duration.value)||1)));durationLabel.append(duration);
    const remove=document.createElement('button');remove.type='button';remove.className='special-slot-remove';remove.setAttribute('aria-label',`Remove time slot ${index+1}`);remove.textContent='×';remove.disabled=specialEditorSlots.length===1;remove.addEventListener('click',()=>{specialEditorSlots=specialEditorSlots.filter(item=>item.id!==slot.id);renderSpecialSlotEditor()});
    row.append(nameLabel,timeLabel,durationLabel,remove);specialSlotList.append(row);
  });
}
function resetScheduleEditor(){
  editingScheduleId='';scheduleEditorTitle.textContent='Add schedule';cancelScheduleEdit.hidden=true;scheduleTimerForm.reset();scheduleDuration.value='5';scheduleEnabled.checked=true;scheduleDayChecks().forEach(input=>input.checked=['1','2','3','4','5'].includes(input.value));specialScheduleName.value='';specialScheduleDate.value=localScheduleDateKey(new Date());specialEditorSlots=[defaultSpecialSlot()];setScheduleEditorType('weekly',{keepSpecial:true});renderSpecialSlotEditor();scheduleName.focus();
}
function editClassroomSchedule(id){
  const entry=classroomSchedules.find(item=>item.id===id);if(!entry)return;
  editingScheduleId=id;scheduleEditorTitle.textContent=entry.type==='special'?'Edit special schedule':'Edit weekly schedule';cancelScheduleEdit.hidden=false;scheduleEnabled.checked=entry.enabled;
  if(entry.type==='special'){
    specialScheduleName.value=entry.name;specialScheduleDate.value=entry.date;specialEditorSlots=entry.slots.map(slot=>({...slot}));setScheduleEditorType('special',{keepSpecial:true});renderSpecialSlotEditor();specialScheduleName.focus();
  }else{
    scheduleName.value=entry.name;scheduleStartTime.value=entry.time;scheduleDuration.value=entry.duration;scheduleDayChecks().forEach(input=>input.checked=(entry.days||[]).includes(Number(input.value)));setScheduleEditorType('weekly',{keepSpecial:true});scheduleName.focus();
  }
}
function makeWeeklyScheduleRow(entry){
  const row=document.createElement('article');row.className=`schedule-row${entry.enabled?'':' is-disabled'}`;
  const main=document.createElement('div');main.className='schedule-row-main';const time=document.createElement('strong');time.className='schedule-row-time';time.textContent=formatScheduleTime(entry.time);const copy=document.createElement('div');const name=document.createElement('strong');name.textContent=entry.name;const meta=document.createElement('small');meta.textContent=`${entry.duration} min · ${scheduleDayText(entry.days)}`;copy.append(name,meta);main.append(time,copy);
  const actions=document.createElement('div');actions.className='schedule-row-actions';
  const enabled=makeScheduleToggle(entry);const run=document.createElement('button');run.type='button';run.textContent='Run now';run.addEventListener('click',()=>runWeeklyScheduleNow(entry));const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.addEventListener('click',()=>editClassroomSchedule(entry.id));const del=makeDeleteButton(entry.id,entry.name);
  actions.append(enabled,run,edit,del);row.append(main,actions);return row;
}
function makeScheduleToggle(entry){
  const label=document.createElement('label');label.className='schedule-row-toggle';const check=document.createElement('input');check.type='checkbox';check.checked=entry.enabled;const text=document.createElement('span');text.textContent=entry.enabled?'On':'Off';check.addEventListener('change',()=>{entry.enabled=check.checked;saveClassroomSchedules();renderScheduleTimers();updateScheduleTimerClock()});label.append(check,text);return label;
}
function makeDeleteButton(id,name){
  const del=document.createElement('button');del.type='button';del.textContent='Delete';del.className='danger';del.addEventListener('click',()=>{if(!confirm(`Delete ${name}?`))return;classroomSchedules=classroomSchedules.filter(item=>item.id!==id);saveClassroomSchedules();renderScheduleTimers();updateScheduleTimerClock();if(editingScheduleId===id)resetScheduleEditor()});return del;
}
function makeSpecialScheduleCard(entry,today){
  const expired=entry.date<today;const linkedEvent=Boolean(entry.linkedEventId);const card=document.createElement('article');card.className=`special-schedule-card${entry.enabled?'':' is-disabled'}${expired?' is-expired':''}${linkedEvent?' is-event-linked':''}`;
  const head=document.createElement('div');head.className='special-schedule-card-head';const copy=document.createElement('div');const title=document.createElement('div');title.className='special-schedule-card-title';const name=document.createElement('strong');name.textContent=entry.name;const badge=document.createElement('span');badge.className='schedule-type-badge';badge.textContent=expired?'Past':linkedEvent?'Event Sign Up':'Special';title.append(name,badge);const meta=document.createElement('small');meta.textContent=`${formatScheduleDate(entry.date)} · ${entry.slots.length} time slot${entry.slots.length===1?'':'s'}${linkedEvent?' · linked automatically':''}`;copy.append(title,meta);
  const actions=document.createElement('div');actions.className='schedule-row-actions';
  if(linkedEvent){
    const open=document.createElement('button');open.type='button';open.textContent='Open event';open.addEventListener('click',()=>window.openEventSignupById?.(entry.linkedEventId));actions.append(open);
  }else{
    const enabled=makeScheduleToggle(entry);const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.addEventListener('click',()=>editClassroomSchedule(entry.id));const duplicate=document.createElement('button');duplicate.type='button';duplicate.textContent='Duplicate';duplicate.addEventListener('click',()=>duplicateSpecialSchedule(entry));const del=makeDeleteButton(entry.id,entry.name);actions.append(enabled,edit,duplicate,del);
  }
  head.append(copy,actions);
  const slots=document.createElement('div');slots.className='special-schedule-slots';entry.slots.slice().sort((a,b)=>a.time.localeCompare(b.time)).forEach(slot=>{const row=document.createElement('div');row.className='special-schedule-slot';const time=document.createElement('strong');time.textContent=formatScheduleTime(slot.time);const slotCopy=document.createElement('div');const slotName=document.createElement('b');slotName.textContent=slot.name;const duration=document.createElement('small');duration.textContent=`${slot.duration} min${linkedEvent?' · Event Sign Up':''}`;slotCopy.append(slotName,duration);const run=document.createElement('button');run.type='button';run.textContent='Run now';run.addEventListener('click',()=>runSpecialSlotNow(entry,slot));row.append(time,slotCopy,run);slots.append(row)});
  card.append(head,slots);return card;
}
function duplicateSpecialSchedule(entry){
  const copy={...entry,id:makeScheduleId('special'),name:`${entry.name} Copy`,enabled:false,slots:entry.slots.map(slot=>({...slot,id:makeScheduleId('slot') }))};classroomSchedules.push(copy);saveClassroomSchedules();renderScheduleTimers();editClassroomSchedule(copy.id);
}
function renderScheduleTimers(){
  if(!weeklyScheduleList||!specialScheduleList)return;weeklyScheduleList.innerHTML='';specialScheduleList.innerHTML='';const today=localScheduleDateKey(new Date());
  const weekly=classroomSchedules.filter(entry=>entry.type==='weekly').sort((a,b)=>`${a.time}:${a.name}`.localeCompare(`${b.time}:${b.name}`));const specials=classroomSchedules.filter(entry=>entry.type==='special').sort((a,b)=>`${a.date}:${a.name}`.localeCompare(`${b.date}:${b.name}`));
  if(!weekly.length)weeklyScheduleList.innerHTML='<p class="schedule-empty">No weekly schedules yet.</p>';else weekly.forEach(entry=>weeklyScheduleList.append(makeWeeklyScheduleRow(entry)));
  if(!specials.length)specialScheduleList.innerHTML='<p class="schedule-empty">No special schedules yet.</p>';else specials.forEach(entry=>specialScheduleList.append(makeSpecialScheduleCard(entry,today)));
}
function makeManualOccurrence({name,duration,type='manual',scheduleName='',date=''}){
  const start=new Date();return{entry:{name:scheduleName||name,type},slot:null,type,displayName:name,start,end:new Date(start.getTime()+Number(duration)*60000),key:`manual:${Date.now()}`,duration,date};
}
function runWeeklyScheduleNow(entry){manualTimer=makeManualOccurrence({name:entry.name,duration:entry.duration,type:'weekly'});updateScheduleTimerClock()}
function runSpecialSlotNow(entry,slot){manualTimer=makeManualOccurrence({name:slot.name,duration:slot.duration,type:'special',scheduleName:entry.name,date:entry.date});updateScheduleTimerClock()}
function activeTimerOccurrence(now){if(manualTimer&&now<manualTimer.end)return manualTimer;if(manualTimer&&now>=manualTimer.end)manualTimer=null;return getActiveScheduledOccurrence(now)}
function specialScheduleExistsToday(now=new Date()){return enabledSpecialSchedulesForDate(now).length>0}
function formatUpcomingSchedule(occurrence){
  if(!occurrence)return 'No upcoming schedule';
  if(occurrence.type==='special')return `${occurrence.displayName} · ${formatScheduleTime(occurrence.time)} · ${occurrence.entry.name} · ${formatScheduleDate(occurrence.entry.date)}`;
  return `${occurrence.displayName} · ${formatScheduleTime(occurrence.time)} · ${scheduleDayText(occurrence.entry.days)}`;
}
function upcomingSchedulesForToday(now=new Date()){
  return allOccurrencesForDate(now).filter(occurrence=>occurrence.start>now&&!dismissedScheduleOccurrences.has(occurrence.key)).sort((a,b)=>a.start-b.start);
}
function renderScheduleDayDrawer(now=new Date()){
  if(!scheduleDayList)return;
  const upcoming=upcomingSchedulesForToday(now);scheduleDayList.innerHTML='';
  if(!upcoming.length){const empty=document.createElement('p');empty.className='schedule-day-empty';empty.textContent='No more scheduled activities today.';scheduleDayList.append(empty);return}
  upcoming.forEach(occurrence=>{
    const row=document.createElement('div');row.className='schedule-day-item';
    const time=document.createElement('strong');time.textContent=formatScheduleTime(occurrence.time);
    const copy=document.createElement('div');const name=document.createElement('b');name.textContent=occurrence.displayName;
    const meta=document.createElement('small');meta.textContent=`${occurrence.duration} min${occurrence.type==='special'&&occurrence.entry?.name?` · ${occurrence.entry.name}`:''}`;
    copy.append(name,meta);row.append(time,copy);scheduleDayList.append(row);
  });
}
function setScheduleDayDrawer(open){
  if(!scheduleDayDrawer||!scheduleTodayToggle)return;
  const show=Boolean(open)&&scheduleActiveCard?.classList.contains('is-schedule-fullscreen');
  scheduleDayDrawer.hidden=!show;scheduleTodayToggle.setAttribute('aria-expanded',String(show));scheduleTodayToggle.textContent=show?'Hide today’s schedule':'Show today’s schedule';
  if(show)renderScheduleDayDrawer(new Date());
}
function syncScheduleFullscreenUI(){
  if(!scheduleActiveCard||!scheduleFullscreen)return;
  const active=scheduleActiveCard.classList.contains('is-schedule-fullscreen');
  scheduleFullscreen.textContent=active?'× Exit full screen':'⛶ Full screen';
  if(scheduleTodayToggle)scheduleTodayToggle.hidden=!active;
  if(!active)setScheduleDayDrawer(false);else if(scheduleDayDrawer&&!scheduleDayDrawer.hidden)renderScheduleDayDrawer(new Date());
}
async function enterScheduleFullscreen(){
  if(!scheduleActiveCard)return;
  scheduleActiveCard.classList.add('is-schedule-fullscreen');document.body.classList.add('schedule-fullscreen-open');syncScheduleFullscreenUI();
  if(document.fullscreenElement!==scheduleActiveCard&&scheduleActiveCard.requestFullscreen){
    try{await scheduleActiveCard.requestFullscreen({navigationUI:'hide'})}catch{}
  }
}
async function exitScheduleFullscreen(){
  if(!scheduleActiveCard)return;
  if(document.fullscreenElement===scheduleActiveCard&&document.exitFullscreen){try{await document.exitFullscreen()}catch{}}
  scheduleActiveCard.classList.remove('is-schedule-fullscreen');document.body.classList.remove('schedule-fullscreen-open');setScheduleDayDrawer(false);syncScheduleFullscreenUI();
}
async function toggleScheduleFullscreen(){
  if(scheduleActiveCard?.classList.contains('is-schedule-fullscreen'))await exitScheduleFullscreen();else await enterScheduleFullscreen();
}
function updateScheduleTimerClock(){
  if(!scheduleClock)return;const now=new Date();scheduleClock.textContent=formatScheduleClock(now);if(deactivateExpiredSpecialSchedules(now))renderScheduleTimers();const specialToday=specialScheduleExistsToday(now);
  if(scheduleSpecialDay){scheduleSpecialDay.hidden=!specialToday;scheduleSpecialDay.textContent=specialToday?`Special schedule active today · ${formatScheduleDate(localScheduleDateKey(now))} · Weekly schedule paused for today`:''}
  const active=activeTimerOccurrence(now);
  if(active){
    const remaining=active.end-now;const total=Math.max(1,active.end-active.start);const elapsed=Math.max(0,now-active.start);const pct=Math.min(100,Math.max(0,elapsed/total*100));const remainingText=formatTimerRemaining(remaining);const isManual=String(active.key).startsWith('manual:');
    scheduleActiveState.textContent=isManual?'RUNNING NOW':active.type==='special'?'SPECIAL SCHEDULE':'RUNNING AUTOMATICALLY';scheduleActiveName.textContent=active.displayName;scheduleCountdown.textContent=remainingText;scheduleActiveRange.textContent=`${formatScheduleTime(`${String(active.start.getHours()).padStart(2,'0')}:${String(active.start.getMinutes()).padStart(2,'0')}`)} – ${formatScheduleTime(`${String(active.end.getHours()).padStart(2,'0')}:${String(active.end.getMinutes()).padStart(2,'0')}`)}${active.type==='special'&&active.entry?.name?` · ${active.entry.name}`:''}`;scheduleProgress.style.width=`${pct}%`;stopScheduleTimer.hidden=false;showScheduleTimer.textContent=`Schedule Timer · ${remainingText}`;
  }else{
    scheduleActiveState.textContent=specialToday?'SPECIAL SCHEDULE TODAY':'WAITING';scheduleActiveName.textContent='No timer is running';scheduleCountdown.textContent='--:--';scheduleActiveRange.textContent=specialToday?'The special schedule will run its next saved time slot automatically.':'The next enabled schedule will start automatically.';scheduleProgress.style.width='0%';stopScheduleTimer.hidden=true;showScheduleTimer.textContent='Schedule Timer';
  }
  scheduleNext.textContent=formatUpcomingSchedule(getUpcomingSchedule(now));
  if(scheduleActiveCard?.classList.contains('is-schedule-fullscreen')&&scheduleDayDrawer&&!scheduleDayDrawer.hidden)renderScheduleDayDrawer(now);
}
if(scheduleFullscreen)scheduleFullscreen.addEventListener('click',toggleScheduleFullscreen);
if(scheduleTodayToggle)scheduleTodayToggle.addEventListener('click',()=>setScheduleDayDrawer(scheduleDayDrawer?.hidden));
if(scheduleDayDrawerClose)scheduleDayDrawerClose.addEventListener('click',()=>setScheduleDayDrawer(false));
document.addEventListener('fullscreenchange',()=>{
  if(!scheduleActiveCard)return;
  if(document.fullscreenElement===scheduleActiveCard){scheduleActiveCard.classList.add('is-schedule-fullscreen');document.body.classList.add('schedule-fullscreen-open')}
  else if(scheduleActiveCard.classList.contains('is-schedule-fullscreen')){scheduleActiveCard.classList.remove('is-schedule-fullscreen');document.body.classList.remove('schedule-fullscreen-open');setScheduleDayDrawer(false)}
  syncScheduleFullscreenUI();
});
if(scheduleTypeWeekly)scheduleTypeWeekly.addEventListener('click',()=>setScheduleEditorType('weekly'));
if(scheduleTypeSpecial)scheduleTypeSpecial.addEventListener('click',()=>setScheduleEditorType('special'));
if(addSpecialSlot)addSpecialSlot.addEventListener('click',()=>{specialEditorSlots.push(defaultSpecialSlot());renderSpecialSlotEditor();const last=specialSlotList.lastElementChild?.querySelector('input[type="text"]');last?.focus()});
if(scheduleTimerForm)scheduleTimerForm.addEventListener('submit',event=>{
  event.preventDefault();let scheduleData;
  if(scheduleEditorType==='special'){
    const name=specialScheduleName.value.trim();const date=specialScheduleDate.value;const today=localScheduleDateKey(new Date());const slots=specialEditorSlots.map(slot=>({...slot,name:String(slot.name||'').trim(),duration:Math.max(1,Math.min(480,Number(slot.duration)||1))})).filter(slot=>slot.name&&slot.time);
    if(!name){alert('Enter a name for the special schedule.');specialScheduleName.focus();return}
    if(!date){alert('Choose a date for the special schedule.');specialScheduleDate.focus();return}
    if(date<today){alert('Choose today or a future date for a special schedule.');return}
    if(!slots.length){alert('Add at least one complete time slot with an activity name and start time.');return}
    if(slots.length!==specialEditorSlots.length){alert('Complete every special-schedule time slot before saving.');return}
    scheduleData={type:'special',name,date,enabled:scheduleEnabled.checked,slots:slots.sort((a,b)=>a.time.localeCompare(b.time))};
  }else{
    const name=scheduleName.value.trim();const time=scheduleStartTime.value;const duration=Math.max(1,Math.min(480,Number(scheduleDuration.value)||1));const days=selectedScheduleDays();if(!name||!time){alert('Enter an activity name and start time.');return}if(!days.length){alert('Choose at least one day for this weekly schedule.');return}
    scheduleData={type:'weekly',name,time,duration,days,enabled:scheduleEnabled.checked};
  }
  if(editingScheduleId){const index=classroomSchedules.findIndex(item=>item.id===editingScheduleId);if(index>=0)classroomSchedules[index]={id:editingScheduleId,...scheduleData}}
  else classroomSchedules.push({id:makeScheduleId(scheduleData.type),...scheduleData});
  saveClassroomSchedules();renderScheduleTimers();updateScheduleTimerClock();resetScheduleEditor();
});
if(cancelScheduleEdit)cancelScheduleEdit.addEventListener('click',resetScheduleEditor);
if(clearScheduleTimers)clearScheduleTimers.addEventListener('click',()=>{if(!classroomSchedules.length)return;if(confirm('Clear all saved weekly and special schedules?')){classroomSchedules=[];manualTimer=null;saveClassroomSchedules();renderScheduleTimers();resetScheduleEditor();updateScheduleTimerClock()}});
if(stopScheduleTimer)stopScheduleTimer.addEventListener('click',()=>{
  const now=new Date();if(manualTimer&&now<manualTimer.end){manualTimer=null}else{const active=getActiveScheduledOccurrence(now);if(active)dismissedScheduleOccurrences.add(active.key)}updateScheduleTimerClock();
});
loadClassroomSchedules();specialEditorSlots=[defaultSpecialSlot()];setScheduleEditorType('weekly',{keepSpecial:true});renderSpecialSlotEditor();renderScheduleTimers();updateScheduleTimerClock();syncScheduleFullscreenUI();setInterval(updateScheduleTimerClock,500);

/* Classroom Dashboard */
const dashboardClassSelect=document.querySelector('#dashboardClassSelect');
const dashboardClassCount=document.querySelector('#dashboardClassCount');
const dashboardClassNote=document.querySelector('#dashboardClassNote');
const dashboardStudentResult=document.querySelector('#dashboardStudentResult');
const dashboardPickStudent=document.querySelector('#dashboardPickStudent');
const dashboardResetPicker=document.querySelector('#dashboardResetPicker');
const dashboardOpenSeating=document.querySelector('#dashboardOpenSeating');
const dashboardLoadWheel=document.querySelector('#dashboardLoadWheel');
const dashboardDay=document.querySelector('#dashboardDay');
const dashboardDate=document.querySelector('#dashboardDate');
const dashboardClock=document.querySelector('#dashboardClock');
const dashboardScheduleState=document.querySelector('#dashboardScheduleState');
const dashboardScheduleCurrent=document.querySelector('#dashboardScheduleCurrent');
const dashboardScheduleRemaining=document.querySelector('#dashboardScheduleRemaining');
const dashboardScheduleNext=document.querySelector('#dashboardScheduleNext');
const dashboardAgenda=document.querySelector('#dashboardAgenda');
const dashboardSyncDot=document.querySelector('#dashboardSyncDot');
const dashboardSyncText=document.querySelector('#dashboardSyncText');
const dashboardSyncDetail=document.querySelector('#dashboardSyncDetail');
let dashboardPickerRemaining=[];
let dashboardPickerClassId='';
function dashboardClasses(){return typeof window.getSeatingClassLists==='function'?window.getSeatingClassLists():[]}
function selectedDashboardClass(){const classes=dashboardClasses();return classes.find(item=>item.id===dashboardClassSelect?.value)||classes[0]||null}
function resetDashboardPicker(message='Select a class and pick a student.'){
  dashboardPickerRemaining=[];dashboardPickerClassId='';
  if(!dashboardStudentResult)return;
  const small=dashboardStudentResult.querySelector('small'),strong=dashboardStudentResult.querySelector('strong'),span=dashboardStudentResult.querySelector('span');
  if(small)small.textContent='Ready to pick';if(strong)strong.textContent='—';if(span)span.textContent=message;
}
function refreshDashboardClasses(){
  if(!dashboardClassSelect)return;
  const classes=dashboardClasses();const previous=dashboardClassSelect.value||localStorage.getItem('glnDashboardClassId')||'';
  dashboardClassSelect.innerHTML='';
  if(!classes.length){dashboardClassSelect.add(new Option('No Seating Chart classes yet',''));dashboardClassSelect.disabled=true;dashboardClassCount.textContent='0 students';dashboardClassNote.textContent='Create a class in Seating Chart to use it here.';dashboardPickStudent.disabled=true;dashboardOpenSeating.disabled=false;dashboardLoadWheel.disabled=true;return}
  dashboardClassSelect.disabled=false;classes.forEach(item=>dashboardClassSelect.add(new Option(item.className,item.id)));
  dashboardClassSelect.value=classes.some(item=>item.id===previous)?previous:classes[0].id;
  localStorage.setItem('glnDashboardClassId',dashboardClassSelect.value);dashboardPickStudent.disabled=false;dashboardLoadWheel.disabled=false;updateDashboardClassSummary();
}
function updateDashboardClassSummary(){
  const item=selectedDashboardClass(),count=item?.roster?.length||0;
  if(dashboardClassCount)dashboardClassCount.textContent=`${count} student${count===1?'':'s'}`;
  if(dashboardClassNote)dashboardClassNote.textContent=item?`${item.className} is ready for quick classroom actions.`:'Class lists come from Seating Chart.';
  if(item&&dashboardPickerClassId&&dashboardPickerClassId!==item.id)resetDashboardPicker();
}
function pickDashboardStudent(){
  const item=selectedDashboardClass();const roster=(item?.roster||[]).map(name=>String(name).trim()).filter(Boolean);
  if(!roster.length){resetDashboardPicker('This class does not have any student names yet.');return}
  if(dashboardPickerClassId!==item.id||!dashboardPickerRemaining.length){dashboardPickerClassId=item.id;dashboardPickerRemaining=[...roster]}
  const index=Math.floor(Math.random()*dashboardPickerRemaining.length),name=dashboardPickerRemaining.splice(index,1)[0];
  const small=dashboardStudentResult.querySelector('small'),strong=dashboardStudentResult.querySelector('strong'),span=dashboardStudentResult.querySelector('span');
  small.textContent='Selected student';strong.textContent=name;span.textContent=dashboardPickerRemaining.length?`${dashboardPickerRemaining.length} student${dashboardPickerRemaining.length===1?'':'s'} remaining this round.`:'Everyone has been picked. The next pick starts a new round.';
}
function updateDashboardSchedule(now=new Date()){
  if(!dashboardScheduleState)return;
  const active=activeTimerOccurrence(now);const upcoming=getUpcomingSchedule(now);const agenda=upcomingSchedulesForToday(now).slice(0,4);
  if(active){const manual=String(active.key).startsWith('manual:');dashboardScheduleState.textContent=manual?'RUNNING NOW':active.type==='special'?'SPECIAL SCHEDULE':'IN PROGRESS';dashboardScheduleCurrent.textContent=active.displayName;dashboardScheduleRemaining.textContent=formatTimerRemaining(active.end-now)}
  else{dashboardScheduleState.textContent=specialScheduleExistsToday(now)?'SPECIAL SCHEDULE TODAY':'WAITING';dashboardScheduleCurrent.textContent='No timer is running';dashboardScheduleRemaining.textContent='--:--'}
  dashboardScheduleNext.textContent=upcoming?formatUpcomingSchedule(upcoming):'No upcoming schedule';
  dashboardAgenda.innerHTML='';
  if(!agenda.length){const empty=document.createElement('p');empty.textContent='No more scheduled activities today.';dashboardAgenda.append(empty)}
  else agenda.forEach(item=>{const row=document.createElement('div');row.className='dashboard-agenda-row';const time=document.createElement('strong');time.textContent=formatScheduleTime(item.time);const copy=document.createElement('span');copy.textContent=item.displayName;row.append(time,copy);dashboardAgenda.append(row)});
}
function updateDashboardSync(){
  if(!dashboardSyncText)return;
  const status=document.querySelector('#seatingStorageStatus');const mode=localStorage.getItem('glnClassroomToolsStorageMode')||localStorage.getItem('glnSeatingStorageMode')||'local';const text=status?.textContent||'';
  const google=mode==='google';dashboardSyncDot.classList.toggle('is-google',google);dashboardSyncText.textContent=google?'Google account sync':'Saved on this device';dashboardSyncDetail.textContent=text||(google?'Classroom Tools will sync when Google sign-in is available.':'Your Classroom Tools data remains available locally.');
}
function updateClassroomDashboard(){
  if(!dashboardDay)return;
  const now=new Date();dashboardDay.textContent=now.toLocaleDateString(undefined,{weekday:'long'});dashboardDate.textContent=now.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});dashboardClock.textContent=now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',second:'2-digit'});updateDashboardSchedule(now);updateDashboardSync();updateDashboardClassSummary();
}
if(dashboardClassSelect)dashboardClassSelect.addEventListener('change',()=>{localStorage.setItem('glnDashboardClassId',dashboardClassSelect.value);resetDashboardPicker();updateDashboardClassSummary()});
if(dashboardPickStudent)dashboardPickStudent.addEventListener('click',pickDashboardStudent);
if(dashboardResetPicker)dashboardResetPicker.addEventListener('click',()=>resetDashboardPicker());
if(dashboardOpenSeating)dashboardOpenSeating.addEventListener('click',()=>{const id=dashboardClassSelect?.value;setCalculatorMode('seating');setTimeout(()=>{if(id)window.selectSeatingClassById?.(id);window.renderSeatingChart?.()},0)});
if(dashboardLoadWheel)dashboardLoadWheel.addEventListener('click',()=>{const id=dashboardClassSelect?.value;setCalculatorMode('wheel');setTimeout(()=>{refreshWheelSeatingClasses();const select=document.querySelector('#wheelSeatingClass');if(select&&id){select.value=id;localStorage.setItem('glnWheelSeatingClass',id)}document.querySelector('#loadWheelSeatingClass')?.click()},0)});
document.querySelectorAll('[data-dashboard-tool]').forEach(button=>button.addEventListener('click',()=>{const tool=button.dataset.dashboardTool;if(tool==='quiz')openQuiz();else setCalculatorMode(tool)}));
window.addEventListener('gln:seating-classes-updated',()=>{refreshDashboardClasses();updateClassroomDashboard()});
setTimeout(()=>{refreshDashboardClasses();updateClassroomDashboard()},0);setInterval(()=>{if(dashboardPanel&&!dashboardPanel.hidden)updateClassroomDashboard()},1000);

const wheelCanvas=document.querySelector('#randomWheel');
const wheelTogglePanel=document.querySelector('#wheelTogglePanel');
const wheelControls=document.querySelector('#wheelControls');
const wheelContext=wheelCanvas.getContext('2d');
const wheelEntries=document.querySelector('#wheelEntries');
const wheelResults=document.querySelector('#wheelResults');
const wheelWinner=document.querySelector('#wheelWinner');
const wheelWinnerName=document.querySelector('#wheelWinnerName');
const wheelSpinTime=document.querySelector('#wheelSpinTime');
const wheelSeatingClass=document.querySelector('#wheelSeatingClass');
const loadWheelSeatingClass=document.querySelector('#loadWheelSeatingClass');
const wheelClassSourceStatus=document.querySelector('#wheelClassSourceStatus');
const wheelColors=['#2563eb','#ef476f','#06b6d4','#f59e0b','#8b5cf6','#22c55e','#f97316','#ec4899','#0ea5e9','#14b8a6','#6366f1','#eab308'];
let wheelRotation=0,wheelSpinning=false,lastWheelWinner='',wheelHistory=[];
const legacyWheelSample=['Alex','Maria','Saw Htoo','Naw Paw','Jordan','Taylor'].join('\n');
const savedWheelEntries=localStorage.getItem('glnWheelEntries');
if(savedWheelEntries===legacyWheelSample){localStorage.removeItem('glnWheelEntries');wheelEntries.value=''}
else if(savedWheelEntries)wheelEntries.value=savedWheelEntries;
const savedWheelSpinTime=localStorage.getItem('glnWheelSpinTime');
if(savedWheelSpinTime&&wheelSpinTime.querySelector(`option[value="${savedWheelSpinTime}"]`))wheelSpinTime.value=savedWheelSpinTime;
function seatingClassListsForWheel(){
  if(typeof window.getSeatingClassLists==='function'){
    try{return window.getSeatingClassLists()}catch{}
  }
  try{
    const saved=JSON.parse(localStorage.getItem('glnSeatingClasses')||'null');
    return Array.isArray(saved?.classes)?saved.classes.map(item=>({id:String(item.id||''),className:String(item.className||'My Class'),roster:Array.isArray(item.roster)?item.roster:[]})):[];
  }catch{return []}
}
function refreshWheelSeatingClasses(){
  if(!wheelSeatingClass)return;
  const previous=wheelSeatingClass.value||localStorage.getItem('glnWheelSeatingClass')||'';
  const classes=seatingClassListsForWheel().filter(item=>item?.id&&Array.isArray(item.roster));
  wheelSeatingClass.innerHTML='<option value="">Choose a class…</option>';
  classes.forEach(item=>{
    const option=new Option(`${item.className} (${item.roster.length})`,item.id);
    wheelSeatingClass.add(option);
  });
  if(classes.some(item=>item.id===previous))wheelSeatingClass.value=previous;
  loadWheelSeatingClass.disabled=!classes.length;
  if(!classes.length)wheelClassSourceStatus.textContent='No saved Seating Chart classes yet. Create a class in Seating Chart first.';
  else if(!wheelSeatingClass.value)wheelClassSourceStatus.textContent=`${classes.length} saved class${classes.length===1?'':'es'} available.`;
  else{
    const selected=classes.find(item=>item.id===wheelSeatingClass.value);
    wheelClassSourceStatus.textContent=selected?`${selected.roster.length} student${selected.roster.length===1?'':'s'} in ${selected.className}.`:`${classes.length} saved classes available.`;
  }
}
function loadSelectedSeatingClassToWheel(){
  const classes=seatingClassListsForWheel(),selected=classes.find(item=>item.id===wheelSeatingClass.value);
  if(!selected){showToast('Choose a Seating Chart class first');return}
  const names=selected.roster.map(name=>String(name||'').trim()).filter(Boolean).slice(0,100);
  if(!names.length){showToast(`${selected.className} has no student names yet`);return}
  wheelEntries.value=names.join('\n');
  localStorage.setItem('glnWheelSeatingClass',selected.id);
  saveAndDrawWheel();
  wheelHistory=[];renderWheelHistory();
  wheelClassSourceStatus.textContent=`Loaded ${names.length} student${names.length===1?'':'s'} from ${selected.className}.`;
  showToast(`Loaded ${selected.className} onto the wheel`);
}
function currentWheelEntries(){
  let entries=wheelEntries.value.split(/\r?\n/).map(item=>item.trim()).filter(Boolean).slice(0,100);
  if(document.querySelector('#wheelNoDuplicates').checked)entries=[...new Set(entries)];
  return entries;
}
function shortenedWheelText(text){const points=Array.from(text);return points.length>18?`${points.slice(0,17).join('')}…`:text}
function drawWheel(){
  const size=Math.max(280,Math.min(640,wheelCanvas.clientWidth||640));
  const ratio=Math.min(window.devicePixelRatio||1,2);
  wheelCanvas.width=Math.round(size*ratio);wheelCanvas.height=Math.round(size*ratio);
  wheelContext.setTransform(ratio,0,0,ratio,0,0);
  const center=size/2,radius=center-12,entries=currentWheelEntries();
  wheelContext.clearRect(0,0,size,size);
  if(!entries.length){wheelContext.beginPath();wheelContext.arc(center,center,radius,0,Math.PI*2);wheelContext.fillStyle='#dfe8f3';wheelContext.fill();wheelContext.fillStyle='#526075';wheelContext.font='800 18px Inter, sans-serif';wheelContext.textAlign='center';wheelContext.fillText('Add items to begin',center,center);return}
  const arc=Math.PI*2/entries.length;
  wheelContext.save();wheelContext.translate(center,center);wheelContext.rotate(wheelRotation);
  entries.forEach((entry,index)=>{
    const start=index*arc,end=start+arc;
    wheelContext.beginPath();wheelContext.moveTo(0,0);wheelContext.arc(0,0,radius,start,end);wheelContext.closePath();wheelContext.fillStyle=wheelColors[index%wheelColors.length];wheelContext.fill();wheelContext.strokeStyle='rgba(255,255,255,.78)';wheelContext.lineWidth=2;wheelContext.stroke();
    wheelContext.save();wheelContext.rotate(start+arc/2);wheelContext.fillStyle='#fff';wheelContext.font=`800 ${entries.length>20?11:entries.length>12?13:16}px Inter, "Noto Sans Myanmar", sans-serif`;wheelContext.textAlign='right';wheelContext.textBaseline='middle';wheelContext.shadowColor='rgba(0,0,0,.28)';wheelContext.shadowBlur=2;wheelContext.fillText(shortenedWheelText(entry),radius-20,0);wheelContext.restore();
  });
  wheelContext.restore();
  wheelContext.beginPath();wheelContext.arc(center,center,58,0,Math.PI*2);wheelContext.fillStyle='#fff';wheelContext.fill();
}
function randomWheelIndex(max){if(window.crypto?.getRandomValues){const values=new Uint32Array(1);window.crypto.getRandomValues(values);return values[0]%max}return Math.floor(Math.random()*max)}
function showWheelResult(name){
  lastWheelWinner=name;wheelWinnerName.textContent=name;wheelWinner.hidden=false;
  wheelHistory.unshift(name);wheelHistory=wheelHistory.slice(0,50);renderWheelHistory();
  const colors=wheelColors;document.querySelector('#wheelConfetti').innerHTML=Array.from({length:42},(_,index)=>`<i style="--left:${(index*37)%101}%;--delay:-${(index%9)*.17}s;--duration:${2.4+(index%7)*.2}s;--turn:${index*29}deg;--confetti:${colors[index%colors.length]}"></i>`).join('');
}
function renderWheelHistory(){
  wheelResults.innerHTML='';
  if(!wheelHistory.length){const item=document.createElement('li');item.textContent='No results yet';wheelResults.appendChild(item);return}
  wheelHistory.forEach(name=>{const item=document.createElement('li');item.textContent=name;wheelResults.appendChild(item)});
}
function spinRandomWheel(){
  const entries=currentWheelEntries();if(!entries.length||wheelSpinning){if(!entries.length)showToast('Add at least one item');return}
  wheelSpinning=true;document.querySelector('#spinWheel').disabled=true;
  const spinSeconds=Math.max(1,Math.min(10,Number(wheelSpinTime.value)||1)),winnerIndex=randomWheelIndex(entries.length),arc=Math.PI*2/entries.length,target=-(winnerIndex+.5)*arc,twoPi=Math.PI*2,current=((wheelRotation%twoPi)+twoPi)%twoPi,normalizedTarget=((target%twoPi)+twoPi)%twoPi,delta=(normalizedTarget-current+twoPi)%twoPi,start=wheelRotation,end=start+twoPi*(4+Math.ceil(spinSeconds*.8)+randomWheelIndex(2))+delta,duration=spinSeconds*1000,startTime=performance.now();
  function animate(now){const progress=Math.min(1,(now-startTime)/duration),eased=1-Math.pow(1-progress,4);wheelRotation=start+(end-start)*eased;drawWheel();if(progress<1)requestAnimationFrame(animate);else{wheelRotation=end%twoPi;wheelSpinning=false;document.querySelector('#spinWheel').disabled=false;showWheelResult(entries[winnerIndex])}}
  requestAnimationFrame(animate);
}
function saveAndDrawWheel(){
  localStorage.setItem('glnWheelEntries',wheelEntries.value);drawWheel();
  if(!window.__classroomToolsApplyingCloud)window.queueClassroomToolsCloudSync?.();
}
document.querySelector('#spinWheel').onclick=spinRandomWheel;
loadWheelSeatingClass.onclick=loadSelectedSeatingClassToWheel;
wheelSeatingClass.onchange=()=>{localStorage.setItem('glnWheelSeatingClass',wheelSeatingClass.value);refreshWheelSeatingClasses();if(!window.__classroomToolsApplyingCloud)window.queueClassroomToolsCloudSync?.()};
window.addEventListener('gln:seating-classes-updated',refreshWheelSeatingClasses);
wheelCanvas.onclick=spinRandomWheel;
wheelEntries.oninput=saveAndDrawWheel;
document.querySelector('#wheelNoDuplicates').onchange=drawWheel;
wheelSpinTime.onchange=()=>{localStorage.setItem('glnWheelSpinTime',wheelSpinTime.value);if(!window.__classroomToolsApplyingCloud)window.queueClassroomToolsCloudSync?.()};
document.querySelector('#shuffleWheel').onclick=()=>{const entries=currentWheelEntries();for(let i=entries.length-1;i>0;i--){const j=randomWheelIndex(i+1);[entries[i],entries[j]]=[entries[j],entries[i]]}wheelEntries.value=entries.join('\n');saveAndDrawWheel()};
document.querySelector('#clearWheel').onclick=()=>{wheelEntries.value='';saveAndDrawWheel();wheelEntries.focus()};
document.querySelector('#clearWheelResults').onclick=()=>{wheelHistory=[];renderWheelHistory()};
document.querySelector('#keepWheelWinner').onclick=()=>{wheelWinner.hidden=true};
document.querySelector('#removeWheelWinner').onclick=()=>{const entries=wheelEntries.value.split(/\r?\n/),index=entries.findIndex(item=>item.trim()===lastWheelWinner);if(index>=0)entries.splice(index,1);wheelEntries.value=entries.join('\n').replace(/^\s+|\s+$/g,'');saveAndDrawWheel();wheelWinner.hidden=true};
wheelTogglePanel.onclick=()=>{
  const collapsed=wheelPanel.classList.toggle('controls-collapsed');
  wheelTogglePanel.textContent=collapsed?'Show panel':'Hide panel';
  wheelTogglePanel.setAttribute('aria-expanded',String(!collapsed));
  if(wheelControls)wheelControls.setAttribute('aria-hidden',String(collapsed));
  requestAnimationFrame(()=>{drawWheel();setTimeout(drawWheel,180)});
};
document.querySelector('#wheelFullscreen').onclick=()=>{if(!document.fullscreenElement)wheelPanel.requestFullscreen?.();else document.exitFullscreen?.()};
window.addEventListener('resize',()=>{if(!wheelPanel.hidden)drawWheel()});
refreshWheelSeatingClasses();
drawWheel();

// Shared Classroom Tools cloud-sync payload. Seating Chart owns the account connection;
// persistent data from other tools is supplied here so one Google account can sync them together.
window.getClassroomToolsSyncData=()=>({
  version:1,
  schedules:classroomSchedules.map(item=>JSON.parse(JSON.stringify(item))),
  wheel:{
    entries:wheelEntries.value,
    spinTime:wheelSpinTime.value,
    seatingClass:wheelSeatingClass.value
  }
});
window.applyClassroomToolsSyncData=data=>{
  if(!data||typeof data!=='object')return;
  window.__classroomToolsApplyingCloud=true;
  try{
    if(Array.isArray(data.schedules)){
      const result=migrateStoredSchedules(data.schedules);
      classroomSchedules=result.items;
      localStorage.setItem(SCHEDULE_TIMER_STORAGE_KEY,JSON.stringify(classroomSchedules));
      renderScheduleTimers();updateScheduleTimerClock();
    }
    if(data.wheel&&typeof data.wheel==='object'){
      if(typeof data.wheel.entries==='string'){wheelEntries.value=data.wheel.entries;localStorage.setItem('glnWheelEntries',data.wheel.entries)}
      if(data.wheel.spinTime!==undefined){wheelSpinTime.value=String(data.wheel.spinTime);localStorage.setItem('glnWheelSpinTime',wheelSpinTime.value)}
      if(typeof data.wheel.seatingClass==='string')localStorage.setItem('glnWheelSeatingClass',data.wheel.seatingClass);
      refreshWheelSeatingClasses();drawWheel();
    }
  }finally{window.__classroomToolsApplyingCloud=false}
};

function closeCalculator(){
  calculatorView.hidden=true;
  navTools.classList.remove('active');
  document.body.classList.remove('calculator-open');
}
function openCalculator(mode='dashboard'){
  typeView.hidden=true;
  practiceView.hidden=true;
  gamesView.hidden=true;
  quizView.hidden=true;
  calculatorView.hidden=false;
  navType.classList.remove('active');
  navPractice.classList.remove('active');
  navGames.classList.remove('active');
  navTools.classList.add('active');
  document.querySelector('#classroomToolSwitch').hidden=false;
  calculatorEyebrow.textContent='GLN CLASSROOM TOOLS';
  setCalculatorMode(mode);
  document.body.classList.add('calculator-open');
  if(typeof stopGame==='function')stopGame();
  if(typeof closeRace==='function')closeRace();
  window.scrollTo({top:0,behavior:'smooth'});
}
navTools.onclick=()=>openCalculator('dashboard');
navType.addEventListener('click',closeCalculator);
navPractice.addEventListener('click',closeCalculator);
navGames.addEventListener('click',closeCalculator);
