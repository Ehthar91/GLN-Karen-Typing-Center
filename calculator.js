const navCalculator=document.querySelector('#navCalculator');
const calculatorView=document.querySelector('#calculatorView');
const calculatorPanel=document.querySelector('#calculatorPanel');
const converterPanel=document.querySelector('#converterPanel');
const showCalculators=document.querySelector('#showCalculators');
const showConverter=document.querySelector('#showConverter');
const calculatorTitle=document.querySelector('#calculator-title');
const calculatorHint=document.querySelector('#calculatorHint');
const converterCategory=document.querySelector('#converterCategory');
const converterInput=document.querySelector('#converterInput');
const converterFrom=document.querySelector('#converterFrom');
const converterTo=document.querySelector('#converterTo');
const converterOutput=document.querySelector('#converterOutput');
const converterEquation=document.querySelector('#converterEquation');
const unitGroups={
  weight:{label:'Weight',base:'kg',units:{lb:['Pounds (lb)',0.45359237],kg:['Kilograms (kg)',1],oz:['Ounces (oz)',0.028349523125],g:['Grams (g)',0.001]}},
  temperature:{label:'Temperature',units:{F:['Fahrenheit (°F)'],C:['Celsius (°C)'],K:['Kelvin (K)']}},
  length:{label:'Length',base:'m',units:{in:['Inches (in)',0.0254],ft:['Feet (ft)',0.3048],yd:['Yards (yd)',0.9144],mi:['Miles (mi)',1609.344],mm:['Millimeters (mm)',0.001],cm:['Centimeters (cm)',0.01],m:['Meters (m)',1],km:['Kilometers (km)',1000]}},
  volume:{label:'Volume',base:'L',units:{cup:['US Cups',0.2365882365],pt:['US Pints',0.473176473],qt:['US Quarts',0.946352946],gal:['US Gallons',3.785411784],mL:['Milliliters (mL)',0.001],L:['Liters (L)',1]}},
  area:{label:'Area',base:'m²',units:{sqin:['Square inches',0.00064516],sqft:['Square feet',0.09290304],sqyd:['Square yards',0.83612736],acre:['Acres',4046.8564224],sqcm:['Square centimeters',0.0001],sqm:['Square meters',1],ha:['Hectares',10000]}},
  speed:{label:'Speed',base:'m/s',units:{mph:['Miles per hour (mph)',0.44704],kmh:['Kilometers per hour (km/h)',0.2777777777777778],ms:['Meters per second (m/s)',1]}},
  time:{label:'Time',base:'seconds',units:{sec:['Seconds',1],min:['Minutes',60],hr:['Hours',3600],day:['Days',86400]}}
};
const defaultUnits={weight:['lb','kg'],temperature:['F','C'],length:['in','cm'],volume:['gal','L'],area:['sqft','sqm'],speed:['mph','kmh'],time:['min','hr']};
function setCalculatorMode(mode){
  const converter=mode==='converter';
  calculatorPanel.hidden=converter;
  converterPanel.hidden=!converter;
  showCalculators.classList.toggle('active',!converter);
  showConverter.classList.toggle('active',converter);
  calculatorTitle.textContent=converter?'Unit Converter':'Graphing & Scientific Calculator';
  calculatorHint.textContent=converter?'Convert common measurements instantly.':'Choose GLN TI-84 or GLN TI-30XS inside the calculator.';
  if(converter)setTimeout(()=>converterInput.focus(),0);
}
function fillUnitMenus(){
  const group=unitGroups[converterCategory.value];
  const options=Object.entries(group.units).map(([value,[label]])=>`<option value="${value}">${label}</option>`).join('');
  converterFrom.innerHTML=options;
  converterTo.innerHTML=options;
  [converterFrom.value,converterTo.value]=defaultUnits[converterCategory.value];
  updateConversion();
}
function temperatureToC(value,unit){return unit==='F'?(value-32)*5/9:unit==='K'?value-273.15:value}
function cToTemperature(value,unit){return unit==='F'?value*9/5+32:unit==='K'?value+273.15:value}
function formatConverted(value){
  if(!Number.isFinite(value))return '—';
  const magnitude=Math.abs(value);
  if(magnitude!==0&&(magnitude>=1e9||magnitude<1e-7))return value.toExponential(6);
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:8}).format(value);
}
function updateConversion(){
  const value=Number(converterInput.value);
  if(converterInput.value===''||!Number.isFinite(value)){converterOutput.textContent='—';converterEquation.textContent='Enter a number to convert.';return}
  const group=unitGroups[converterCategory.value];
  let result;
  if(converterCategory.value==='temperature')result=cToTemperature(temperatureToC(value,converterFrom.value),converterTo.value);
  else result=value*group.units[converterFrom.value][1]/group.units[converterTo.value][1];
  const formatted=formatConverted(result);
  converterOutput.textContent=formatted;
  converterEquation.textContent=`${formatConverted(value)} ${converterFrom.value} = ${formatted} ${converterTo.value}`;
}
Object.entries(unitGroups).forEach(([value,group])=>converterCategory.add(new Option(group.label,value)));
fillUnitMenus();
showCalculators.onclick=()=>setCalculatorMode('calculator');
showConverter.onclick=()=>setCalculatorMode('converter');
converterCategory.onchange=fillUnitMenus;
converterInput.oninput=updateConversion;
converterFrom.onchange=updateConversion;
converterTo.onchange=updateConversion;
document.querySelector('#converterSwap').onclick=()=>{const from=converterFrom.value;converterFrom.value=converterTo.value;converterTo.value=from;updateConversion()};
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
