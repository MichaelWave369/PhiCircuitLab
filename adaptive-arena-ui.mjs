import {
  runArena,runTournament,CONTROLLERS,CHAMBERS,COATINGS
} from './adaptive-arena-engine.mjs';

const $=id=>document.getElementById(id);
const form=$('arena-form');
const ORDER=Object.keys(CONTROLLERS);
const COLORS={fixed:'#94a3b8',rules:'#55e2df',learned:'#ffc578',reserve:'#b89aff'};
const NOTEBOOK_KEY='phi-circuit-lab-arena-notebook-v1';
const METRIC_LABELS=[
  ['PV input','solarWh'],['Demand requested','demandWh'],
  ['Demand served','servedWh'],['Demand unserved','unservedWh'],
  ['Converter + storage losses','lossWh'],['Curtailed PV','spilledWh'],
  ['Battery at start','batteryStartWh'],['Battery at end','batteryEndWh'],
  ['Energy balance residual','energyResidualWh']
];
const format=(n,d=1)=>Number(n).toLocaleString(undefined,{maximumFractionDigits:d});
const pct=n=>format(n*100,1)+'%';
let current=null;
let cursor=144;
let saved=[];
function getSettings(){
  const fd=new FormData(form);
  return {
    chamber:fd.get('chamber'),coating:fd.get('coating'),
    pvW:Number(fd.get('pvW')),batteryWh:Number(fd.get('batteryWh')),
    loadW:Number(fd.get('loadW')),stress:Number(fd.get('stressPct'))/100,
    seed:Number(fd.get('seed')),trialSeed:Number(fd.get('trialSeed'))
  };
}
function updateOutputs(){
  for(const [id,suffix] of [['pv',' W'],['battery',' Wh'],['load',' W'],['stress','%']]){
    $('arena-'+id+'-value').textContent=$('arena-'+id).value+suffix;
  }
}
function setStatus(message){$('arena-status').textContent=message;}
function makeElement(tag,text,cls){
  const el=document.createElement(tag);if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);return el;
}
function populateStandings(){
  const parent=$('arena-podium');parent.replaceChildren();
  current.rankings.forEach((key,i)=>{
    const t=current.runs[key].totals;
    const tile=makeElement('article');
    tile.style.setProperty('--item-color',COLORS[key]);
    tile.append(makeElement('small','POSITION '+(i+1),'arena-rank'),
      makeElement('small',CONTROLLERS[key]),
      makeElement('strong',pct(t.reliability)),
      makeElement('small',format(t.servedWh)+' Wh delivered'),
      makeElement('small',t.thermalAlarmMinutes+' min thermal alarm'));
    const bar=makeElement('div',undefined,'arena-bar');
    const fill=makeElement('span');fill.style.width=(100*t.reliability).toFixed(2)+'%';
    bar.append(fill);tile.append(bar);parent.append(tile);
  });
  const baseline=current.runs.fixed.totals;
  const winner=current.runs[current.rankings[0]].totals;
  const delta=100*(winner.servedWh-baseline.servedWh)/baseline.demandWh;
  $('arena-notes').textContent='Best for this scenario: '+CONTROLLERS[current.rankings[0]]+
    '. Change from the fixed baseline: '+(delta>0?'+':'')+format(delta,2)+
    ' percentage points of requested load served. Lower unserved demand wins the primary comparison. The trained policy is not guaranteed to win.';
}
function populateEnergy(){
  const rows=$('arena-energy-rows');rows.replaceChildren();
  for(const [title,key] of METRIC_LABELS){
    const tr=makeElement('tr');
    const th=makeElement('th',title);th.scope='row';tr.append(th);
    for(const controller of ORDER){
      const value=current.runs[controller].totals[key];
      tr.append(makeElement('td',format(value,4)+' Wh'));
    }
    rows.append(tr);
  }
}
function drawWave(svgId,series,maxValue,minValue=0){
  const svg=$(svgId);
  const W=720,H=155,left=48,right=11,top=10,bottom=25;
  const width=W-left-right,height=H-top-bottom;
  const range=Math.max(0.001,maxValue-minValue);
  const x=index=>left+width*index/287;
  const y=value=>top+height*(1-(Math.min(maxValue,Math.max(minValue,value))-minValue)/range);
  let html='';
  for(let n=0;n<4;n++){
    const yy=top+n*height/3;
    const tick=maxValue-n*range/3;
    html+='<line class="arena-gridline" x1="'+left+'" x2="'+(left+width)+'" y1="'+yy+'" y2="'+yy+'"/>';
    html+='<text class="arena-tick" x="'+(left-5)+'" y="'+(yy+3)+'" text-anchor="end">'+format(tick,1)+'</text>';
  }
  for(let h=0;h<=24;h+=6){
    const xx=left+width*h/24;
    html+='<text class="arena-tick" x="'+xx+'" y="'+(H-5)+'" text-anchor="middle">'+h+'h</text>';
  }
  for(const item of series){
    const d=item.values.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
    html+='<path d="'+d+'" stroke="'+item.color+'" stroke-width="2.4" fill="none" stroke-linejoin="round"'+
      (item.dashed?' stroke-dasharray="6 4"':'')+'/>';
  }
  html+='<line x1="'+x(cursor).toFixed(1)+'" x2="'+x(cursor).toFixed(1)+'" y1="'+top+
    '" y2="'+(top+height)+'" stroke="#edf4ff" stroke-width="1.7" stroke-dasharray="3 3"/>';
  svg.innerHTML=html;
}
function updateScope(){
  if(!current)return;
  const selected=$('arena-controller').value;
  const trace=current.runs[selected].trace;
  const item=trace[cursor];
  const totalMinutes=Math.floor(item.hour*60);
  $('probe-time').textContent=String(Math.floor(totalMinutes/60)).padStart(2,'0')+':'+String(totalMinutes%60).padStart(2,'0');
  $('probe-volts').textContent=format(item.busV)+' V';
  $('probe-amps').textContent=format(item.busA,3)+' A';
  $('probe-power').textContent=format(item.deliveredW)+' W';
  $('probe-core').textContent=format(item.coreC)+' °C';
  $('probe-soc').textContent=format(item.socPercent)+'%';
  const get=prop=>trace.map(t=>t[prop]);
  drawWave('scope-volts',[{values:get('busV'),color:COLORS[selected]}],55);
  drawWave('scope-current',[{values:get('busA'),color:COLORS[selected]}],
    Math.max(1,...get('busA'))*1.12);
  drawWave('scope-power',[{values:get('deliveredW'),color:COLORS[selected]},
    {values:get('demandW'),color:'#b89aff',dashed:true}],
    Math.max(100,...get('demandW'))*1.1);
  const temp=[...get('coreC'),...get('observedCoreC')];
  drawWave('scope-temperature',[{values:get('coreC'),color:COLORS[selected]},
    {values:get('observedCoreC'),color:'#ffc578',dashed:true}],
    Math.max(55,...temp)*1.10,Math.min(0,...temp)-3);
}
function render(){
  populateStandings();populateEnergy();updateScope();
  $('arena-tournament').hidden=true;
  setStatus(current.options.chamber.toUpperCase()+' • COMPLETE');
}
function execute(){
  setStatus('CALCULATING');
  current=runArena(getSettings());
  render();
}
function showFullTournament(){
  setStatus('RUNNING TOURNAMENT');
  const result=runTournament(getSettings(),3);
  const body=$('arena-tournament-rows');body.replaceChildren();
  for(const item of result.cases){
    const tr=makeElement('tr');
    tr.append(makeElement('th',CHAMBERS[item.chamber]),makeElement('td',CONTROLLERS[item.winner]));
    for(const controller of ORDER)tr.append(makeElement('td',pct(item.scores[controller].servedWh/item.scores[controller].demandWh)));
    body.append(tr);
  }
  const lead=result.ranking[0];
  $('arena-tournament-summary').textContent='Overall leader: '+CONTROLLERS[lead]+
    ' • '+result.cases.length+' chamber conditions × '+result.seeds+
    ' held-out evaluation seeds. Every controller sees the same trials; energy-balance residuals remain near zero. Ranking covers this synthetic test set only.';
  $('arena-tournament').hidden=false;
  setStatus('FULL TOURNAMENT COMPLETE');
}
function download(filename,mime,contents){
  const url=URL.createObjectURL(new Blob([contents],{type:mime}));
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportTrace(){
  if(!current)return;
  const columns=['hour','pv_W','load_demand_W'];
  for(const k of ORDER)columns.push(k+'_bus_V',k+'_current_A',k+'_delivered_W',
    k+'_core_C',k+'_observed_core_C',k+'_soc_percent',k+'_mode');
  const rows=[columns.join(',')];
  for(let i=0;i<288;i++){
    const first=current.runs.fixed.trace[i];
    const row=[first.hour.toFixed(4),first.pvW.toFixed(4),first.demandW.toFixed(4)];
    for(const key of ORDER){
      const t=current.runs[key].trace[i];
      row.push(...[t.busV,t.busA,t.deliveredW,t.coreC,t.observedCoreC,t.socPercent].map(n=>n.toFixed(4)),t.mode);
    }
    rows.push(row.join(','));
  }
  download('phi-arena-traces.csv','text/csv;charset=utf-8',rows.join('\n')+'\n');
}
function loadNotebook(){
  try{
    const data=JSON.parse(localStorage.getItem(NOTEBOOK_KEY)||'[]');
    return Array.isArray(data)?data.filter(x=>x&&typeof x==='object'&&
      typeof x.date==='string'&&typeof x.chamber==='string'&&typeof x.winner==='string').slice(0,36):[];
  }catch{return []}
}
function writeNotebook(){
  try{localStorage.setItem(NOTEBOOK_KEY,JSON.stringify(saved));return true}
  catch{$('arena-book-message').textContent='Browser storage blocked or full. Export the notebook instead.';return false}
}
function showNotebook(){
  const body=$('arena-notebook-rows');body.replaceChildren();
  if(!saved.length){
    const tr=makeElement('tr');const td=makeElement('td','No saved runs yet. Run an experiment and save it.');
    td.colSpan=6;td.style.textAlign='left';tr.append(td);body.append(tr);return;
  }
  for(const item of saved){
    const tr=makeElement('tr');
    const fields=[
      new Date(item.date).toLocaleString(),
      CHAMBERS[item.chamber]||item.chamber,
      COATINGS[item.coating]?.label||item.coating,
      CONTROLLERS[item.winner]||item.winner,
      Number.isFinite(item.deliveredFraction)?pct(item.deliveredFraction):'—',
      String(item.note||'').slice(0,160)
    ];
    fields.forEach(value=>tr.append(makeElement('td',value)));
    body.append(tr);
  }
}
function saveRun(){
  if(!current)return;
  const winner=current.rankings[0];
  const entry={
    version:1,date:new Date().toISOString(),
    chamber:current.options.chamber,coating:current.options.coating,
    config:{...current.options.config,trialSeed:current.options.trialSeed},
    winner,deliveredFraction:current.runs[winner].totals.reliability,
    result:Object.fromEntries(ORDER.map(k=>[k,{...current.runs[k].totals}])),
    note:$('arena-note').value.slice(0,160)
  };
  saved=[entry,...saved].slice(0,36);
  if(writeNotebook()){
    $('arena-book-message').textContent='Experiment saved locally. '+saved.length+' record(s).';
    showNotebook();
  }
}
function exportNotebook(){
  download('phi-arena-experiment-notebook.json','application/json',
    JSON.stringify({format:'phi-arena-notebook-v1',exportedAt:new Date().toISOString(),entries:saved},null,2));
}
function clearNotebook(){
  if(!saved.length)return;
  if(!window.confirm('Clear all locally saved Adaptive Systems Arena experiments? Export first if needed.'))return;
  saved=[];if(writeNotebook()){showNotebook();$('arena-book-message').textContent='Local notebook cleared.'}
}
form.addEventListener('input',updateOutputs);
form.addEventListener('submit',event=>{event.preventDefault();execute()});
$('arena-all').addEventListener('click',showFullTournament);
$('arena-controller').addEventListener('change',updateScope);
$('arena-time').addEventListener('input',event=>{cursor=Number(event.target.value);updateScope()});
$('arena-save').addEventListener('click',saveRun);
$('arena-clear').addEventListener('click',clearNotebook);
$('arena-export-trace').addEventListener('click',exportTrace);
$('arena-export-book').addEventListener('click',exportNotebook);
saved=loadNotebook();showNotebook();updateOutputs();execute();
