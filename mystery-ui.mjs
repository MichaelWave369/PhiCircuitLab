import { mountWiringLab } from './wiring-lab.mjs';
import { validateCircuit } from './wiring-solver.mjs';
import { DIAGNOSES } from './academy-engine.mjs';
import {
  MYSTERY_CASE_COUNT, MYSTERY_CATALOG, createMysteryCase,
  getFaultedRepairDocument, getCaseDiagnosis, takeMysteryMeasurement,
  evidenceProgress, judgeMysteryDiagnosis, gradeMysteryRepair, mysteryScore
} from './mystery-engine.mjs';

const STORAGE_KEY='phi-circuit-lab-mystery-v1';
const makeSeed=()=>Math.floor(Math.random()*4294967296)>>>0;
const seedValid=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const emptyRecord=()=>({notes:[],choice:'',locked:false,correct:false,lockEvidenceCount:0,
  hint:false,failedChecks:0,score:null,feedback:'',repair:null});
const emptyRun=seed=>({version:1,seed,active:0,records:{}});
const h=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");

function readRun(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(!data||data.version!==1||!seedValid(data.seed)||
      !Number.isInteger(data.active)||data.active<0||data.active>=MYSTERY_CASE_COUNT||
      !data.records||typeof data.records!=='object'||Array.isArray(data.records))return null;
    const run=emptyRun(data.seed);run.active=data.active;
    for(let i=0;i<MYSTERY_CASE_COUNT;i++){
      const raw=data.records[i];
      if(!raw||typeof raw!=='object')continue;
      const record=emptyRecord();
      if(Array.isArray(raw.notes)){
        const existing=new Set();
        for(const note of raw.notes.slice(0,40)){
          try{
            const n=takeMysteryMeasurement(run.seed,i,note);
            if(existing.has(n.key))continue;
            existing.add(n.key);record.notes.push(n);
          }catch(_){/* Ignore old or invalid measurements */ }
        }
      }
      record.choice=DIAGNOSES.some(d=>d.id===raw.choice)?raw.choice:'';
      record.locked=raw.locked===true&&record.choice!==''&&evidenceProgress(record.notes).ready;
      record.correct=record.locked?
        judgeMysteryDiagnosis(run.seed,i,record.choice,record.notes).correct:false;
      record.lockEvidenceCount=record.locked?evidenceProgress(record.notes).count:0;
      record.hint=raw.hint===true;
      record.failedChecks=Number.isInteger(raw.failedChecks)&&raw.failedChecks>=0?
        Math.min(999,raw.failedChecks):0;
      record.feedback=typeof raw.feedback==='string'?raw.feedback.slice(0,300):'';
      if(record.locked&&raw.repair){
        try{record.repair=validateCircuit(raw.repair);}
        catch(_){record.repair=null;}
      }
      // Only restore an earned score when a repair is present and still valid.
      const successful=record.locked&&record.repair&&
        gradeMysteryRepair(run.seed,i,record.repair).ok;
      if(successful&&Number.isInteger(raw.score)&&raw.score>=25&&raw.score<=100)
        record.score=raw.score;
      run.records[i]=record;
    }
    return run;
  }catch(_){return null;}
}
function writeRun(run){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(run));}
  catch(_){/* Best-effort privacy-preserving local persistence. */}
}
const recordFor=(run,i)=>run.records[i]||(run.records[i]=emptyRecord());
function points(run){return Object.values(run.records).reduce((sum,r)=>
  sum+(Number.isInteger(r?.score)?r.score:0),0);}
