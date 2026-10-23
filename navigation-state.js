/* GLN navigation refresh restoration.
 * Keeps the currently open top-level section and Classroom Tool in this tab.
 * Does not restore sensitive or ephemeral quiz/student session state.
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
  // Shared event links and dedicated classroom quiz kiosks own their routes.
  if(params.has('signup')||params.has('eventEditor')||params.get('kiosk')==='quiz')return;
  const element=id=>document.getElementById(id);
  const isVisible=id=>{const node=element(id);return !!node&&!node.hidden};
  function currentRoute(){
    if(isVisible('calculatorView')){
      // quizView is a separate section shown in the Classroom Tools shell.
      for(const mode of classroomModes){if(isVisible(panelIds[mode]))return `tools:${mode}`}
      return 'tools:dashboard';
    }
    if(isVisible('gamesView'))return 'games';
    if(isVisible('practiceView'))return 'practice';
    return 'type';
  }
  function validRoute(route){
    return route==='type'||route==='practice'||route==='games'||
      (typeof route==='string'&&route.startsWith('tools:')&&classroomModes.includes(route.slice(6)));
  }
  function saveRoute(){
    try{
      if(document.body.classList.contains('event-signup-public-mode') ||
         document.body.classList.contains('quiz-kiosk-mode'))return;
      sessionStorage.setItem(STATE_KEY,currentRoute());
    }catch(_){/* Storage is optional, e.g. restricted/incognito environments. */}
  }
  function restoreRoute(route){
    if(route==='type')return; // The default initial view is already Type.
    if(route==='practice'&&typeof showView==='function')showView('practice');
    else if(route==='games'&&typeof openGames==='function')openGames();
    else if(route.startsWith('tools:')&&typeof openCalculator==='function'){
      openCalculator(route.slice(6));
    }
  }
  let lastRoute='';
  let savedScroll=null;
  try{
    const remembered=sessionStorage.getItem(STATE_KEY);
    if(validRoute(remembered)){
      lastRoute=remembered;
      const pos=JSON.parse(sessionStorage.getItem(SCROLL_KEY)||'null');
      if(pos?.route===remembered&&Number.isFinite(pos.y)&&pos.y>=0)savedScroll=pos.y;
      restoreRoute(remembered);
    }
  }catch(_){/* Invalid or unavailable storage should never break navigation. */}
  // Record user navigation as soon as it happens, not only when the tab closes.
  // The timeout lets existing onClick handlers first switch the visible section.
  document.addEventListener('click',event=>{
    if(event.target.closest('#navType,#navPractice,#navGames,#navTools,'+
      '#showDashboard,#showCalculator,#showNumberGenerator,#showScheduleTimer,'+
      '#showQuiz,#showWheel,#showGrouping,#showFlashcards,#showEventSignup,'+
      '#showBusCall,#showSeating,[data-dashboard-tool]')){
      setTimeout(saveRoute,0);
    }
  });
  // Also captures programmatic navigation (e.g. opening Seating Chart from Dashboard).
  window.addEventListener('pagehide',()=>{
    saveRoute();
    try{sessionStorage.setItem(SCROLL_KEY,JSON.stringify({route:currentRoute(),y:window.scrollY||0}))}catch(_){}
  });
  // Restore scroll location as well as the section, so a refresh does not
  // jump to the top of a long Classroom Tools page. No saved position is
  // applied after a normal, user-triggered navigation.
  if(lastRoute && savedScroll!==null){
    const returnToPosition=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(currentRoute()!==lastRoute)return;
      window.scrollTo({top:savedScroll,behavior:'instant'});
    }));
    if(document.readyState==='complete')returnToPosition();
    else window.addEventListener('load',returnToPosition,{once:true});
  }
})();
