import {
  MAX_RESISTORS, MAX_SWITCHES, MAX_LEDS, MAX_WIRES, presetCircuit, solveCircuit, validateCircuit
} from './wiring-solver.mjs';
import { LED_FORWARD_V } from './wiring-diode-solver.mjs';
import { measureVoltage, traceContinuity, inspectBranchCurrent } from './wiring-meter.mjs';
import { flipLedPolarity } from './academy-engine.mjs';

const STORAGE_KEY='phi-circuit-lab-wiring-v1';
const SVG_NS='http://www.w3.org/2000/svg';
const SOURCE_TERMINALS={
  'V+':{x:110,y:105},'GND':{x:110,y:405}
};

function endpointPosition(doc,name) {
  if (SOURCE_TERMINALS[name]) return SOURCE_TERMINALS[name];
  const [id,side]=name.split(':');
  const p=[...doc.parts,...doc.switches,...doc.leds].find(p=>p.id===id);
  if (!p) throw new Error('Unknown component terminal');
  return {x:p.x+(side==='a'?-54:54),y:p.y};
}
function textSafe(value){
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
const formatMa = a => a===null?'—':(a*1000).toFixed(3)+' mA';
const formatV = v => v===null?'—':v.toFixed(3)+' V';
const formatW = w => w===null?'—':(w*1000).toFixed(2)+' mW';

function path(a,b){
  const dx=Math.abs(a.x-b.x);
  if (dx<48) return 'M '+a.x+' '+a.y+' V '+b.y+' H '+b.x;
  const middle=(a.x+b.x)/2;
  return 'M '+a.x+' '+a.y+' H '+middle+' V '+b.y+' H '+b.x;
}
function terminalSVG(id,point,pending){
  const active=id===pending;
  return '<g class="wire-terminal'+(active?' awaiting':'')+'" data-terminal="'+id+
    '" tabindex="0" role="button" aria-label="Connect terminal '+textSafe(id)+'">' +
    '<circle cx="'+point.x+'" cy="'+point.y+'" r="11" fill="'+(active?'#ffc578':'#132a3a')+
    '" stroke="'+(active?'#ffc578':'#55e2df')+'" stroke-width="3"/>' +
    '<circle cx="'+point.x+'" cy="'+point.y+'" r="4" fill="'+(active?'#09131e':'#55e2df')+'"/></g>';
}
function svgMarkup(doc,selected,pending,result,meter){
  const wires=doc.wires.map((w,index)=>{
    const a=endpointPosition(doc,w.a),b=endpointPosition(doc,w.b);
    const d=path(a,b),active=selected?.kind==='wire'&&selected.index===index;
    return '<g data-wire-index="'+index+'" role="button" tabindex="0" aria-label="Select wire '+textSafe(w.a)+' to '+textSafe(w.b)+'">' +
      '<path d="'+d+'" fill="none" stroke="transparent" stroke-width="20" pointer-events="stroke"/>' +
      '<path d="'+d+'" fill="none" stroke="'+(active?'#ffc578':'#55e2df')+
      '" stroke-width="'+(active?'5':'3')+'" stroke-linejoin="round" pointer-events="none"/></g>';
  }).join('');
  const parts=doc.parts.map(p=>{
    const active=selected?.kind==='part'&&selected.id===p.id;
    const reading=result.parts.find(x=>x.id===p.id);
    const color=reading?.state==='active'?'#78e5a5':
      reading?.state==='floating'?'#a28cff':
      reading?.state==='bypassed'?'#ffc578':'#b7c8dd';
    return '<g class="placed-resistor" data-part-id="'+p.id+'" aria-label="'+p.id+' resistor '+p.ohms+' ohms" role="button" tabindex="0">' +
      '<path d="M '+(p.x-54)+' '+p.y+' H '+(p.x-35)+' M '+(p.x+35)+' '+p.y+' H '+(p.x+54)+
      '" fill="none" stroke="#ffc578" stroke-width="4"/>' +
      '<rect x="'+(p.x-35)+'" y="'+(p.y-24)+'" width="70" height="48" rx="8" fill="'+(active?'#324765':'#283446')+
      '" stroke="'+(active?'#ffc578':color)+'" stroke-width="'+(active?'4':'2')+'"/>' +
      '<text x="'+p.x+'" y="'+(p.y-4)+'" class="part-title" text-anchor="middle">'+p.id+'</text>' +
      '<text x="'+p.x+'" y="'+(p.y+13)+'" class="part-value" text-anchor="middle">'+p.ohms+' Ω</text>' +
      terminalSVG(p.id+':a',{x:p.x-54,y:p.y},pending)+
      terminalSVG(p.id+':b',{x:p.x+54,y:p.y},pending)+'</g>';
  }).join('');
  const switches=doc.switches.map(sw=>{
    const selectedSwitch=selected?.kind==='part'&&selected.id===sw.id;
    const border=selectedSwitch?'#ffc578':(sw.closed?'#7be1a7':'#a28cff');
    const lever=sw.closed
      ? '<path d="M '+(sw.x-20)+' '+sw.y+' H '+(sw.x+20)+'" stroke="#7be1a7" stroke-width="5" fill="none"/>'
      : '<path d="M '+(sw.x-20)+' '+sw.y+' L '+(sw.x+15)+' '+(sw.y-22)+'" stroke="#a28cff" stroke-width="5" fill="none"/>';
    return '<g class="placed-switch" data-part-id="'+sw.id+'" role="button" tabindex="0" '+
      'aria-label="'+sw.id+' '+(sw.closed?'closed':'open')+' switch; select to toggle">' +
      '<rect x="'+(sw.x-38)+'" y="'+(sw.y-30)+'" width="76" height="60" rx="10" fill="#233148" stroke="'+border+'" stroke-width="2"/>' +
      '<path d="M '+(sw.x-54)+' '+sw.y+' H '+(sw.x-20)+' M '+(sw.x+20)+' '+sw.y+
      ' H '+(sw.x+54)+'" fill="none" stroke="#ffc578" stroke-width="3"/>' +
      lever+
      '<text x="'+sw.x+'" y="'+(sw.y+49)+'" text-anchor="middle" fill="#edf4ff" font-size="16">'+sw.id+
      ' '+(sw.closed?'CLOSED':'OPEN')+'</text>' +
      terminalSVG(sw.id+':a',{x:sw.x-54,y:sw.y},pending)+
      terminalSVG(sw.id+':b',{x:sw.x+54,y:sw.y},pending)+'</g>';
  }).join('');
  const ledParts=doc.leds.map(d=>{
    const reading=result.leds.find(r=>r.id===d.id);
    const selectedLed=selected?.kind==='part'&&selected.id===d.id;
    const color={red:'#ff6363',green:'#7be1a7',blue:'#79b0ff'}[d.color];
    const on=reading?.state==='on';
    const glow=on?'drop-shadow(0 0 11px '+color+')':'none';
    const fill=on?color:'#182a3c';
    return '<g data-part-id="'+d.id+'" class="placed-led" role="button" tabindex="0" '+
      'aria-label="'+d.id+' '+d.color+' LED, '+(reading?.state||'unresolved')+'; select to edit">' +
      '<path d="M '+(d.x-54)+' '+d.y+' H '+(d.x-26)+' M '+(d.x+26)+' '+d.y+' H '+(d.x+54)+
      '" stroke="#ffc578" stroke-width="4" fill="none"/>' +
      '<circle cx="'+d.x+'" cy="'+d.y+'" r="27" fill="'+fill+'" stroke="'+(selectedLed?'#ffc578':color)+
      '" stroke-width="'+(selectedLed?4:2)+'" style="filter:'+glow+'"/>' +
      '<path d="M '+(d.x-13)+' '+(d.y-14)+' L '+(d.x+13)+' '+d.y+' L '+(d.x-13)+' '+(d.y+14)+
      ' Z" fill="#102339" stroke="#edf4ff" stroke-width="2"/>' +
      '<path d="M '+(d.x+15)+' '+(d.y-17)+' V '+(d.y+17)+'" stroke="#edf4ff" stroke-width="3"/>' +
      '<path d="M '+(d.x+25)+' '+(d.y-28)+' l 11 -10 m -3 0 h 3 v 3 M '+
      (d.x+29)+' '+(d.y-20)+' l 11 -10 m -3 0 h 3 v 3" stroke="'+color+
      '" stroke-width="2" fill="none"/>' +
      '<text x="'+d.x+'" y="'+(d.y+48)+'" font-size="16" text-anchor="middle" fill="#edf4ff">'+
      d.id+' '+d.color.toUpperCase()+'</text>' +
      terminalSVG(d.id+':a',{x:d.x-54,y:d.y},pending)+
      terminalSVG(d.id+':b',{x:d.x+54,y:d.y},pending)+'</g>';
  }).join('');
  // Visual probe markers are overlays only, never physical wires or
  // current paths. They do not intercept mouse or keyboard events.
  const probeMarks=['voltage','continuity'].includes(meter.mode)
    ? [[meter.red,'#ff7882'],[meter.black,'#85bfff']]
      .filter(([t])=>t!==null)
      .map(([t,color])=>{
        const pt=endpointPosition(doc,t);
        return '<circle cx="'+pt.x+'" cy="'+pt.y+'" r="17" stroke="'+color+
          '" stroke-width="4" fill="none" pointer-events="none"/>';
      }).join('')
    : '';
  return '<defs><pattern id="wiring-grid" width="24" height="24" patternUnits="userSpaceOnUse">'+
    '<circle cx="1" cy="1" r="1" fill="#294156"/></pattern></defs>' +
    '<rect x="0" y="0" width="900" height="500" fill="#0a1727" rx="12"/>' +
    '<rect x="0" y="0" width="900" height="500" fill="url(#wiring-grid)" rx="12"/>' +
    '<text x="22" y="30" fill="#8da5bc" font-size="15">IDEAL RESISTIVE DC • CLICK TWO TERMINALS TO WIRE</text>' +
    '<path d="M110 105 V184 M110 316 V405" stroke="#55e2df" stroke-width="5" fill="none"/>' +
    '<rect x="74" y="184" width="72" height="132" rx="12" fill="#1a3545" stroke="#55e2df" stroke-width="3"/>' +
    '<text x="110" y="224" fill="#fff" font-size="28" text-anchor="middle">+</text>' +
    '<text x="110" y="257" fill="#edf4ff" font-size="17" text-anchor="middle">'+doc.supplyV+' V</text>' +
    '<text x="110" y="295" fill="#edf4ff" font-size="24" text-anchor="middle">−</text>' +
    '<text x="46" y="92" fill="#55e2df" font-size="16">V+</text>' +
    '<text x="42" y="445" fill="#55e2df" font-size="16">GND</text>' +
    wires+parts+switches+ledParts+
    terminalSVG('V+',SOURCE_TERMINALS['V+'],pending)+
    terminalSVG('GND',SOURCE_TERMINALS.GND,pending)+probeMarks+
    '<text x="470" y="478" text-anchor="middle" fill="#59738c" font-size="13">Educational model only. No currents are assumed for an ideal source short.</text>';
}

function wiringPanelHTML() {
  return '<span class="eyebrow">VIRTUAL HARDWARE WORKSHOP • V0.6</span>' +
    '<h1>Wiring Sandbox</h1>' +
    '<p>Place resistors, switches and polarized LEDs, connect terminals, and simulate an idealized DC circuit. ' +
    'LEDs light only when the model predicts forward current. No hardware required.</p>' +
    '<div class="panel wiring-toolbar">' +
    '<label>Start from a circuit<select id="wiring-preset" class="lab-select" aria-label="Start circuit example">' +
    '<option value="" disabled>Current design (saved locally)</option><option value="series">Two resistors in series</option>' +
    '<option value="parallel">Two parallel branches</option>' +
    '<option value="divider">Loaded voltage divider</option>' +
    '<option value="switch">Series switch challenge</option>' +
    '<option value="led">Red LED + 330 Ω</option>' +
    '<option value="reverse-led">Reversed LED + 330 Ω</option>' +
    '<option value="led-unlimited">LED without resistor (caution)</option>' +
    '<option value="open">Blank wiring challenge</option></select></label>' +
    '<button type="button" id="wiring-add" class="button primary">+ Add resistor</button>' +
    '<button type="button" id="wiring-add-switch" class="button">+ Add switch</button>' +
    '<button type="button" id="wiring-add-led" class="button">+ Add LED</button>' +
    '<button type="button" id="wiring-delete" class="button">Delete selected</button>' +
    '<button type="button" id="wiring-clear" class="button">Disconnect all</button>' +
    '<button type="button" id="wiring-undo" class="button">Undo</button></div>' +
    '<div class="wiring-workspace"><svg id="wiring-canvas" viewBox="0 0 900 500" role="group" aria-label="Interactive circuit drawing canvas"></svg></div>' +
    '<p id="wiring-help" class="micro" aria-live="polite">Select Wire to connect terminals or choose a meter mode to investigate. Drag components to move them.</p>' +
    '<section class="panel meter-panel" aria-label="Virtual multimeter">' +
      '<div class="meter-header"><div><h2>Virtual Multimeter</h2><p class="micro">Ideal measurements • no real hardware</p></div>' +
      '<label>Tool / measurement mode<select id="meter-mode" class="lab-select" aria-label="Choose wiring or meter tool">' +
      '<option value="wire">Wire / edit</option><option value="voltage">DC voltage probes</option>' +
      '<option value="continuity">Wire continuity (power off)</option>' +
      '<option value="current">Inspect branch current</option></select></label></div>' +
      '<div class="meter-results"><div><span class="micro" id="meter-label">Ready to measure</span>' +
      '<div id="meter-readout" class="meter-digits" role="status" aria-live="polite">—</div></div>' +
      '<div><strong id="meter-probes">Select a mode</strong><p id="meter-details" class="micro">' +
      'DC voltmeter readings do not load the model. Continuity checks ideal wires and closed switches only.</p></div></div>' +
      '<p class="micro">Voltage / continuity: click the RED probe terminal, then the BLACK probe terminal. ' +
      'To reposition, click another terminal. Current: select a resistor or LED body. ' +
      'A real ammeter normally requires a series connection; this tool reads simulated branch current without changing the circuit.</p>' +
      '<div class="meter-shortcuts"><button type="button" id="meter-reset" class="button">Clear probes</button>' +
      '<button type="button" id="meter-source" class="button">Probe supply V+ / GND</button></div></section>' +
    '<div class="wiring-bottom">' +
    '<section class="panel wiring-details"><h2>Parts & power</h2>' +
    '<label class="wiring-supply"><span>Ideal supply</span><input type="range" min="0" max="24" step=".5" value="9" id="wiring-supply"><output id="wiring-supply-value">9 V</output></label>' +
    '<div id="wiring-inspector"></div>' +
    '<div class="actions"><button class="button" id="wiring-export">Export JSON</button>' +
    '<label class="button wiring-upload">Import JSON<input id="wiring-import" type="file" accept=".json,application/json" hidden></label></div>' +
    '<p class="micro">The document is saved locally in this browser. Import files are checked before use. No account or server required.</p></section>' +
    '<section class="panel wiring-results"><h2>Circuit readings</h2>' +
    '<div id="wiring-state" class="wiring-state" role="status"></div>' +
    '<div class="result-grid"><div class="result"><small>Supply current</small><strong id="wiring-current">—</strong></div>' +
    '<div class="result"><small>Equivalent resistance</small><strong id="wiring-equivalent">—</strong></div></div>' +
    '<div class="wiring-table-wrap"><table class="truth-table wiring-readings"><thead><tr><th>Part</th><th>ΔV (a→b)</th><th>I (a→b)</th><th>Power</th><th>State</th></tr></thead>' +
    '<tbody id="wiring-readings-body"></tbody></table></div>' +
    '<ul id="wiring-notices" class="wiring-notices"></ul></section></div>' +
    '<section class="panel" style="margin-top:1rem"><h2>Challenge: make a working loop</h2>' +
    '<p>Select <strong>Blank wiring challenge</strong>. Connect the positive supply to R1’s left terminal, ' +
    'R1’s right terminal to R2’s left, and R2’s right terminal to GND. Your goal is a complete series loop with a measurable current.</p>' +
    '<p class="micro">This solver supports up to '+MAX_RESISTORS+' ideal resistors and '+MAX_WIRES+
    ' ideal wires. It does not model semiconductors, capacitance, transient behavior, physical voltage limits or source impedance. ' +
    'A direct V+ to GND path through wires and closed switches is an ideal short. ' +
    'LEDs use a fixed forward-voltage threshold plus a teaching-only 20 Ω model slope, not measured device physics. ' +
    'For simpler current-limiting arithmetic, compare the dedicated LED + Resistor bench.</p>' +
    '<button class="button" data-open-lab="led">Open LED + Resistor Bench</button></section>';
}

/** Create and bind the interactive wiring canvas inside its own app route. */
export function mountWiringLab(root,options={}) {
  const { initialCircuit=null, storageKey=STORAGE_KEY,
    onCircuitChange=null, onMeterSnapshot=null, challengeMode=false }=options;
  root.innerHTML=wiringPanelHTML();
  if(challengeMode){
    // Keep the editing controls in the document for existing event handlers,
    // but hide unrelated presets/imports and new-part buttons during missions.
    for(const selector of ['#wiring-preset','#wiring-add','#wiring-add-switch','#wiring-add-led',
      '#wiring-import','#wiring-export']){
      const control=root.querySelector(selector);
      if(control)control.closest('label')?.classList.add('academy-hidden-control');
      if(control&&!control.closest('label'))control.classList.add('academy-hidden-control');
    }
  }
  const canvas=root.querySelector('#wiring-canvas');
  const inspector=root.querySelector('#wiring-inspector');
  const hint=root.querySelector('#wiring-help');
  const stateBanner=root.querySelector('#wiring-state');
  let doc,loaded=false;
  if(initialCircuit){
    doc=validateCircuit(initialCircuit);loaded=true;
  }else if(storageKey!==null){
    try{
      const cached=localStorage.getItem(storageKey);
      if(cached){doc=validateCircuit(JSON.parse(cached));loaded=true;}
    }catch(_){/* Bad local data must not prevent using the classroom. */}
  }
  if(!doc)doc=presetCircuit('series');
  root.querySelector('#wiring-preset').value=loaded?'':'series';
  const history=[];
  const meter={mode:'wire',red:null,black:null,part:null};
  let selected=null;
  let pending=null;
  let drag=null;
  let notice=loaded?'Restored locally saved circuit.':'Start by connecting two terminals.';
  function persist(){
    if(storageKey!==null){
      try{localStorage.setItem(storageKey,JSON.stringify(doc));}
      catch(_){/* Storage may be disabled by browser settings. */}
    }
  }
  function snapshot(){
    root.querySelector('#wiring-preset').value='';
    history.push(JSON.stringify(doc));
    if(history.length>30)history.shift();
  }
  function message(value){notice=value;}
  function render(){
    const result=solveCircuit(doc);
    canvas.innerHTML=svgMarkup(doc,selected,pending,result,meter);
    root.querySelector('#wiring-supply').value=String(doc.supplyV);
    root.querySelector('#wiring-supply-value').textContent=doc.supplyV+' V';
    root.querySelector('#wiring-undo').disabled=history.length===0;
    root.querySelector('#wiring-add').disabled=doc.parts.length>=MAX_RESISTORS;
    root.querySelector('#wiring-add-switch').disabled=doc.switches.length>=MAX_SWITCHES;
    root.querySelector('#wiring-add-led').disabled=doc.leds.length>=MAX_LEDS;
    root.querySelector('#wiring-delete').disabled=!selected;
    stateBanner.className='wiring-state wiring-'+result.status;
    const summaries={ok:'Connected circuit',open:'Open circuit',short:'Ideal source short detected',unsolved:'Model could not resolve this LED circuit'};
    stateBanner.textContent=summaries[result.status];
    root.querySelector('#wiring-current').textContent=formatMa(result.sourceCurrentA);
    root.querySelector('#wiring-equivalent').textContent=result.equivalentOhms===null?'—':result.equivalentOhms.toFixed(2)+' Ω';
    root.querySelector('#wiring-equivalent').previousElementSibling.textContent=
      doc.leds.length?'Operating-point V / I':'Equivalent resistance';
    root.querySelector('#wiring-readings-body').innerHTML=result.parts.map(p=>
      '<tr><td>'+p.id+'</td><td>'+formatV(p.voltageV)+'</td><td>'+formatMa(p.currentA)+'</td>' +
      '<td>'+formatW(p.powerW)+'</td><td>'+p.state+'</td></tr>').join('') +
      result.leds.map(led=>'<tr><td>'+led.id+'</td><td>'+formatV(led.voltageV)+'</td><td>'+
      formatMa(led.currentA)+'</td><td>'+formatW(led.powerW)+'</td><td>'+
      textSafe(led.state)+'</td></tr>').join('') +
      result.switches.map(sw=>
      '<tr><td>'+sw.id+'</td><td>—</td><td>—</td><td>—</td><td>'+sw.state+'</td></tr>').join('');
    root.querySelector('#wiring-notices').innerHTML=result.notices.map(n=>'<li>'+textSafe(n)+'</li>').join('');
    if(!result.notices.length)root.querySelector('#wiring-notices').innerHTML=
      '<li>Ideal DC readings only. Confirm all real component ratings before building.</li>';
    if(selected?.kind==='part'){
      const p=doc.parts.find(x=>x.id===selected.id)||doc.switches.find(x=>x.id===selected.id)||
        doc.leds.find(x=>x.id===selected.id);
      if(!p){selected=null;inspector.innerHTML='';}
      else if(p.id.startsWith('D')){
        inspector.innerHTML='<div class="wiring-inspector"><strong>Selected: '+p.id+' (polarized LED)</strong>' +
          '<p class="micro">Terminal a (left) is the anode (+). Terminal b (right) is the cathode (bar). '+
          'Reverse wiring blocks modeled current and may exceed real reverse-voltage limits.</p>'+
          '<label>LED color / forward threshold<select id="wiring-led-color" class="lab-select">'+
          Object.entries(LED_FORWARD_V).map(([name,v])=>'<option value="'+name+'"'+
          (name===p.color?' selected':'')+'>'+name+' (≈'+v+' V)</option>').join('')+'</select></label>'+
          '<button type="button" class="button" id="wiring-flip-led">Flip LED polarity</button>' +
          '<p class="micro">Flip swaps which external wires connect to the anode and cathode.</p>' +
          '<p class="micro">The model uses a fixed 20 Ω series slope, not a real diode datasheet.</p></div>';
      } else if(p.id.startsWith('S')){
        inspector.innerHTML='<div class="wiring-inspector"><strong>Selected: '+p.id+' (ideal switch)</strong>' +
          '<p>State: <strong>'+ (p.closed?'Closed':'Open')+'</strong></p>' +
          '<button type="button" class="button primary" id="wiring-toggle-switch" ' +
          'aria-label="Toggle selected switch '+p.id+'">Toggle switch</button>' +
          '<p class="micro">Closed behaves like an ideal wire; open interrupts the path. ' +
          'The switch branch current is not individually reported because ideal-wire current sharing is not always unique.</p></div>';
      } else inspector.innerHTML='<div class="wiring-inspector"><strong>Selected: '+p.id+
        '</strong><label><span>Resistance (Ω)</span><input type="number" id="wiring-resistance" ' +
        'min="1" max="10000000" step="100" value="'+p.ohms+'" inputmode="decimal"></label>' +
        '<p class="micro">Change resistance, then press Enter or click outside the box.</p></div>';
    } else if(selected?.kind==='wire'){
      const w=doc.wires[selected.index];
      inspector.innerHTML=w?'<p><strong>Selected wire:</strong> '+textSafe(w.a)+' ↔ '+textSafe(w.b)+
        '</p><p class="micro">Use Delete selected to disconnect it.</p>':'';
    } else inspector.innerHTML='<p class="micro">Select a resistor, LED or switch to edit it. Drag components to move them.</p>';
    hint.textContent=(pending?'Connecting from '+pending+'. Click another terminal, or press Escape. ': '')+notice;
    renderMeter(result);
    if(typeof onMeterSnapshot==='function'){
      const readout=root.querySelector('#meter-readout').textContent;
      const details=root.querySelector('#meter-details').textContent;
      const probes=root.querySelector('#meter-probes').textContent;
      onMeterSnapshot(meter.mode!=='wire'&&readout!=='—'?
        {mode:meter.mode,readout,details,probes,supplyV:doc.supplyV}:null);
    }
    persist();
    if(typeof onCircuitChange==='function')onCircuitChange(validateCircuit(doc),result);
  }
  function renderMeter(result){
    const readout=root.querySelector('#meter-readout');
    const detail=root.querySelector('#meter-details');
    const labels=root.querySelector('#meter-probes');
    root.querySelector('#meter-mode').value=meter.mode;
    if(meter.mode==='wire'){
      readout.textContent='—';
      labels.textContent='Wiring tool';
      detail.textContent='Click two terminals to add an ideal wire. Select a meter mode to inspect the design.';
      return;
    }
    if(meter.mode==='current'){
      labels.textContent=meter.part?'Part '+meter.part:'Select a part';
      if(!meter.part){readout.textContent='—';detail.textContent='Click any resistor or LED body for signed branch current.';return;}
      if(![...doc.parts,...doc.switches,...doc.leds].some(p=>p.id===meter.part)){
        meter.part=null;readout.textContent='—';detail.textContent='Selected part no longer exists.';return;
      }
      const x=inspectBranchCurrent(doc,result,meter.part);
      readout.textContent=x.status==='ok'?formatMa(x.value):'—';
      detail.textContent=x.details;
      return;
    }
    labels.textContent='RED: '+(meter.red||'choose terminal')+' | BLACK: '+(meter.black||'choose terminal');
    if(!meter.red||!meter.black){
      readout.textContent='—';
      detail.textContent='Click red (+) terminal first, then black (−). Probe markers do not alter the circuit.';
      return;
    }
    const x=meter.mode==='voltage'?
      measureVoltage(doc,result,meter.red,meter.black):
      traceContinuity(doc,meter.red,meter.black);
    readout.textContent=meter.mode==='voltage'?
      (x.status==='ok'?formatV(x.value):'—'):
      (x.value?'CONNECTED':'OPEN');
    detail.textContent=x.details;
  }
  function meterTerminalClick(t){
    if(meter.mode==='current'){
      message('Current tool: select a resistor or LED body, not a terminal.');render();return;
    }
    if(!meter.red||meter.black!==null){
      meter.red=t;meter.black=null;
      message('Red probe placed at '+t+'. Choose the black probe terminal.');
    }else{
      meter.black=t;message('Measured '+meter.red+' relative to '+t+'.');
    }
    render();
  }
  function terminalClick(t){
    if(meter.mode!=='wire'){meterTerminalClick(t);return;}
    if(pending===null){
      pending=t;selected=null;message('Choose a second terminal to complete the connection.');render();return;
    }
    if(pending===t){pending=null;message('Canceled terminal selection.');render();return;}
    const a=pending,b=t;
    pending=null;
    if(doc.wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a))){
      message('Those terminals are already wired together.');render();return;
    }
    if(doc.wires.length>=MAX_WIRES){message('Maximum wire count reached.');render();return;}
    snapshot();doc.wires.push({a,b});selected={kind:'wire',index:doc.wires.length-1};
    message('Connected '+a+' to '+b+'.');render();
  }
  function toPoint(event) {
    const pt=canvas.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;
    const matrix=canvas.getScreenCTM();
    if(!matrix)return null;
    const pos=pt.matrixTransform(matrix.inverse());
    return {x:pos.x,y:pos.y};
  }
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function inspectTarget(target){
    const t=target.closest('[data-terminal]');
    if(t)return {kind:'terminal',id:t.dataset.terminal};
    const wire=target.closest('[data-wire-index]');
    if(wire)return {kind:'wire',index:Number(wire.dataset.wireIndex)};
    const part=target.closest('[data-part-id]');
    if(part)return {kind:'part',id:part.dataset.partId};
    return null;
  }
  function choose(target){
    const hit=inspectTarget(target);
    if(!hit)return;
    if(hit.kind==='terminal'){terminalClick(hit.id);return;}
    if(hit.kind==='wire'){
      if(meter.mode!=='wire'){message('Choose terminals or components for this meter mode.');render();return;}
      selected={kind:'wire',index:hit.index};pending=null;message('Wire selected.');render();return;
    }
    if(hit.kind==='part'){
      if(meter.mode==='current'){
        meter.part=hit.id;
        message('Inspecting current through '+hit.id+'.');
        render();return;
      }
      selected={kind:'part',id:hit.id};pending=null;
      message(hit.id.startsWith('S')?'Switch selected; toggle it below.':
        hit.id.startsWith('D')?'LED selected; choose its color below.':
        'Resistor selected; adjust its value below.');
      render();}
  }
  canvas.addEventListener('click',e=>{if(!drag)choose(e.target);});
  canvas.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      pending=null;meter.red=null;meter.black=null;meter.part=null;
      message('Wiring or meter selection cleared.');render();e.preventDefault();return;
    }
    if(e.key!=='Enter'&&e.key!==' ')return;
    const hit=inspectTarget(e.target);
    if(hit){e.preventDefault();choose(e.target);}
  });
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('[data-terminal]'))return;
    const hit=inspectTarget(e.target);
    if(hit?.kind!=='part')return;
    const p=[...doc.parts,...doc.switches,...doc.leds].find(x=>x.id===hit.id),xy=toPoint(e);
    if(!p||!xy)return;
    drag={pointerId:e.pointerId,id:p.id,startX:xy.x,startY:xy.y,offsetX:p.x-xy.x,offsetY:p.y-xy.y,moved:false};
    selected={kind:'part',id:p.id};pending=null;
    // Capture only after movement crosses the drag threshold. This allows
    // an ordinary pointer click to select a component on real devices.
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const xy=toPoint(e);if(!xy)return;
    if(!drag.moved && Math.hypot(xy.x-drag.startX,xy.y-drag.startY)<6)return;
    if(!drag.moved){snapshot();drag.moved=true;canvas.setPointerCapture(e.pointerId);}
    const p=[...doc.parts,...doc.switches,...doc.leds].find(p=>p.id===drag.id);
    if(!p)return;
    p.x=clamp(Math.round(xy.x+drag.offsetX),150,810);
    p.y=clamp(Math.round(xy.y+drag.offsetY),75,425);
    message('Moved '+p.id+'.');render();
  });
  const finishDrag=e=>{
    if(drag?.pointerId===e.pointerId){
      const moved=drag.moved;
      drag=null;
      if(moved)message('Component moved.');
      else message('Component selected. Edit it in the parts panel.');
      render();
      // A captured pointer gesture may produce a click on the SVG root;
      // that does not alter wiring.
    }
  };
  canvas.addEventListener('pointerup',finishDrag);
  canvas.addEventListener('pointercancel',finishDrag);
  root.querySelector('#meter-mode').addEventListener('change',e=>{
    meter.mode=e.target.value;
    meter.red=null;meter.black=null;meter.part=null;pending=null;
    message(meter.mode==='wire'?'Wire tool selected.':'Meter mode: '+e.target.selectedOptions[0].textContent+'.');
    render();
  });
  root.querySelector('#meter-reset').addEventListener('click',()=>{
    meter.red=null;meter.black=null;meter.part=null;
    message('Cleared virtual meter probes.');render();
  });
  root.querySelector('#meter-source').addEventListener('click',()=>{
    meter.mode='voltage';meter.red='V+';meter.black='GND';meter.part=null;pending=null;
    message('Voltage probes placed across the supply.');render();
  });
  root.querySelector('#wiring-preset').addEventListener('change',e=>{
    const kind=e.target.value;
    if(!kind)return;
    snapshot();doc=presetCircuit(kind);e.target.value=kind;selected=null;pending=null;
    meter.red=null;meter.black=null;meter.part=null;
    message('Example loaded: '+e.target.selectedOptions[0].textContent+'.');render();
  });
  root.querySelector('#wiring-add').addEventListener('click',()=>{
    if(doc.parts.length>=MAX_RESISTORS)return;
    let n=1;while(doc.parts.some(p=>p.id==='R'+n))n++;
    snapshot();
    const id='R'+n,x=250+((doc.parts.length*115)%500),y=125+((doc.parts.length*63)%260);
    doc.parts.push({id,ohms:1000,x,y});
    selected={kind:'part',id};pending=null;
    message('Added '+id+'. Click terminals to wire it.');render();
  });
  root.querySelector('#wiring-add-switch').addEventListener('click',()=>{
    if(doc.switches.length>=MAX_SWITCHES)return;
    let n=1;while(doc.switches.some(sw=>sw.id==='S'+n))n++;
    snapshot();
    const id='S'+n,x=285+((doc.switches.length*137)%470),y=125+((doc.switches.length*75)%235);
    doc.switches.push({id,closed:false,x,y});
    selected={kind:'part',id};pending=null;
    message('Added '+id+'. Wire it into a circuit, then toggle it.');render();
  });
  root.querySelector('#wiring-add-led').addEventListener('click',()=>{
    if(doc.leds.length>=MAX_LEDS)return;
    let n=1;while(doc.leds.some(d=>d.id==='D'+n))n++;
    snapshot();
    const id='D'+n,x=285+((doc.leds.length*137)%470),y=140+((doc.leds.length*83)%235);
    doc.leds.push({id,color:'red',x,y});
    selected={kind:'part',id};pending=null;
    message('Added '+id+' (red). Wire anode a to positive through a suitable resistor, cathode b to ground.');render();
  });
  root.querySelector('#wiring-inspector').addEventListener('click',e=>{
    if(e.target.closest('#wiring-flip-led')&&selected?.kind==='part'){
      const led=doc.leds.find(d=>d.id===selected.id);
      if(!led)return;
      snapshot();
      doc=flipLedPolarity(doc,led.id);
      message('Flipped '+led.id+' polarity by swapping its connected anode/cathode leads.');
      render();return;
    }
    if(!e.target.closest('#wiring-toggle-switch')||selected?.kind!=='part')return;
    const sw=doc.switches.find(sw=>sw.id===selected.id);
    if(!sw)return;
    snapshot();sw.closed=!sw.closed;
    message(sw.id+' is '+(sw.closed?'closed':'open')+'.');render();
  });
  root.querySelector('#wiring-delete').addEventListener('click',()=>{
    if(!selected)return;
    snapshot();
    if(selected.kind==='wire'){
      doc.wires.splice(selected.index,1);message('Wire removed.');
    } else {
      const id=selected.id;
      doc.parts=doc.parts.filter(p=>p.id!==id);
      doc.switches=doc.switches.filter(sw=>sw.id!==id);
      doc.leds=doc.leds.filter(d=>d.id!==id);
      doc.wires=doc.wires.filter(w=>!w.a.startsWith(id+':')&&!w.b.startsWith(id+':'));
      message(id+' removed along with its connected wires.');
    }
    selected=null;pending=null;render();
  });
  root.querySelector('#wiring-clear').addEventListener('click',()=>{
    if(!doc.wires.length)return;
    snapshot();doc.wires=[];selected=null;pending=null;
    message('Disconnected every wire. Parts remain in place.');render();
  });
  root.querySelector('#wiring-undo').addEventListener('click',()=>{
    if(!history.length)return;
    doc=validateCircuit(JSON.parse(history.pop()));
    selected=null;pending=null;message('Last action undone.');render();
  });
  root.querySelector('#wiring-supply').addEventListener('input',e=>{
    root.querySelector('#wiring-preset').value='';
    doc.supplyV=Number(e.target.value);
    message('Changed the ideal supply voltage.');render();
  });
  root.querySelector('#wiring-inspector').addEventListener('change',e=>{
    if(selected?.kind!=='part')return;
    if(e.target.id==='wiring-led-color'){
      const d=doc.leds.find(d=>d.id===selected.id);
      if(!d||!Object.hasOwn(LED_FORWARD_V,e.target.value)||d.color===e.target.value)return;
      snapshot();d.color=e.target.value;
      message('Changed '+d.id+' to '+d.color+' LED; the assumed forward voltage has changed.');
      render();return;
    }
    if(e.target.id!=='wiring-resistance')return;
    const value=Number(e.target.value);
    if(!Number.isFinite(value)||value<1||value>1e7){
      message('Resistor values must be from 1 to 10,000,000 Ω.');render();return;
    }
    const p=doc.parts.find(x=>x.id===selected.id);
    if(!p||p.ohms===value)return;
    snapshot();p.ohms=value;
    message('Updated '+p.id+' to '+value+' Ω.');render();
  });
  root.querySelector('#wiring-export').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(doc,null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='phi-circuit-design.json';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    message('Exported a local JSON circuit document.');render();
  });
  root.querySelector('#wiring-import').addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    try{
      if(file.size>50000)throw new RangeError('Circuit JSON must be under 50 KB');
      const input=validateCircuit(JSON.parse(await file.text()));
      snapshot();doc=input;selected=null;pending=null;
      meter.red=null;meter.black=null;meter.part=null;
      message('Imported a validated local circuit document.');
    }catch(err){message('Import rejected: '+err.message);}
    e.target.value='';
    render();
  });
  render();
}
