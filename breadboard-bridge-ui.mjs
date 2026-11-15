import {validateCircuit,presetCircuit} from './wiring-solver.mjs';
import {activeProject,validateWorkstationLibrary,WORKSTATION_STORAGE_KEY} from './workstation-engine.mjs';
import {BREADBOARD_STORAGE_KEY} from './breadboard-engine.mjs';
import {planBreadboardFromCircuit} from './breadboard-bridge-engine.mjs';
import {renderBreadboardPreview} from './breadboard-ui.mjs';

const escapeHtml=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const fmtA=a=>a===null?'—':(a*1000).toFixed(3)+' mA';
const EXAMPLES=[
  {kind:'series',name:'Two resistors in series'},
  {kind:'parallel',name:'Two parallel resistors'},
  {kind:'divider',name:'Loaded resistor divider'},
  {kind:'led',name:'Forward red LED'},
  {kind:'reverse-led',name:'Reverse-biased LED diagnosis'},
  {kind:'switch',name:'Open SPST switch'},
  {kind:'open',name:'Disconnected resistor circuit'}
];
function sourceOptions(){
  const options=[];
  const hasWiring=localStorage.getItem('phi-circuit-lab-wiring-v1')!==null;
  const hasWorkstation=localStorage.getItem(WORKSTATION_STORAGE_KEY)!==null;
  options.push({value:'saved',label:'My saved Wiring Lab design',disabled:!hasWiring});
  options.push({value:'workstation',label:'Active Workstation project',disabled:!hasWorkstation});
  for(const x of EXAMPLES)options.push({value:'demo:'+x.kind,label:'Demo: '+x.name,disabled:false});
  return options;
}
function readSource(choice){
  if(choice==='saved'){
    const text=localStorage.getItem('phi-circuit-lab-wiring-v1');
    if(text===null)throw new Error('No Wiring Lab circuit is saved. Open Wiring Lab or select a sample.');
    return validateCircuit(JSON.parse(text));
  }
  if(choice==='workstation'){
    const text=localStorage.getItem(WORKSTATION_STORAGE_KEY);
    if(text===null)throw new Error('No Workstation project has been saved. Open Project Workstation first.');
    const library=validateWorkstationLibrary(JSON.parse(text));
    return validateCircuit(activeProject(library).circuit);
  }
  if(choice.startsWith('demo:')){
    const kind=choice.slice(5);
    if(!EXAMPLES.some(x=>x.kind===kind))throw new RangeError('Unsupported demo circuit');
    return presetCircuit(kind);
  }
  throw new RangeError('Choose a valid schematic source');
}
function baseMarkup(options,choice){
  return '<section class="bridge-header"><span class="eyebrow">Φ CIRCUIT LAB • v1.2 • VERIFIED TOPOLOGY PLACEMENT</span>'+
    '<h1>Schematic-to-Breadboard Bridge</h1>'+
    '<p>Translate a supported Wiring Lab circuit into an actual 12-column breadboard layout, with a hole-by-hole build guide. '+
    'The bridge verifies the original terminal connections and electrical results before offering a transfer.</p></section>'+
    '<section class="panel bridge-source"><h2>1. Select your schematic</h2>'+
    '<p>Use your saved free-build Wiring Lab circuit, the active Workstation project, or an educational starter example. '+
    'Nothing is overwritten by planning.</p>'+
    '<div class="bridge-source-controls"><label>Electrical circuit source'+
    '<select id="bridge-source" class="lab-select">'+options.map(o=>
      '<option value="'+escapeHtml(o.value)+'"'+(o.disabled?' disabled':'')+
      (choice===o.value?' selected':'')+'>'+escapeHtml(o.label)+'</option>').join('')+
      '</select></label>'+
    '<button class="button primary" id="bridge-plan" type="button">Generate verified placement</button>'+
    '<button class="button" id="bridge-reload" type="button">Refresh saved sources</button></div>'+
    '<p class="micro">A full board with more than 12 two-terminal components, or a circuit containing an ideal source short, will be refused with an explanation.</p>'+
    '<p id="bridge-status" role="status" aria-live="polite" class="bridge-status">Choose a source and generate a placement plan.</p></section>'+
    '<section id="bridge-results" hidden aria-label="Verified breadboard plan">'+
      '<div class="bridge-confirm panel">'+
        '<div><span class="eyebrow">VERIFIED ELECTRICAL MAPPING</span><h2>2. Review the breadboard layout</h2>'+
        '<p id="bridge-result-title"></p></div>'+
        '<button class="button primary" type="button" id="bridge-apply">Load this layout into Breadboard</button></div>'+
      '<div class="bridge-scorecard">'+
        '<div><small>Components placed</small><strong id="bridge-parts">—</strong></div>'+
        '<div><small>Jumpers routed</small><strong id="bridge-wires">—</strong></div>'+
        '<div><small>Terminal pairs checked</small><strong id="bridge-pairs">—</strong></div>'+
        '<div><small>Source DC current</small><strong id="bridge-current">—</strong></div></div>'+
      '<div class="panel bridge-preview"><h3>Read-only board preview</h3>'+
        '<p class="micro">The same component geometry as the editable Breadboard. Preview is non-interactive. '+
          'Review every jumper and placement step before transferring.</p>'+
        '<div class="bb-svg-wrap"><svg id="bridge-canvas" viewBox="0 0 900 540" role="img" '+
          'aria-label="Verified component placement across breadboard center trench and jumper routes"></svg></div>'+
      '</div>'+
      '<section class="panel bridge-steps"><h2>3. Hole-by-hole build instructions</h2>'+
        '<p>The rail labels indicate connections, not safety certification. '+
          'Each component is placed across the central isolation trench. Follow jumper connections exactly.</p>'+
        '<ol id="bridge-instructions"></ol></section>'+
      '<section class="panel bridge-limits"><h2>What the verification means</h2>'+
        '<p>Every pair of original named terminals was checked for identical direct-wire connectivity. '+
          'The original and rebuilt circuits were then solved with the same DC solver and compared for '+
          'source current, component behavior and terminal voltages.</p>'+
        '<ul id="bridge-warnings"></ul>'+
        '<p class="micro">The preview is a virtual learning plan, not a physical construction or mains-voltage safety approval. '+
          'Jumper routes are deterministic but not length-optimized, and physical breadboard rail layouts vary.</p></section>'+
    '</section>';
}
export function mountSchematicBridge(root){
  root.__bridgeCleanup?.();
  const controller=new AbortController();
  root.__bridgeCleanup=()=>controller.abort();
  let choices=sourceOptions();
  let choice=choices.find(o=>!o.disabled)?.value||'demo:series';
  let plan=null;
  root.innerHTML=baseMarkup(choices,choice);
  const $=selector=>root.querySelector(selector);
  function status(text,error=false){
    const node=$('#bridge-status');
    node.textContent=text;
    node.className=error?'bridge-status bridge-error':'bridge-status';
  }
  function clearPlan(){
    plan=null;$('#bridge-results').hidden=true;
    $('#bridge-canvas').innerHTML='';
  }
  function showPlan(){
    if(!plan){clearPlan();return;}
    const check=plan.verification;
    $('#bridge-results').hidden=false;
    $('#bridge-result-title').textContent=
      'Schematic and generated board match. Original and mapped electrical status: '+check.sourceStatus+
      ' / '+check.boardStatus+'. No source-configuration changes or hidden circuit rewriting.';
    $('#bridge-parts').textContent=String(check.componentCount)+' / 12';
    $('#bridge-wires').textContent=String(plan.layout.wires.length)+' / 40';
    $('#bridge-pairs').textContent=String(check.netPairsChecked)+' pairs';
    $('#bridge-current').textContent=fmtA(check.sourceCurrentA);
    $('#bridge-canvas').innerHTML=renderBreadboardPreview(plan.layout);
    $('#bridge-instructions').innerHTML=plan.steps.map(s=>
      '<li><strong>'+escapeHtml(s.title)+'</strong>'+
        '<p>'+escapeHtml(s.detail)+'</p>'+
        (s.from&&s.to?'<small>CONTACTS: '+escapeHtml(s.from)+' → '+escapeHtml(s.to)+'</small>':'')+
      '</li>').join('');
    $('#bridge-warnings').innerHTML=plan.warnings.map(w=>
      '<li>'+escapeHtml(w)+'</li>').join('');
  }
  root.addEventListener('change',e=>{
    if(e.target.id==='bridge-source'){
      choice=e.target.value;
      clearPlan();
      status('Source selected. Generate a new verified placement to continue.');
    }
  },{signal:controller.signal});
  root.addEventListener('click',e=>{
    const target=e.target.closest('button');
    if(!target)return;
    if(target.id==='bridge-reload'){
      choices=sourceOptions();
      if(!choices.some(o=>o.value===choice&&!o.disabled))
        choice=choices.find(o=>!o.disabled).value;
      const old=$('#bridge-source');
      old.innerHTML=choices.map(o=>'<option value="'+escapeHtml(o.value)+'"'+
        (o.disabled?' disabled':'')+'>'+escapeHtml(o.label)+'</option>').join('');
      old.value=choice;
      clearPlan();
      status('Available sources refreshed. Generate a new placement to continue.');
      return;
    }
    if(target.id==='bridge-plan'){
      try{
        plan=planBreadboardFromCircuit(readSource(choice));
        showPlan();
        status('Verified: '+plan.verification.netPairsChecked+
          ' terminal pairs and electrical results match. No saved design was changed.');
      }catch(err){
        clearPlan();
        status('Layout not generated: '+err.message,true);
      }
      return;
    }
    if(target.id==='bridge-apply'){
      if(!plan||!plan.verification.equivalent){
        status('A verified placement must be generated first.',true);
        return;
      }
      if(!window.confirm(
        'Replace your existing saved Breadboard layout with this verified schematic placement? '+
        'Wiring Lab and Workstation source circuits will remain unchanged.'))return;
      try{
        // Validate again on the action boundary. Only this explicit operation
        // writes to the separate breadboard key.
        const verified=planBreadboardFromCircuit(plan.source);
        localStorage.setItem(BREADBOARD_STORAGE_KEY,JSON.stringify(verified.layout));
        document.querySelector('header [data-view="breadboard"]')?.click();
      }catch(err){status('Cannot load this layout: '+err.message,true);}
    }
  },{signal:controller.signal});
}
