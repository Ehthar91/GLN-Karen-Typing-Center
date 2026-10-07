
/* ---------------------------
   THEME / DARK MODE
---------------------------- */
const KLGA_THEME_KEY='klgaTheme';

function applyTheme(theme){
  const value=theme==='dark'?'dark':'light';
  document.documentElement.setAttribute('data-theme',value);

  if(window.themeToggleText){
    themeToggleText.textContent=value==='dark'?'Light Mode':'Dark Mode';
  }
  if(window.themeToggleIcon){
    themeToggleIcon.textContent=value==='dark'?'☀':'☾';
  }
  if(window.themeToggleBtn){
    themeToggleBtn.setAttribute(
      'aria-label',
      value==='dark'?'Switch to light mode':'Switch to dark mode'
    );
  }
}

function initialTheme(){
  const saved=localStorage.getItem(KLGA_THEME_KEY);
  if(saved==='dark' || saved==='light') return saved;

  if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){
    return 'dark';
  }
  return 'light';
}

applyTheme(initialTheme());

document.addEventListener('DOMContentLoaded',()=>{
  applyTheme(initialTheme());

  if(window.themeToggleBtn){
    themeToggleBtn.onclick=()=>{
      const current=document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light';
      const next=current==='dark'?'light':'dark';
      localStorage.setItem(KLGA_THEME_KEY,next);
      applyTheme(next);
    };
  }
});


/* ---------------------------
   FIREBASE BRIDGE
   Uses window.KLGAFirebase when firebase-app.js is configured.
   Falls back to localStorage when Firebase is unavailable.
---------------------------- */

