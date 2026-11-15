import {mountWiringLab} from './wiring-lab.mjs';
import {mountScopeLab} from './scope-ui.mjs';
import {
  WORKSTATION_STORAGE_KEY,MAX_WORKSTATION_PROJECTS,MAX_WORKSTATION_NOTES,
  MAX_WORKSTATION_IMPORT_BYTES,newWorkstationLibrary,validateWorkstationLibrary,
  activeProject,createWorkstationProject,duplicateWorkstationProject,
  renameWorkstationProject,selectWorkstationProject,deleteWorkstationProject,
  updateWorkstationCircuit,updateWorkstationScope,
  addWorkstationNote,deleteWorkstationNote,
  exportWorkstationBundle,importWorkstationBundle
} from './workstation-engine.mjs';

const h=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const seconds=t=>t<1?(t*1000).toFixed(2)+' ms':t.toFixed(3)+' s';
const volts=v=>v.toFixed(3)+' V';
const milliamps=a=>(a*1000).toFixed(3)+' mA';
const tabs=[['overview','Project overview'],['circuit','Circuit designer'],
  ['scope','RC oscilloscope'],['notes','Lab notebook']];
function loadLibrary(){
  try{
    const raw=localStorage.getItem(WORKSTATION_STORAGE_KEY);
    if(raw)return validateWorkstationLibrary(JSON.parse(raw));
  }catch(_){/* Corrupt or blocked local storage: start an in-memory portfolio. */}
  return newWorkstationLibrary();
}
function statusNode(root,message,error){
  const target=root.querySelector('#ws-status');
  if(!target)return;
  target.textContent=message;
  target.className=error?'ws-status ws-error':'ws-status';
}
function optionMarkup(projects){
  return projects.map(p=>'<option value="'+h(p.id)+'">'+h(p.name)+'</option>').join('');
}
function overviewMarkup(project){
  const resistors=project.circuit.parts.length;
  const leds=project.circuit.leds.length;
  const switches=project.circuit.switches.length;
  const notes=project.notes.length;
  return '<div class="ws-intro"><h2>One project. Two laboratories. One notebook.</h2>'+
    '<p>Your project stores a <strong>DC Wiring Lab design</strong>, a separate <strong>ideal RC scope experiment</strong>, '+
    'and evidence from both. These represent different models; the scope does not silently simulate the arbitrary wiring layout.</p></div>'+
    '<div class="ws-summary-grid">'+
    '<button class="ws-summary-card" type="button" data-ws-tab="circuit"><span class="eyebrow">CIRCUIT</span>'+
    '<strong>'+resistors+' resistors · '+switches+' switches · '+leds+' LEDs</strong>'+
    '<span>Open the DC editor and measure voltage or branch current</span></button>'+
    '<button class="ws-summary-card" type="button" data-ws-tab="scope"><span class="eyebrow">SIGNALS</span>'+
    '<strong>'+h(project.scope.waveform)+' waveform · '+h(project.scope.resistanceOhms)+' Ω</strong>'+
    '<span>Explore an independent RC transient and capture cursor readings</span></button>'+
    '<button class="ws-summary-card" type="button" data-ws-tab="notes"><span class="eyebrow">NOTEBOOK</span>'+
    '<strong>'+notes+' / '+MAX_WORKSTATION_NOTES+' observations</strong>'+
    '<span>Write findings, capture measurements and export the project portfolio</span></button></div>'+
    '<div class="panel ws-lesson-links"><h3>Continue the learning path</h3><p>All other courses remain available and retain their original independent progress.</p>'+
    '<div class="ws-links"><button class="button" data-view="classroom">Classroom</button>'+
    '<button class="button" data-view="workbench">Fundamentals Workbench</button>'+
    '<button class="button" data-view="academy">Challenge Academy</button>'+
    '<button class="button" data-view="mystery">Mystery Diagnostics</button></div></div>';
}
function notesMarkup(project){
  return '<section class="panel ws-notebook"><h2>Project laboratory notebook</h2>'+
    '<p>Observations are private plain text saved only in this browser. Capture a real current reading from the '+
    'circuit meter or scope cursors using the button above each instrument, or record an experiment by hand.</p>'+
    '<label for="ws-manual-note">New observation</label>'+
    '<textarea id="ws-manual-note" rows="3" maxlength="500" placeholder="Hypothesis, measurement, calculation, or what you changed..."></textarea>'+
    '<div class="ws-note-controls"><button class="button primary" id="ws-add-note" type="button">Save observation</button>'+
    '<span class="micro">'+project.notes.length+' of '+MAX_WORKSTATION_NOTES+' entries</span></div>'+
    '<ol id="ws-notes-list" class="ws-notes-list">'+(project.notes.length?
      [...project.notes].reverse().map(n=>'<li><div class="ws-note-top"><span class="chip">'+h(n.source.toUpperCase())+'</span>'+
        '<button type="button" class="button" data-ws-delete-note="'+h(n.id)+'">Remove</button></div>'+
        '<p>'+h(n.text)+'</p></li>').join(''):
      '<li class="micro">No recorded observations yet. Capture a meter or scope reading, or add a note.</li>')+
    '</ol></section>';
}
function projectShell(library,tab){
  const project=activeProject(library);
  return '<header class="ws-hero"><span class="eyebrow">Φ CIRCUIT LAB • V1.0 • LOCAL ELECTRONICS WORKSTATION</span>'+
    '<h1>Virtual Electronics Workstation</h1>'+
    '<p>Keep a circuit, a separate RC signal experiment and practical lab notes together in one named offline project. '+
    'Everything stays yours: no account, advertisements, paid dependencies or server uploads.</p></header>'+
    '<section class="panel ws-project-manager" aria-label="Workstation project management">'+
    '<div class="ws-project-top"><label>Active project<select id="ws-project-select" class="lab-select">'+
    optionMarkup(library.projects)+'</select></label>'+
    '<label>Project name<input id="ws-project-name" maxlength="60" value="'+h(project.name)+'" aria-label="Project name"></label></div>'+
    '<div class="ws-project-actions">'+
    '<button id="ws-new" type="button" class="button primary"'+(library.projects.length>=MAX_WORKSTATION_PROJECTS?' disabled':'')+'>New project</button>'+
    '<button id="ws-rename" type="button" class="button">Rename</button>'+
    '<button id="ws-duplicate" type="button" class="button"'+(library.projects.length>=MAX_WORKSTATION_PROJECTS?' disabled':'')+'>Duplicate</button>'+
    '<button id="ws-delete" type="button" class="button"'+(library.projects.length===1?' disabled':'')+'>Delete</button>'+
    '<button id="ws-export" type="button" class="button">Export projects JSON</button>'+
    '<label class="button ws-import-label">Import projects JSON<input id="ws-import" type="file" hidden accept=".json,application/json"></label></div>'+
    '<p id="ws-status" class="ws-status" role="status" aria-live="polite">Project '+h(project.id)+
    ' · '+library.projects.length+'/'+MAX_WORKSTATION_PROJECTS+' projects · saved locally</p></section>'+
    '<nav class="ws-tabbar" aria-label="Workstation project tools">'+
    tabs.map(([id,label])=>'<button type="button" class="ws-tab'+(tab===id?' active':'')+'" data-ws-tab="'+id+
      '" aria-current="'+(tab===id?'page':'false')+'">'+label+'</button>').join('')+'</nav>'+
    '<section id="ws-tool-region" aria-label="Active workstation tool"></section>'+
    '<p class="micro ws-footer">The project circuit uses the ideal DC Wiring Lab solver. The oscilloscope uses a '+
    'separate first-order RC model. Exported JSON contains user-created circuits, scope settings and notebook text. '+
    'No scores or data from other labs are modified by project operations.</p>';
}
function exportJson(text){
  const blob=new Blob([text],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='phi-electronics-workstation.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function mountWorkstation(root){
  // The app uses one main root across routes; avoid retaining handlers from
  // previous visits that could otherwise duplicate notebook/project actions.
  root.__wsCleanup?.();
  const controller=new AbortController();
  root.__wsCleanup=()=>controller.abort();
  let library=loadLibrary();
  let tab='overview',latestMeter=null,latestScope=null;
  function persist(){
    library=validateWorkstationLibrary(library);
    try{localStorage.setItem(WORKSTATION_STORAGE_KEY,exportWorkstationBundle(library));}
    catch(_){/* Keep working in memory if storage is unavailable. */}
  }
  function mutate(fn,success){
    try{
      library=fn(library);
      persist();
      render();
      statusNode(root,success||'Project updated. Saved in this browser.',false);
    }catch(error){statusNode(root,error.message,true);}
  }
  function recordObservation(source,text){
    mutate(state=>addWorkstationNote(state,source,text),'Observation saved in this project notebook.');
  }
  function toolRegion(){
    const region=root.querySelector('#ws-tool-region');
    const project=activeProject(library);
    latestMeter=null;latestScope=null;
    if(tab==='overview'){region.innerHTML=overviewMarkup(project);return;}
    if(tab==='notes'){region.innerHTML=notesMarkup(project);return;}
    if(tab==='circuit'){
      region.innerHTML='<div class="ws-capture"><p><strong>DC circuit instrument.</strong> '+
        'Select voltage, continuity or branch current and make a measurement, then capture it to your notebook.</p>'+
        '<button id="ws-capture-meter" class="button primary" type="button" disabled>Capture meter reading</button></div>'+
        '<div id="ws-embedded-circuit"></div>';
      mountWiringLab(root.querySelector('#ws-embedded-circuit'),{
        initialCircuit:project.circuit,storageKey:null,
        onCircuitChange(doc){
          library=updateWorkstationCircuit(library,doc);persist();
        },
        onMeterSnapshot(reading){
          latestMeter=reading;
          const button=root.querySelector('#ws-capture-meter');
          if(button)button.disabled=!reading;
        }
      });
      return;
    }
    if(tab==='scope'){
      region.innerHTML='<div class="ws-capture"><p><strong>Separate RC signal experiment.</strong> '+
        'Position the two cursors, then capture their calculated results in the same project notebook.</p>'+
        '<button id="ws-capture-scope" class="button primary" type="button">Capture scope cursors</button></div>'+
        '<div id="ws-embedded-scope"></div>';
      mountScopeLab(root.querySelector('#ws-embedded-scope'),{
        initialConfig:project.scope,storageKey:null,
        onConfigChange(config){
          library=updateWorkstationScope(library,config);persist();
        },
        onScopeSnapshot(reading){latestScope=reading;}
      });
    }
  }
  function render(){
    root.innerHTML=projectShell(library,tab);
    root.querySelector('#ws-project-select').value=library.activeId;
    toolRegion();
  }
  root.addEventListener('click',event=>{
    const target=event.target.closest('button,[data-ws-delete-note]');
    if(!target)return;
    const switched=target.dataset.wsTab;
    if(switched&&tabs.some(([id])=>id===switched)){
      tab=switched;render();return;
    }
    const id=target.id;
    if(id==='ws-new'){
      mutate(state=>createWorkstationProject(state,
        root.querySelector('#ws-project-name').value),'New isolated electronics project created.');return;
    }
    if(id==='ws-rename'){
      mutate(state=>renameWorkstationProject(state,
        root.querySelector('#ws-project-name').value),'Project renamed.');return;
    }
    if(id==='ws-duplicate'){
      mutate(duplicateWorkstationProject,'Project duplicated with its circuit, scope and notes.');return;
    }
    if(id==='ws-delete'){
      if(!window.confirm('Delete this Workstation project and its lab notes? Other labs are unaffected.'))return;
      mutate(deleteWorkstationProject,'Project deleted. Other labs remain untouched.');return;
    }
    if(id==='ws-export'){
      exportJson(exportWorkstationBundle(library));
      statusNode(root,'Downloaded a validated offline JSON backup of all Workstation projects.',false);
      return;
    }
    if(id==='ws-add-note'){
      recordObservation('manual',root.querySelector('#ws-manual-note').value);return;
    }
    if(target.dataset.wsDeleteNote){
      mutate(state=>deleteWorkstationNote(state,target.dataset.wsDeleteNote),
        'Notebook entry removed.');return;
    }
    if(id==='ws-capture-meter'){
      if(!latestMeter){statusNode(root,'Take a valid circuit meter reading first.',true);return;}
      const text='DC '+latestMeter.mode+': '+latestMeter.probes+' = '+latestMeter.readout+
        ' (source '+latestMeter.supplyV+' V). '+latestMeter.details;
      recordObservation('meter',text.slice(0,500));return;
    }
    if(id==='ws-capture-scope'){
      if(!latestScope){statusNode(root,'Position your scope cursors first.',true);return;}
      const x=latestScope;
      const text='RC '+x.waveform+'; τ='+seconds(x.tauSeconds)+
        '; A='+seconds(x.cursorATimeSeconds)+', '+volts(x.capacitorA)+
        '; B='+seconds(x.cursorBTimeSeconds)+', '+volts(x.capacitorB)+
        '; Δt='+seconds(Math.abs(x.deltaTimeSeconds))+
        '; ΔVc='+volts(x.deltaCapacitorV)+
        '; current at A='+milliamps(x.currentA)+'.';
      recordObservation('scope',text);return;
    }
  },{signal:controller.signal});
  root.addEventListener('change',event=>{
    if(event.target.id==='ws-project-select'){
      mutate(state=>selectWorkstationProject(state,event.target.value),
        'Switched to a different isolated project.');
    }
  },{signal:controller.signal});
  root.addEventListener('change',async event=>{
    if(event.target.id!=='ws-import')return;
    const file=event.target.files?.[0];
    if(!file)return;
    try{
      if(file.size>MAX_WORKSTATION_IMPORT_BYTES)
        throw new RangeError('Project bundle too large (limit 150 KB)');
      const incoming=importWorkstationBundle(await file.text());
      if(!window.confirm('Replace this Workstation portfolio with the imported projects? This cannot be undone unless you exported a backup.'))return;
      library=incoming;tab='overview';persist();render();
      statusNode(root,'Imported a validated project portfolio. Other labs are unchanged.',false);
    }catch(error){statusNode(root,'Import rejected: '+error.message,true);}
    finally{
      const input=root.querySelector('#ws-import');
      if(input)input.value='';
    }
  },{signal:controller.signal});
  persist();render();
}
