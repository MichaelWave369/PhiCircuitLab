import { mountWiringLab } from './wiring-lab.mjs';
import { validateCircuit } from './wiring-solver.mjs';
import {
  MISSION_COUNT, DIAGNOSES, createMission, gradePrediction,
  evaluateRepair, calculateMissionScore
} from './academy-engine.mjs';

const STORAGE_KEY='phi-circuit-lab-academy-v1';
const freshSeed=()=>Math.floor(Math.random()*4294967296)>>>0;
const isSeed=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff;
const safeMessage=s=>String(s??'');
const initialRecord=()=>({circuit:null,choice:'',locked:false,correct:false,
  hint:false,failedChecks:0,score:null,feedback:''});
const freshRun=seed=>({version:1,seed,active:0,missions:{}});

function readRun(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(!data||data.version!==1||!isSeed(data.seed)||
      !Number.isInteger(data.active)||data.active<0||data.active>=MISSION_COUNT||
      !data.missions||typeof data.missions!=='object'||Array.isArray(data.missions))return null;
    const run=freshRun(data.seed);
    run.active=data.active;
    for(let i=0;i<MISSION_COUNT;i++){
      const r=data.missions[i];
      if(!r||typeof r!=='object')continue;
      const record=initialRecord();
      if(r.circuit){
        try{record.circuit=validateCircuit(r.circuit);}
        catch(_){record.circuit=null;}
      }
      record.choice=DIAGNOSES.some(d=>d.id===r.choice)?r.choice:'';
      record.locked=r.locked===true&&record.choice!=='';
      record.correct=record.locked&&gradePrediction(createMission(data.seed,i),record.choice);
      record.hint=r.hint===true;
      record.failedChecks=Number.isInteger(r.failedChecks)&&r.failedChecks>=0?
        Math.min(999,r.failedChecks):0;
      record.score=Number.isInteger(r.score)&&r.score>=0&&r.score<=100?r.score:null;
      record.feedback=typeof r.feedback==='string'?r.feedback.slice(0,300):'';
      run.missions[i]=record;
    }
    return run;
  }catch(_){return null;}
}
function saveRun(run) {
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(run));}
  catch(_){/* Some private browsing modes forbid local storage. */}
}
function missionRecord(run,index){
  if(!run.missions[index])run.missions[index]=initialRecord();
  return run.missions[index];
}
function completedCount(run){
  return Object.values(run.missions).filter(x=>x?.score!==null).length;
}
function totalScore(run){
  return Object.values(run.missions).reduce((sum,x)=>sum+
    (Number.isInteger(x?.score)?x.score:0),0);
}