async function fbReady(){
  // firebase-app.js is a module and may finish a moment after app.js.
  // Wait briefly so we do not accidentally fall back to localStorage.
  for(let i=0;i<50;i++){
    if(window.KLGAFirebase){
      return !!window.KLGAFirebase.ready;
    }
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  return false;
}


async function cloudSignInTeacher(){
  if(!(await fbReady())) throw new Error("Firebase is not ready.");
  return await window.KLGAFirebase.signInTeacher();
}

async function cloudTeacherAuthorized(){
  if(!(await fbReady())) return false;
  return await window.KLGAFirebase.isAuthorizedTeacher();
}

async function cloudEnsureStudentAuth(){
  if(!(await fbReady())) throw new Error("Firebase is not ready.");
  return await window.KLGAFirebase.ensureStudentAuth();
}

async function cloudSignOut(){
  if(await fbReady()) return await window.KLGAFirebase.signOut();
}

function cloudCurrentUser(){
  return window.KLGAFirebase?.currentUser?.() || null;
}

async function cloudLoadRoster(){
  if(await fbReady()) return await window.KLGAFirebase.getRoster();
  return loadRoster();
}

async function cloudSaveStudent(student){
  if(await fbReady()) return await window.KLGAFirebase.saveStudent(student);
  const roster=loadRoster();
  const i=roster.findIndex(s=>s.key===student.key);
  if(i>=0) roster[i]=student; else roster.push(student);
  saveRoster(roster);
}

async function cloudDeleteStudent(key){
  if(await fbReady()) return await window.KLGAFirebase.deleteStudent(key);
  saveRoster(loadRoster().filter(s=>s.key!==key));
}

async function cloudLoadSessions(){
  if(await fbReady()) return await window.KLGAFirebase.getSessions();
  return loadSessions();
}

async function cloudSaveSession(session){
  if(await fbReady()) return await window.KLGAFirebase.saveSession(session);
  const sessions=await cloudLoadSessions();
  const i=sessions.findIndex(s=>s.key===session.key);
  if(i>=0) sessions[i]=session; else sessions.push(session);
  saveSessions(sessions);
}

async function cloudDeleteSession(key){
  if(await fbReady()) return await window.KLGAFirebase.deleteSession(key);
  saveSessions(loadSessions().filter(s=>s.key!==key));
}

async function cloudSaveResult(result){
  if(await fbReady()) return await window.KLGAFirebase.saveResult(result);
  const saved=JSON.parse(localStorage.getItem('klgaFiveLevelResults')||'[]');
  saved.push(result);
  localStorage.setItem('klgaFiveLevelResults',JSON.stringify(saved));
}

async function cloudLoadResults(){
  if(await fbReady() && window.KLGAFirebase.getResults){
    return await window.KLGAFirebase.getResults();
  }
  return JSON.parse(localStorage.getItem('klgaFiveLevelResults')||'[]');
}

async function cloudSubscribeResults(callback){
  if(await fbReady() && window.KLGAFirebase.subscribeResults){
    return window.KLGAFirebase.subscribeResults(callback);
  }
  callback(JSON.parse(localStorage.getItem('klgaFiveLevelResults')||'[]'));
  return ()=>{};
}

async function cloudClearResults(){
  if(await fbReady() && window.KLGAFirebase.clearResults){
    return await window.KLGAFirebase.clearResults();
  }
  localStorage.removeItem('klgaFiveLevelResults');
}

async function cloudClearGradeResults(year,season,grade){
  const all=await cloudLoadResults();
  const targets=all.filter(x=>
    schoolYearFromResult(x)===year &&
    seasonFromResult(x)===season &&
    String(x.grade||'Unknown')===String(grade)
  );

  if(!targets.length) return 0;

  if(await fbReady() && window.KLGAFirebase.deleteResults){
    const ids=targets.map(x=>x.key).filter(Boolean);
    if(ids.length!==targets.length){
      throw new Error('One or more Firebase results are missing document IDs.');
    }
    await window.KLGAFirebase.deleteResults(ids);
    return targets.length;
  }

  const kept=all.filter(x=>!(
    schoolYearFromResult(x)===year &&
    seasonFromResult(x)===season &&
    String(x.grade||'Unknown')===String(grade)
  ));
  localStorage.setItem('klgaFiveLevelResults',JSON.stringify(kept));
  return targets.length;
}


async function cloudJoinSession(name,password){
  if(await fbReady()) return await window.KLGAFirebase.findActiveSession(name,password);
  const sessions=await cloudLoadSessions();
  return sessions.find(s=>s.status==='Active' && s.name===name && s.password===password) || null;
}

async function cloudSetStudentJoin(sessionKey,studentKey,status){
  if(await fbReady()) return await window.KLGAFirebase.setStudentStatus(sessionKey,studentKey,status);
  return true;
}

async function cloudSubscribeStudentStatus(sessionKey,studentKey,callback){
  if(await fbReady() && window.KLGAFirebase.subscribeStudentStatus){
    return window.KLGAFirebase.subscribeStudentStatus(sessionKey,studentKey,callback);
  }
  return ()=>{};
}

async function cloudSubscribeSessionStudents(sessionKey,callback){
  if(await fbReady() && window.KLGAFirebase.subscribeSessionStudents){
    return window.KLGAFirebase.subscribeSessionStudents(sessionKey,callback);
  }
  return ()=>{};
}


function localProgressKey(sessionKey,studentKey){
  return `klgaTestProgress:${sessionKey}:${studentKey}`;
}

async function cloudSaveStudentProgress(sessionKey,studentKey,progress){
  if(await fbReady() && window.KLGAFirebase.saveStudentProgress){
    return await window.KLGAFirebase.saveStudentProgress(sessionKey,studentKey,progress);
  }
  localStorage.setItem(localProgressKey(sessionKey,studentKey),JSON.stringify(progress));
}

async function cloudLoadStudentProgress(sessionKey,studentKey){
  if(await fbReady() && window.KLGAFirebase.getStudentProgress){
    return await window.KLGAFirebase.getStudentProgress(sessionKey,studentKey);
  }
  try{
    return JSON.parse(localStorage.getItem(localProgressKey(sessionKey,studentKey))||'null');
  }catch(err){
    return null;
  }
}

async function cloudClearStudentProgress(sessionKey,studentKey){
  if(await fbReady() && window.KLGAFirebase.clearStudentProgress){
    return await window.KLGAFirebase.clearStudentProgress(sessionKey,studentKey);
  }
  localStorage.removeItem(localProgressKey(sessionKey,studentKey));
}

async function cloudSetSessionStudentRunState(sessionKey,status){
  if(await fbReady() && window.KLGAFirebase.setSessionStudentRunState){
    return await window.KLGAFirebase.setSessionStudentRunState(sessionKey,status);
  }
}


async function cloudSetStudentTestControl(sessionKey,studentKey,action){
  if(await fbReady() && window.KLGAFirebase.setStudentTestControl){
    return await window.KLGAFirebase.setStudentTestControl(sessionKey,studentKey,action);
  }

  // Local-only fallback cannot push a live control action across devices.
  // It still clears locally saved progress for terminate when applicable.
  if(action==='terminate'){
    localStorage.removeItem(localProgressKey(sessionKey,studentKey));
  }
  return null;
}



const consonants=[
{l:'က',s:'Ka'},{l:'ခ',s:'Ka'},{l:'ဂ',s:'Ga'},{l:'ဃ',s:'Kha'},{l:'င',s:'Ngah'},{l:'စ',s:'Sa'},{l:'ဆ',s:'Cha'},{l:'ရှ',s:'Sha'},{l:'ည',s:'Nya'},{l:'တ',s:'Ta'},{l:'ထ',s:'Ta'},{l:'ဒ',s:'Da'},{l:'န',s:'Na'},{l:'ပ',s:'Pa'},{l:'ဖ',s:'Pa'},{l:'ဘ',s:'Ba'},{l:'မ',s:'Ma'},{l:'ယ',s:'Ya'},{l:'ရ',s:'Ra'},{l:'လ',s:'La'},{l:'ဝ',s:'Wa'},{l:'သ',s:'Tha'},{l:'ဟ',s:'Ha'},{l:'အ',s:'Ah'},{l:'ဧ',s:'Ahh'}
];
const vowels=[{v:'ါ',s:'Ah'},{v:'ံ',s:'Ee'},{v:'ၢ',s:'Uh'},{v:'ု',s:'Eu'},{v:'ူ',s:'Oo'},{v:'့',s:'Ay/Ae'},{v:'ဲ',s:'Eh'},{v:'ိ',s:'Oe'},{v:'ီ',s:'Aw'}];
const blends=[{m:'ၠ',s:'Ya',suffix:'y'},{m:'ြ',s:'Ra',suffix:'r'},{m:'ျ',s:'La',suffix:'l'},{m:'ွ',s:'Wa',suffix:'w'},{m:'ှ',s:'Ga',suffix:'g'}];
const tones=[{m:'ၢ်',n:'Uh Thee'},{m:'ာ်',n:'Ah Thee'},{m:'ၣ်',n:'Ha Thee'},{m:'း',n:'Pluh See'},{m:'ၤ',n:'Kay Poe'}];

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function pct(rows){return rows.length?Math.round(rows.filter(r=>r.correct).length/rows.length*100):0}
function wrong(arr,ans,n=3){return shuffle(arr.filter(x=>x!==ans)).slice(0,n)}

function stemFromSound(s){
 if(s==='Ahh') return 'Ahh';
 if(s.endsWith('ah')) return s.slice(0,-2);
 if(s.endsWith('a')) return s.slice(0,-1);
 return s;
}

function blendPronunciation(c,b){
 const written=c.l+b.m;
 const exceptions={
   'ကၠ':'Ja',
   'ခၠ':'Cha',
   'ကြ':'Kra'
 };
 if(exceptions[written]) return exceptions[written];

 let stem=stemFromSound(c.s);

 if(c.l==='အ'){
   return {'ၠ':'Aya','ြ':'Ara','ျ':'Ala','ွ':'Awa','ှ':'Aga'}[b.m];
 }
 if(c.l==='ဧ'){
   return {'ၠ':'Ahhya','ြ':'Ahhra','ျ':'Ahhla','ွ':'Ahhwa','ှ':'Ahhga'}[b.m];
 }

 const cluster={'ၠ':'y','ြ':'r','ျ':'l','ွ':'w','ှ':'g'}[b.m];
 return stem+cluster+'a';
}

const cvBank=[];consonants.forEach(c=>vowels.forEach(v=>cvBank.push({w:c.l+v.v,s:(()=>{let stem=stemFromSound(c.s);if(c.l==='အ')return{'Ah':'Ah','Ee':'Ee','Uh':'Uh','Eu':'Eu','Oo':'Oo','Ay/Ae':'Ay','Eh':'Eh','Oe':'Oe','Aw':'Aw'}[v.s];if(c.l==='ဧ')return{'Ah':'Ahh','Ee':'Eeh','Uh':'Uhh','Eu':'Euh','Oo':'Ooh','Ay/Ae':'Ayy','Eh':'Ehh','Oe':'Oeh','Aw':'Aww'}[v.s];return{'Ah':stem+'ah','Ee':stem+'ee','Uh':stem+'uh','Eu':stem+'eu','Oo':stem+'oo','Ay/Ae':stem+'ay','Eh':stem+'eh','Oe':stem+'oe','Aw':stem+'aw'}[v.s]})(),c,v})));
const blendBank=[
{w:"ကၠ",s:"Ja"},
{w:"ကြ",s:"Kra"},
{w:"ကျ",s:"Kla"},
{w:"ကွ",s:"Kwa"},
{w:"ခၠ",s:"Cha"},
{w:"ခြ",s:"Khra"},
{w:"ချ",s:"Khla"},
{w:"ခွ",s:"Khwa"},
{w:"ဃြ",s:"Khra"},
{w:"ဃွ",s:"Khwa"},
{w:"ဆှ",s:"Chga"},
{w:"တြ",s:"Tra"},
{w:"တွ",s:"Twa"},
{w:"ထြ",s:"Tra"},
{w:"ထွ",s:"Twa"},
{w:"ထှ",s:"Tga"},
{w:"ဒြ",s:"Dra"},
{w:"ဒွ",s:"Dwa"},
{w:"ပၠ",s:"Pya"},
{w:"ပြ",s:"Pra"},
{w:"ပျ",s:"Pla"},
{w:"ပွ",s:"Pwa"},
{w:"ပှ",s:"Pga"},
{w:"ဖၠ",s:"Pya"},
{w:"ဖြ",s:"Pra"},
{w:"ဖျ",s:"Pla"},
{w:"ဖွ",s:"Pwa"},
{w:"ဖှ",s:"Pga"},
{w:"ဘၠ",s:"Bya"},
{w:"ဘြ",s:"Bra"},
{w:"ဘျ",s:"Bla"},
{w:"ဘွ",s:"Bwa"},
{w:"ဘှ",s:"Bga"},
{w:"မၠ",s:"Mya"},
{w:"မြ",s:"Mra"},
{w:"မျ",s:"Mla"},
{w:"မွ",s:"Mwa"},
{w:"မှ",s:"Mga"},
{w:"ယွ",s:"Ywa"},
{w:"လွ",s:"Lwa"},
{w:"သြ",s:"Thra"},
{w:"သျ",s:"Thla"},
{w:"သွ",s:"Thwa"},
{w:"ဟွ",s:"Hwa"}
];
const k8WrittenBank=["ကျိ", "ကျီ", "ကျဲ", "ကျ့", "ကြီ", "ကၠါ", "ကၠိ", "ကၠံ", "ကၠၢ", "ချံ", "ချ့", "ခြါ", "ခွံ", "ခၠီ", "ဆှီ", "ဆှု", "ဆှဲ", "တြီ", "ထွဲ", "ပျီ", "ပျဲ", "ပြါ", "ပြိ", "ပြု", "ပြံ", "ပၠါ", "ဖျိ", "ဖျီ", "ဖျ့", "ဖှီ", "ဖှံ", "ဖၠါ", "ဘှီ", "ဘှဲ", "ဘှ့", "ဘှၢ", "ဘၠူ", "မှဲ", "မှံ", "မၠီ"];



function splitK8Written(w){
 const vowelSymbols=vowels.map(v=>v.v).sort((a,b)=>b.length-a.length);
 for(const v of vowelSymbols){
   if(w.endsWith(v)){
     return {blend:w.slice(0,-v.length), vowel:v};
   }
 }
 return null;
}

function k8SoundFromWritten(w){
 const parts=splitK8Written(w);
 if(!parts) return '';
 const blend=blendBank.find(x=>x.w===parts.blend);
 const vowel=vowels.find(x=>x.v===parts.vowel);
 if(!blend || !vowel) return '';

 let stem=blend.s;
 if(stem.endsWith('ah')) stem=stem.slice(0,-2);
 else if(stem.endsWith('a')) stem=stem.slice(0,-1);

 const endings={
   'Ah':'ah','Ee':'ee','Uh':'uh','Eu':'eu','Oo':'oo',
   'Ay/Ae':'ay','Eh':'eh','Oe':'oe','Aw':'aw'
 };
 return stem + endings[vowel.s];
}

const k8Bank=k8WrittenBank.map(w=>({w:w,s:k8SoundFromWritten(w)})).filter(x=>x.s);
const k9Bank=[{"phrase": "ယမၤလိတၢ်လၢဖုသၣ်ဖၠူၣ်ကၠိ", "sound": "Yer Ma Loe Ta Luh Peu Tha Pyoo Joe"}, {"phrase": "ယကၠိခိၣ်မ့ၢ်သရၣ်ကၠိစဲး", "sound": "Yer Joe Koe May Ther Ra Joe Seh"}, {"phrase": "အဝဲအိၣ်လၢဝ့ၢ်မၠီမၠး", "sound": "Ah Weh Oe Luh Way Mya Mya"}, {"phrase": "အပါမံၤလၢစီၤဖါကၠါ", "sound": "Ah Pah Mee Luh Saw Pah Jah"}, {"phrase": "ဖါတံၢ်ဆါနၤပၠါလၢဖၠါပူၤ", "sound": "Pah Tee Chah Na Pyah Luh Pyah Poo"}, {"phrase": "မီၣ်လမၠဲၣ်အိၣ်ဘူးဒီးဘလူကၠိ", "sound": "Maw Ler Myeh Oe Boo Daw Ber Loo Joe"}, {"phrase": "ပတ့အီၣ်ကိၣ်ဒီးဘုကၠူၣ်ကမူၣ်", "sound": "Per Tay Aw Koe Daw Beu Joo Ker Moo"}, {"phrase": "နီၢ်ဘၠူလၣ်လဲၤဆူဖၠါပူၤ", "sound": "Naw Byoo Lah Leh Choo Pyah Poo"}, {"phrase": "ဘီကီးမ့ၢ်ကၠီၣ်တဲၣ်ဝ့ၢ်ခိၣ်", "sound": "Baw Kaw May Jaw Teh Way Koe"}, {"phrase": "ယကထီၣ်ဖၠၣ်စိမိၤကၠိ", "sound": "Yer Ker Taw Pya Soe Moe Joe"}, {"phrase": "မၠ့းကၠံနါမ့ၢ်ကခၠ့ၣ်ဝ့ၢ်ခိၣ်", "sound": "Myay Jee Nah May Ker Chay Way Koe"}, {"phrase": "ကခၠ့ၣ်ကသံၣ်သွံၣ်န့ၣ်အမံၤဒိၣ်", "sound": "Ker Chay Ker Thee Thwee Nay Ah Mee Doe"}, {"phrase": "အပၠီးမ့ၢ်ဝဲခၠီကလုာ်တဂၤလီၤ", "sound": "Ah Pyaw May Weh Chaw Ker Leu Ter Ga Law"}, {"phrase": "ထိၣ်ကၠၢဖိစီၢ်လီၤလၢသ့ၣ်ခံ", "sound": "Toe Juh Poe Saw Law Luh Thay Kee"}, {"phrase": "ကၠၢမနံၣ်ဖိန့ၣ်ပကိးလၢကၠၢမဲလီၤ", "sound": "Juh Mer Nee Poe Nay Per Koe Luh Juh Meh Law"}, {"phrase": "ဘးအူကၠံအပၢ်မ့ၢ်ဖုသၣ်မၠးကၠံလီၤ", "sound": "Ba Oo Jee Ah Pa May Peu Tha Mya Jee Law"}, {"phrase": "တြီယၤတဂ့ၤ", "sound": "Traw Ya Ter Gay"}, {"phrase": "ယတမၤကြီတၢ်ဘၣ်", "sound": "Yer Ter Ma Kraw Ta Ba"}, {"phrase": "ယကြၢးမၤတၢ်ဂ့ၤလီၤ", "sound": "Yer Kruh Ma Ta Gay Law"}, {"phrase": "တလိၣ်ပတြၢၤယၤဘၣ်", "sound": "Ter Loe Per Truh Ya Ba"}, {"phrase": "ကးဘၢဃာ်ဆီအပဲတြီ", "sound": "Ka Buh Kha Chaw Ah Peh Traw"}, {"phrase": "လံာ်ကြီကြာ်ကထံၣ်ဘၣ်အီၤ", "sound": "Lee Kraw Kra Ker Tee Ba Aw"}, {"phrase": "တၢ်နၢသြီၣ်နၢမူဘၣ်ယၤ", "sound": "Ta Nuh Thraw Nuh Moo Ba Ya"}, {"phrase": "အဖီအိၣ်ပြံကဒံပြီးကဒီးပြး", "sound": "Ah Paw Oe Pree Ker Dee Praw Ker Daw Pra"}, {"phrase": "ပြုကလၤဟဲက့ၤဟဲက့ၤ", "sound": "Preu Ker La Heh Kay Heh Kay"}, {"phrase": "တဘၣ်အိၣ်ပြံပြါတဂ့ၤ", "sound": "Ter Ba Oe Pree Prah Ter Gay"}, {"phrase": "ထုးခြါထီၣ်နသးတစဲး", "sound": "Teu Khrah Taw Ner Tha Ter Seh"}, {"phrase": "ဟးအူပြိကလံၤဘၣ်ဒး", "sound": "Ha Oo Proe Ker Lee Ba Da"}, {"phrase": "နီၢ်ပြံလၣ်မံသါသီၣ်ခြီးခြီး", "sound": "Naw Pree La Mee Thah Thaw Khraw Khraw"}, {"phrase": "ထိၣ်သတြီၤနသးဒီးအီၤ", "sound": "Toe Ther Traw Ner Tha Daw Aw"}, {"phrase": "မုၢ်ဆဲးလီၤကပြုၢ်ကပြီၤ", "sound": "Meu Cheh Law Ker Preu Ker Praw"}, {"phrase": "ယအိၣ်လၢတၢ်ကြဲၢ်သဝီ", "sound": "Yer Oe Luh Ta Kreh Ther Waw"}, {"phrase": "ကျီပျီထီၣ်ကျဲတက့ၢ်", "sound": "Klaw Plaw Taw Kleh Ter Kay"}, {"phrase": "ပျီၤယုၢ်သၣ်ချံကဘၣ်နၤ", "sound": "Plaw Yeu Tha Khlee Ker Ba Na"}, {"phrase": "ကဟးဖျိးဘၣ်ဖုးကျဲ", "sound": "Ker Ha Ploe Ba Peu Kleh"}, {"phrase": "ခးတပျာ်ချံၣ်ပျၢ်သၢထံၣ်", "sound": "Ka Ter Pla Khlee Pla Thuh Tee"}, {"phrase": "ထီပျီာ်ဖီကဖျီအသး", "sound": "Taw Plaw Paw Ker Plaw Ah Tha"}, {"phrase": "ပျဲအကျဲယံၤယံၤတစဲး", "sound": "Pleh Ah Kleh Yee Yee Ter Seh"}, {"phrase": "ဟးပူၤဖျဲးနသးချ့ချ့", "sound": "Ha Poo Pleh Ner Tha Khlay Khlay"}, {"phrase": "အပျ့ၤတဘ့ၣ်စၢ်ဘျဲးဘျီး", "sound": "Ah Play Ter Bay Sa Bleh Blaw"}, {"phrase": "ဟးဖျ့ဖျိလၢကျဲပူၤဘၣ်ဒး", "sound": "Ha Play Ploe Luh Kleh Poo Ba Da"}, {"phrase": "ဝၣ်ဒ့ကဖျ့ဘၣ်ဖုးနမဲာ်ချံ", "sound": "Wa Day Ker Play Ba Peu Ner Meh Khlee"}, {"phrase": "ပျဲဂဲၤဖိသၣ်လၢပျဲၢ်စီၢ်ခိၣ်တဂ့ၤ", "sound": "Pleh Geh Poe Tha Luh Pleh Saw Koe Ter Gay"}, {"phrase": "ပျဲဟးအီၤဆူပျီပူၤတက့ၢ်", "sound": "Pleh Ha Aw Choo Plaw Poo Ter Kay"}, {"phrase": "ပျ့ၣ်ကျိပူၤညၣ်ပျာ်အိၣ်အါမး", "sound": "Play Kloe Poo Nya Pla Oe Ah Ma"}, {"phrase": "ချိၣ်ဟးတချ့အါအါဘၣ်", "sound": "Khloe Ha Ter Khlay Ah Ah Ba"}, {"phrase": "ယသးပျံၤမဲာ်တဲာ်ချဲးအါ", "sound": "Yer Tha Plee Meh Teh Khleh Ah"}, {"phrase": "ကျ့ထီၣ်ဃဲာ်ပကကျီဝၣ်", "sound": "Klay Taw Kheh Per Ker Klaw Wa"}, {"phrase": "ကွၢ်ဃုနကွါတက့ၢ်", "sound": "Kwa Kheu Ner Kwah Ter Kay"}, {"phrase": "ညၣ်ကွီမဲၢ်အိၣ်လၢကွံပူၤ", "sound": "Nya Kwaw Meh Oe Luh Kwee Poo"}, {"phrase": "ကွဲးကွံးကွးဟံၣ်ဒူၣ်တဂ့ၤ", "sound": "Kweh Kwee Kwa Hee Doo Ter Gay"}, {"phrase": "ကွံာ်ကွဲၢ်လဲၢ်ဘီလၢလၢၢ်တဂ့ၤ", "sound": "Kwee Kweh Leh Baw Luh Luh Ter Gay"}, {"phrase": "ကွၢ်သကွ့ၤတၢ်လၢနဃၢၤ", "sound": "Kwa Ther Kway Ta Luh Ner Khuh"}, {"phrase": "ကွဲးဟ့ၣ်ယုၢ်စံၣ်ညီၣ်ကွီၢ်အလံာ်", "sound": "Kweh Hay Yeu See Nyaw Kwaw Ah Lee"}, {"phrase": "လဲၤဟးကွၢ်ကီကွဲၢ်ကဘီလ့", "sound": "Leh Ha Kwa Kaw Kweh Ker Baw Lay"}, {"phrase": "ကွံာ်လီၤလၢၢ်ဆူကွံပူၤ", "sound": "Kwee Law Luh Choo Kwee Poo"}, {"phrase": "ခွဲပျီဟံၣ်ပူၤဒီးနီၣ်ခွဲ", "sound": "Khweh Plaw Hee Poo Daw Naw Khweh"}, {"phrase": "ကွၢ်ထွဲနဒ့မုၣ်ဂ့ၤဂ့ၤ", "sound": "Kwa Tweh Ner Day Meu Gay Gay"}, {"phrase": "ခွဲးခွးတၢ်ကပီာ်နၢၤနၢၤ", "sound": "Khweh Khwa Ta Ker Paw Nuh Nuh"}, {"phrase": "ခွံၣ်ယဲၤဖုဖျိးဝဲဒၣ်ယံၤမး", "sound": "Khwee Yeh Peu Ploe Weh Da Yee Ma"}, {"phrase": "စီၤဖါခွဲၣ်ဟးအခီၣ်ခွ့ခွီ", "sound": "Saw Pah Khweh Ha Ah Kaw Khway Khwaw"}, {"phrase": "ယတခွါလဲၤသးဝံၣ်ခွါယၢၢ်", "sound": "Yer Ter Khwah Leh Tha Wee Khwah Yuh"}, {"phrase": "ခွံခိၣ်ခွံနၢ်ဝံၤအီၣ်တကွံသၣ်", "sound": "Khwee Koe Khwee Na Wee Aw Ter Kwee Tha"}, {"phrase": "ယဒ့ဖိကွဲးကွ့ကွီယမဲာ်", "sound": "Yer Day Poe Kweh Kway Kwaw Yer Meh"}, {"phrase": "ပှိၢ်စှီၤဘှဲမ့ၢ်ကညီတကလုာ်ဃီ", "sound": "Pgoe Sgaw Bgeh May Ker Nyaw Ter Ker Leu Khaw"}, {"phrase": "ဟးကဘှၢဒ်သိးချိၣ်တဂ့ၤ", "sound": "Ha Ker Bguh Da Thoe Khloe Ter Gay"}, {"phrase": "နီၢ်သးဖှံဘှီထီၣ်အထၣ်", "sound": "Naw Tha Pgee Bgaw Taw Ah Ta"}, {"phrase": "ခွံထီၣ်ခိၣ်ကဆှဲကဆှီ", "sound": "Khwee Taw Koe Ker Chgeh Ker Chgaw"}, {"phrase": "ခ့ဘှ့အ့ၣ်ဖှီတၢ်ဖိညီၤ", "sound": "Kay Bgay Ay Pgaw Ta Poe Nyaw"}, {"phrase": "ဖှံလီၤန့ၢ်ထိၣ်ဖှံးဖိဆၣ်", "sound": "Pgee Law Nay Toe Pgee Poe Cha"}, {"phrase": "ဖှဲးသ့ၣ်ဖးဆှီအဟၢဖၢ", "sound": "Pgeh Thay Pa Chgaw Ah Huh Puh"}, {"phrase": "ကဆ့ၣ်နီၤအီၣ်မ့ၤဘှၢဘှၢ", "sound": "Ker Chay Naw Aw May Bguh Bguh"}, {"phrase": "မၤသီၣ်စှၢၢ်စှံးတဂ့ၤ", "sound": "Ma Thaw Sguh Sgee Ter Gay"}, {"phrase": "ဖါတံၢ်လဲၤပှ့ၤတကီၤဆံၣ်သၣ်", "sound": "Pah Tee Leh Pgay Ter Kaw Chee Tha"}, {"phrase": "ဆှဲးဆှုလီၤတဲာ်တၢၢ်နၢမှဲဒၢ", "sound": "Chgeh Chgeu Law Teh Tuh Nuh Mgeh Duh"}, {"phrase": "ဖုသးပှၢ်ကွၢ်ထွဲအလံၤ", "sound": "Peu Tha Pga Kwa Tweh Ah Lee"}, {"phrase": "ကမၢနဘှီတၢ်တမံၤ", "sound": "Ker Muh Ner Bgaw Ta Ter Mee"}, {"phrase": "ဘှီနဲသပှၢ်ပှၢ်တက့ၢ်", "sound": "Bgaw Neh Ther Pga Pga Ter Kay"}, {"phrase": "တၢ်ဘှံးသးကသါဘှၢဘှၢ", "sound": "Ta Bgee Tha Ker Thah Bguh Bguh"}, {"phrase": "နံၤကမှံပှဲၤဒီးသးဖှံ", "sound": "Nee Ker Mgee Pgeh Daw Tha Pgee"}];



function q(skill,domain,type,instruction,prompt,choices,correct,promptClass='',choiceClass=''){
 return{skill,domain,type,instruction,prompt,choices,answer:choices.indexOf(correct),promptClass,choiceClass}
}

/* ---------------------------
   QUESTION GENERATORS
   Each function returns a pool. The adaptive engine samples
   only the items it needs for the current level.
---------------------------- */

function makeK1Pool(){
 return shuffle(consonants).map(x=>{
   const ch=shuffle([x.l,...wrong(consonants.map(z=>z.l),x.l)]);
   return q('K1','Alphabet Recognition','recognition','Select the matching letter.',x.l,ch,x.l,'karen-large','karen');
 });
}

function makeK2Pool(){
 const out=[];
 consonants.forEach(x=>{
   const ss=[...new Set(consonants.map(z=>z.s))];
   let ch=shuffle([x.s,...wrong(ss,x.s)]);
   out.push(q('K2','Letter Sounds','letterToSound','What sound does this letter make?',x.l,ch,x.s,'karen-large',''));
   ch=shuffle([x.l,...wrong(consonants.map(z=>z.l),x.l)]);
   out.push(q('K2','Letter Sounds','soundToLetter','Which letter makes this sound?',x.s,ch,x.l,'','karen'));
 });
 return shuffle(out);
}

function makeK3Pool(){
 const out=[];
 vowels.forEach(x=>{
   let ch=shuffle([x.s,...wrong(vowels.map(z=>z.s),x.s)]);
   out.push(q('K3','Vowel Recognition','vowelToSound','What sound does this vowel make?',x.v,ch,x.s,'karen-large',''));
   ch=shuffle([x.v,...wrong(vowels.map(z=>z.v),x.v)]);
   out.push(q('K3','Vowel Recognition','soundToVowel','Which vowel makes this sound?',x.s,ch,x.v,'','karen'));
 });
 return shuffle(out);
}

function makeK4Pool(){
 const out=[];
 cvBank.forEach(x=>{
   const soundPool=[...new Set(cvBank.filter(z=>z.c.l===x.c.l).map(z=>z.s))];
   let ch=shuffle([x.s,...wrong(soundPool,x.s)]);
   out.push(q('K4','Alphabet + Vowel','writtenToSound','Read this combination.',x.w,ch,x.s,'karen-large',''));
   const writtenPool=cvBank.filter(z=>z.c.l===x.c.l).map(z=>z.w);
   ch=shuffle([x.w,...wrong(writtenPool,x.w)]);
   out.push(q('K4','Alphabet + Vowel','soundToWritten','Which written combination matches this sound?',x.s,ch,x.w,'','karen'));
 });
 return shuffle(out);
}

function makeK5Pool(){
 const out=[];
 tones.forEach(t=>{
   let ch=shuffle([t.m,...wrong(tones.map(x=>x.m),t.m)]);
   out.push(q('K5','Tone Recognition','identifyTone','Select the matching tone mark.',t.m,ch,t.m,'karen-large','karen'));
   ch=shuffle([t.n,...wrong(tones.map(x=>x.n),t.n)]);
   out.push(q('K5','Tone Recognition','toneToName','What is the name of this tone?',t.m,ch,t.n,'karen-large',''));
   ch=shuffle([t.m,...wrong(tones.map(x=>x.m),t.m)]);
   out.push(q('K5','Tone Recognition','nameToTone','Which tone mark is called "'+t.n+'"?',t.n,ch,t.m,'','karen'));
 });
 return shuffle(out);
}

function makeK6Pool(){
 const out=[];
 blends.forEach(b=>{
   let ch=shuffle([b.m,...wrong(blends.map(x=>x.m),b.m)]);
   out.push(q('K6','Blend Sound Recognition','identifyBlend','Select the matching blend symbol.',b.m,ch,b.m,'karen-large','karen'));
   ch=shuffle([b.s,...wrong(blends.map(x=>x.s),b.s)]);
   out.push(q('K6','Blend Sound Recognition','blendToSound','What sound does this blend symbol make?',b.m,ch,b.s,'karen-large',''));
   ch=shuffle([b.m,...wrong(blends.map(x=>x.m),b.m)]);
   out.push(q('K6','Blend Sound Recognition','soundToBlend','Which blend symbol makes this sound?',b.s,ch,b.m,'','karen'));
 });
 return shuffle(out);
}

function makeK7Pool(){
 const out=[];
 blendBank.forEach(x=>{
   const soundPool=[...new Set(blendBank.map(z=>z.s))];
   let ch=shuffle([x.s,...wrong(soundPool,x.s)]);
   out.push(q('K7','Alphabet + Blend','readBlend','Read this alphabet + blend combination.',x.w,ch,x.s,'karen-large',''));
   ch=shuffle([x.s,...wrong(soundPool,x.s)]);
   out.push(q('K7','Alphabet + Blend','pronunciation','Which is the correct pronunciation?',x.w,ch,x.s,'karen-large',''));
   const writtenPool=blendBank.map(z=>z.w);
   ch=shuffle([x.w,...wrong(writtenPool,x.w)]);
   out.push(q('K7','Alphabet + Blend','soundToWritten','Which written combination matches this sound?',x.s,ch,x.w,'','karen'));
 });
 return shuffle(out);
}

function makeK8Pool(){
 const out=[];
 k8Bank.forEach(x=>{
   const soundPool=[...new Set(k8Bank.map(z=>z.s))];
   let ch=shuffle([x.s,...wrong(soundPool,x.s)]);
   out.push(q('K8','Alphabet + Blend + Vowel','readABV','Read this alphabet + blend + vowel combination.',x.w,ch,x.s,'karen-large',''));
   ch=shuffle([x.s,...wrong(soundPool,x.s)]);
   out.push(q('K8','Alphabet + Blend + Vowel','pronunciationABV','Which is the correct pronunciation?',x.w,ch,x.s,'karen-large',''));
   const writtenPool=k8Bank.map(z=>z.w);
   ch=shuffle([x.w,...wrong(writtenPool,x.w)]);
   out.push(q('K8','Alphabet + Blend + Vowel','soundToWrittenABV','Which written combination matches this sound?',x.s,ch,x.w,'','karen'));
 });
 return shuffle(out);
}

function poolForLevel(level){
 return ({
   1:makeK1Pool,2:makeK2Pool,3:makeK3Pool,4:makeK4Pool,
   5:makeK5Pool,6:makeK6Pool,7:makeK7Pool,8:makeK8Pool,9:makeK9Pool
 })[level]();
}



const validSoundGroups = {
  // Common alphabet/base sound families used in the current reading guide
  alphabet: [
    'Ker','Kher','Ger','Nger','Ser','Cher','Sher','Nyer',
    'Ter','Der','Ner','Per','Ber','Mer','Yer','Rer','Ler','Wer','Ther','Her','Ah'
  ],

  // Valid vowel-based syllable endings from the teacher-defined vowel system
  vowelEndings: [
    'ah','ee','uh','eu','oo','ay','eh','oe','aw'
  ],

  // Valid blend onsets currently used in the KLGA banks / reading guide
  blendOnsets: [
    'Ja','Cha','Kra','Kla','Kwa','Khra','Khla','Khwa',
    'Chga','Tra','Twa','Tga','Dra','Dwa',
    'Pya','Pra','Pla','Pwa','Pga',
    'Bya','Bra','Bla','Bwa','Bga',
    'Mya','Mra','Mla','Mwa','Mga',
    'Ywa','Lwa','Thra','Thla','Thwa','Hwa'
  ]
};

function replaceOneValidComponent(sound, mode){
 const tokens=sound.split(' ');
 if(!tokens.length) return sound;

 const order=shuffle(tokens.map((_,i)=>i));

 for(const idx of order){
   const token=tokens[idx];

   // 1) Change a bare alphabet sound to another real alphabet sound.
   if(mode==='alphabet' || mode==='any'){
     if(validSoundGroups.alphabet.includes(token)){
       const options=validSoundGroups.alphabet.filter(x=>x!==token);
       if(options.length){
         const out=[...tokens];
         out[idx]=shuffle(options)[0];
         return out.join(' ');
       }
     }
   }

   // 2) Change only the vowel ending while keeping the onset.
   if(mode==='vowel' || mode==='any'){
     const lower=token.toLowerCase();
     for(const ending of [...validSoundGroups.vowelEndings].sort((a,b)=>b.length-a.length)){
       if(lower.endsWith(ending) && token.length>ending.length){
         const onset=token.slice(0,token.length-ending.length);
         const options=validSoundGroups.vowelEndings.filter(v=>v!==ending);
         if(options.length){
           const newEnding=shuffle(options)[0];
           const out=[...tokens];
           out[idx]=onset+newEnding;
           return out.join(' ');
         }
       }
     }
   }

   // 3) Swap a known blend syllable/onset with another valid blend sound.
   if(mode==='blend' || mode==='any'){
     for(const blend of validSoundGroups.blendOnsets){
       if(token.startsWith(blend)){
         const rest=token.slice(blend.length);
         const options=validSoundGroups.blendOnsets.filter(x=>x!==blend);
         if(options.length){
           const out=[...tokens];
           out[idx]=shuffle(options)[0]+rest;
           return out.join(' ');
         }
       }
     }
   }
 }

 return sound;
}

function makeCloseDistractors(correct){
 const choices=new Set([correct]);

 // First close distractor: valid vowel change when possible.
 let d1=replaceOneValidComponent(correct,'vowel');
 if(d1===correct) d1=replaceOneValidComponent(correct,'any');
 choices.add(d1);

 // Second close distractor: valid alphabet/blend change when possible.
 let d2=replaceOneValidComponent(correct,'blend');
 if(d2===correct || choices.has(d2)) d2=replaceOneValidComponent(correct,'alphabet');
 if(d2===correct || choices.has(d2)) d2=replaceOneValidComponent(correct,'any');
 choices.add(d2);

 // Third distractor: another real reading sound of similar length.
 const tokenCount=correct.split(' ').length;
 const candidates=k9Bank
   .map(x=>x.sound)
   .filter(s=>s!==correct && !choices.has(s) && Math.abs(s.split(' ').length-tokenCount)<=1);

 if(candidates.length) choices.add(shuffle(candidates)[0]);

 // Safety fallback: keep generating only from valid component swaps.
 let guard=0;
 while(choices.size<4 && guard<30){
   const d=replaceOneValidComponent(correct,'any');
   if(d!==correct) choices.add(d);
   guard++;
 }

 // Final fallback from real K9 answers only.
 if(choices.size<4){
   const realChoices=shuffle(k9Bank.map(x=>x.sound).filter(s=>s!==correct && !choices.has(s)));
   for(const s of realChoices){
     choices.add(s);
     if(choices.size>=4) break;
   }
 }

 return shuffle([...choices]).slice(0,4);
}


function makeK9Pool(){
 return shuffle(k9Bank).map(x=>{
   const ch=makeCloseDistractors(x.sound);
   return q(
     'K9',
     'Phrase Reading',
     'phraseToSound',
     'Choose the reading sound that matches this phrase.',
     x.phrase,
     ch,
     x.sound,
     'karen-large',
     ''
   );
 });
}


/* ---------------------------
   5-LEVEL ADAPTIVE ENGINE
   Internal skill banks remain K1-K9 for diagnostics.
---------------------------- */

const LEVELS = {
  1: {
    name:'Foundations',
    skills:[1,2,3],
    description:'Alphabet Recognition, Letter Sounds, Vowel Recognition'
  },
  2: {
    name:'Sound Building',
    skills:[4,5,6],
    description:'Alphabet + Vowel, Tone Recognition, Blend Sound Recognition'
  },
  3: {
    name:'Blend Reading',
    skills:[7],
    description:'Alphabet + Blend'
  },
  4: {
    name:'Advanced Sound Building',
    skills:[8],
    description:'Alphabet + Blend + Vowel'
  },
  5: {
    name:'Phrase Reading',
    skills:[9],
    description:'Reading Phrases'
  }
};

const SKILL_NAMES = {
  1:'Alphabet Recognition',
  2:'Letter Sounds',
  3:'Vowel Recognition',
  4:'Alphabet + Vowel',
  5:'Tone Recognition',
  6:'Blend Sound Recognition',
  7:'Alphabet + Blend',
  8:'Alphabet + Blend + Vowel',
  9:'Phrase Reading'
};

const views={
  home:homeView,
  auth:teacherAuthView,
  join:joinSessionView,
  setup:studentSetupView,
  test:testView,
  result:resultView,
  teacher:teacherView
};

let state={};

const ADAPTIVE_TOTAL_QUESTIONS=40;

// Conservative pace-review heuristic.
// KLGA only checks after 8 answered questions.
// A student is paused when at least 6 of the last 8 answers were under 2.5 seconds
// AND the average of those 8 answers was under 3 seconds.
const SPEED_REVIEW_MIN_ANSWERS=8;
const SPEED_REVIEW_WINDOW=8;
const SPEED_REVIEW_FAST_MS=2500;
const SPEED_REVIEW_AVG_MS=3000;

function fresh(){
  return {
    studentName:'',
    grade:'',
    window:'',
    mode:'adaptive',
    currentLevel:2,
    individualLevel:null,
    currentBatch:[],
    currentIndex:0,
    selected:null,
    responses:[],
    levelResults:{},
    skillResults:{},
    path:[],
    highestPassed:0,
    lowestFailed:6,
    totalQuestions:0,
    usedQuestionKeys:new Set(),
    recentDurations:[],
    questionStartedAt:0,
    speedReviewCount:0
  };
}
state=fresh();

function showView(n){
  Object.values(views).forEach(v=>v.classList.add('hidden'));
  views[n].classList.remove('hidden');
}

function pct(rows){
  return rows.length ? Math.round(rows.filter(r=>r.correct).length/rows.length*100) : 0;
}

function questionsForSkill(skill){
  return poolForLevel(skill);
}

function questionKey(item){
  return [item.skill,item.type,item.prompt,(item.choices||[]).join('||')].join('::');
}

// Balanced sampling for grouped levels.
// Level 1 and 2 default to 9 questions: 3 from each internal skill.
// Levels 3-5 default to 8.
function defaultCountForLevel(level){
  return LEVELS[level].skills.length>1 ? 9 : 8;
}

function buildLevelPool(level){
  const skills=LEVELS[level].skills;
  let all=[];
  skills.forEach(skill=>{
    questionsForSkill(skill).forEach(item=>{
      all.push({...item, internalSkill:skill, visibleLevel:level});
    });
  });
  return shuffle(all);
}

function balancedSample(level, countChoice){
  const skills=LEVELS[level].skills;
  const pools={};
  skills.forEach(skill=>{
    const unused=questionsForSkill(skill).filter(item=>!state.usedQuestionKeys.has(questionKey(item)));
    const source=unused.length ? unused : questionsForSkill(skill);
    pools[skill]=shuffle(source).map(item=>({
      ...item,
      internalSkill:skill,
      visibleLevel:level
    }));
  });

  if(countChoice==='all'){
    let all=[];
    skills.forEach(skill=>all.push(...pools[skill]));
    const chosen=shuffle(all);
    chosen.forEach(item=>state.usedQuestionKeys.add(questionKey(item)));
    return chosen;
  }

  let count = Number(countChoice) || defaultCountForLevel(level);

  if(skills.length===1){
    const chosen=pools[skills[0]].slice(0,Math.min(count,pools[skills[0]].length));
    chosen.forEach(item=>state.usedQuestionKeys.add(questionKey(item)));
    return chosen;
  }

  // Balance across the grouped skills as evenly as possible.
  let result=[];
  let cursor=0;
  let guard=0;
  while(result.length<count && guard<1000){
    const skill=skills[cursor % skills.length];
    if(pools[skill].length){
      result.push(pools[skill].shift());
    }
    cursor++;
    guard++;
    if(skills.every(s=>pools[s].length===0)) break;
  }
  const chosen=shuffle(result);
  chosen.forEach(item=>state.usedQuestionKeys.add(questionKey(item)));
  return chosen;
}


function sessionAssignmentKey(session=joinedSession){
  if(!session) return '';
  if(session.testType==='individual'){
    return `individual:${Number(session.level||1)}:${String(session.questionCount||'8')}`;
  }
  return `adaptive:${ADAPTIVE_TOTAL_QUESTIONS}`;
}

function serializeCurrentTestProgress(){
  if(!joinedSession || !joinedStudent) return null;
  return {
    version:1,
    assignmentKey:sessionAssignmentKey(joinedSession),
    sessionKey:joinedSession.key,
    studentKey:joinedStudent.key,
    savedAt:new Date().toISOString(),
    state:{
      studentName:state.studentName,
      grade:state.grade,
      window:state.window,
      mode:state.mode,
      currentLevel:state.currentLevel,
      individualLevel:state.individualLevel,
      currentBatch:state.currentBatch,
      currentIndex:state.currentIndex,
      responses:state.responses,
      levelResults:state.levelResults,
      skillResults:state.skillResults,
      path:state.path,
      highestPassed:state.highestPassed,
      lowestFailed:state.lowestFailed,
      totalQuestions:state.totalQuestions,
      usedQuestionKeys:[...state.usedQuestionKeys],
      recentDurations:state.recentDurations,
      speedReviewCount:state.speedReviewCount
    }
  };
}

function progressMatchesCurrentSession(progress){
  return Boolean(
    progress &&
    progress.version===1 &&
    progress.sessionKey===joinedSession?.key &&
    progress.studentKey===joinedStudent?.key &&
    progress.assignmentKey===sessionAssignmentKey(joinedSession) &&
    progress.state
  );
}

function restoreTestProgress(progress){
  if(!progressMatchesCurrentSession(progress)) return false;
  const saved=progress.state;

  state=fresh();
  state.studentName=saved.studentName||joinedStudent?.name||'';
  state.grade=saved.grade||joinedStudent?.grade||'';
  state.window=saved.window||testWindow.value;
  state.mode=saved.mode||'adaptive';
  state.currentLevel=Number(saved.currentLevel||2);
  state.individualLevel=saved.individualLevel===null || saved.individualLevel===undefined
    ? null
    : Number(saved.individualLevel);
  state.currentBatch=Array.isArray(saved.currentBatch)?saved.currentBatch:[];
  state.currentIndex=Number(saved.currentIndex||0);
  state.selected=null;
  state.responses=Array.isArray(saved.responses)?saved.responses:[];
  state.levelResults=saved.levelResults||{};
  state.skillResults=saved.skillResults||{};
  state.path=Array.isArray(saved.path)?saved.path:[];
  state.highestPassed=Number(saved.highestPassed||0);
  state.lowestFailed=Number(saved.lowestFailed||6);
  state.totalQuestions=Number(saved.totalQuestions||0);
  state.usedQuestionKeys=new Set(Array.isArray(saved.usedQuestionKeys)?saved.usedQuestionKeys:[]);
  state.recentDurations=Array.isArray(saved.recentDurations)?saved.recentDurations.map(Number).filter(Number.isFinite).slice(-SPEED_REVIEW_WINDOW):[];
  state.speedReviewCount=Number(saved.speedReviewCount||0);
  state.questionStartedAt=0;

  return Boolean(state.currentBatch.length && state.currentIndex <= state.currentBatch.length);
}

async function saveCurrentSessionProgress(){
  if(!joinedSession || !joinedStudent) return;
  const progress=serializeCurrentTestProgress();
  if(!progress) return;
  try{
    await cloudSaveStudentProgress(joinedSession.key,joinedStudent.key,progress);
  }catch(err){
    console.warn('Could not save KLGA test progress:',err);
  }
}

function updateResumeSetupUI(progress){
  pendingResumeProgress=progressMatchesCurrentSession(progress)?progress:null;

  if(pendingResumeProgress){
    const answered=Number(pendingResumeProgress.state?.totalQuestions||0);
    const total=joinedSession?.testType==='individual'
      ? (String(joinedSession.questionCount||'8')==='all' ? 'all assigned' : String(joinedSession.questionCount||'8'))
      : String(ADAPTIVE_TOTAL_QUESTIONS);

    resumeProgressNotice.innerHTML=
      `<strong>Saved progress found.</strong> `+
      `You completed ${answered} of ${esc(total)} questions. `+
      `Choose <strong>Resume Test</strong> to continue where you stopped.`;
    resumeProgressNotice.classList.remove('hidden');
    beginTestBtn.textContent='Resume Test';
  }else{
    resumeProgressNotice.classList.add('hidden');
    resumeProgressNotice.textContent='';
    beginTestBtn.textContent='Begin Test';
  }
}

function ensureSessionEndedModal(){
  let modal=document.getElementById('sessionEndedModal');
  if(modal) return modal;

  modal=document.createElement('div');
  modal.id='sessionEndedModal';
  modal.className='modal hidden';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=
    `<div class="modal-backdrop"></div>`+
    `<div class="modal-card session-ended-card" role="dialog" aria-modal="true" aria-labelledby="sessionEndedTitle">`+
      `<div class="session-ended-icon" aria-hidden="true">■</div>`+
      `<div class="eyebrow">Session Ended</div>`+
      `<h2 id="sessionEndedTitle">Your teacher ended the session.</h2>`+
      `<p>Your test has stopped and your progress was saved.</p>`+
      `<div class="session-ended-progress" id="sessionEndedProgress"></div>`+
      `<p class="muted">When your teacher starts this same session again, join it normally and KLGA will offer to resume from this point.</p>`+
      `<button type="button" class="btn primary" id="sessionEndedHomeBtn">Return Home</button>`+
    `</div>`;

  document.body.appendChild(modal);
  modal.querySelector('#sessionEndedHomeBtn').onclick=()=>{
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    stopStudentRuntimeWatch();
    joinedSession=null;
    joinedStudent=null;
    pendingResumeProgress=null;
    sessionPausedByTeacher=false;
    state=fresh();
    showView('home');
  };
  return modal;
}


function ensureIndividualStopModal(){
  let modal=document.getElementById('individualStopModal');
  if(modal) return modal;

  modal=document.createElement('div');
  modal.id='individualStopModal';
  modal.className='modal hidden';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=
    `<div class="modal-backdrop"></div>`+
    `<div class="modal-card session-ended-card" role="dialog" aria-modal="true" aria-labelledby="individualStopTitle">`+
      `<div class="session-ended-icon" id="individualStopIcon" aria-hidden="true">■</div>`+
      `<div class="eyebrow" id="individualStopEyebrow">Teacher Action</div>`+
      `<h2 id="individualStopTitle">Your test was stopped.</h2>`+
      `<p id="individualStopMessage"></p>`+
      `<div class="session-ended-progress" id="individualStopProgress"></div>`+
      `<button type="button" class="btn primary" id="individualStopHomeBtn">Return Home</button>`+
    `</div>`;

  document.body.appendChild(modal);
  modal.querySelector('#individualStopHomeBtn').onclick=()=>{
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    stopStudentRuntimeWatch();
    joinedSession=null;
    joinedStudent=null;
    pendingResumeProgress=null;
    sessionPausedByTeacher=false;
    lastHandledControlNonce=null;
    state=fresh();
    showView('home');
  };

  return modal;
}

async function endIndividualStudentTest(){
  if(sessionPausedByTeacher || !joinedSession || !joinedStudent) return;
  sessionPausedByTeacher=true;

  try{
    await saveCurrentSessionProgress();
  }catch(err){
    console.warn('Could not save progress while ending individual student test:',err);
  }

  nextQuestionBtn.disabled=true;
  answerChoices.querySelectorAll('button').forEach(btn=>btn.disabled=true);

  const modal=ensureIndividualStopModal();
  modal.querySelector('#individualStopEyebrow').textContent='Test Ended by Teacher';
  modal.querySelector('#individualStopTitle').textContent='Your test has been ended.';
  modal.querySelector('#individualStopMessage').textContent=
    'Your progress was saved. You can resume this same test later after your teacher approves you again.';

  const answered=Number(state.totalQuestions||0);
  const total=state.mode==='individual'
    ? (String(joinedSession.questionCount||'8')==='all' ? 'assigned questions' : String(joinedSession.questionCount||'8'))
    : String(ADAPTIVE_TOTAL_QUESTIONS);
  modal.querySelector('#individualStopProgress').textContent=`Saved at ${answered} of ${total} questions.`;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
}

async function terminateIndividualStudentTest(){
  if(!joinedSession || !joinedStudent) return;
  sessionPausedByTeacher=true;

  // Do NOT save the current test again. The teacher intentionally discarded it.
  try{
    await cloudClearStudentProgress(joinedSession.key,joinedStudent.key);
  }catch(err){
    console.warn('Could not clear terminated test progress:',err);
  }

  pendingResumeProgress=null;
  nextQuestionBtn.disabled=true;
  answerChoices.querySelectorAll('button').forEach(btn=>btn.disabled=true);

  const modal=ensureIndividualStopModal();
  modal.querySelector('#individualStopEyebrow').textContent='Test Terminated';
  modal.querySelector('#individualStopTitle').textContent='Your test will restart from the beginning.';
  modal.querySelector('#individualStopMessage').textContent=
    'Your teacher terminated this attempt. Your saved progress was cleared. The next time you are approved, you will begin again at Question 1.';
  modal.querySelector('#individualStopProgress').textContent='This attempt will not be resumed.';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
}

async function pauseStudentTestForEndedSession(){
  if(sessionPausedByTeacher || !joinedSession || !joinedStudent) return;
  sessionPausedByTeacher=true;

  try{
    await saveCurrentSessionProgress();
    await cloudSetStudentJoin(joinedSession.key,joinedStudent.key,'paused');
  }catch(err){
    console.warn('Could not mark student test paused:',err);
  }

  nextQuestionBtn.disabled=true;
  answerChoices.querySelectorAll('button').forEach(btn=>btn.disabled=true);

  const modal=ensureSessionEndedModal();
  const answered=Number(state.totalQuestions||0);
  const total=state.mode==='individual'
    ? (String(joinedSession.questionCount||'8')==='all' ? 'assigned questions' : String(joinedSession.questionCount||'8'))
    : String(ADAPTIVE_TOTAL_QUESTIONS);
  modal.querySelector('#sessionEndedProgress').textContent=`Saved at ${answered} of ${total} questions.`;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
}

function stopStudentRuntimeWatch(){
  if(stopStudentRuntimeListener) stopStudentRuntimeListener();
  stopStudentRuntimeListener=null;
}

async function startStudentRuntimeWatch(){
  stopStudentRuntimeWatch();
  if(!joinedSession || !joinedStudent) return;

  stopStudentRuntimeListener=await cloudSubscribeStudentStatus(
    joinedSession.key,
    joinedStudent.key,
    record=>{
      if(record?.sessionStatus==='Ended'){
        pauseStudentTestForEndedSession();
        return;
      }

      const nonce=record?.controlNonce;
      const action=record?.controlAction;

      if(!action || nonce===null || nonce===undefined) return;
      if(String(nonce)===String(lastHandledControlNonce)) return;

      lastHandledControlNonce=nonce;

      if(action==='end'){
        endIndividualStudentTest();
      }else if(action==='resume'){
        resumeSpeedReviewedStudent();
      }else if(action==='terminate'){
        terminateIndividualStudentTest();
      }
    }
  );
}

function beginLevel(level){
  state.currentLevel=level;
  const remaining=Math.max(0,ADAPTIVE_TOTAL_QUESTIONS-state.totalQuestions);
  const count=Math.min(defaultCountForLevel(level),remaining);
  if(count<=0){
    finishAdaptive(finalAdaptivePlacement());
    return;
  }
  state.currentBatch=balancedSample(level,count);
  state.currentIndex=0;
  state.selected=null;
  state.path.push('Level '+level);
  render();
}

function beginIndividual(level,countChoice){
  state.mode='individual';
  state.individualLevel=level;
  state.currentLevel=level;
  state.currentBatch=balancedSample(level,countChoice);
  state.currentIndex=0;
  state.selected=null;
  state.path=['Level '+level];
  render();
}


function currentQuestionTotal(){
  if(state.mode==='individual'){
    return state.currentBatch.length;
  }
  return ADAPTIVE_TOTAL_QUESTIONS;
}

function recentPaceStatsFromDurations(durations){
  const recent=(Array.isArray(durations)?durations:[])
    .map(Number)
    .filter(ms=>Number.isFinite(ms) && ms>=0)
    .slice(-SPEED_REVIEW_WINDOW);

  if(!recent.length){
    return {count:0,averageMs:null,fastCount:0};
  }

  const averageMs=Math.round(recent.reduce((sum,ms)=>sum+ms,0)/recent.length);
  const fastCount=recent.filter(ms=>ms<SPEED_REVIEW_FAST_MS).length;
  return {count:recent.length,averageMs,fastCount};
}

function shouldPauseForSpeedReview(){
  if(!joinedSession || !joinedStudent) return false;
  if(state.totalQuestions<SPEED_REVIEW_MIN_ANSWERS) return false;

  const pace=recentPaceStatsFromDurations(state.recentDurations);
  return pace.count>=SPEED_REVIEW_WINDOW &&
    pace.fastCount>=6 &&
    pace.averageMs<SPEED_REVIEW_AVG_MS;
}

function formatPaceMs(ms){
  if(ms===null || ms===undefined || !Number.isFinite(Number(ms))) return '—';
  return `${(Number(ms)/1000).toFixed(1)}s avg`;
}

async function flagStudentForSpeedReview(){
  if(sessionPausedByTeacher || !joinedSession || !joinedStudent) return;

  sessionPausedByTeacher=true;
  state.speedReviewCount=Number(state.speedReviewCount||0)+1;

  const pace=recentPaceStatsFromDurations(state.recentDurations);

  try{
    await saveCurrentSessionProgress();
    await cloudSetStudentJoin(joinedSession.key,joinedStudent.key,'speed-review');
  }catch(err){
    console.warn('Could not save speed-review pause:',err);
  }

  nextQuestionBtn.disabled=true;
  answerChoices.querySelectorAll('button').forEach(btn=>btn.disabled=true);

  const modal=ensureIndividualStopModal();
  modal.querySelector('#individualStopEyebrow').textContent='Teacher Review Needed';
  modal.querySelector('#individualStopTitle').textContent='Your test is temporarily paused.';
  modal.querySelector('#individualStopMessage').textContent=
    'KLGA noticed a consistently very fast answering pattern. Your teacher will decide whether you should resume or restart.';
  modal.querySelector('#individualStopProgress').textContent=
    `Progress saved at ${state.totalQuestions} of ${currentQuestionTotal()} questions • ${formatPaceMs(pace.averageMs)} recently.`;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
}

function continueAfterTeacherResume(){
  if(state.currentIndex>=state.currentBatch.length){
    if(state.mode==='individual'){
      finishIndividual();
    }else{
      evaluateLevel();
    }
  }else{
    render();
  }
}

async function resumeSpeedReviewedStudent(){
  sessionPausedByTeacher=false;

  // Reset the recent pace window after teacher review so KLGA collects
  // a fresh pattern instead of immediately re-flagging old timings.
  state.recentDurations=[];
  state.questionStartedAt=0;

  const modal=document.getElementById('individualStopModal');
  if(modal){
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }

  await saveCurrentSessionProgress();
  continueAfterTeacherResume();
}

function progressDetailsForRecord(session,record){
  const progress=record?.testProgress?.state;
  if(!progress){
    return {
      answered:0,
      total:session.testType==='individual'
        ? String(session.questionCount||8)
        : ADAPTIVE_TOTAL_QUESTIONS,
      percent:0,
      level:'—',
      paceMs:null
    };
  }

  const answered=Number(progress.totalQuestions||0);
  let total;

  if(session.testType==='individual'){
    if(String(session.questionCount||'8')==='all'){
      total=Math.max(answered,Array.isArray(progress.currentBatch)?progress.currentBatch.length:answered);
    }else{
      total=Number(session.questionCount||8);
    }
  }else{
    total=ADAPTIVE_TOTAL_QUESTIONS;
  }

  total=Math.max(1,Number(total)||1);
  const percent=Math.max(0,Math.min(100,Math.round(answered/total*100)));
  const responses=Array.isArray(progress.responses)?progress.responses:[];
  const durations=responses.map(r=>Number(r.elapsedMs)).filter(ms=>Number.isFinite(ms) && ms>=0);
  const pace=recentPaceStatsFromDurations(durations);

  return {
    answered,
    total,
    percent,
    level:progress.currentLevel?`Level ${progress.currentLevel}`:'—',
    paceMs:pace.averageMs
  };
}

function render(){
  const z=state.currentBatch[state.currentIndex];
  if(!z) return;
  state.selected=null;
  state.questionStartedAt=Date.now();

  questionDomain.textContent='Level '+state.currentLevel+' — '+LEVELS[state.currentLevel].name;
  questionNumber.textContent=state.totalQuestions+1;
  questionTotal.textContent=state.mode==='individual'
    ? state.currentBatch.length
    : ADAPTIVE_TOTAL_QUESTIONS;
  currentSkill.textContent=SKILL_NAMES[z.internalSkill] || z.skill;
  questionInstruction.textContent=z.instruction;
  questionPrompt.textContent=z.prompt;
  questionPrompt.className='question-prompt '+z.promptClass;

  const estimated = state.mode==='individual'
    ? Math.round((state.currentIndex/state.currentBatch.length)*100)
    : Math.min(100,Math.round((state.totalQuestions/ADAPTIVE_TOTAL_QUESTIONS)*100));
  progressBar.style.width=estimated+'%';

  answerChoices.innerHTML='';
  z.choices.forEach((c,i)=>{
    const b=document.createElement('button');
    b.className='choice '+z.choiceClass;
    b.textContent=c;
    b.onclick=()=>{
      [...answerChoices.children].forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      state.selected=i;
      nextQuestionBtn.disabled=false;
    };
    answerChoices.appendChild(b);
  });
  nextQuestionBtn.disabled=true;

  if(joinedSession && joinedStudent && !sessionPausedByTeacher){
    saveCurrentSessionProgress();
  }
}

async function submit(){
  if(sessionPausedByTeacher) return;
  if(state.selected===null) return;

  const z=state.currentBatch[state.currentIndex];
  const correct=state.selected===z.answer;
  const elapsedMs=state.questionStartedAt
    ? Math.max(0,Date.now()-state.questionStartedAt)
    : null;

  state.responses.push({
    visibleLevel:state.currentLevel,
    internalSkill:z.internalSkill,
    skill:z.skill,
    type:z.type,
    correct,
    elapsedMs
  });

  if(Number.isFinite(elapsedMs)){
    state.recentDurations.push(elapsedMs);
    state.recentDurations=state.recentDurations.slice(-SPEED_REVIEW_WINDOW);
  }

  state.totalQuestions++;
  state.currentIndex++;
  state.questionStartedAt=0;

  if(shouldPauseForSpeedReview()){
    await flagStudentForSpeedReview();
    return;
  }

  if(state.currentIndex>=state.currentBatch.length){
    if(state.mode==='individual'){
      finishIndividual();
    }else{
      evaluateLevel();
    }
  }else{
    render();
  }
}

function calculateDiagnostics(level){
  const levelRows=state.responses.filter(r=>r.visibleLevel===level);
  state.levelResults[level]=pct(levelRows);

  LEVELS[level].skills.forEach(skill=>{
    const rows=state.responses.filter(r=>r.internalSkill===skill);
    if(rows.length) state.skillResults[skill]=pct(rows);
  });
}

function finalAdaptivePlacement(){
  // Recalculate every level that was actually tested using all responses.
  const testedLevels=[...new Set(state.responses.map(r=>r.visibleLevel))].sort((a,b)=>a-b);
  testedLevels.forEach(level=>calculateDiagnostics(level));

  let highestPassed=0;
  testedLevels.forEach(level=>{
    if((state.levelResults[level]??0)>=75) highestPassed=Math.max(highestPassed,level);
  });

  // If Level 1 was tested but not passed and no higher level passed, placement is Below Level 1.
  return highestPassed;
}

function evaluateLevel(){
  const level=state.currentLevel;
  calculateDiagnostics(level);
  const score=state.levelResults[level];

  if(score>=75){
    state.highestPassed=Math.max(state.highestPassed,level);
  }else{
    state.lowestFailed=Math.min(state.lowestFailed,level);
  }

  // Every adaptive benchmark now contains exactly 40 questions.
  if(state.totalQuestions>=ADAPTIVE_TOTAL_QUESTIONS){
    finishAdaptive(finalAdaptivePlacement());
    return;
  }

  let nextLevel=level;

  if(score>=75){
    if(level===5){
      // Top level reached: continue gathering Level 5 evidence.
      nextLevel=5;
    }else{
      const harder=level+1;
      if(harder>=state.lowestFailed){
        // Placement boundary found. Focus remaining questions on the harder side
        // of the boundary so KGS can measure progress toward the next level.
        nextLevel=harder;
      }else{
        nextLevel=harder;
      }
    }
  }else{
    if(level===1){
      // Student is below the first benchmark; collect more Level 1 evidence.
      nextLevel=1;
    }else{
      const easier=level-1;
      if(easier<=state.highestPassed){
        // Boundary found between the passed easier level and this harder level.
        // Stay on the harder level to strengthen the within-band KGS estimate.
        nextLevel=level;
      }else{
        nextLevel=easier;
      }
    }
  }

  beginLevel(nextLevel);
}

function diagnosticHtml(){
  let out='';
  for(let level=1;level<=5;level++){
    const testedSkills=LEVELS[level].skills.filter(s=>state.skillResults[s]!==undefined);
    if(!testedSkills.length) continue;

    out += `<div class="diag-level"><strong>Level ${level} — ${LEVELS[level].name}</strong>`;
    testedSkills.forEach(skill=>{
      out += `<div class="diag-row"><span>${SKILL_NAMES[skill]}</span><strong>${state.skillResults[skill]}%</strong></div>`;
    });
    out += `</div>`;
  }
  return out || '<span>No diagnostic subskill scores available.</span>';
}

function setResultTiles(){
  const els=[null,level1Score,level2Score,level3Score,level4Score,level5Score];
  for(let level=1;level<=5;level++){
    els[level].textContent = state.levelResults[level]===undefined
      ? '—'
      : state.levelResults[level]+'%';
  }
}

function clampNumber(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function adaptiveKGS(level,levelResults){
  const numericLevel=Number(level)||0;

  // Below Level 1: progress toward the Level 1 benchmark.
  if(numericLevel<=0){
    const l1=Number(levelResults?.[1]??0);
    return clampNumber(Math.round((l1/75)*99),0,99);
  }

  // Level 5 is the top visible band. Use mastery above the 75% benchmark
  // to spread passing Level 5 scores across 500-599.
  if(numericLevel>=5){
    const l5=Number(levelResults?.[5]??75);
    const mastery=clampNumber(l5,75,100);
    return 500+Math.round(((mastery-75)/25)*99);
  }

  // Levels 1-4: use performance on the next harder level to measure
  // progress within the current 100-point band.
  const nextAccuracy=Number(levelResults?.[numericLevel+1]??0);
  const progress=clampNumber(Math.round((nextAccuracy/75)*99),0,99);
  return numericLevel*100+progress;
}

function resultPlacementLevel(result){
  const raw=String(result?.placement||result?.resultLabel||'');
  if(/below\s+level\s+1/i.test(raw)) return 0;
  const m=raw.match(/level\s*([1-5])/i);
  return m?Number(m[1]):null;
}

function resultKGSValue(result){
  const stored=Number(result?.kgs);
  if(Number.isFinite(stored) && result?.kgs!=='' && result?.kgs!==null && result?.kgs!==undefined){
    return stored;
  }
  if(String(result?.mode||'').toLowerCase().indexOf('adaptive')===-1) return null;

  const level=resultPlacementLevel(result);
  if(level===null) return null;
  const levels={
    1:result?.level1,
    2:result?.level2,
    3:result?.level3,
    4:result?.level4,
    5:result?.level5
  };
  return adaptiveKGS(level,levels);
}

function resultStudentIdentity(result){
  if(result?.studentKey) return `key:${String(result.studentKey)}`;
  if(result?.studentId) return `id:${String(result.studentId).trim().toLowerCase()}`;
  return `name:${String(result?.student||'').trim().toLowerCase()}|grade:${String(result?.grade||'')}`;
}

function resultSchoolYear(result){
  try{return schoolYearFromResult(result);}catch(err){return 'Unknown Year';}
}

function growthDeltaForResult(result,allResults){
  const current=resultKGSValue(result);
  if(current===null) return null;

  const identity=resultStudentIdentity(result);
  const year=resultSchoolYear(result);
  const currentTime=resultSortTime(result);

  const prior=(allResults||[])
    .filter(x=>x!==result)
    .filter(x=>String(x?.mode||'').toLowerCase().includes('adaptive'))
    .filter(x=>resultStudentIdentity(x)===identity)
    .filter(x=>resultSchoolYear(x)===year)
    .filter(x=>resultKGSValue(x)!==null)
    .filter(x=>{
      const t=resultSortTime(x);
      return !currentTime || !t || t<currentTime;
    })
    .sort((a,b)=>resultSortTime(b)-resultSortTime(a))[0];

  if(!prior) return null;
  return current-resultKGSValue(prior);
}

function formatGrowthDelta(delta){
  if(delta===null || delta===undefined || Number.isNaN(Number(delta))) return '—';
  const n=Number(delta);
  if(n>0) return `+${n}`;
  return String(n);
}

async function priorGrowthForNewResult(result){
  try{
    const existing=await cloudLoadResults();
    const delta=growthDeltaForResult(result,[...existing,result]);
    return delta;
  }catch(err){
    console.warn('Could not calculate prior KLGA growth:',err);
    return null;
  }
}

async function finishAdaptive(level){
  progressBar.style.width='100%';
  const displayLevel=level<=0?'Below Level 1':'Level '+level;

  resultStudentName.textContent=state.studentName;
  resultLevel.textContent=displayLevel;
  resultAccuracy.textContent=pct(state.responses)+'%';
  const kgs=adaptiveKGS(level,state.levelResults);
  resultKgs.textContent=String(kgs);
  resultGrowth.textContent='—';
  setResultTiles();

  adaptiveSummary.innerHTML=
    `<strong>Adaptive path:</strong> ${state.path.join(' → ')}<br>`+
    `<strong>Questions answered:</strong> ${state.totalQuestions} of ${ADAPTIVE_TOTAL_QUESTIONS}<br>`+
    `<strong>Placement:</strong> ${displayLevel}<br>`+
    `<strong>KLGA Growth Score:</strong> ${kgs}`;

  diagnosticSummary.innerHTML=diagnosticHtml();

  const result={
    student:state.studentName,
    grade:state.grade,
    window:state.window,
    mode:'Adaptive Test',
    resultLabel:displayLevel,
    placement:displayLevel,
    kgs,
    growth:'',
    studentKey:joinedStudent?.key||'',
    studentId:joinedStudent?.studentId||'',
    overall:pct(state.responses),
    questions:state.totalQuestions,
    path:state.path.join(' → '),
    level1:state.levelResults[1]??'',
    level2:state.levelResults[2]??'',
    level3:state.levelResults[3]??'',
    level4:state.levelResults[4]??'',
    level5:state.levelResults[5]??'',
    skill1:state.skillResults[1]??'',
    skill2:state.skillResults[2]??'',
    skill3:state.skillResults[3]??'',
    skill4:state.skillResults[4]??'',
    skill5:state.skillResults[5]??'',
    skill6:state.skillResults[6]??'',
    skill7:state.skillResults[7]??'',
    skill8:state.skillResults[8]??'',
    skill9:state.skillResults[9]??'',
    date:new Date().toLocaleDateString()
  };

  result.growth=await priorGrowthForNewResult(result);
  resultGrowth.textContent=formatGrowthDelta(result.growth);

  const saved=JSON.parse(localStorage.getItem('klgaFiveLevelResults')||'[]');
  saved.push(result);
  localStorage.setItem('klgaFiveLevelResults',JSON.stringify(saved));
  cloudSaveResult(result).catch(()=>{});
  if(joinedSession && joinedStudent){
    cloudClearStudentProgress(joinedSession.key,joinedStudent.key).catch(()=>{});
    cloudSetStudentJoin(joinedSession.key,joinedStudent.key,"finished").catch(()=>{});
    stopStudentRuntimeWatch();
  }
  pendingResumeProgress=null;
  showView('result');
}

function finishIndividual(){
  const level=state.individualLevel;
  calculateDiagnostics(level);
  const score=state.levelResults[level];
  const rows=state.responses.filter(r=>r.visibleLevel===level);

  resultStudentName.textContent=state.studentName;
  resultLevel.textContent='Level '+level;
  resultAccuracy.textContent=score+'%';
  resultKgs.textContent='—';
  resultGrowth.textContent='—';
  setResultTiles();

  adaptiveSummary.innerHTML=
    `<strong>Individual level test:</strong> Level ${level} — ${LEVELS[level].name}<br>`+
    `<strong>Questions answered:</strong> ${rows.length}<br>`+
    `<strong>Score:</strong> ${score}% (${rows.filter(r=>r.correct).length}/${rows.length})<br>`+
    `<strong>Mastery benchmark:</strong> ${score>=75?'Met (75% or higher)':'Not yet met'}<br>`+
    `<strong>KLGA Growth Score:</strong> Not reported for Individual Level Tests`;

  diagnosticSummary.innerHTML=diagnosticHtml();

  const result={
    student:state.studentName,
    grade:state.grade,
    window:state.window,
    mode:'Individual Level Test',
    resultLabel:score>=75?'Met Benchmark':'Below Benchmark',
    placement:'Level '+level,
    kgs:'',
    growth:'',
    studentKey:joinedStudent?.key||'',
    studentId:joinedStudent?.studentId||'',
    overall:score,
    questions:rows.length,
    path:'Level '+level,
    level1:level===1?score:'',
    level2:level===2?score:'',
    level3:level===3?score:'',
    level4:level===4?score:'',
    level5:level===5?score:'',
    skill1:state.skillResults[1]??'',
    skill2:state.skillResults[2]??'',
    skill3:state.skillResults[3]??'',
    skill4:state.skillResults[4]??'',
    skill5:state.skillResults[5]??'',
    skill6:state.skillResults[6]??'',
    skill7:state.skillResults[7]??'',
    skill8:state.skillResults[8]??'',
    skill9:state.skillResults[9]??'',
    date:new Date().toLocaleDateString()
  };

  const saved=JSON.parse(localStorage.getItem('klgaFiveLevelResults')||'[]');
  saved.push(result);
  localStorage.setItem('klgaFiveLevelResults',JSON.stringify(saved));
  cloudSaveResult(result).catch(()=>{});
  if(joinedSession && joinedStudent){
    cloudClearStudentProgress(joinedSession.key,joinedStudent.key).catch(()=>{});
    cloudSetStudentJoin(joinedSession.key,joinedStudent.key,"finished").catch(()=>{});
    stopStudentRuntimeWatch();
  }
  pendingResumeProgress=null;
  showView('result');
}



/* ---------------------------
   TESTING SESSIONS
---------------------------- */
let editingSessionKey=null;

let activeMonitorSession=null;
let stopSessionMonitor=null;
let stopStudentStatusListener=null;
let stopStudentRuntimeListener=null;
let pendingResumeProgress=null;
let sessionPausedByTeacher=false;
let lastHandledControlNonce=null;

function statusLabel(s){
  return ({
    "not joined":"Not Joined",
    waiting:"Waiting",
    approved:"Approved",
    testing:"Testing",
    paused:"Paused",
    "speed-review":"Speed Review",
    terminated:"Terminated",
    finished:"Finished"
  })[s] || s;
}

async function openLiveMonitor(sessionKey){
  const sessions=await cloudLoadSessions();
  const session=sessions.find(s=>s.key===sessionKey);
  if(!session) return;

  activeMonitorSession=session;
  liveSessionMonitor.classList.remove("hidden");
  liveSessionTitle.textContent=session.name;
  liveSessionMeta.innerHTML=
    `<span>${esc(session.testType==="adaptive"?"Adaptive Test":"Level "+session.level)} • ${esc(session.status)}</span>`+
    `<span class="monitor-password-wrap">`+
      `<span class="monitor-password-label">Password:</span>`+
      `<span id="liveMonitorPasswordValue" class="monitor-password-value" data-password="${esc(session.password||'')}">••••••</span>`+
      `<button id="toggleLiveMonitorPasswordBtn" type="button" class="btn mini ghost monitor-password-toggle" aria-pressed="false">Show</button>`+
    `</span>`;

  const passwordValue=document.getElementById('liveMonitorPasswordValue');
  const passwordToggle=document.getElementById('toggleLiveMonitorPasswordBtn');
  if(passwordValue && passwordToggle){
    passwordToggle.onclick=()=>{
      const showing=passwordToggle.getAttribute('aria-pressed')==='true';
      if(showing){
        passwordValue.textContent='••••••';
        passwordToggle.textContent='Show';
        passwordToggle.setAttribute('aria-pressed','false');
      }else{
        passwordValue.textContent=passwordValue.dataset.password||'';
        passwordToggle.textContent='Hide';
        passwordToggle.setAttribute('aria-pressed','true');
      }
    };
  }

  if(stopSessionMonitor) stopSessionMonitor();
  stopSessionMonitor=await cloudSubscribeSessionStudents(session.key,statuses=>{
    renderLiveSessionStudents(session,statuses);
  });
}


function setLiveMonitorFullScreen(open){
  if(!liveSessionMonitor) return;

  const shouldOpen=Boolean(open);
  liveSessionMonitor.classList.toggle('is-screen-open',shouldOpen);
  document.body.classList.toggle('live-monitor-screen-open',shouldOpen);

  if(window.fullScreenLiveMonitorBtn){
    fullScreenLiveMonitorBtn.textContent=shouldOpen?'Restore':'Full Screen';
    fullScreenLiveMonitorBtn.setAttribute('aria-pressed',String(shouldOpen));
  }

  if(shouldOpen){
    // Force the dedicated/full-screen monitor to open at its true top.
    // A second reset is needed after the browser restores scroll position
    // or Firebase paints the live session content.
    window.scrollTo(0,0);
    liveSessionMonitor.scrollTop=0;
    requestAnimationFrame(()=>{
      window.scrollTo(0,0);
      liveSessionMonitor.scrollTop=0;
    });
    setTimeout(()=>{
      window.scrollTo(0,0);
      liveSessionMonitor.scrollTop=0;
    },80);
    setTimeout(()=>{
      liveSessionMonitor.scrollTop=0;
    },300);
  }
}

function toggleLiveMonitorFullScreen(){
  setLiveMonitorFullScreen(!liveSessionMonitor.classList.contains('is-screen-open'));
}

function monitorUrlForSession(sessionKey){
  const url=new URL(window.location.href);
  url.searchParams.set('monitor',sessionKey);
  return url.toString();
}

function openCurrentMonitorInNewTab(){
  const sessionKey=activeMonitorSession?.key;
  if(!sessionKey) return;
  window.open(monitorUrlForSession(sessionKey),'_blank','noopener');
}

function monitorSessionKeyFromUrl(){
  try{
    return new URL(window.location.href).searchParams.get('monitor')||'';
  }catch(err){
    return '';
  }
}

function clearMonitorUrlParam(){
  try{
    const url=new URL(window.location.href);
    if(!url.searchParams.has('monitor')) return;
    url.searchParams.delete('monitor');
    window.history.replaceState({},'',url.toString());
  }catch(err){}
}

function closeLiveMonitor(){
  const wasDedicated=isDedicatedMonitorMode();

  setLiveMonitorFullScreen(false);
  liveSessionMonitor.classList.add("hidden");
  if(stopSessionMonitor) stopSessionMonitor();
  stopSessionMonitor=null;
  activeMonitorSession=null;

  if(wasDedicated){
    clearMonitorUrlParam();
    document.body.classList.remove('dedicated-monitor-mode','dedicated-monitor-loading');
    if(window.openLiveMonitorTabBtn) openLiveMonitorTabBtn.classList.remove('hidden');
    if(window.closeLiveMonitorBtn) closeLiveMonitorBtn.textContent='Close Monitor';
    showView('teacher');
    setTeacherTab('sessions');
  }
}


function ensureStudentTestControlModal(){
  let modal=document.getElementById('studentTestControlModal');
  if(modal) return modal;

  modal=document.createElement('div');
  modal.id='studentTestControlModal';
  modal.className='modal hidden';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=
    `<div class="modal-backdrop" data-student-control-cancel></div>`+
    `<div class="modal-card student-control-card" role="dialog" aria-modal="true" aria-labelledby="studentControlTitle">`+
      `<div class="student-control-icon" aria-hidden="true">!</div>`+
      `<div class="eyebrow" id="studentControlEyebrow">Teacher Action</div>`+
      `<h2 id="studentControlTitle">Student Test Action</h2>`+
      `<p id="studentControlMessage"></p>`+
      `<div class="student-control-actions">`+
        `<button type="button" class="btn ghost" data-student-control-cancel>Cancel</button>`+
        `<button type="button" class="btn secondary" id="studentControlConfirmBtn">Confirm</button>`+
      `</div>`+
    `</div>`;

  document.body.appendChild(modal);
  return modal;
}

function confirmStudentTestControl({title,message,confirmLabel,danger=false}){
  const modal=ensureStudentTestControlModal();
  const titleEl=modal.querySelector('#studentControlTitle');
  const messageEl=modal.querySelector('#studentControlMessage');
  const confirmBtn=modal.querySelector('#studentControlConfirmBtn');
  const eyebrow=modal.querySelector('#studentControlEyebrow');
  const icon=modal.querySelector('.student-control-icon');
  const cancelEls=modal.querySelectorAll('[data-student-control-cancel]');

  titleEl.textContent=title;
  messageEl.textContent=message;
  confirmBtn.textContent=confirmLabel;
  confirmBtn.className=`btn ${danger?'danger':'secondary'}`;
  eyebrow.textContent=danger?'Permanent Restart':'Pause Student Test';
  icon.classList.toggle('is-danger',danger);

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');

  return new Promise(resolve=>{
    let done=false;

    const finish=value=>{
      if(done) return;
      done=true;
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden','true');
      confirmBtn.onclick=null;
      cancelEls.forEach(el=>el.onclick=null);
      document.removeEventListener('keydown',onKey);
      resolve(value);
    };

    const onKey=event=>{
      if(event.key==='Escape') finish(false);
    };

    confirmBtn.onclick=()=>finish(true);
    cancelEls.forEach(el=>el.onclick=()=>finish(false));
    document.addEventListener('keydown',onKey);
    confirmBtn.focus();
  });
}

async function renderLiveSessionStudents(session,statuses){
  const roster=await cloudLoadRoster();
  const assigned=(session.studentKeys||[])
    .map(k=>roster.find(r=>r.key===k))
    .filter(Boolean)
    .sort((a,b)=>a.name.localeCompare(b.name));

  const map={};
  (statuses||[]).forEach(x=>map[x.studentKey]=x);

  let waiting=0,approved=0,testing=0,speedReview=0,finished=0;
  liveSessionStudentsBody.innerHTML="";

  assigned.forEach(student=>{
    const record=map[student.key]||{};
    const status=record.status || "not joined";
    const progress=progressDetailsForRecord(session,record);

    if(status==="waiting") waiting++;
    if(status==="approved") approved++;
    if(status==="testing") testing++;
    if(status==="speed-review") speedReview++;
    if(status==="finished") finished++;

    let action='';

    if(status==="waiting"){
      action=`<button class="btn mini primary" data-confirm-live="${student.key}">Confirm</button>`;
    }else if(status==="speed-review"){
      action=
        `<div class="student-test-actions speed-review-actions">`+
          `<button class="btn mini primary" data-resume-speed-review="${student.key}">Resume</button>`+
          `<button class="btn mini danger" data-terminate-student-test="${student.key}">Restart from Question 1</button>`+
        `</div>`;
    }else if(status==="testing" || status==="approved"){
      action=
        `<div class="student-test-actions">`+
          `<button class="btn mini secondary" data-end-student-test="${student.key}">End Test</button>`+
          `<button class="btn mini danger" data-terminate-student-test="${student.key}">Terminate & Restart</button>`+
        `</div>`;
    }else if(status==="paused"){
      action=
        `<div class="student-test-actions">`+
          `<span class="muted">Progress saved</span>`+
          `<button class="btn mini danger" data-terminate-student-test="${student.key}">Terminate & Restart</button>`+
        `</div>`;
    }else if(status==="terminated"){
      action=`<span class="muted">Next approval starts from Question 1</span>`;
    }else{
      action=`<span class="muted">${statusLabel(status)}</span>`;
    }

    const safeStatus=String(status).replace(/\s+/g,"-");
    const paceClass=status==="speed-review"?'pace-alert':'';
    const tr=document.createElement("tr");
    tr.innerHTML=
      `<td><strong>${esc(student.name)}</strong></td>`+
      `<td>${esc(student.studentId)}</td>`+
      `<td>${esc(student.grade)}</td>`+
      `<td>`+
        `<div class="live-progress-cell">`+
          `<div class="live-progress-text"><strong>${progress.answered}/${progress.total}</strong><span>${progress.percent}% • ${esc(progress.level)}</span></div>`+
          `<div class="live-mini-progress"><span style="width:${progress.percent}%"></span></div>`+
        `</div>`+
      `</td>`+
      `<td><span class="pace-value ${paceClass}">${esc(formatPaceMs(progress.paceMs))}</span></td>`+
      `<td><span class="status-pill status-${safeStatus}">${statusLabel(status)}</span></td>`+
      `<td>${action}</td>`;
    liveSessionStudentsBody.appendChild(tr);
  });

  monitorAssigned.textContent=assigned.length;
  monitorWaiting.textContent=waiting;
  monitorApproved.textContent=approved;
  monitorTesting.textContent=testing;
  monitorSpeedReview.textContent=speedReview;
  monitorFinished.textContent=finished;

  document.querySelectorAll("[data-confirm-live]").forEach(btn=>{
    btn.onclick=()=>cloudSetStudentJoin(session.key,btn.dataset.confirmLive,"approved");
  });

  document.querySelectorAll("[data-resume-speed-review]").forEach(btn=>{
    btn.onclick=async()=>{
      const studentKey=btn.dataset.resumeSpeedReview;
      const student=assigned.find(s=>s.key===studentKey);
      if(!student) return;

      const approved=await confirmStudentTestControl({
        title:`Resume ${student.name}'s Test?`,
        message:'The student will continue from the saved question. KLGA will reset the recent pace window and begin monitoring a fresh answering pattern.',
        confirmLabel:'Resume Test',
        danger:false
      });
      if(!approved) return;

      btn.disabled=true;
      try{
        await cloudSetStudentTestControl(session.key,studentKey,'resume');
      }catch(err){
        console.error('Resume speed-reviewed test failed:',err);
        alert('Could not resume this student test. Check Firebase connection and permissions.');
        btn.disabled=false;
      }
    };
  });

  document.querySelectorAll("[data-end-student-test]").forEach(btn=>{
    btn.onclick=async()=>{
      const studentKey=btn.dataset.endStudentTest;
      const student=assigned.find(s=>s.key===studentKey);
      if(!student) return;

      const approved=await confirmStudentTestControl({
        title:`End ${student.name}'s Test?`,
        message:'This stops only this student. Their current progress will be kept so they can resume later.',
        confirmLabel:'End Test',
        danger:false
      });
      if(!approved) return;

      btn.disabled=true;
      try{
        await cloudSetStudentTestControl(session.key,studentKey,'end');
      }catch(err){
        console.error('End student test failed:',err);
        alert('Could not end this student test. Check Firebase connection and permissions.');
        btn.disabled=false;
      }
    };
  });

  document.querySelectorAll("[data-terminate-student-test]").forEach(btn=>{
    btn.onclick=async()=>{
      const studentKey=btn.dataset.terminateStudentTest;
      const student=assigned.find(s=>s.key===studentKey);
      if(!student) return;

      const approved=await confirmStudentTestControl({
        title:`Restart ${student.name} from Question 1?`,
        message:'This permanently deletes this student’s saved in-progress attempt. The next time you approve them, they will start again from the beginning.',
        confirmLabel:'Restart from Question 1',
        danger:true
      });
      if(!approved) return;

      btn.disabled=true;
      try{
        await cloudSetStudentTestControl(session.key,studentKey,'terminate');
      }catch(err){
        console.error('Terminate student test failed:',err);
        alert('Could not restart this student test. Check Firebase connection and permissions.');
        btn.disabled=false;
      }
    };
  });
}


function loadSessions(){
  return JSON.parse(localStorage.getItem('klgaTestingSessions')||'[]');
}
function saveSessions(sessions){
  localStorage.setItem('klgaTestingSessions',JSON.stringify(sessions));
}
function randomCode(length=6){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out='';
  for(let i=0;i<length;i++) out+=chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function generateSessionName(){ return 'KLGA-'+randomCode(4); }
function generateSessionPassword(){ return randomCode(6); }

async function renderSessionStudentChecklist(selectedKeys=[]){
  const roster=await cloudLoadRoster();
  sessionStudentChecklist.innerHTML='';

  ["6","7","8"].forEach(grade=>{
    const students=roster
      .filter(s=>String(s.grade)===grade)
      .sort((a,b)=>a.name.localeCompare(b.name));

    const section=document.createElement('div');
    section.className='session-grade-group';

    const header=document.createElement('div');
    header.className='session-grade-header';
    header.innerHTML=`<strong>Grade ${grade}</strong><span>${students.length} student${students.length===1?'':'s'}</span>`;
    section.appendChild(header);

    if(!students.length){
      const empty=document.createElement('div');
      empty.className='empty-grade-note';
      empty.textContent='No students';
      section.appendChild(empty);
    }else{
      students.forEach(student=>{
        const label=document.createElement('label');
        label.className='student-check-row';
        label.innerHTML=
          `<input type="checkbox" value="${student.key}" ${selectedKeys.includes(student.key)?'checked':''}>`+
          `<span><strong>${esc(student.name)}</strong><small>ID ${esc(student.studentId)}</small></span>`;
        section.appendChild(label);
      });
    }
    sessionStudentChecklist.appendChild(section);
  });
}
function selectedSessionStudentKeys(){
  return [...sessionStudentChecklist.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);
}
async function openSessionForm(session=null){
  sessionFormWrap.classList.remove('hidden');
  sessionFormError.classList.add('hidden');
  sessionFormError.textContent='';
  if(session){
    editingSessionKey=session.key;
    sessionName.value=session.name;
    sessionPassword.value=session.password;
    sessionTestType.value=session.testType;
    sessionLevel.value=session.level||'1';
    sessionQuestionCount.value=String(session.questionCount||'8');
    const isIndividual=session.testType==='individual';
    sessionLevelWrap.classList.toggle('hidden',!isIndividual);
    sessionQuestionCountWrap.classList.toggle('hidden',!isIndividual);
    await renderSessionStudentChecklist(session.studentKeys||[]);
    saveSessionBtn.textContent='Update Session';
  }else{
    editingSessionKey=null;
    sessionName.value=generateSessionName();
    sessionPassword.value=generateSessionPassword();
    sessionTestType.value='adaptive';
    sessionLevel.value='1';
    sessionQuestionCount.value='8';
    sessionLevelWrap.classList.add('hidden');
    sessionQuestionCountWrap.classList.add('hidden');
    await renderSessionStudentChecklist([]);
    saveSessionBtn.textContent='Save Session';
  }
}
function closeSessionForm(){
  sessionFormWrap.classList.add('hidden');
  editingSessionKey=null;
}
async function persistSession(){
  const name=sessionName.value.trim();
  const password=sessionPassword.value.trim();
  const testType=sessionTestType.value;
  const level=testType==='individual'?Number(sessionLevel.value):null;
  const questionCount=testType==='individual'?sessionQuestionCount.value:null;
  const studentKeys=selectedSessionStudentKeys();
  const rosterForSession=await cloudLoadRoster();
  const studentSummaries=studentKeys
    .map(key=>rosterForSession.find(s=>s.key===key))
    .filter(Boolean)
    .map(s=>({key:s.key,studentId:s.studentId,name:s.name,grade:s.grade}));

  if(!name || !password){
    sessionFormError.textContent='Please enter a session name and password.';
    sessionFormError.classList.remove('hidden');
    return;
  }
  if(!studentKeys.length){
    sessionFormError.textContent='Select at least one student.';
    sessionFormError.classList.remove('hidden');
    return;
  }

  const sessions=await cloudLoadSessions();
  const duplicate=sessions.find(s=>s.name.toLowerCase()===name.toLowerCase() && s.key!==editingSessionKey);
  if(duplicate){
    sessionFormError.textContent='That session name is already being used.';
    sessionFormError.classList.remove('hidden');
    return;
  }

  let session;
  if(editingSessionKey){
    const existing=sessions.find(s=>s.key===editingSessionKey);
    session={...(existing||{}),key:editingSessionKey,name,password,testType,level,questionCount,studentKeys,studentSummaries};
  }else{
    session={
      key:'ses_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
      name,password,testType,level,questionCount,studentKeys,studentSummaries,status:'Draft',
      createdAt:new Date().toLocaleString()
    };
  }
  await cloudSaveSession(session);
  closeSessionForm();
  renderSessions();
}
async function editSession(key){
  const session=(await cloudLoadSessions()).find(s=>s.key===key);
  if(session) openSessionForm(session);
}
async function setSessionStatus(key,status){
  try{
    const sessions=await cloudLoadSessions();
    const idx=sessions.findIndex(s=>s.key===key);

    if(idx<0){
      alert('Session could not be found in Firebase. Refresh the page and try again.');
      return;
    }

    const updated={
      ...sessions[idx],
      status,
      updatedAt:new Date().toLocaleString()
    };

    await cloudSaveSession(updated);
    await cloudSetSessionStudentRunState(key,status);
    await renderSessions();

    if(status==='Active'){
      await openLiveMonitor(key);
    }else if(activeMonitorSession?.key===key){
      closeLiveMonitor();
    }
  }catch(err){
    console.error('Session status update failed:',err);
    alert('Could not update the session. Check your Firestore connection and rules.');
  }
}
async function deleteSession(key){
  try{
    const sessions=await cloudLoadSessions();
    const session=sessions.find(s=>s.key===key);
    if(!session){
      alert('Session could not be found in Firebase.');
      return;
    }

    if(confirm(`Delete session ${session.name}?`)){
      await cloudDeleteSession(key);

      if(activeMonitorSession?.key===key){
        closeLiveMonitor();
      }

      await renderSessions();
    }
  }catch(err){
    console.error('Session delete failed:',err);
    alert('Could not delete the session. Check your Firestore connection and rules.');
  }
}

async function backfillSessionStudentSummaries(){
  const sessions=await cloudLoadSessions();
  const needs=sessions.filter(s=>!Array.isArray(s.studentSummaries) || s.studentSummaries.length!==(s.studentKeys||[]).length);
  if(!needs.length) return;

  const roster=await cloudLoadRoster();
  for(const session of needs){
    const studentSummaries=(session.studentKeys||[])
      .map(key=>roster.find(s=>s.key===key))
      .filter(Boolean)
      .map(s=>({key:s.key,studentId:s.studentId,name:s.name,grade:s.grade}));
    await cloudSaveSession({...session,studentSummaries});
  }
}

async function renderSessions(){
  const sessions=await cloudLoadSessions();
  const roster=await cloudLoadRoster();
  sessionTableBody.innerHTML='';
  if(!sessions.length){
    const tr=document.createElement('tr');
    tr.innerHTML='<td colspan="6" class="empty-row">No testing sessions created yet.</td>';
    sessionTableBody.appendChild(tr);
    return;
  }
  sessions.slice().reverse().forEach(s=>{
    const studentNames=(s.studentKeys||[]).map(k=>roster.find(r=>r.key===k)?.name).filter(Boolean);
    const testLabel=s.testType==='adaptive'
      ? 'Adaptive • 40 questions'
      : `Level ${s.level} • ${s.questionCount||8} question${String(s.questionCount||8)==='1'?'':'s'}`;
    const tr=document.createElement('tr');
    tr.innerHTML=
      `<td><strong>${esc(s.name)}</strong></td>`+
      `<td><span class="session-password">${esc(s.password)}</span></td>`+
      `<td>${testLabel}</td>`+
      `<td>${studentNames.length}</td>`+
      `<td><span class="status-pill status-${String(s.status).toLowerCase()}">${esc(s.status)}</span></td>`+
      `<td class="row-actions">`+
      `<button class="btn mini secondary" data-session-edit="${s.key}">Edit</button>`+
      (s.status==='Active'
        ? `<button class="btn mini secondary" data-session-monitor="${s.key}">Monitor</button>`
        : '')+
      (s.status!=='Active'
        ? `<button class="btn mini primary" data-session-start="${s.key}">Start</button>`
        : `<button class="btn mini ghost" data-session-end="${s.key}">End</button>`)+
      `<button class="btn mini danger" data-session-delete="${s.key}">Delete</button>`+
      `</td>`;
    sessionTableBody.appendChild(tr);
  });

  document.querySelectorAll('[data-session-edit]').forEach(btn=>btn.onclick=()=>editSession(btn.dataset.sessionEdit));
  document.querySelectorAll('[data-session-monitor]').forEach(btn=>btn.onclick=()=>openLiveMonitor(btn.dataset.sessionMonitor));
  document.querySelectorAll('[data-session-start]').forEach(btn=>btn.onclick=()=>setSessionStatus(btn.dataset.sessionStart,'Active'));
  document.querySelectorAll('[data-session-end]').forEach(btn=>btn.onclick=()=>setSessionStatus(btn.dataset.sessionEnd,'Ended'));
  document.querySelectorAll('[data-session-delete]').forEach(btn=>btn.onclick=()=>deleteSession(btn.dataset.sessionDelete));
}

/* ---------------------------
   STUDENT ROSTER
---------------------------- */

let editingStudentKey=null;

function loadRoster(){
  return JSON.parse(localStorage.getItem('klgaStudentRoster')||'[]');
}

function saveRoster(roster){
  localStorage.setItem('klgaStudentRoster',JSON.stringify(roster));
}

async function renderRoster(){
  const bodies={"6":grade6RosterBody,"7":grade7RosterBody,"8":grade8RosterBody};
  const counts={"6":grade6Count,"7":grade7Count,"8":grade8Count};

  Object.values(bodies).forEach(body=>{
    body.innerHTML='<tr><td colspan="3" class="empty-row">Loading roster…</td></tr>';
  });

  let roster=[];
  try{
    roster=await cloudLoadRoster();
  }catch(err){
    console.error('Roster load failed:',err);
    Object.values(bodies).forEach(body=>{
      body.innerHTML='<tr><td colspan="3" class="empty-row">Could not load roster from Firebase.</td></tr>';
    });
    return;
  }

  ["6","7","8"].forEach(grade=>{
    const students=roster
      .filter(s=>String(s.grade)===grade)
      .sort((a,b)=>a.name.localeCompare(b.name));

    counts[grade].textContent=`${students.length} student${students.length===1?'':'s'}`;
    bodies[grade].innerHTML='';

    if(!students.length){
      bodies[grade].innerHTML='<tr><td colspan="3" class="empty-row">No students in this grade.</td></tr>';
      return;
    }

    students.forEach(student=>{
      const tr=document.createElement('tr');
      tr.innerHTML=
        `<td>${esc(student.studentId)}</td>`+
        `<td><strong>${esc(student.name)}</strong></td>`+
        `<td>`+
          `<button class="btn mini secondary" data-edit-student="${student.key}">Edit</button> `+
          `<button class="btn mini danger" data-delete-student="${student.key}">Delete</button>`+
        `</td>`;
      bodies[grade].appendChild(tr);
    });
  });

  document.querySelectorAll('[data-edit-student]').forEach(btn=>{
    btn.onclick=()=>editStudent(btn.dataset.editStudent);
  });
  document.querySelectorAll('[data-delete-student]').forEach(btn=>{
    btn.onclick=()=>deleteStudent(btn.dataset.deleteStudent);
  });
}


async function getNextAutoStudentId(){
  const roster=await cloudLoadRoster();

  // Find numeric IDs and continue from the highest.
  const nums=roster
    .map(s=>String(s.studentId||'').trim())
    .filter(id=>/^\d+$/.test(id))
    .map(Number);

  const next = nums.length ? Math.max(...nums)+1 : 1001;
  return String(next);
}

async function applyStudentIdMode(mode){
  if(mode==='auto'){
    rosterStudentId.readOnly=true;
    rosterStudentId.placeholder='Auto-generated';
    if(!editingStudentKey){
      rosterStudentId.value=await getNextAutoStudentId();
    }
  }else{
    rosterStudentId.readOnly=false;
    rosterStudentId.placeholder='Enter student ID';
    if(!editingStudentKey){
      rosterStudentId.value='';
    }
  }
}

async function openStudentForm(student=null){
  studentFormWrap.classList.remove('hidden');
  studentFormError.classList.add('hidden');
  studentFormError.textContent='';

  if(student){
    editingStudentKey=student.key;
    rosterStudentId.value=student.studentId;
    rosterStudentName.value=student.name;
    rosterStudentGrade.value=student.grade;

    // Existing IDs remain editable through Manual mode.
    studentIdMode.value='manual';
    await applyStudentIdMode('manual');

    saveStudentBtn.textContent='Update Student';
  }else{
    editingStudentKey=null;
    rosterStudentName.value='';
    rosterStudentGrade.value='';

    studentIdMode.value='auto';
    await applyStudentIdMode('auto');

    saveStudentBtn.textContent='Save Student';
  }
}

function closeStudentForm(){
  studentFormWrap.classList.add('hidden');
  editingStudentKey=null;
}

async function editStudent(key){
  const roster=await cloudLoadRoster();
  const student=roster.find(s=>s.key===key);
  if(student) openStudentForm(student);
}

async function deleteStudent(key){
  const roster=await cloudLoadRoster();
  const student=roster.find(s=>s.key===key);
  if(!student) return;

  if(confirm(`Delete ${student.name} from the roster?`)){
    await cloudDeleteStudent(key);
    await renderRoster();
  }
}

async function persistStudent(){
  if(studentIdMode.value==='auto' && !editingStudentKey){
    rosterStudentId.value=await getNextAutoStudentId();
  }

  const studentId=rosterStudentId.value.trim();
  const name=rosterStudentName.value.trim();
  const grade=rosterStudentGrade.value;

  if(!studentId || !name || !grade){
    studentFormError.textContent='Please enter Student ID, Student Name, and Grade.';
    studentFormError.classList.remove('hidden');
    return;
  }

  const roster=await cloudLoadRoster();

  const duplicate=roster.find(
    s=>s.studentId.toLowerCase()===studentId.toLowerCase() && s.key!==editingStudentKey
  );

  if(duplicate){
    studentFormError.textContent='That Student ID is already in the roster.';
    studentFormError.classList.remove('hidden');
    return;
  }

  let student;
  if(editingStudentKey){
    const existing=roster.find(s=>s.key===editingStudentKey);
    student={
      ...(existing||{}),
      key:editingStudentKey,
      studentId,
      name,
      grade
    };
  }else{
    student={
      key:'stu_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
      studentId,
      name,
      grade
    };
  }

  try{
    await cloudSaveStudent(student);
    closeStudentForm();
    await renderRoster();
  }catch(err){
    console.error('Student save failed:',err);
    studentFormError.textContent='Could not save student to Firebase. Check Firestore Database and Rules.';
    studentFormError.classList.remove('hidden');
  }
}


function resultSortTime(x){
  if(x.createdAt?.seconds) return x.createdAt.seconds*1000;
  if(x.createdAt?.toMillis) return x.createdAt.toMillis();
  return Date.parse(x.date||'')||0;
}


let teacherResultCache=[];

function normalizeSkillScore(value){
  if(value===null || value===undefined || value==='') return '—';
  const n=Number(value);
  return Number.isFinite(n) ? `${n}%` : String(value);
}

function teacherResultSkills(result){
  const labels={
    skill1:'Alphabet Recognition',
    skill2:'Letter Sounds',
    skill3:'Vowel Recognition',
    skill4:'Alphabet + Vowel',
    skill5:'Tone Recognition',
    skill6:'Blend Sound Recognition',
    skill7:'Alphabet + Blend',
    skill8:'Alphabet + Blend + Vowel',
    skill9:'Phrase Reading'
  };
  return Object.entries(labels)
    .map(([key,label])=>({label,value:result[key]}))
    .filter(x=>x.value!==undefined && x.value!==null && x.value!=='');
}

function openTeacherResultDetail(resultKey){
  const result=teacherResultCache.find(r=>String(r.key)===String(resultKey));
  if(!result) return;

  teacherResultDetailTitle.textContent=`${result.student||'Student'} — ${result.resultLabel||'Result'}`;

  const items=[
    ['Student',result.student||'—'],
    ['Grade',result.grade||'—'],
    ['Window',result.window||'—'],
    ['Mode',result.mode||'—'],
    ['Questions',result.questions??'—'],
    ['KGS',resultKGSValue(result)??'—'],
    ['Growth',formatGrowthDelta(growthDeltaForResult(result,teacherResultCache))],
    ['Overall',result.overall!==undefined?`${result.overall}%`:'—'],
    ['Result',result.resultLabel||'—'],
    ['Date',result.date||'—']
  ];

  teacherResultSummary.innerHTML=items.map(([label,value]) =>
    `<div class="result-summary-item"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`
  ).join('');

  teacherResultPath.textContent=result.path||result.resultLabel||'—';

  const skills=teacherResultSkills(result);
  teacherResultSkillsBody.innerHTML='';
  if(!skills.length){
    teacherResultSkillsBody.innerHTML='<tr><td colspan="2" class="empty-row">No skill breakdown saved for this result.</td></tr>';
  }else{
    skills.forEach(s=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${esc(s.label)}</td><td><strong>${esc(normalizeSkillScore(s.value))}</strong></td>`;
      teacherResultSkillsBody.appendChild(tr);
    });
  }

  teacherResultDetailModal.classList.remove('hidden');
  teacherResultDetailModal.setAttribute('aria-hidden','false');
}

function closeTeacherResultDetail(){
  teacherResultDetailModal.classList.add('hidden');
  teacherResultDetailModal.setAttribute('aria-hidden','true');
}


function schoolYearFromResult(result){
  // Prefer a saved schoolYear value if one exists.
  if(result.schoolYear) return String(result.schoolYear);

  // Derive a school year from the saved result date.
  // July-Dec belongs to year -> year+1; Jan-Jun belongs to year-1 -> year.
  const raw=result.date || result.createdAt;
  let d=null;

  if(result.createdAt?.seconds){
    d=new Date(result.createdAt.seconds*1000);
  }else if(raw){
    d=new Date(raw);
  }

  if(!d || Number.isNaN(d.getTime())) return 'Unknown Year';

  const y=d.getFullYear();
  const m=d.getMonth()+1;
  return m>=7 ? `${y}–${String(y+1).slice(-2)}` : `${y-1}–${String(y).slice(-2)}`;
}

function seasonFromResult(result){
  const value=String(result.window||'').trim();
  if(/^fall$/i.test(value)) return 'Fall';
  if(/^spring$/i.test(value)) return 'Spring';
  if(/^winter$/i.test(value)) return 'Winter';
  return value || 'Unspecified';
}

function yearSortValue(label){
  const m=String(label).match(/^(\d{4})/);
  return m ? Number(m[1]) : -1;
}

function seasonSortValue(season){
  const order={Fall:1,Winter:2,Spring:3,Unspecified:4};
  return order[season] || 9;
}


function ensureClearResultsConfirmModal(){
  let modal=document.getElementById('clearResultsConfirmModal');
  if(modal) return modal;

  modal=document.createElement('div');
  modal.id='clearResultsConfirmModal';
  modal.className='modal hidden';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=
    `<div class="modal-backdrop" data-clear-results-cancel></div>`+
    `<div class="modal-card clear-results-confirm-card" role="dialog" aria-modal="true" aria-labelledby="clearResultsConfirmTitle">`+
      `<div class="clear-results-warning-icon" aria-hidden="true">!</div>`+
      `<div class="eyebrow danger-eyebrow">Permanent Action</div>`+
      `<h2 id="clearResultsConfirmTitle">Clear Results?</h2>`+
      `<p id="clearResultsConfirmMessage" class="clear-results-confirm-message"></p>`+
      `<div id="clearResultsConfirmScope" class="clear-results-confirm-scope"></div>`+
      `<p class="clear-results-confirm-note"><strong>This cannot be undone.</strong> Export the results first if you may need them later.</p>`+
      `<div class="clear-results-confirm-actions">`+
        `<button type="button" class="btn ghost" data-clear-results-cancel>Cancel</button>`+
        `<button type="button" class="btn danger clear-results-confirm-delete">Clear Results</button>`+
      `</div>`+
    `</div>`;

  document.body.appendChild(modal);
  return modal;
}

function confirmClearResults({title='Clear Results?',message='',scope='',confirmLabel='Clear Results'}={}){
  const modal=ensureClearResultsConfirmModal();
  const titleEl=modal.querySelector('#clearResultsConfirmTitle');
  const messageEl=modal.querySelector('#clearResultsConfirmMessage');
  const scopeEl=modal.querySelector('#clearResultsConfirmScope');
  const confirmBtn=modal.querySelector('.clear-results-confirm-delete');
  const cancelEls=modal.querySelectorAll('[data-clear-results-cancel]');

  titleEl.textContent=title;
  messageEl.textContent=message;
  scopeEl.textContent=scope;
  confirmBtn.textContent=confirmLabel;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');

  return new Promise(resolve=>{
    let finished=false;

    const cleanup=answer=>{
      if(finished) return;
      finished=true;
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden','true');
      confirmBtn.onclick=null;
      cancelEls.forEach(el=>el.onclick=null);
      document.removeEventListener('keydown',onKey);
      resolve(answer);
    };

    const onKey=event=>{
      if(event.key==='Escape') cleanup(false);
    };

    confirmBtn.onclick=()=>cleanup(true);
    cancelEls.forEach(el=>el.onclick=()=>cleanup(false));
    document.addEventListener('keydown',onKey);
    confirmBtn.focus();
  });
}

async function renderDashboard(resultsOverride=null){
  resultsHierarchy.innerHTML='<div class="empty-row">Loading results…</div>';

  try{
    const r=resultsOverride || await cloudLoadResults();
    const sorted=[...r].sort((a,b)=>resultSortTime(b)-resultSortTime(a));
    teacherResultCache=sorted;

    if(!sorted.length){
      resultsHierarchy.innerHTML='<div class="empty-row">No KLGA results yet.</div>';
      return;
    }

    const grouped={};

    sorted.forEach(result=>{
      const year=schoolYearFromResult(result);
      const season=seasonFromResult(result);
      const grade=String(result.grade||'Unknown');

      grouped[year] ??= {};
      grouped[year][season] ??= {};
      grouped[year][season][grade] ??= [];
      grouped[year][season][grade].push(result);
    });

    const years=Object.keys(grouped).sort((a,b)=>yearSortValue(b)-yearSortValue(a));
    resultsHierarchy.innerHTML='';

    years.forEach(year=>{
      const yearSection=document.createElement('section');
      yearSection.className='results-year-section';

      const totalForYear=Object.values(grouped[year])
        .flatMap(seasons=>Object.values(seasons))
        .reduce((sum,arr)=>sum+arr.length,0);

      yearSection.innerHTML=
        `<div class="results-year-header">`+
          `<div><div class="eyebrow">School Year</div><h2>${esc(year)}</h2></div>`+
          `<span class="grade-count">${totalForYear} result${totalForYear===1?'':'s'}</span>`+
        `</div>`;

      const seasonsWrap=document.createElement('div');
      seasonsWrap.className='results-seasons-wrap';

      const seasons=Object.keys(grouped[year]).sort((a,b)=>seasonSortValue(a)-seasonSortValue(b));

      seasons.forEach(season=>{
        const seasonSection=document.createElement('section');
        seasonSection.className='results-season-section';

        const seasonTotal=Object.values(grouped[year][season])
          .reduce((sum,arr)=>sum+arr.length,0);

        seasonSection.innerHTML=
          `<div class="results-season-header">`+
            `<h3>${esc(season)}</h3>`+
            `<span class="grade-count">${seasonTotal} result${seasonTotal===1?'':'s'}</span>`+
          `</div>`;

        const gradesWrap=document.createElement('div');
        gradesWrap.className='results-grade-grid';

        ['6','7','8'].forEach(grade=>{
          const gradeResults=(grouped[year][season][grade]||[])
            .slice()
            .sort((a,b)=>resultSortTime(b)-resultSortTime(a));

          const gradeSection=document.createElement('section');
          gradeSection.className='grade-results-section is-collapsed';
          gradeSection.dataset.year=year;
          gradeSection.dataset.season=season;
          gradeSection.dataset.grade=grade;

          gradeSection.innerHTML=
            `<div class="grade-results-title">`+
              `<div class="grade-results-topline">`+
                `<div class="grade-results-label">`+
                  `<span class="grade-label-text">Grade ${grade}</span>`+
                  `<span class="grade-count">${gradeResults.length} result${gradeResults.length===1?'':'s'}</span>`+
                `</div>`+
                `<div class="grade-title-actions">`+
                  `<button class="btn mini danger grade-clear-btn" type="button" ${gradeResults.length?'':'disabled'}>Clear Results</button>`+
                  `<button class="grade-expand-btn" type="button" aria-expanded="false" title="Expand Grade ${grade} results">`+
                    `<span class="grade-expand-icon">›</span>`+
                    `<span class="grade-expand-text">Expand</span>`+
                  `</button>`+
                `</div>`+
              `</div>`+
              `<div class="grade-results-actions">`+
                `<button class="btn mini ghost grade-fullscreen-btn" type="button" ${gradeResults.length?'':'disabled'}>Full Screen</button>`+
                `<button class="btn mini secondary grade-export-btn" type="button" ${gradeResults.length?'':'disabled'}>Export CSV</button>`+
                `<button class="btn mini secondary grade-sheet-script-btn" type="button" ${gradeResults.length?'':'disabled'}>Google Sheet Script</button>`+
              `</div>`+
            `</div>`;

          const tableWrap=document.createElement('div');
          tableWrap.className='table-wrap grade-results-body';

          tableWrap.innerHTML=
            `<table>`+
              `<thead><tr>`+
                `<th>Student</th>`+
                `<th>Mode</th>`+
                `<th>Questions</th>`+
                `<th>Path / Level</th>`+
                `<th>Result</th>`+
                `<th>KGS</th>`+
                `<th>Growth</th>`+
                `<th>Overall</th>`+
                `<th>Date</th>`+
                `<th>Details</th>`+
              `</tr></thead>`+
              `<tbody></tbody>`+
            `</table>`;

          const tbody=tableWrap.querySelector('tbody');

          if(!gradeResults.length){
            tbody.innerHTML='<tr><td colspan="10" class="empty-row">No results for this grade.</td></tr>';
          }else{
            gradeResults.forEach(x=>{
              const tr=document.createElement('tr');
              tr.innerHTML=
                `<td>${esc(x.student||'')}</td>`+
                `<td>${esc(x.mode||'')}</td>`+
                `<td>${esc(x.questions??'')}</td>`+
                `<td>${esc(x.path||'')}</td>`+
                `<td><strong>${esc(x.resultLabel||'')}</strong></td>`+
                `<td><strong class="kgs-table-value">${esc(resultKGSValue(x)??'—')}</strong></td>`+
                `<td class="growth-table-value">${esc(formatGrowthDelta(growthDeltaForResult(x,teacherResultCache)))}</td>`+
                `<td>${esc(x.overall??'')}%</td>`+
                `<td>${esc(x.date||'')}</td>`+
                `<td><button class="btn mini secondary" data-result-detail="${x.key}">View Details</button></td>`;
              tbody.appendChild(tr);
            });
          }

          gradeSection.appendChild(tableWrap);
          gradesWrap.appendChild(gradeSection);
        });

        seasonSection.appendChild(gradesWrap);
        seasonsWrap.appendChild(seasonSection);
      });

      yearSection.appendChild(seasonsWrap);
      resultsHierarchy.appendChild(yearSection);
    });

    document.querySelectorAll('[data-result-detail]').forEach(btn=>{
      btn.onclick=()=>openTeacherResultDetail(btn.dataset.resultDetail);
    });

    document.querySelectorAll('.grade-expand-btn').forEach(btn=>{
      btn.onclick=()=>{
        const section=btn.closest('.grade-results-section');
        if(!section) return;

        const willExpand=section.classList.contains('is-collapsed');
        section.classList.toggle('is-collapsed',!willExpand);
        btn.setAttribute('aria-expanded',String(willExpand));
        btn.title=(willExpand?'Collapse ':'Expand ')+`Grade ${section.dataset.grade} results`;
        const label=btn.querySelector('.grade-expand-text');
        if(label) label.textContent=willExpand?'Collapse':'Expand';
      };
    });

    document.querySelectorAll('.grade-fullscreen-btn').forEach(btn=>{
      btn.onclick=()=>{
        const section=btn.closest('.grade-results-section');
        if(!section) return;

        const opening=!section.classList.contains('is-screen-open');

        document.querySelectorAll('.grade-results-section.is-screen-open').forEach(other=>{
          if(other!==section){
            other.classList.remove('is-screen-open');
            const otherBtn=other.querySelector('.grade-fullscreen-btn');
            if(otherBtn) otherBtn.textContent='Full Screen';
          }
        });

        section.classList.toggle('is-screen-open',opening);
        document.body.classList.toggle('grade-result-screen-open',opening);
        btn.textContent=opening?'Restore':'Full Screen';

        if(opening && section.classList.contains('is-collapsed')){
          section.classList.remove('is-collapsed');
          const expandBtn=section.querySelector('.grade-expand-btn');
          if(expandBtn){
            expandBtn.setAttribute('aria-expanded','true');
            expandBtn.title=`Collapse Grade ${section.dataset.grade} results`;
          }
        }
      };
    });

    document.querySelectorAll('.grade-clear-btn').forEach(btn=>{
      btn.onclick=async()=>{
        const section=btn.closest('.grade-results-section');
        if(!section || btn.disabled) return;

        const year=section.dataset.year;
        const season=section.dataset.season;
        const grade=section.dataset.grade;

        const subset=teacherResultCache.filter(x=>
          schoolYearFromResult(x)===year &&
          seasonFromResult(x)===season &&
          String(x.grade||'Unknown')===grade
        );

        if(!subset.length) return;

        const approved=await confirmClearResults({
          title:`Clear Grade ${grade} Results?`,
          message:'You are about to permanently delete this result group.',
          scope:`${year} • ${season} • Grade ${grade} • ${subset.length} result${subset.length===1?'':'s'}`,
          confirmLabel:`Clear ${subset.length} Result${subset.length===1?'':'s'}`
        });

        if(!approved) return;

        btn.disabled=true;
        try{
          await cloudClearGradeResults(year,season,grade);
          await renderDashboard();
        }catch(err){
          console.error('Clear grade results failed:',err);
          btn.disabled=false;
          alert('Could not clear these results. Check the Firebase connection and Firestore rules.');
        }
      };
    });

    document.querySelectorAll('.grade-export-btn').forEach(btn=>{
      btn.onclick=()=>{
        const section=btn.closest('.grade-results-section');
        if(!section) return;

        const year=section.dataset.year;
        const season=section.dataset.season;
        const grade=section.dataset.grade;

        const subset=teacherResultCache.filter(x=>
          schoolYearFromResult(x)===year &&
          seasonFromResult(x)===season &&
          String(x.grade||'Unknown')===grade
        );

        if(!subset.length) return;
        downloadResultsCsv(
          subset,
          `KLGA-${safeFilePart(year)}-${safeFilePart(season)}-Grade-${safeFilePart(grade)}-Results.csv`
        );
      };
    });

    document.querySelectorAll('.grade-sheet-script-btn').forEach(btn=>{
      btn.onclick=()=>{
        const section=btn.closest('.grade-results-section');
        if(!section) return;

        const year=section.dataset.year;
        const season=section.dataset.season;
        const grade=section.dataset.grade;

        const subset=teacherResultCache.filter(x=>
          schoolYearFromResult(x)===year &&
          seasonFromResult(x)===season &&
          String(x.grade||'Unknown')===grade
        );

        if(!subset.length) return;

        const script=buildGoogleSheetAppsScript(subset,year,season,grade);
        showGoogleSheetScriptModal(script,year,season,grade);
      };
    });

  }catch(err){
    console.error('Results load failed:',err);
    resultsHierarchy.innerHTML='<div class="empty-row">Could not load results from Firebase.</div>';
  }
}

function esc(s=''){
  return String(s).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function safeFilePart(value){
  return String(value??'')
    .trim()
    .replace(/[–—]/g,'-')
    .replace(/[^A-Za-z0-9._-]+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-|-$/g,'') || 'Unknown';
}

function downloadResultsCsv(results,filename='KLGA-5-Level-Results.csv'){
  const rows=[[
    'Student','Grade','Window','Mode','Result','KLGA Growth Score','Growth','Overall','Questions','Path',
    'Level 1','Level 2','Level 3','Level 4','Level 5',
    'Alphabet Recognition','Letter Sounds','Vowel Recognition',
    'Alphabet + Vowel','Tone Recognition','Blend Sound Recognition',
    'Alphabet + Blend','Alphabet + Blend + Vowel','Phrase Reading','Date'
  ]];

  results.forEach(x=>rows.push([
    x.student,x.grade,x.window,x.mode,x.resultLabel,resultKGSValue(x)??'',formatGrowthDelta(growthDeltaForResult(x,results)),x.overall,x.questions,x.path,
    x.level1,x.level2,x.level3,x.level4,x.level5,
    x.skill1,x.skill2,x.skill3,x.skill4,x.skill5,x.skill6,x.skill7,x.skill8,x.skill9,
    x.date
  ]));

  const csv=rows.map(row=>
    row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')
  ).join('\n');

  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportCsv(){
  const r=await cloudLoadResults();
  downloadResultsCsv(r,'KLGA-5-Level-Results.csv');
}


function buildGoogleSheetAppsScript(results,year,season,grade){
  const headers=[
    'Student','Grade','Window','Mode','Result','KLGA Growth Score','Growth','Overall','Questions','Path',
    'Level 1','Level 2','Level 3','Level 4','Level 5',
    'Alphabet Recognition','Letter Sounds','Vowel Recognition',
    'Alphabet + Vowel','Tone Recognition','Blend Sound Recognition',
    'Alphabet + Blend','Alphabet + Blend + Vowel','Phrase Reading','Date'
  ];

  const rows=results.map(x=>[
    x.student??'',x.grade??'',x.window??'',x.mode??'',x.resultLabel??'',
    resultKGSValue(x)??'',formatGrowthDelta(growthDeltaForResult(x,results)),x.overall??'',x.questions??'',x.path??'',
    x.level1??'',x.level2??'',x.level3??'',x.level4??'',x.level5??'',
    x.skill1??'',x.skill2??'',x.skill3??'',x.skill4??'',x.skill5??'',
    x.skill6??'',x.skill7??'',x.skill8??'',x.skill9??'',x.date??''
  ]);

  const data=[headers,...rows];
  const title=`KLGA ${year} ${season} Grade ${grade} Results`;
  const sheetName=`Grade ${grade} - ${season}`;

  return `/**
 * KLGA GOOGLE SHEET EXPORT
 * ${year} • ${season} • Grade ${grade}
 *
 * 1. Go to script.google.com
 * 2. Create a new project.
 * 3. Paste this entire script.
 * 4. Run createKLGAGradeResultsSheet().
 * 5. Approve Google permissions when prompted.
 */
function createKLGAGradeResultsSheet() {
  const spreadsheet = SpreadsheetApp.create(${JSON.stringify(title)});
  const sheet = spreadsheet.getActiveSheet();
  sheet.setName(${JSON.stringify(sheetName)});

  const data = ${JSON.stringify(data, null, 2)};

  const range = sheet.getRange(1, 1, data.length, data[0].length);
  range.setValues(data);

  // Header styling
  const header = sheet.getRange(1, 1, 1, data[0].length);
  header
    .setFontWeight('bold')
    .setBackground('#315EFB')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');

  // Freeze and filter
  sheet.setFrozenRows(1);
  if (data.length > 1) {
    range.createFilter();
  }

  // Alignment
  sheet.getDataRange().setVerticalAlignment('middle');
  sheet.getRange(2, 2, Math.max(data.length - 1, 1), data[0].length - 1)
    .setHorizontalAlignment('center');
  sheet.getRange(2, 1, Math.max(data.length - 1, 1), 1)
    .setHorizontalAlignment('left');

  // Level color headers: L1 red, L2 yellow, L3 orange, L4 green, L5 blue
  sheet.getRange(1,11).setBackground('#DC2626').setFontColor('#FFFFFF');
  sheet.getRange(1,12).setBackground('#EAB308').setFontColor('#1F2937');
  sheet.getRange(1,13).setBackground('#F97316').setFontColor('#FFFFFF');
  sheet.getRange(1,14).setBackground('#16A34A').setFontColor('#FFFFFF');
  sheet.getRange(1,15).setBackground('#2563EB').setFontColor('#FFFFFF');

  // Basic formatting
  sheet.getDataRange().setWrap(true);
  sheet.autoResizeColumns(1, data[0].length);
  sheet.setColumnWidth(1, 190);
  sheet.setColumnWidth(10, 220);
  sheet.setColumnWidth(25, 150);

  // Alternating row colors.
  if (data.length > 1) {
    const body = sheet.getRange(2, 1, data.length - 1, data[0].length);
    body.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
  }

  SpreadsheetApp.flush();
  Logger.log('Google Sheet created: ' + spreadsheet.getUrl());
  return spreadsheet.getUrl();
}`;
}

function ensureGoogleSheetScriptModal(){
  let modal=document.getElementById('googleSheetScriptModal');
  if(modal) return modal;

  modal=document.createElement('div');
  modal.id='googleSheetScriptModal';
  modal.className='modal hidden';
  modal.setAttribute('aria-hidden','true');

  modal.innerHTML=
    `<div class="modal-backdrop" data-close-sheet-script></div>`+
    `<div class="modal-card sheet-script-card">`+
      `<div class="modal-head">`+
        `<div>`+
          `<div class="eyebrow">Google Sheets Export</div>`+
          `<h2 id="googleSheetScriptTitle">Generated Apps Script</h2>`+
          `<p class="sheet-script-help">Copy this script into Google Apps Script and run <strong>createKLGAGradeResultsSheet</strong>. It will create a new Google Sheet in your Drive.</p>`+
        `</div>`+
        `<button id="closeGoogleSheetScriptBtn" class="btn ghost mini" type="button">Close</button>`+
      `</div>`+
      `<textarea id="googleSheetScriptText" class="sheet-script-textarea" spellcheck="false" readonly></textarea>`+
      `<div id="googleSheetScriptStatus" class="sheet-script-status"></div>`+
      `<div class="actions sheet-script-actions">`+
        `<button id="copyGoogleSheetScriptBtn" class="btn primary" type="button">Copy Script</button>`+
        `<button id="downloadGoogleSheetScriptBtn" class="btn secondary" type="button">Download .gs</button>`+
      `</div>`+
    `</div>`;

  document.body.appendChild(modal);

  const close=()=>{
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  };

  modal.querySelector('#closeGoogleSheetScriptBtn').onclick=close;
  modal.querySelector('[data-close-sheet-script]').onclick=close;

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && !modal.classList.contains('hidden')) close();
  });

  return modal;
}

function showGoogleSheetScriptModal(script,year,season,grade){
  const modal=ensureGoogleSheetScriptModal();
  const textarea=modal.querySelector('#googleSheetScriptText');
  const title=modal.querySelector('#googleSheetScriptTitle');
  const status=modal.querySelector('#googleSheetScriptStatus');
  const copyBtn=modal.querySelector('#copyGoogleSheetScriptBtn');
  const downloadBtn=modal.querySelector('#downloadGoogleSheetScriptBtn');

  title.textContent=`${year} • ${season} • Grade ${grade}`;
  textarea.value=script;
  status.textContent='';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');

  copyBtn.onclick=async()=>{
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(script);
      }else{
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
      }
      status.textContent='Script copied. Paste it into Google Apps Script.';
    }catch(err){
      console.error('Copy script failed:',err);
      textarea.focus();
      textarea.select();
      status.textContent='Select the script and copy it manually.';
    }
  };

  downloadBtn.onclick=()=>{
    const blob=new Blob([script],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`KLGA-${safeFilePart(year)}-${safeFilePart(season)}-Grade-${safeFilePart(grade)}-Google-Sheet.gs`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    status.textContent='Apps Script file downloaded.';
  };

  setTimeout(()=>textarea.scrollTop=0,0);
}



/* ---------------------------
   TEACHER DASHBOARD NAVIGATION
---------------------------- */
let activeTeacherTab='overview';

function setTeacherTab(tab){
  const valid=['overview','sessions','students','results'];
  if(!valid.includes(tab)) tab='overview';
  activeTeacherTab=tab;

  const panels={
    overview:document.getElementById('teacherOverviewPanel'),
    sessions:document.getElementById('teacherSessionsPanel'),
    students:document.getElementById('teacherStudentsPanel'),
    results:document.getElementById('teacherResultsPanel')
  };

  Object.entries(panels).forEach(([key,panel])=>{
    if(panel) panel.classList.toggle('hidden',key!==tab);
  });

  document.querySelectorAll('[data-teacher-tab]').forEach(btn=>{
    const on=btn.dataset.teacherTab===tab;
    btn.classList.toggle('active',on);
    btn.setAttribute('aria-selected',on?'true':'false');
  });

  if(tab==='overview') updateTeacherOverview();
}

async function updateTeacherOverview(resultsOverride=null){
  const studentCount=document.getElementById('overviewStudentCount');
  if(!studentCount) return;

  try{
    const [roster,sessions,results]=await Promise.all([
      cloudLoadRoster(),
      cloudLoadSessions(),
      resultsOverride ? Promise.resolve(resultsOverride) : cloudLoadResults()
    ]);

    const active=sessions.filter(s=>s.status==='Active');
    const sortedResults=[...results].sort((a,b)=>resultSortTime(b)-resultSortTime(a));

    studentCount.textContent=roster.length;
    overviewActiveSessions.textContent=active.length;
    overviewResultCount.textContent=sortedResults.length;

    const recent=sortedResults[0];
    if(recent){
      overviewRecentResult.textContent=recent.student||'Student';
      overviewRecentResultMeta.textContent=`${recent.resultLabel||recent.path||'KLGA Result'} • KGS ${resultKGSValue(recent)??'—'} • ${recent.overall??'—'}%`;
    }else{
      overviewRecentResult.textContent='—';
      overviewRecentResultMeta.textContent='No assessment results yet';
    }

    overviewSessionSummary.innerHTML='';
    const sessionItems=(active.length?active:sessions.slice().reverse()).slice(0,4);
    if(!sessionItems.length){
      overviewSessionSummary.innerHTML='<div class="overview-empty">No testing sessions created yet.</div>';
    }else{
      sessionItems.forEach(s=>{
        const row=document.createElement('div');
        row.className='overview-summary-item';
        const test=s.testType==='adaptive'?'Adaptive':`Level ${s.level}`;
        row.innerHTML=`<div><strong>${esc(s.name)}</strong><small>${esc(test)} • ${esc(s.status)}</small></div><span class="overview-summary-value">${(s.studentKeys||[]).length}</span>`;
        overviewSessionSummary.appendChild(row);
      });
    }

    overviewRecentResultsList.innerHTML='';
    if(!sortedResults.length){
      overviewRecentResultsList.innerHTML='<div class="overview-empty">No KLGA results yet.</div>';
    }else{
      sortedResults.slice(0,4).forEach(r=>{
        const row=document.createElement('div');
        row.className='overview-summary-item';
        row.innerHTML=`<div><strong>${esc(r.student||'Student')}</strong><small>Grade ${esc(r.grade||'—')} • ${esc(r.date||'')} • ${esc(r.resultLabel||'')}</small></div><span class="overview-summary-value">KGS ${esc(resultKGSValue(r)??'—')}</span>`;
        overviewRecentResultsList.appendChild(row);
      });
    }
  }catch(err){
    console.error('Teacher overview load failed:',err);
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-teacher-tab]').forEach(btn=>{
    btn.addEventListener('click',()=>setTeacherTab(btn.dataset.teacherTab));
  });
  document.querySelectorAll('[data-overview-go]').forEach(btn=>{
    btn.addEventListener('click',()=>setTeacherTab(btn.dataset.overviewGo));
  });

  if(monitorSessionKeyFromUrl()){
    bootstrapDedicatedMonitorMode();
  }
});

let stopResultsListener=null;

async function startResultsListener(){
  if(stopResultsListener){
    stopResultsListener();
    stopResultsListener=null;
  }

  stopResultsListener=await cloudSubscribeResults(results=>{
    renderDashboard(results);
    updateTeacherOverview(results);
  });
}

startStudentBtn.onclick=()=>showView('join');


let monitorUrlAutoOpened=false;
let dedicatedMonitorBootstrapped=false;

function isDedicatedMonitorMode(){
  return Boolean(monitorSessionKeyFromUrl());
}

async function waitForFirebaseAuthRestore(timeoutMs=3500){
  await fbReady();

  const existing=cloudCurrentUser();
  if(existing) return existing;

  if(!window.KLGAFirebase?.onAuth) return null;

  return await new Promise(resolve=>{
    let done=false;
    let stop=()=>{};

    const finish=user=>{
      if(done) return;
      done=true;
      try{ stop(); }catch(err){}
      resolve(user||null);
    };

    stop=window.KLGAFirebase.onAuth(user=>finish(user));
    setTimeout(()=>finish(cloudCurrentUser()),timeoutMs);
  });
}

async function openDedicatedMonitor(sessionKey){
  if(!sessionKey) return false;

  const sessions=await cloudLoadSessions();
  const session=sessions.find(s=>s.key===sessionKey);

  if(!session){
    teacherAuthMessage.textContent='This KLGA testing session could not be found.';
    teacherAuthMessage.classList.remove('hidden');
    return false;
  }

  showView('teacher');
  setTeacherTab('sessions');
  document.body.classList.add('dedicated-monitor-mode');

  await openLiveMonitor(sessionKey);
  setLiveMonitorFullScreen(true);
  window.scrollTo(0,0);
  liveSessionMonitor.scrollTop=0;
  setTimeout(()=>{
    window.scrollTo(0,0);
    liveSessionMonitor.scrollTop=0;
  },150);

  if(window.openLiveMonitorTabBtn){
    openLiveMonitorTabBtn.classList.add('hidden');
  }
  if(window.closeLiveMonitorBtn){
    closeLiveMonitorBtn.textContent='Exit Monitor';
  }

  monitorUrlAutoOpened=true;
  return true;
}

async function bootstrapDedicatedMonitorMode(){
  const sessionKey=monitorSessionKeyFromUrl();
  if(!sessionKey || dedicatedMonitorBootstrapped) return false;

  dedicatedMonitorBootstrapped=true;
  document.body.classList.add('dedicated-monitor-mode','dedicated-monitor-loading');

  try{
    await waitForFirebaseAuthRestore();

    const user=cloudCurrentUser();
    if(!user || user.isAnonymous){
      showView('auth');
      document.body.classList.remove('dedicated-monitor-loading');
      return true;
    }

    const authorized=await cloudTeacherAuthorized();
    if(!authorized){
      teacherAuthMessage.textContent=`Signed in as ${user.email||user.displayName||'Google user'}, but this account is not authorized as a KLGA teacher yet.`;
      teacherAuthMessage.classList.remove('hidden');
      teacherUidText.textContent=user.uid;
      teacherUidBox.classList.remove('hidden');
      showView('auth');
      document.body.classList.remove('dedicated-monitor-loading');
      return true;
    }

    teacherAccountName.textContent=user.displayName||'Teacher';
    teacherAccountEmail.textContent=user.email||'';

    await backfillSessionStudentSummaries();
    await Promise.all([renderSessions(),renderRoster(),renderDashboard()]);
    await startResultsListener();

    await openDedicatedMonitor(sessionKey);
    document.body.classList.remove('dedicated-monitor-loading');
    return true;
  }catch(err){
    console.error('Dedicated monitor startup failed:',err);
    teacherAuthMessage.textContent='Could not open the dedicated session monitor. Check your Firebase connection and try again.';
    teacherAuthMessage.classList.remove('hidden');
    showView('auth');
    document.body.classList.remove('dedicated-monitor-loading');
    return true;
  }
}

async function openTeacherDashboard(){
  teacherAuthMessage.classList.add('hidden');
  teacherUidBox.classList.add('hidden');

  try{
    const user=cloudCurrentUser();
    if(!user || user.isAnonymous){
      showView('auth');
      return;
    }

    const authorized=await cloudTeacherAuthorized();
    if(!authorized){
      teacherAuthMessage.textContent=`Signed in as ${user.email||user.displayName||'Google user'}, but this account is not authorized as a KLGA teacher yet.`;
      teacherAuthMessage.classList.remove('hidden');
      teacherUidText.textContent=user.uid;
      teacherUidBox.classList.remove('hidden');
      googleTeacherSignInBtn.textContent='Choose Another Google Account';
      showView('auth');
      return;
    }

    teacherAccountName.textContent=user.displayName||'Teacher';
    teacherAccountEmail.textContent=user.email||'';
    await backfillSessionStudentSummaries();
    await Promise.all([renderSessions(),renderRoster(),renderDashboard()]);
    await startResultsListener();

    const monitorSessionKey=monitorSessionKeyFromUrl();
    if(monitorSessionKey){
      await openDedicatedMonitor(monitorSessionKey);
    }else{
      showView('teacher');
      setTeacherTab('overview');
    }
  }catch(err){
    console.error('Teacher access failed:',err);
    teacherAuthMessage.textContent='Could not verify teacher access. Check Firebase Authentication and Firestore rules.';
    teacherAuthMessage.classList.remove('hidden');
    showView('auth');
  }
}

googleTeacherSignInBtn.onclick=async()=>{
  teacherAuthMessage.classList.add('hidden');
  teacherUidBox.classList.add('hidden');
  try{
    const {user,authorized}=await cloudSignInTeacher();
    if(!authorized){
      teacherAuthMessage.textContent=`Google sign-in worked, but ${user.email||'this account'} is not in the KLGA teacher allowlist yet.`;
      teacherAuthMessage.classList.remove('hidden');
      teacherUidText.textContent=user.uid;
      teacherUidBox.classList.remove('hidden');
      googleTeacherSignInBtn.textContent='Choose Another Google Account';
      return;
    }
    googleTeacherSignInBtn.textContent='Sign in with Google';
    await openTeacherDashboard();
  }catch(err){
    console.error('Google sign-in failed:',err);
    teacherAuthMessage.textContent='Google sign-in did not complete. Make sure Google is enabled in Firebase Authentication and your website domain is authorized.';
    teacherAuthMessage.classList.remove('hidden');
  }
};

if(window.closeTeacherResultDetailBtn){
  closeTeacherResultDetailBtn.onclick=closeTeacherResultDetail;
}
document.querySelectorAll('[data-close-result-detail]').forEach(el=>{
  el.onclick=closeTeacherResultDetail;
});

teacherSignOutBtn.onclick=async()=>{
  await cloudSignOut();
  if(isDedicatedMonitorMode()){
    setLiveMonitorFullScreen(false);
    liveSessionMonitor.classList.add('hidden');
    showView('auth');
  }else{
    showView('home');
  }
};

studentModeBtn.onclick=()=>showView('join');
startTeacherBtn.onclick=openTeacherDashboard;
teacherModeBtn.onclick=openTeacherDashboard;

document.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>{
  if(isDedicatedMonitorMode()){
    bootstrapDedicatedMonitorMode();
    return;
  }
  showView('home');
});

returnHomeBtn.onclick=()=>{
  stopStudentRuntimeWatch();
  state=fresh();
  joinedSession=null;
  joinedStudent=null;
  pendingResumeProgress=null;
  sessionPausedByTeacher=false;
  lastHandledControlNonce=null;
  updateResumeSetupUI(null);
  applyStudentSessionAssignment();
  showView('home');
};


function applyStudentSessionAssignment(){
  const inSession=Boolean(joinedSession && joinedStudent);

  if(!inSession){
    testModeWrap.classList.remove('hidden');
    assignedAssessmentWrap.classList.add('hidden');
    testMode.disabled=false;
    individualLevel.disabled=false;
    questionCount.disabled=false;
    return;
  }

  testModeWrap.classList.add('hidden');
  assignedAssessmentWrap.classList.remove('hidden');

  const isIndividual=joinedSession.testType==='individual';
  testMode.value=isIndividual?'individual':'adaptive';
  testMode.disabled=true;

  if(isIndividual){
    const assignedLevel=Number(joinedSession.level||1);
    const assignedCount=String(joinedSession.questionCount||'8');
    individualLevel.value=String(assignedLevel);
    questionCount.value=assignedCount;
    individualLevel.disabled=true;
    questionCount.disabled=true;
    individualLevelWrap.classList.remove('hidden');
    questionCountWrap.classList.remove('hidden');

    assignedAssessmentType.textContent=`Individual Level Test — Level ${assignedLevel}`;
    assignedAssessmentDetails.textContent=`${assignedCount==='all'?'All available':assignedCount} questions • Assigned by teacher`;
  }else{
    individualLevelWrap.classList.add('hidden');
    questionCountWrap.classList.add('hidden');
    individualLevel.disabled=false;
    questionCount.disabled=false;

    assignedAssessmentType.textContent='Adaptive Test';
    assignedAssessmentDetails.textContent='40 questions • Assigned by teacher';
  }
}

testMode.onchange=()=>{
  if(joinedSession && joinedStudent){
    applyStudentSessionAssignment();
    return;
  }
  const isIndividual=testMode.value==='individual';
  individualLevelWrap.classList.toggle('hidden',!isIndividual);
  questionCountWrap.classList.toggle('hidden',!isIndividual);
};

beginTestBtn.onclick=async()=>{
  const name=studentName.value.trim();
  const grade=studentGrade.value;
  const window=testWindow.value;
  const mode=(joinedSession && joinedStudent)
    ? (joinedSession.testType==='individual'?'individual':'adaptive')
    : testMode.value;

  if(!name||!grade){
    alert('Please enter student name and grade.');
    return;
  }

  sessionPausedByTeacher=false;

  if(joinedSession && joinedStudent && pendingResumeProgress && restoreTestProgress(pendingResumeProgress)){
    studentName.value=state.studentName;
    studentGrade.value=state.grade;
    testWindow.value=state.window;
    await cloudSetStudentJoin(joinedSession.key,joinedStudent.key,"testing");
    await startStudentRuntimeWatch();
    showView('test');
    pendingResumeProgress=null;
    beginTestBtn.textContent='Begin Test';
    resumeProgressNotice.classList.add('hidden');
    render();
    return;
  }

  state=fresh();
  state.studentName=name;
  state.grade=grade;
  state.window=window;
  state.mode=mode;

  if(joinedSession && joinedStudent){
    await cloudSetStudentJoin(joinedSession.key,joinedStudent.key,"testing");
    await startStudentRuntimeWatch();
  }

  showView('test');

  if(mode==='individual'){
    const level=(joinedSession && joinedStudent)
      ? Number(joinedSession.level||1)
      : Number(individualLevel.value);
    const count=(joinedSession && joinedStudent)
      ? String(joinedSession.questionCount||'8')
      : questionCount.value;
    beginIndividual(level,count);
  }else{
    beginLevel(2);
  }
};



closeLiveMonitorBtn.onclick=closeLiveMonitor;
if(window.fullScreenLiveMonitorBtn){
  fullScreenLiveMonitorBtn.onclick=toggleLiveMonitorFullScreen;
}
if(window.openLiveMonitorTabBtn){
  openLiveMonitorTabBtn.onclick=openCurrentMonitorInNewTab;
}
createSessionBtn.onclick=()=>openSessionForm();
cancelSessionBtn.onclick=closeSessionForm;
saveSessionBtn.onclick=persistSession;
generateSessionNameBtn.onclick=()=>sessionName.value=generateSessionName();
generatePasswordBtn.onclick=()=>sessionPassword.value=generateSessionPassword();
sessionTestType.onchange=()=>{
  const isIndividual=sessionTestType.value==='individual';
  sessionLevelWrap.classList.toggle('hidden',!isIndividual);
  sessionQuestionCountWrap.classList.toggle('hidden',!isIndividual);
};
selectAllSessionStudentsBtn.onclick=()=>sessionStudentChecklist.querySelectorAll('input[type="checkbox"]').forEach(x=>x.checked=true);
clearSessionStudentsBtn.onclick=()=>sessionStudentChecklist.querySelectorAll('input[type="checkbox"]').forEach(x=>x.checked=false);

studentIdMode.onchange=()=>applyStudentIdMode(studentIdMode.value);
addStudentBtn.onclick=()=>openStudentForm();
saveStudentBtn.onclick=persistStudent;
cancelStudentBtn.onclick=closeStudentForm;


let joinedSession=null;
let joinedStudent=null;

joinSessionBtn.onclick=async()=>{
  stopStudentRuntimeWatch();
  pendingResumeProgress=null;
  sessionPausedByTeacher=false;
  lastHandledControlNonce=null;
  joinSessionError.classList.add('hidden');
  try{
    await cloudEnsureStudentAuth();
  }catch(err){
    console.error('Student authentication failed:',err);
    joinSessionError.textContent='Could not connect to Firebase Authentication.';
    joinSessionError.classList.remove('hidden');
    return;
  }
  const name=joinSessionName.value.trim();
  const password=joinSessionPassword.value.trim();

  if(!name || !password){
    joinSessionError.textContent='Enter the session name and password.';
    joinSessionError.classList.remove('hidden');
    return;
  }

  const session=await cloudJoinSession(name,password);
  if(!session){
    joinSessionError.textContent='Active session not found or password is incorrect.';
    joinSessionError.classList.remove('hidden');
    return;
  }

  joinedSession=session;

  const allowed=[...(session.studentSummaries||[])]
    .sort((a,b)=>a.name.localeCompare(b.name));

  joinStudentSelect.innerHTML='';
  allowed.forEach(student=>{
    const opt=document.createElement('option');
    opt.value=student.key;
    opt.textContent=`${student.name} — Grade ${student.grade}`;
    joinStudentSelect.appendChild(opt);
  });

  if(!allowed.length){
    joinSessionError.textContent='No students are assigned to this session.';
    joinSessionError.classList.remove('hidden');
    return;
  }

  joinStudentWrap.classList.remove('hidden');
  confirmStudentJoinBtn.classList.remove('hidden');
  joinSessionBtn.classList.add('hidden');
};

confirmStudentJoinBtn.onclick=async()=>{
  const student=(joinedSession?.studentSummaries||[])
    .find(s=>s.key===joinStudentSelect.value);
  if(!student || !joinedSession) return;

  joinSessionError.classList.add('hidden');
  joinSessionError.textContent='';
  confirmStudentJoinBtn.disabled=true;
  confirmStudentJoinBtn.textContent='Joining…';

  try{
    joinedStudent=student;
    await cloudSetStudentJoin(joinedSession.key,student.key,"waiting");
  }catch(error){
    console.error('KLGA student join failed:',error);
    joinedStudent=null;
    joinSessionError.textContent=
      'Unable to continue with this student. An earlier test session may still be active or already finished. Please ask your teacher to End Test or Terminate & Restart this student, then try again.';
    joinSessionError.classList.remove('hidden');
    confirmStudentJoinBtn.disabled=false;
    confirmStudentJoinBtn.textContent='Continue';
    return;
  }

  waitingApprovalWrap.classList.remove("hidden");
  confirmStudentJoinBtn.classList.add("hidden");
  confirmStudentJoinBtn.disabled=false;
  confirmStudentJoinBtn.textContent='Continue';

  if(stopStudentStatusListener) stopStudentStatusListener();

  stopStudentStatusListener=await cloudSubscribeStudentStatus(
    joinedSession.key,
    student.key,
    async statusRecord=>{
      if(statusRecord?.status!=="approved") return;

      if(stopStudentStatusListener) stopStudentStatusListener();
      stopStudentStatusListener=null;

      studentName.value=student.name;
      studentGrade.value=student.grade;

      applyStudentSessionAssignment();

      try{
        const savedProgress=statusRecord?.testProgress
          || await cloudLoadStudentProgress(joinedSession.key,student.key);
        updateResumeSetupUI(savedProgress);
      }catch(err){
        console.warn('Could not load saved KLGA progress:',err);
        updateResumeSetupUI(null);
      }

      sessionPausedByTeacher=false;
      lastHandledControlNonce=null;
      await startStudentRuntimeWatch();

      waitingApprovalWrap.classList.add("hidden");
      showView("setup");
    }
  );
};


nextQuestionBtn.onclick=submit;
exportCsvBtn.onclick=exportCsv;

clearResultsBtn.onclick=async()=>{
  const count=teacherResultCache.length;
  if(!count) return;

  const approved=await confirmClearResults({
    title:'Clear ALL KLGA Results?',
    message:'This will permanently delete every saved assessment result across all school years, seasons, and grades.',
    scope:`ALL RESULTS • ${count} result${count===1?'':'s'}`,
    confirmLabel:`Clear All ${count} Result${count===1?'':'s'}`
  });

  if(!approved) return;

  clearResultsBtn.disabled=true;
  try{
    await cloudClearResults();
    await renderDashboard();

  }catch(err){
    console.error('Clear results failed:',err);
    alert('Could not clear Firebase results. Check Firestore connection and rules.');
  }finally{
    clearResultsBtn.disabled=false;
  }
};


/* Close fullscreen views with Escape. */
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape') return;

  if(liveSessionMonitor?.classList.contains('is-screen-open')){
    setLiveMonitorFullScreen(false);
    return;
  }

  const section=document.querySelector('.grade-results-section.is-screen-open');
  if(!section) return;
  section.classList.remove('is-screen-open');
  document.body.classList.remove('grade-result-screen-open');
  const btn=section.querySelector('.grade-fullscreen-btn');
  if(btn) btn.textContent='Full Screen';
});


/* Dedicated monitor refresh fallback. */
if(document.readyState!=='loading' && monitorSessionKeyFromUrl()){
  bootstrapDedicatedMonitorMode();
}
