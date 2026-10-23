/* GLN shareable section links — keeps GitHub Pages as one static HTML page.
 * URL examples: #type, #practice, #games, #tools/dashboard, #tools/grouping.
 * Kiosk and conference invitation URLs are deliberately left alone.
 */
(()=>{
  'use strict';
  const STATE_KEY='glnCurrentPageThisTabV1';
  const SCROLL_KEY='glnCurrentPageScrollThisTabV1';
  const classroomModes=[
    'dashboard','calculator','number-generator','schedule-timer','quiz',
    'wheel','grouping','flashcards','event-signup','bus-call','seating'
  ];
  const panelIds={
    dashboard:'classroomDashboardPanel',calculator:'calculatorPanel',
    'number-generator':'numberGeneratorPanel','schedule-timer':'scheduleTimerPanel',
    quiz:'quizView',wheel:'wheelPanel',grouping:'groupingPanel',
    flashcards:'flashcardsPanel','event-signup':'eventSignupPanel',
    'bus-call':'busCallPanel',seating:'seatingPanel'
  };
  const params=new URLSearchParams(location.search);
  // Public conference pages, editor invitations and managed student quiz links
  // control their own navigation, and must not expose/override their routes.
  if(params.has('signup')||params.has('eventEditor')||params.get('kiosk')==='quiz')return;

  const element=id=>document.getElementById(id);
  const visible=id=>{const node=element(id);return !!node&&!node.hidden};
  function currentRoute(){
    if(visible('calculatorView')){
      for(const mode of classroomModes)if(visible(panelIds[mode]))return `tools:${mode}`;
      return 'tools:dashboard';
    }
    if(visible('gamesView'))return 'games';
    if(visible('practiceView'))return 'practice';
    return 'type';
  }
  function validRoute(route){
    return route==='type'||route==='practice'||route==='games'||
      (typeof route==='string'&&route.startsWith('tools:')&&classroomModes.includes(route.slice(6)));
  }
  function hashForRoute(route){
    return '#'+(route.startsWith('tools:')?'tools/'+route.slice(6):route);
  }
  function routeFromHash(){
    const hash=location.hash.slice(1);
    if(hash==='type'||hash==='practice'||hash==='games')return hash;
    if(hash.startsWith('tools/')){
      const mode=hash.slice(6);
      if(classroomModes.includes(mode))return 'tools:'+mode;
    }
    // Accept a shorthand for classroom dashboard as well.
    if(hash==='tools')return 'tools:dashboard';
    return null;
  }
  function saveRoute(route){
    if(!validRoute(route))return;
    try{sessionStorage.setItem(STATE_KEY,route)}catch(_){}
  }
  let restoring=false;
  function displayRoute(route){
    if(!validRoute(route))return;
    restoring=true;
    try{
      if(route==='type'||route==='practice'){
        if(typeof showView==='function')showView(route);
        if(typeof closeCalculator==='function')closeCalculator();
      }else if(route==='games'){
        if(typeof openGames==='function')openGames();
        if(typeof closeCalculator==='function')closeCalculator();
      }else if(typeof openCalculator==='function'){
        // Use the existing Classroom Tools renderer, including its quiz mode.
        // This only opens the section; it does not resume a quiz session.
        openCalculator(route.slice(6));
      }
    }finally{restoring=false}
    saveRoute(route);
  }
  function setUrl(route,replace=false){
    if(!validRoute(route))return;
    const target=hashForRoute(route);
    if(location.hash===target)return;
    const url=location.pathname+location.search+target;
    // Push on a user navigation, replace during initial restoration.
    if(replace)history.replaceState(history.state,'',url);
    else history.pushState({glnNavigationRoute:route},'',url);
  }
  function syncFromView(){
    if(restoring||document.body.classList.contains('event-signup-public-mode')||
       document.body.classList.contains('quiz-kiosk-mode'))return;
    const route=currentRoute();
    saveRoute(route);
    setUrl(route);
  }

  // Explicit deep links win over any previous tab's remembered position.
  // Old URLs without fragments keep the previous refresh-restoration behavior.
  const linkedRoute=routeFromHash();
  let savedRoute=null,scrollY=null;
  try{
    const remembered=sessionStorage.getItem(STATE_KEY);
    if(validRoute(remembered))savedRoute=remembered;
    const scroll=JSON.parse(sessionStorage.getItem(SCROLL_KEY)||'null');
    if(scroll&&scroll.route===savedRoute&&Number.isFinite(scroll.y)&&scroll.y>=0)scrollY=scroll.y;
  }catch(_){}
  const startRoute=linkedRoute||savedRoute||'type';
  if(startRoute!=='type')displayRoute(startRoute);
  else saveRoute('type');
  setUrl(startRoute,true);

  // Navigation buttons already switch panels through existing app handlers.
  // Record the resulting view without replacing those handlers.
  document.addEventListener('click',event=>{
    if(event.target.closest('#navType,#navPractice,#navGames,#navTools,'+
      '#showDashboard,#showCalculator,#showNumberGenerator,#showScheduleTimer,'+
      '#showQuiz,#showWheel,#showGrouping,#showFlashcards,#showEventSignup,'+
      '#showBusCall,#showSeating,[data-dashboard-tool]')){
      setTimeout(syncFromView,0);
    }
  });

  // Covers non-click navigation too, such as opening a tool from another panel.
  // Only observe top-level view/panel visibility, not changing quiz questions.
  const watched=['typeView','practiceView','gamesView','calculatorView',...Object.values(panelIds)];
  const observer=new MutationObserver(()=>{
    if(restoring)return;
    queueMicrotask(syncFromView);
  });
  for(const id of watched){
    const node=element(id);
    if(node)observer.observe(node,{attributes:true,attributeFilter:['hidden']});
  }

  function followUrl(){
    const route=routeFromHash();
    // Unknown anchors aren't GLN navigation requests.
    if(!route)return;
    if(route!==currentRoute())displayRoute(route);
    else saveRoute(route);
  }
  window.addEventListener('popstate',followUrl);
  window.addEventListener('hashchange',followUrl);

  // Preserve existing scroll-on-refresh support only for an unchanged route.
  if(startRoute===savedRoute&&scrollY!==null){
    const restoreScroll=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(currentRoute()===startRoute)window.scrollTo({top:scrollY,behavior:'instant'});
    }));
    if(document.readyState==='complete')restoreScroll();
    else window.addEventListener('load',restoreScroll,{once:true});
  }
  window.addEventListener('pagehide',()=>{
    const route=currentRoute();
    saveRoute(route);
    try{sessionStorage.setItem(SCROLL_KEY,JSON.stringify({route,y:window.scrollY||0}))}catch(_){}
  });
})();