export function mountChallengeAcademy(root) {
  let run=readRun()||freshRun(freshSeed());
  saveRun(run);
  let current=null,mission=null;
  function dashboard(){
    mission=createMission(run.seed,run.active);
    const record=missionRecord(run,run.active);
    root.innerHTML=
      '<section class="academy-header"><span class="eyebrow">Φ CIRCUIT LAB • v0.7 • PLAY TO LEARN</span>' +
      '<h1>Circuit Challenge Academy</h1>' +
      '<p>Nine seeded troubleshooting missions. Predict the fault, repair it in the actual Wiring Lab, '+
      'and verify the result. The circuit engine grades electrical behavior, not decorative success lights.</p>' +
      '<div class="academy-scores"><div><small>Run score</small><strong id="academy-score">0 / 900</strong></div>'+
      '<div><small>Missions cleared</small><strong id="academy-cleared">0 / 9</strong></div>'+
      '<div><small>Reproducible seed</small><strong id="academy-seed">'+run.seed+'</strong></div></div></section>' +
      '<div class="academy-actions"><button type="button" class="button" id="academy-new">New random run</button>'+
      '<label>Load a run seed <input id="academy-seed-input" type="number" min="0" max="4294967295" step="1" inputmode="numeric" value="'+run.seed+'"></label>'+
      '<button type="button" class="button" id="academy-seed-load">Start this seed</button></div>' +
      '<section class="academy-missions" aria-label="Select troubleshooting mission">'+
      Array.from({length:MISSION_COUNT},(_,i)=>{
        const m=createMission(run.seed,i),r=missionRecord(run,i);
        return '<button type="button" class="academy-mission'+(i===run.active?' active':'')+
          '" data-academy-index="'+i+'" aria-current="'+(i===run.active?'step':'false')+'">'+
          '<small>MISSION '+String(i+1).padStart(2,'0')+'</small><strong>'+m.title+'</strong>'+
          '<span>'+(r.score===null?'Not cleared':r.score+' / 100 points')+'</span></button>';
      }).join('')+'</section>' +
      '<section class="panel academy-brief" aria-labelledby="academy-mission-title">' +
      '<span class="eyebrow">FAULT-FINDING MISSION '+(run.active+1)+' / '+MISSION_COUNT+'</span>'+
      '<h2 id="academy-mission-title">'+mission.title+'</h2>'+
      '<p id="academy-question">'+mission.question+'</p>'+
      '<p><strong>Before changing anything, predict the fault.</strong> A correct prediction is worth 25 of 100 points.</p>'+
      '<div class="academy-predict"><label for="academy-prediction">Your diagnosis</label>'+
      '<select id="academy-prediction" class="lab-select">'+
      '<option value="">Choose the likely fault</option>'+
      DIAGNOSES.map(d=>'<option value="'+d.id+'">'+d.label+'</option>').join('')+
      '</select><button class="button primary" type="button" id="academy-lock">Lock diagnosis</button></div>'+
      '<p id="academy-goal" class="academy-goal"></p>'+
      '<p id="academy-hint" class="academy-hint" hidden></p>'+
      '<div class="academy-controls"><button type="button" class="button" id="academy-hint-button">Reveal hint (−10 points)</button>'+
      '<button type="button" class="button" id="academy-reset">Reset circuit</button>'+
      '<button type="button" class="button primary" id="academy-check">Check my repair</button>'+
      '<button type="button" class="button" id="academy-next">Next mission</button></div>'+
      '<p id="academy-feedback" class="academy-feedback" role="status" aria-live="polite"></p>'+
      '</section>'+
      '<div id="academy-workspace" class="academy-workspace" aria-label="Independent challenge wiring sandbox"></div>'+
      '<p class="micro academy-footnote">The challenge bench has its own local save and never replaces your free-build Wiring Lab design or lesson completion. '+
      'Use the multimeter to investigate. This is an educational idealized simulator, not a real electronics safety test.</p>';
    const bench=root.querySelector('#academy-workspace');
    current=record.circuit?validateCircuit(record.circuit):validateCircuit(mission.initial);
    mountWiringLab(bench,{
      initialCircuit:current,
      storageKey:null,
      challengeMode:true,
      onCircuitChange(next){
        current=validateCircuit(next);
        record.circuit=current;
        saveRun(run);
      }
    });
    paint();
  }
  function paint(){
    const record=missionRecord(run,run.active);
    root.querySelector('#academy-score').textContent=totalScore(run)+' / '+(MISSION_COUNT*100);
    root.querySelector('#academy-cleared').textContent=completedCount(run)+' / '+MISSION_COUNT;
    root.querySelector('#academy-prediction').value=record.choice;
    root.querySelector('#academy-prediction').disabled=record.locked||record.score!==null;
    root.querySelector('#academy-lock').disabled=record.locked||record.score!==null;
    root.querySelector('#academy-hint-button').disabled=record.hint||record.score!==null;
    root.querySelector('#academy-check').disabled=!record.locked||record.score!==null;
    root.querySelector('#academy-next').disabled=record.score===null||run.active===MISSION_COUNT-1;
    root.querySelector('#academy-goal').textContent=record.locked?'REPAIR OBJECTIVE: '+mission.goal:
      'Diagnosis first. Lock your prediction to unlock the repair objective and score check.';
    const hint=root.querySelector('#academy-hint');
    hint.hidden=!record.hint;
    hint.textContent=record.hint?'HINT: '+mission.hint:'';
    const text=record.score!==null?
      'MISSION CLEARED • '+record.score+'/100 points. '+record.feedback+
      ' Correct diagnosis: '+DIAGNOSES.find(d=>d.id===mission.diagnosis).label+'.'+
      (run.active===MISSION_COUNT-1?' All nine mission slots reached. Review or start a fresh random run.':''):
      (record.feedback||'Repair the circuit in the challenge workspace below.');
    root.querySelector('#academy-feedback').textContent=text;
    root.querySelectorAll('[data-academy-index]').forEach(btn=>{
      const i=Number(btn.dataset.academyIndex),r=missionRecord(run,i);
      btn.classList.toggle('active',i===run.active);
      btn.setAttribute('aria-current',i===run.active?'step':'false');
      btn.querySelector('span').textContent=r.score===null?'Not cleared':r.score+' / 100 points';
    });
  }
  root.addEventListener('change',e=>{
    if(e.target.id!=='academy-prediction')return;
    const r=missionRecord(run,run.active);
    if(r.locked)return;
    const choice=e.target.value;
    if(DIAGNOSES.some(d=>d.id===choice)){r.choice=choice;saveRun(run);}
    else r.choice='';
  });
  root.addEventListener('click',e=>{
    const idx=e.target.closest('[data-academy-index]');
    if(idx){
      run.active=Number(idx.dataset.academyIndex);
      saveRun(run);dashboard();return;
    }
    const button=e.target.closest('button');
    if(!button)return;
    const id=button.id;
    if(id==='academy-lock'){
      const record=missionRecord(run,run.active);
      if(record.locked)return;
      const choice=root.querySelector('#academy-prediction').value;
      if(!DIAGNOSES.some(d=>d.id===choice)){
        record.feedback='Choose a diagnosis before locking your prediction.';
        paint();return;
      }
      record.choice=choice;record.locked=true;
      record.correct=gradePrediction(mission,choice);
      record.feedback='Diagnosis locked. Now use the actual wiring and meter tools to repair the fault.';
      saveRun(run);paint();return;
    }
    if(id==='academy-hint-button'){
      const record=missionRecord(run,run.active);
      if(record.hint||record.score!==null)return;
      record.hint=true;saveRun(run);paint();return;
    }
    if(id==='academy-check'){
      const record=missionRecord(run,run.active);
      if(!record.locked||record.score!==null)return;
      const grade=evaluateRepair(mission,current);
      if(grade.ok){
        record.score=calculateMissionScore({predictionCorrect:record.correct,
          hintUsed:record.hint,failedChecks:record.failedChecks});
        record.feedback=grade.feedback;
        record.circuit=validateCircuit(current);
      }else{
        record.failedChecks=Math.min(999,record.failedChecks+1);
        record.feedback=grade.feedback+' (Unsuccessful checks: '+record.failedChecks+')';
      }
      saveRun(run);paint();return;
    }
    if(id==='academy-reset'){
      const record=missionRecord(run,run.active);
      record.circuit=validateCircuit(mission.initial);
      record.feedback='Circuit reset to its starting fault. Prediction and attempt deductions remain.';
      saveRun(run);dashboard();return;
    }
    if(id==='academy-next'){
      if(missionRecord(run,run.active).score===null||run.active>=MISSION_COUNT-1)return;
      run.active++;
      saveRun(run);dashboard();return;
    }
    if(id==='academy-new'||id==='academy-seed-load'){
      let seed;
      if(id==='academy-seed-load'){
        const input=root.querySelector('#academy-seed-input').value.trim();
        seed=Number(input);
        if(!/^\d+$/.test(input)||!isSeed(seed)){
          root.querySelector('#academy-feedback').textContent='Enter a whole-number seed from 0 to 4294967295.';
          return;
        }
      }else seed=freshSeed();
      if(typeof window.confirm==='function'&&!window.confirm('Start a new Academy run? This resets only the current Academy score and challenge progress.'))return;
      run=freshRun(seed);saveRun(run);dashboard();
    }
  });
  dashboard();
}