function cleared(run){return Object.values(run.records).filter(r=>r?.score!==null).length;}
function showReading(note){
  const target=note.mode==='current'?note.part:note.red+' / '+note.black;
  return '<li><strong>'+h(note.mode.toUpperCase())+'</strong> '+h(target)+
    ' <span class="mystery-reading">'+h(note.readout)+'</span>'+
    '<small>'+h(note.details)+'</small></li>';
}
function terminalOptions(names){
  return names.map(name=>'<option value="'+h(name)+'">'+h(name)+'</option>').join('');
}
export function mountMysteryDiagnostics(root){
  // The top-level app reuses the same root when changing routes. Tear down
  // listeners from prior visits so returning cannot double-grade or reset.
  root.__mysteryCleanup?.();
  const controller=new AbortController();
  root.__mysteryCleanup=()=>controller.abort();
  let run=readRun()||emptyRun(makeSeed());
  writeRun(run);
  let activeCircuit=null,caseData=null;

  function display(){
    caseData=createMysteryCase(run.seed,run.active);
    const rec=recordFor(run,run.active);
    root.innerHTML=
      '<section class="mystery-header"><span class="eyebrow">Φ CIRCUIT LAB • V0.8 • BLACK-BOX WORKSHOP</span>'+
      '<h1>Mystery Circuit Diagnostics</h1>'+
      '<p>Eight sealed service calls. The circuit is hidden at first. Collect real simulated meter evidence, '+
      'lock a diagnosis, then reveal the faulty wiring and make the repair. No guessing by looking at an exposed broken wire.</p>'+
      '<div class="academy-scores"><div><small>Case score</small><strong id="mystery-score">'+points(run)+' / '+(MYSTERY_CASE_COUNT*100)+'</strong></div>'+
      '<div><small>Cases cleared</small><strong id="mystery-cleared">'+cleared(run)+' / '+MYSTERY_CASE_COUNT+'</strong></div>'+
      '<div><small>Run seed</small><strong id="mystery-seed">'+run.seed+'</strong></div></div></section>'+
      '<div class="academy-actions"><button type="button" class="button" id="mystery-new">New random run</button>'+
      '<label>Replay seed <input id="mystery-seed-input" type="number" step="1" min="0" max="4294967295" value="'+run.seed+'"></label>'+
      '<button type="button" class="button" id="mystery-seed-load">Start seed</button></div>'+
      '<section class="mystery-cases" aria-label="Select mystery service case">'+
      MYSTERY_CATALOG.map((item,i)=>{
        const entry=recordFor(run,i);
        return '<button type="button" class="mystery-case'+(i===run.active?' active':'')+
          '" data-mystery-index="'+i+'" aria-current="'+(i===run.active?'step':'false')+'">'+
          '<small>CASE '+item.id+'</small><strong>'+h(item.title)+'</strong>'+
          '<span>'+ (entry.score===null?'Sealed / active':entry.score+'/100')+'</span></button>';
      }).join('')+'</section>'+
      '<section class="panel mystery-workorder" aria-labelledby="mystery-case-title">'+
      '<span class="eyebrow">SEALED SERVICE WORK ORDER '+caseData.id+'</span>'+
      '<h2 id="mystery-case-title">'+h(caseData.title)+'</h2>'+
      '<p id="mystery-report">'+h(caseData.report)+'</p>'+
      '<p>'+h(caseData.task)+'</p>'+
      '<p class="micro" id="mystery-evidence-state"></p></section>'+
      '<section class="panel mystery-meter" id="mystery-meter" aria-label="Sealed circuit measurement terminal">'+
      '<h2>Diagnostic Instrument Station</h2>'+
      '<p>Only test-point labels and measurements are exposed. The schematic, component values, connections and solver fault notices remain concealed until you lock a diagnosis.</p>'+
      '<label>Meter mode <select id="mystery-mode" class="lab-select">'+
      '<option value="voltage">DC voltage (red minus black)</option>'+
      '<option value="continuity">Ideal wire continuity (conceptual power-off)</option>'+
      '<option value="current">Inspect modeled part current</option></select></label>'+
      '<div class="mystery-probe-row" id="mystery-probe-pair">'+
      '<label>RED probe<select id="mystery-red" class="lab-select">'+terminalOptions(caseData.terminals)+'</select></label>'+
      '<label>BLACK probe<select id="mystery-black" class="lab-select">'+terminalOptions(caseData.terminals)+'</select></label></div>'+
      '<label id="mystery-part-label" hidden>Component <select id="mystery-part" class="lab-select">'+
      terminalOptions(caseData.parts)+'</select></label>'+
      '<div class="mystery-controls"><button type="button" class="button primary" id="mystery-measure">Take measurement</button>'+
      '<button type="button" class="button" id="mystery-hint">Conceptual hint (−10 points)</button></div>'+
      '<p id="mystery-hint-text" class="mystery-hint" hidden></p>'+
      '<div class="mystery-raw"><span class="micro">LATEST METER READING</span>'+
      '<strong id="mystery-readout">—</strong></div>'+
      '<h3>Evidence notebook</h3>'+
      '<ol id="mystery-notebook" class="mystery-notebook"></ol>'+
      '</section>'+
      '<section class="panel mystery-diagnosis"><h2>Diagnosis and repair</h2>'+
      '<p>Two <strong>different</strong> measurements are required, including at least one test of a component or internal terminal.</p>'+
      '<label for="mystery-choice">Likely fault</label>'+
      '<div class="academy-predict"><select id="mystery-choice" class="lab-select">'+
      '<option value="">Choose a diagnosis</option>'+
      DIAGNOSES.map(d=>'<option value="'+h(d.id)+'">'+h(d.label)+'</option>').join('')+
      '</select><button type="button" class="button primary" id="mystery-lock">Lock diagnosis & reveal circuit</button></div>'+
      '<p id="mystery-goal" class="academy-goal" hidden></p>'+
      '<div class="academy-controls">'+
      '<button type="button" class="button" id="mystery-reset">Reset repair</button>'+
      '<button type="button" class="button primary" id="mystery-check">Check repair</button>'+
      '<button type="button" class="button" id="mystery-next">Next case</button></div>'+
      '<p id="mystery-feedback" class="academy-feedback" role="status" aria-live="polite"></p>'+
      '</section><section id="mystery-repair" class="mystery-repair" aria-label="Revealed repair workspace"></section>'+
      '<p class="micro mystery-footnote">Case progress is local to this browser. The regular Wiring Lab and nine-mission Challenge Academy remain untouched. '+
      'Real continuity tests require de-energized circuits; this station is a mathematical demonstration only.</p>';
    root.querySelector('#mystery-red').value='V+';
    root.querySelector('#mystery-black').value='GND';
    if(rec.locked)mountRepair();
    paint();
  }
  function mountRepair(){
    const rec=recordFor(run,run.active);
    if(!rec.locked)return;
    const container=root.querySelector('#mystery-repair');
    if(!container)return;
    activeCircuit=rec.repair?validateCircuit(rec.repair):
      getFaultedRepairDocument(run.seed,run.active);
    mountWiringLab(container,{
      initialCircuit:activeCircuit,storageKey:null,challengeMode:true,
      onCircuitChange(doc){
        activeCircuit=validateCircuit(doc);rec.repair=activeCircuit;writeRun(run);
      }
    });
  }
  function paint(){
    const rec=recordFor(run,run.active),progress=evidenceProgress(rec.notes);
    root.querySelector('#mystery-score').textContent=points(run)+' / '+(MYSTERY_CASE_COUNT*100);
    root.querySelector('#mystery-cleared').textContent=cleared(run)+' / '+MYSTERY_CASE_COUNT;
    root.querySelector('#mystery-evidence-state').textContent=
      'Evidence: '+progress.count+' distinct measurement locations. '+
      (rec.locked?'Diagnosis locked; circuit revealed.':
       progress.ready?'Evidence requirement met; lock a diagnosis to reveal wiring.':
       'Collect at least two distinct readings, including an internal test point.');
    root.querySelector('#mystery-notebook').innerHTML=
      rec.notes.length?rec.notes.map(showReading).join(''):'<li class="micro">No measurements yet.</li>';
    root.querySelector('#mystery-readout').textContent=
      rec.notes.length?rec.notes.at(-1).readout:'—';
    root.querySelector('#mystery-choice').value=rec.choice;
    root.querySelector('#mystery-choice').disabled=rec.locked;
    root.querySelector('#mystery-lock').disabled=rec.locked||!progress.ready;
    root.querySelector('#mystery-check').disabled=!rec.locked||rec.score!==null;
    root.querySelector('#mystery-reset').disabled=!rec.locked||rec.score!==null;
    root.querySelector('#mystery-next').disabled=rec.score===null||run.active===MYSTERY_CASE_COUNT-1;
    root.querySelector('#mystery-hint').disabled=rec.hint||rec.score!==null;
    const hint=root.querySelector('#mystery-hint-text');
    hint.hidden=!rec.hint;
    hint.textContent=rec.hint?'CLUE: '+getCaseDiagnosis(run.seed,run.active).hint:'';
    const goal=root.querySelector('#mystery-goal');
    goal.hidden=!rec.locked;
    goal.textContent=rec.locked?'REPAIR GOAL: '+getCaseDiagnosis(run.seed,run.active).goal:'';
    root.querySelector('#mystery-feedback').textContent=
      rec.score!==null?'CASE CLEARED • '+rec.score+'/100. '+rec.feedback+
      ' Diagnosis: '+DIAGNOSES.find(d=>d.id===getCaseDiagnosis(run.seed,run.active).correctId).label+'.':
      (rec.feedback||'Use the instrument station before opening the circuit.');
    for(const card of root.querySelectorAll('[data-mystery-index]')){
      const i=Number(card.dataset.mysteryIndex),r=recordFor(run,i);
      card.classList.toggle('active',i===run.active);
      card.setAttribute('aria-current',i===run.active?'step':'false');
      card.querySelector('span').textContent=r.score===null?'Sealed / active':r.score+'/100';
    }
  }
  root.addEventListener('change',e=>{
    if(e.target.id==='mystery-mode'){
      const current=e.target.value,isCurrent=current==='current';
      root.querySelector('#mystery-probe-pair').hidden=isCurrent;
      root.querySelector('#mystery-part-label').hidden=!isCurrent;
    }
    if(e.target.id==='mystery-choice'){
      const rec=recordFor(run,run.active);
      if(rec.locked)return;
      rec.choice=DIAGNOSES.some(d=>d.id===e.target.value)?e.target.value:'';
      writeRun(run);
    }
  },{signal:controller.signal});
  root.addEventListener('click',e=>{
    const caseBtn=e.target.closest('[data-mystery-index]');
    if(caseBtn){
      run.active=Number(caseBtn.dataset.mysteryIndex);
      writeRun(run);display();return;
    }
    const button=e.target.closest('button');
    if(!button)return;
    const id=button.id;
    if(id==='mystery-measure'){
      const rec=recordFor(run,run.active);
      if(rec.score!==null)return;
      const mode=root.querySelector('#mystery-mode').value;
      const request={mode,
        red:root.querySelector('#mystery-red').value,
        black:root.querySelector('#mystery-black').value,
        part:root.querySelector('#mystery-part').value};
      try{
        const note=takeMysteryMeasurement(run.seed,run.active,request);
        if(!rec.notes.some(n=>n.key===note.key))rec.notes.push(note);
        rec.feedback='Instrument reading saved. Interpret your evidence before submitting.';
      }catch(err){rec.feedback='Meter error: '+err.message;}
      writeRun(run);paint();return;
    }
    if(id==='mystery-hint'){
      const rec=recordFor(run,run.active);
      if(rec.hint||rec.score!==null)return;
      rec.hint=true;writeRun(run);paint();return;
    }
    if(id==='mystery-lock'){
      const rec=recordFor(run,run.active);
      if(rec.locked)return;
      const choice=root.querySelector('#mystery-choice').value;
      const judgment=judgeMysteryDiagnosis(run.seed,run.active,choice,rec.notes);
      if(!judgment.allowed){rec.feedback=judgment.message;paint();return;}
      rec.choice=choice;rec.locked=true;rec.correct=judgment.correct;
      rec.lockEvidenceCount=evidenceProgress(rec.notes).count;
      rec.feedback=judgment.message+
        (rec.correct?' Your diagnosis matches the fault.':' The repair bench is open; compare your prediction with the circuit.');
      writeRun(run);mountRepair();paint();return;
    }
    if(id==='mystery-check'){
      const rec=recordFor(run,run.active);
      if(!rec.locked||rec.score!==null)return;
      const grade=gradeMysteryRepair(run.seed,run.active,activeCircuit);
      if(grade.ok){
        rec.score=mysteryScore({correctDiagnosis:rec.correct,
          evidenceCount:rec.lockEvidenceCount,hintUsed:rec.hint,failedChecks:rec.failedChecks});
        rec.repair=validateCircuit(activeCircuit);
        rec.feedback=grade.feedback;
      }else{
        rec.failedChecks=Math.min(999,rec.failedChecks+1);
        rec.feedback=grade.feedback+' (Failed repair checks: '+rec.failedChecks+')';
      }
      writeRun(run);paint();return;
    }
    if(id==='mystery-reset'){
      const rec=recordFor(run,run.active);
      if(!rec.locked||rec.score!==null)return;
      rec.repair=null;rec.feedback='Repair reset; diagnosis, evidence and deductions are preserved.';
      writeRun(run);mountRepair();paint();return;
    }
    if(id==='mystery-next'){
      if(recordFor(run,run.active).score===null||run.active>=MYSTERY_CASE_COUNT-1)return;
      run.active++;writeRun(run);display();return;
    }
    if(id==='mystery-new'||id==='mystery-seed-load'){
      let next=id==='mystery-new'?makeSeed():Number(root.querySelector('#mystery-seed-input').value);
      if(id==='mystery-seed-load'&&(!/^\d+$/.test(root.querySelector('#mystery-seed-input').value.trim())||!seedValid(next))){
        root.querySelector('#mystery-feedback').textContent='Enter a whole-number seed between 0 and 4294967295.';
        return;
      }
      if(!window.confirm('Start a new Mystery run? This resets only Mystery cases and scores.'))return;
      run=emptyRun(next);writeRun(run);display();
    }
  },{signal:controller.signal});
  display();
}
