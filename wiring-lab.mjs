import {
  MAX_RESISTORS, MAX_WIRES, presetCircuit, solveCircuit, validateCircuit
} from './wiring-solver.mjs';

const STORAGE_KEY='phi-circuit-lab-wiring-v1';
const SVG_NS='http://www.w3.org/2000/svg';
const SOURCE_TERMINALS={
  'V+':{x:110,y:105},'GND':{x:110,y:405}
};

function endpointPosition(doc,name) {
  if (SOURCE_TERMINALS[name]) return SOURCE_TERMINALS[name];
  const [id,side]=name.split(':');
  const p=doc.parts.find(p=>p.id===id);
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
function svgMarkup(doc,selected,pending,result){
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
    wires+parts+
    terminalSVG('V+',SOURCE_TERMINALS['V+'],pending)+
    terminalSVG('GND',SOURCE_TERMINALS.GND,pending)+
    '<text x="470" y="478" text-anchor="middle" fill="#59738c" font-size="13">Educational model only. No currents are assumed for an ideal source short.</text>';
}

function wiringPanelHTML() {
  return '<span class="eyebrow">VIRTUAL HARDWARE WORKSHOP • V0.3</span>' +
    '<h1>Wiring Sandbox</h1>' +
    '<p>Arrange resistors, connect their terminals, and calculate currents from your own circuit topology. ' +
    'Start with a preset or use the disconnected example to build a circuit yourself.</p>' +
    '<div class="panel wiring-toolbar">' +
    '<label>Start from a circuit<select id="wiring-preset" class="lab-select" aria-label="Start circuit example">' +
    '<option value="" disabled>Current design (saved locally)</option><option value="series">Two resistors in series</option>' +
    '<option value="parallel">Two parallel branches</option>' +
    '<option value="divider">Loaded voltage divider</option>' +
    '<option value="open">Blank wiring challenge</option></select></label>' +
    '<button type="button" id="wiring-add" class="button primary">+ Add resistor</button>' +
    '<button type="button" id="wiring-delete" class="button">Delete selected</button>' +
    '<button type="button" id="wiring-clear" class="button">Disconnect all</button>' +
    '<button type="button" id="wiring-undo" class="button">Undo</button></div>' +
    '<div class="wiring-workspace"><svg id="wiring-canvas" viewBox="0 0 900 500" role="group" aria-label="Interactive circuit drawing canvas"></svg></div>' +
    '<p id="wiring-help" class="micro" aria-live="polite">Click one terminal circle, then another to add a wire. Click a wire or resistor to select it. Drag a resistor to move it. Press Escape to cancel connecting.</p>' +
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
    'A direct V+ to GND wire is treated as a fault, not as a numerical current.</p></section>';
}

/** Create and bind the interactive wiring canvas inside its own app route. */
export function mountWiringLab(root) {
  root.innerHTML=wiringPanelHTML();
  const canvas=root.querySelector('#wiring-canvas');
  const inspector=root.querySelector('#wiring-inspector');
  const hint=root.querySelector('#wiring-help');
  const stateBanner=root.querySelector('#wiring-state');
  let doc,loaded=false;
  try {
    const cached=localStorage.getItem(STORAGE_KEY);
    if(cached){doc=validateCircuit(JSON.parse(cached));loaded=true;}
  } catch (_) { /* Broken local data should never prevent loading lessons. */ }
  if(!doc)doc=presetCircuit('series');
  root.querySelector('#wiring-preset').value=loaded?'':'series';
  const history=[];
  let selected=null;
  let pending=null;
  let drag=null;
  let notice=loaded?'Restored locally saved circuit.':'Start by connecting two terminals.';
  function persist(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(doc));}
    catch(_){/* Storage may be disabled by browser settings. */ }
  }
  function snapshot(){
    root.querySelector('#wiring-preset').value='';
    history.push(JSON.stringify(doc));
    if(history.length>30)history.shift();
  }
  function message(value){notice=value;}
  function render(){
    const result=solveCircuit(doc);
    canvas.innerHTML=svgMarkup(doc,selected,pending,result);
    root.querySelector('#wiring-supply').value=String(doc.supplyV);
    root.querySelector('#wiring-supply-value').textContent=doc.supplyV+' V';
    root.querySelector('#wiring-undo').disabled=history.length===0;
    root.querySelector('#wiring-add').disabled=doc.parts.length>=MAX_RESISTORS;
    root.querySelector('#wiring-delete').disabled=!selected;
    stateBanner.className='wiring-state wiring-'+result.status;
    const summaries={ok:'Connected circuit',open:'Open circuit',short:'Ideal source short detected'};
    stateBanner.textContent=summaries[result.status];
    root.querySelector('#wiring-current').textContent=formatMa(result.sourceCurrentA);
    root.querySelector('#wiring-equivalent').textContent=result.equivalentOhms===null?'—':result.equivalentOhms.toFixed(2)+' Ω';
    root.querySelector('#wiring-readings-body').innerHTML=result.parts.map(p=>
      '<tr><td>'+p.id+'</td><td>'+formatV(p.voltageV)+'</td><td>'+formatMa(p.currentA)+'</td>' +
      '<td>'+formatW(p.powerW)+'</td><td>'+p.state+'</td></tr>').join('');
    root.querySelector('#wiring-notices').innerHTML=result.notices.map(n=>'<li>'+textSafe(n)+'</li>').join('');
    if(!result.notices.length)root.querySelector('#wiring-notices').innerHTML=
      '<li>Ideal DC readings only. Confirm all real component ratings before building.</li>';
    if(selected?.kind==='part'){
      const p=doc.parts.find(x=>x.id===selected.id);
      if(!p){selected=null;inspector.innerHTML='';}
      else inspector.innerHTML='<div class="wiring-inspector"><strong>Selected: '+p.id+
        '</strong><label><span>Resistance (Ω)</span><input type="number" id="wiring-resistance" ' +
        'min="1" max="10000000" step="100" value="'+p.ohms+'" inputmode="decimal"></label>' +
        '<p class="micro">Change resistance, then press Enter or click outside the box.</p></div>';
    } else if(selected?.kind==='wire'){
      const w=doc.wires[selected.index];
      inspector.innerHTML=w?'<p><strong>Selected wire:</strong> '+textSafe(w.a)+' ↔ '+textSafe(w.b)+
        '</p><p class="micro">Use Delete selected to disconnect it.</p>':'';
    } else inspector.innerHTML='<p class="micro">Select a resistor to change its resistance or drag it to a new position.</p>';
    hint.textContent=(pending?'Connecting from '+pending+'. Click another terminal, or press Escape. ': '')+notice;
    persist();
  }
  function terminalClick(t){
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
    if(hit.kind==='wire'){selected={kind:'wire',index:hit.index};pending=null;message('Wire selected.');render();return;}
    if(hit.kind==='part'){selected={kind:'part',id:hit.id};pending=null;message('Resistor selected; adjust its value below.');render();}
  }
  canvas.addEventListener('click',e=>{if(!drag)choose(e.target);});
  canvas.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      pending=null;message('Connection canceled.');render();e.preventDefault();return;
    }
    if(e.key!=='Enter'&&e.key!==' ')return;
    const hit=inspectTarget(e.target);
    if(hit){e.preventDefault();choose(e.target);}
  });
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('[data-terminal]'))return;
    const hit=inspectTarget(e.target);
    if(hit?.kind!=='part')return;
    const p=doc.parts.find(x=>x.id===hit.id),xy=toPoint(e);
    if(!p||!xy)return;
    drag={pointerId:e.pointerId,id:p.id,startX:xy.x,startY:xy.y,offsetX:p.x-xy.x,offsetY:p.y-xy.y,moved:false};
    selected={kind:'part',id:p.id};pending=null;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const xy=toPoint(e);if(!xy)return;
    if(!drag.moved && Math.hypot(xy.x-drag.startX,xy.y-drag.startY)<6)return;
    if(!drag.moved){snapshot();drag.moved=true;}
    const p=doc.parts.find(p=>p.id===drag.id);
    if(!p)return;
    p.x=clamp(Math.round(xy.x+drag.offsetX),150,810);
    p.y=clamp(Math.round(xy.y+drag.offsetY),75,425);
    message('Moved '+p.id+'.');render();
  });
  const finishDrag=e=>{
    if(drag?.pointerId===e.pointerId){
      const moved=drag.moved;
      drag=null;
      if(moved){message('Resistor moved.');render();}
      // A captured pointer gesture may produce a click on the SVG root;
      // that does not alter wiring.
    }
  };
  canvas.addEventListener('pointerup',finishDrag);
  canvas.addEventListener('pointercancel',finishDrag);
  root.querySelector('#wiring-preset').addEventListener('change',e=>{
    const kind=e.target.value;
    if(!kind)return;
    snapshot();doc=presetCircuit(kind);e.target.value=kind;selected=null;pending=null;
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
  root.querySelector('#wiring-delete').addEventListener('click',()=>{
    if(!selected)return;
    snapshot();
    if(selected.kind==='wire'){
      doc.wires.splice(selected.index,1);message('Wire removed.');
    } else {
      const id=selected.id;
      doc.parts=doc.parts.filter(p=>p.id!==id);
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
    if(e.target.id!=='wiring-resistance'||selected?.kind!=='part')return;
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
      message('Imported a validated local circuit document.');
    }catch(err){message('Import rejected: '+err.message);}
    e.target.value='';
    render();
  });
  render();
}
