(()=>{
  const params=new URLSearchParams(location.search);
  const kiosk=params.get('kiosk');
  if(kiosk!=='quiz')return;

  window.GLN_QUIZ_KIOSK=true;
  document.documentElement.classList.add('quiz-kiosk-document');
  document.body.classList.add('quiz-kiosk-mode');

  function ensureWelcome(){
    const builder=document.querySelector('#quizBuilder');
    const join=document.querySelector('.quiz-join-card');
    if(!builder||!join||document.querySelector('#quizKioskWelcome'))return;
    const welcome=document.createElement('section');
    welcome.className='quiz-kiosk-welcome';
    welcome.id='quizKioskWelcome';
    welcome.innerHTML='<img src="logo.png" alt="GLN Karen Typing Center"><p>CLASSROOM QUIZ</p><h1>Join your teacher\'s quiz</h1><small>Enter the room code and your name to begin.</small>';
    builder.insertBefore(welcome,join);
  }

  function applyKioskShell(){
    document.documentElement.classList.add('quiz-kiosk-document');
    document.body.classList.add('quiz-kiosk-mode');
    if(typeof openQuiz==='function')openQuiz();
    else{
      const type=document.querySelector('#typeView'),practice=document.querySelector('#practiceView'),games=document.querySelector('#gamesView'),tools=document.querySelector('#calculatorView'),quiz=document.querySelector('#quizView');
      if(type)type.hidden=true;if(practice)practice.hidden=true;if(games)games.hidden=true;if(tools)tools.hidden=false;if(quiz)quiz.hidden=false;
    }
    ensureWelcome();
    const classRoom=document.querySelector('#quizClassroom');
    const builder=document.querySelector('#quizBuilder');
    if(builder&&(!classRoom||classRoom.hidden))builder.hidden=false;
    document.title='GLN Classroom Quiz';
  }

  // Keep the special kiosk URL stable so refresh/relaunch returns to the student quiz shell.
  try{
    const url=new URL(location.href);
    url.searchParams.set('kiosk','quiz');
    history.replaceState({glnQuizKiosk:true},'',url.pathname+url.search+url.hash);
  }catch{}

  applyKioskShell();
  window.addEventListener('pageshow',applyKioskShell);

  // This does not pretend to create OS-level kiosk security itself. On managed
  // ChromeOS, the Admin console can launch this exact URL as the kiosk web app.
  document.addEventListener('click',event=>{
    const brand=event.target.closest('.brand');
    if(brand){event.preventDefault();applyKioskShell()}
  });
})();
