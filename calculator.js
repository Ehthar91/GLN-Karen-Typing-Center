const navCalculator=document.querySelector('#navCalculator');
const calculatorView=document.querySelector('#calculatorView');
function closeCalculator(){
  calculatorView.hidden=true;
  navCalculator.classList.remove('active');
  document.body.classList.remove('calculator-open');
}
function openCalculator(){
  typeView.hidden=true;
  practiceView.hidden=true;
  gamesView.hidden=true;
  quizView.hidden=true;
  calculatorView.hidden=false;
  navType.classList.remove('active');
  navPractice.classList.remove('active');
  navGames.classList.remove('active');
  navQuiz.classList.remove('active');
  navCalculator.classList.add('active');
  document.body.classList.add('calculator-open');
  if(typeof stopGame==='function')stopGame();
  if(typeof closeRace==='function')closeRace();
  window.scrollTo({top:0,behavior:'smooth'});
}
navCalculator.onclick=openCalculator;
navType.addEventListener('click',closeCalculator);
navPractice.addEventListener('click',closeCalculator);
navGames.addEventListener('click',closeCalculator);
navQuiz.addEventListener('click',closeCalculator);
