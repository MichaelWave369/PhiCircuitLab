import {
  BREADBOARD_STORAGE_KEY,BOARD_COLS,BOARD_ROWS,BOARD_HOLES,
  blankBreadboard,validateBreadboard,createBreadboardExample,analyzeBreadboard,
  measureBreadboardVoltage,traceBreadboardContinuity,
  addBoardJumper,addBoardPart,editBoardPart,removeBoardItem,setBoardSupply
} from './breadboard-engine.mjs';

const safe=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const fmtV=v=>v===null?'—':v.toFixed(3)+' V';
const fmtMa=a=>a===null?'—':(a*1000).toFixed(3)+' mA';
const BOARD_Y={P:74,N:120,A:176,B:204,C:232,D:260,E:288,
  F:360,G:388,H:416,I:444,J:472};
const pos=id=>{
  if(id==='V+')return {x:48,y:74};
  if(id==='GND')return {x:48,y:120};
  const row=id[0],col=Number(id.slice(1));
  return {x:110+col*52,y:BOARD_Y[row]};
};
const partKind=id=>id.startsWith('R')?'part':id.startsWith('S')?'switch':'led';
const memberSet=(analysis,contact)=>new Set(analysis.netMembers(contact));
const panel=()=>'<section class="bb-header"><span class="eyebrow">Φ CIRCUIT LAB • v1.1 • SOLDERLESS PROTOTYPING</span>'+
  '<h1>Virtual Breadboard & Component Library</h1>'+
  '<p>Build in actual electrical contact strips: A–E share each column, F–J share a different strip across '+
  'the center trench, and P/N rails run separately. Nothing is powered until you connect source jacks with jumpers.</p></section>'+
  '<section class="panel bb-toolbar" aria-label="Breadboard tools and starter circuits">'+
  '<div class="bb-toolbar-primary"><label>Starter circuit<select id="bb-example" class="lab-select">'+
  '<option value="led">LED + limiting resistor</option><option value="resistor">Single resistor</option>'+
  '<option value="parallel">Parallel resistors</option><option value="switch">Switch + resistor</option>'+
  '<option value="reverse-led">Backwards LED diagnosis</option>'+
  '<option value="blank">Blank breadboard</option></select></label>'+
  '<label>Active tool<select id="bb-tool" class="lab-select">'+
  '<option value="select">Select and inspect</option><option value="jumper">Jumper wire: two clicks</option>'+
  '<option value="resistor">Resistor: two holes</option><option value="switch">SPST switch: two holes</option>'+
  '<option value="led">Polarized LED: anode then cathode</option>'+
  '<option value="voltage">DC volts: red then black</option>'+
  '<option value="continuity">Copper continuity: two contacts</option></select></label>'+
  '<label>Power source (V)<input id="bb-supply" type="number" min="0" max="24" step=".5" value="5"></label></div>'+
  '<div class="bb-toolbar-actions"><button id="bb-undo" class="button" type="button">Undo</button>'+
  '<button id="bb-clear" class="button" type="button">Clear board</button>'+
  '<button id="bb-export" class="button" type="button">Export breadboard JSON</button>'+
  '<label class="button bb-import-control">Import breadboard JSON<input id="bb-import" type="file" hidden accept=".json,application/json"></label>'+
  '<button id="bb-send-to-wiring" class="button" type="button">Send to Wiring Lab</button></div>'+
  '<p class="micro bb-tool-message" id="bb-message" role="status" aria-live="polite">Select a tool, then use the labeled hole contacts.</p></section>'+
  '<div class="bb-workspace"><section class="panel bb-visual" aria-label="Solderless breadboard visualization">'+
  '<div class="bb-visual-heading"><h2>12-column training breadboard</h2>'+
  '<span id="bb-status" class="bb-status">—</span></div>'+
  '<p class="micro">Red V+ and gray GND are loose supply leads at left. Connect them to P/N rails with jumper wires. '+
  'The two long rails are not connected to each other or to the center strips by default.</p>'+
  '<div class="bb-svg-wrap"><svg id="bb-canvas" viewBox="0 0 900 540" role="group" aria-label="Clickable breadboard, power rails, ten-hole contact columns and components"></svg></div>'+
  '<div class="bb-summary"><div><small>Modeled source current</small><strong id="bb-current">—</strong></div>'+
  '<div><small>Placed resistors / switches / LEDs</small><strong id="bb-counts">—</strong></div>'+
  '<div><small>Jumper wires</small><strong id="bb-wires-count">—</strong></div></div>'+
  '<ul id="bb-notices" class="bb-notices"></ul></section>'+
  '<aside class="bb-side"><section class="panel"><h2>Component library</h2>'+
  '<p>Choose a placement tool. Click the first hole, then the second. Parts bridge those two contacts electrically.</p>'+
  '<div class="bb-library-rows"><button type="button" class="bb-library" data-bb-tool="jumper"><strong>↗ Jumper</strong><span>Zero-ohm wire between contacts</span></button>'+
  '<button type="button" class="bb-library" data-bb-tool="resistor"><strong>▱ Resistor</strong><span>1 kΩ initial, editable 1 Ω–10 MΩ</span></button>'+
  '<button type="button" class="bb-library" data-bb-tool="switch"><strong>⎍ SPST switch</strong><span>Initially open, toggle to close</span></button>'+
  '<button type="button" class="bb-library" data-bb-tool="led"><strong>◉ LED</strong><span>Polarized, red/green/blue, requires resistor</span></button></div>'+
  '<p class="micro">8 resistors, 4 switches, 3 LEDs, and 40 jumpers maximum. This is a small training board, not a universal component catalog.</p></section>'+
  '<section class="panel"><h2>Selection & inspector</h2><div id="bb-inspector">'+
  '<p>Select a component, jumper or hole to see its details.</p></div></section>'+
  '<section class="panel"><h2>Virtual contact meter</h2>'+
  '<p>Choose DC volts or copper continuity, then probe two contacts. Measurements do not add wires.</p>'+
  '<p id="bb-probes" class="micro">Choose a probe mode</p>'+
  '<strong class="bb-meter-readout" id="bb-meter-readout">—</strong>'+
  '<p id="bb-meter-details" class="micro">Idle</p>'+
  '<button class="button" type="button" id="bb-reset-probes">Clear probes</button></section></aside></div>'+
  '<section class="panel bb-how-it-works"><h2>How a solderless breadboard actually connects</h2>'+
  '<div class="bb-rule-grid"><div><strong>Five contacts = one metal strip</strong>'+
  '<p>A3, B3, C3, D3 and E3 are internally connected. Column 4 is a separate strip.</p></div>'+
  '<div><strong>The center trench breaks the circuit</strong>'+
  '<p>E3 and F3 have NO internal connection. Place a resistor or jumper across the gap to join the two sides appropriately.</p></div>'+
  '<div><strong>Rails are separate and initially unpowered</strong>'+
  '<p>All P1–P12 contacts share the P rail; all N1–N12 share the N rail. Both remain isolated from the source until wired.</p></div></div>'+
  '<p class="micro">Educational DC model: ideal wires, resistors, SPST switches and simplified LED voltage/current curves. '+
  'Physical breadboards vary in rail splits, ratings and construction. Do not use for mains or real hardware safety decisions.</p></section>';

function svgBoard(doc,analysis,selected,pending,tool){
  const net=selected?.kind==='contact'?memberSet(analysis,selected.id):new Set();
  const base='<rect width="900" height="540" rx="16" fill="#0d1c29"/>'+
    '<rect x="100" y="30" width="690" height="475" rx="19" fill="#e1e7df" stroke="#b3bcb3" stroke-width="3"/>'+
    '<rect x="114" y="308" width="662" height="32" rx="4" fill="#9ea99f"/>'+
    '<text x="440" y="328" fill="#334044" font-size="13" text-anchor="middle">CENTER TRENCH · NO COPPER CONNECTION</text>'+
    '<path d="M 132 52 H 748" stroke="#cf5059" stroke-width="4"/>'+
    '<path d="M 132 98 H 748" stroke="#5f708a" stroke-width="4"/>'+
    '<text x="94" y="80" fill="#c63e4b" font-size="21" font-weight="700" text-anchor="end">+</text>'+
    '<text x="94" y="127" fill="#536273" font-size="21" font-weight="700" text-anchor="end">−</text>'+
    Array.from({length:BOARD_COLS},(_,i)=>{
      const n=i+1;
      return '<text x="'+pos('A'+n).x+'" y="156" font-size="14" fill="#334044" text-anchor="middle">'+n+'</text>';
    }).join('')+
    [...BOARD_ROWS].map(r=>'<text x="120" y="'+(BOARD_Y[r]+5)+'" fill="#334044" font-size="15" text-anchor="middle">'+r+'</text>').join('')+
    '<text x="437" y="525" text-anchor="middle" fill="#abc1d9" font-size="13">12-column breadboard · educational continuous rails</text>';
  const wires=doc.wires.map((w,i)=>{
    const a=pos(w.a),b=pos(w.b),active=selected?.kind==='wire'&&selected.index===i;
    const middle=Math.max(20,Math.min(a.y,b.y)-34-(i%4)*7);
    const d='M '+a.x+' '+a.y+' Q '+((a.x+b.x)/2)+' '+middle+' '+b.x+' '+b.y;
    const stroke=active?'#e6ba56':w.a==='V+'||w.b==='V+'?'#d45362':
      w.a==='GND'||w.b==='GND'?'#677989':['#4583c7','#448b70','#a368b3','#c18b4c'][i%4];
    return '<g data-bb-wire="'+i+'" tabindex="0" role="button" aria-label="Select jumper '+safe(w.a)+' to '+safe(w.b)+'">'+
      '<path d="'+d+'" fill="none" stroke="transparent" stroke-width="17" pointer-events="stroke"/>'+
      '<path d="'+d+'" fill="none" stroke="'+stroke+'" stroke-width="'+(active?'5':'3')+'" pointer-events="none"/></g>';
  }).join('');
  const comps=[
    ...doc.parts.map(p=>({...p,kind:'resistor'})),
    ...doc.switches.map(p=>({...p,kind:'switch'})),
    ...doc.leds.map(p=>({...p,kind:'led'}))
  ].map(part=>{
    const a=pos(part.a),b=pos(part.b),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
    const active=selected?.kind==='component'&&selected.id===part.id;
    const color=part.kind==='resistor'?'#b28a44':
      part.kind==='switch'?(part.closed?'#278d68':'#a75c5c'):
      ({red:'#be5263',green:'#3b9c72',blue:'#4f78c5'}[part.color]);
    const label=part.kind==='resistor'?part.ohms+' Ω':
      part.kind==='switch'?(part.closed?'CLOSED':'OPEN'):part.color.toUpperCase()+' LED';
    return '<g data-bb-part="'+part.id+'" tabindex="0" role="button" aria-label="Inspect '+part.kind+' '+part.id+'">'+
      '<path d="M '+a.x+' '+a.y+' L '+b.x+' '+b.y+'" fill="none" stroke="#68717b" stroke-width="6" pointer-events="none"/>'+
      '<rect x="'+(x-35)+'" y="'+(y-17)+'" width="70" height="34" rx="7" fill="'+(active?'#2b415b':color)+'"'+
      ' stroke="'+(active?'#f5dc71':'#f7f7e9')+'" stroke-width="'+(active?'4':'1.5')+'"/>'+
      '<text x="'+x+'" y="'+(y-4)+'" text-anchor="middle" fill="#fff" font-size="13" font-weight="700" pointer-events="none">'+part.id+'</text>'+
      '<text x="'+x+'" y="'+(y+10)+'" text-anchor="middle" fill="#fff" font-size="9.5" pointer-events="none">'+safe(label)+'</text>'+
      (part.kind==='led'?'<text x="'+(a.x-9)+'" y="'+(a.y-12)+'" font-size="12" fill="#a22" font-weight="700">A+</text>'+
        '<text x="'+(b.x-9)+'" y="'+(b.y-12)+'" font-size="12" fill="#334" font-weight="700">K−</text>':'')+
      '</g>';
  }).join('');
  const holes=BOARD_HOLES.map(id=>{
    const p=pos(id),active=id===pending,selectedNet=net.has(id);
    const rail=id.startsWith('P')||id.startsWith('N');
    return '<g data-bb-contact="'+id+'" role="button" tabindex="0" aria-label="Contact hole '+id+'">'+
      '<circle cx="'+p.x+'" cy="'+p.y+'" r="'+(selectedNet?'10':'8.5')+'" fill="'+(active?'#e7ae35':selectedNet?'#8edcc4':'#c8d0c8')+'"'+
      ' stroke="'+(active?'#a06000':selectedNet?'#07885f':'#7c8d88')+'" stroke-width="'+(active?'3':'1.2')+'"/>'+
      '<circle cx="'+p.x+'" cy="'+p.y+'" r="'+(rail?'4.5':'3.6')+'" fill="'+(active?'#45371b':'#46555a')+'"/>'+
      '<title>'+id+'</title></g>';
  }).join('');
  const jacks=['V+','GND'].map(id=>{
    const p=pos(id),active=id===pending;
    return '<g data-bb-contact="'+id+'" role="button" tabindex="0" aria-label="Source '+id+' jack">'+
      '<circle cx="'+p.x+'" cy="'+p.y+'" r="15" fill="'+(active?'#dfbc64':'#152532')+'" stroke="'+(id==='V+'?'#db596c':'#bbc7da')+'" stroke-width="3"/>'+
      '<text x="'+p.x+'" y="'+(p.y+4)+'" fill="#fff" font-size="10" text-anchor="middle" font-weight="700">'+(id==='V+'?'+':'−')+'</text>'+
      '<title>'+id+'</title></g>';
  }).join('');
  return base+wires+comps+holes+jacks;
}

export function mountBreadboardLab(root){
  root.innerHTML=panel();
  let doc,loaded=false;
  try{
    const raw=localStorage.getItem(BREADBOARD_STORAGE_KEY);
    if(raw){doc=validateBreadboard(JSON.parse(raw));loaded=true;}
  }catch(_){/* Ignore stale or damaged local data. */}
  if(!doc)doc=createBreadboardExample('led');
  const history=[];
  let tool='select',pending=null,selected=null,meter={red:null,black:null};
  let message=loaded?'Restored a saved breadboard.':'Try the LED example, then disconnect a jumper.';
  const $=selector=>root.querySelector(selector);
  const save=()=>{
    try{localStorage.setItem(BREADBOARD_STORAGE_KEY,JSON.stringify(doc));}
    catch(_){/* Continue in memory if local storage is not available. */}
  };
  const say=text=>{message=text;};
  function mutate(fn,feedback){
    try{
      const next=fn(doc);
      history.push(JSON.stringify(doc));if(history.length>40)history.shift();
      doc=validateBreadboard(next);
      if(feedback)say(feedback);
      pending=null;
    }catch(e){say('Action rejected: '+e.message);}
    render();
  }
  function inspector(analysis){
    const container=$('#bb-inspector');
    if(!selected){container.innerHTML='<p class="micro">Select a placed component, jumper, or hole to inspect.</p>';return;}
    if(selected.kind==='contact'){
      const contacts=analysis.netMembers(selected.id);
      const voltage=analysis.voltageAt(selected.id);
      container.innerHTML='<p><strong>Contact '+safe(selected.id)+'</strong></p>'+
        '<p class="micro">'+contacts.length+' contacts share its direct copper/jumper net. This does not include conducting resistor or diode paths.</p>'+
        '<p class="micro">Linked contacts: '+safe(contacts.slice(0,24).join(', '))+
        (contacts.length>24?' …':'')+'</p>'+
        '<p>Resolved model voltage: <strong>'+safe(fmtV(voltage))+'</strong></p>';
      return;
    }
    if(selected.kind==='wire'){
      const wire=doc.wires[selected.index];
      if(!wire){selected=null;inspector(analysis);return;}
      container.innerHTML='<p><strong>Jumper '+safe(wire.a)+' → '+safe(wire.b)+'</strong></p>'+
        '<p class="micro">An ideal conductor joining two contacts. Deleting it opens that direct connection.</p>'+
        '<button class="button" type="button" id="bb-delete">Remove this jumper</button>';return;
    }
    const p=[...doc.parts,...doc.switches,...doc.leds].find(x=>x.id===selected.id);
    if(!p){selected=null;inspector(analysis);return;}
    const kind=partKind(p.id);
    container.innerHTML='<p><strong>'+p.id+'</strong> · '+safe(p.a)+' (a) → '+safe(p.b)+' (b)</p>'+
      (kind==='part'?'<label>Resistance (Ω)<input id="bb-ohms" type="number" min="1" max="10000000" step="10" value="'+p.ohms+'"></label>':'')+
      (kind==='switch'?'<p>Contact: <strong>'+(p.closed?'closed':'open')+'</strong></p>'+
        '<button class="button" type="button" id="bb-toggle">'+(p.closed?'Open switch':'Close switch')+'</button>':'')+
      (kind==='led'?'<label>LED color<select class="lab-select" id="bb-led-color">'+
        ['red','green','blue'].map(c=>'<option value="'+c+'"'+(p.color===c?' selected':'')+'>'+c+'</option>').join('')+
        '</select></label><p class="micro">a = anode (+); b = cathode (−). Always retain current limiting.</p>'+
        '<button class="button" type="button" id="bb-flip">Flip LED polarity</button>':'')+
      '<button class="button" type="button" id="bb-delete">Remove selected component</button>';
  }
  function meterReadout(){
    const labels=$('#bb-probes'),readout=$('#bb-meter-readout'),details=$('#bb-meter-details');
    if(!['voltage','continuity'].includes(tool)){
      labels.textContent='Select DC volts or copper continuity to probe.';
      readout.textContent='—';details.textContent='Measurement probes never alter copper connectivity.';return;
    }
    labels.textContent='RED / first: '+(meter.red||'choose contact')+
      ' | BLACK / second: '+(meter.black||'choose contact');
    if(!meter.red||!meter.black){readout.textContent='—';details.textContent='Click two contact holes or supply jacks.';return;}
    if(tool==='voltage'){
      const value=measureBreadboardVoltage(doc,meter.red,meter.black);
      readout.textContent=value.status==='ok'?fmtV(value.voltageV):'—';
      details.textContent=value.message;
    }else{
      const value=traceBreadboardContinuity(doc,meter.red,meter.black);
      readout.textContent=value.connected?'CONNECTED':'OPEN';
      details.textContent=value.message;
    }
  }
  function render(){
    const analysis=analyzeBreadboard(doc),result=analysis.result;
    $('#bb-canvas').innerHTML=svgBoard(doc,analysis,selected,pending,tool);
    $('#bb-supply').value=String(doc.supplyV);
    $('#bb-tool').value=tool;
    $('#bb-undo').disabled=history.length===0;
    $('#bb-message').textContent=message+
      (pending?' First contact: '+pending+'. Choose the second contact.':'');
    $('#bb-example').value='';
    const labels={ok:'Connected circuit',open:'Open circuit',short:'Ideal source short',unsolved:'Circuit model unresolved'};
    $('#bb-status').textContent=labels[result.status]||result.status;
    $('#bb-status').dataset.status=result.status;
    $('#bb-current').textContent=fmtMa(result.sourceCurrentA);
    $('#bb-counts').textContent=doc.parts.length+' / '+doc.switches.length+' / '+doc.leds.length;
    $('#bb-wires-count').textContent=doc.wires.length+' / 40';
    const notices=result.notices.length?result.notices:
      ['Ideal low-voltage DC teaching model. Confirm real parts and source ratings before using physical components.'];
    $('#bb-notices').innerHTML=notices.map(t=>'<li>'+safe(t)+'</li>').join('');
    inspector(analysis);meterReadout();save();
  }
  function contactClick(id){
    if(tool==='select'){
      selected={kind:'contact',id};pending=null;
      say('Inspecting the copper net at '+id+'.');render();return;
    }
    if(['voltage','continuity'].includes(tool)){
      if(!meter.red||meter.black){meter.red=id;meter.black=null;}
      else meter.black=id;
      say('Virtual '+tool+' probes updated.');render();return;
    }
    if(!pending){pending=id;selected=null;say('First contact: '+id+'.');render();return;}
    const a=pending,b=id;pending=null;
    if(tool==='jumper')mutate(d=>addBoardJumper(d,a,b),'Connected jumper '+a+' → '+b+'.');
    else if(id==='V+'||id==='GND'||a==='V+'||a==='GND'){
      say('Components need two breadboard holes. Use jumper tool for source jacks.');render();
    }else mutate(d=>addBoardPart(d,tool,a,b),
      'Placed '+tool+' from '+a+' to '+b+'. Inspect it to edit values.');
  }
  const canvas=$('#bb-canvas');
  canvas.addEventListener('click',e=>{
    const contact=e.target.closest('[data-bb-contact]');
    if(contact){contactClick(contact.dataset.bbContact);return;}
    const component=e.target.closest('[data-bb-part]');
    if(component){
      selected={kind:'component',id:component.dataset.bbPart};pending=null;
      say('Selected '+selected.id+'.');render();return;
    }
    const wire=e.target.closest('[data-bb-wire]');
    if(wire){
      selected={kind:'wire',index:Number(wire.dataset.bbWire)};pending=null;
      say('Jumper selected.');render();
    }
  });
  canvas.addEventListener('keydown',e=>{
    if(e.key==='Escape'){pending=null;meter={red:null,black:null};selected=null;say('Selection cleared.');render();return;}
    if(e.key!=='Enter'&&e.key!==' ')return;
    const el=e.target.closest('[data-bb-contact],[data-bb-part],[data-bb-wire]');
    if(el){e.preventDefault();el.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
  });
  $('#bb-tool').addEventListener('change',e=>{
    tool=e.target.value;pending=null;meter={red:null,black:null};selected=null;
    say('Tool: '+e.target.selectedOptions[0].textContent+'.');render();
  });
  root.querySelectorAll('[data-bb-tool]').forEach(b=>b.addEventListener('click',()=>{
    $('#bb-tool').value=b.dataset.bbTool;
    $('#bb-tool').dispatchEvent(new Event('change',{bubbles:true}));
  }));
  $('#bb-example').addEventListener('change',e=>{
    const kind=e.target.value;if(!kind)return;
    if(!window.confirm('Replace this saved breadboard design with the selected starter example?')){render();return;}
    mutate(()=>createBreadboardExample(kind),'Loaded '+kind+' example.');selected=null;render();
  });
  $('#bb-supply').addEventListener('change',e=>{
    const value=Number(e.target.value);
    mutate(d=>setBoardSupply(d,value),'Updated virtual source voltage.');
  });
  $('#bb-undo').addEventListener('click',()=>{
    if(!history.length)return;
    doc=validateBreadboard(JSON.parse(history.pop()));
    pending=null;selected=null;meter={red:null,black:null};say('Undid the previous board change.');render();
  });
  $('#bb-clear').addEventListener('click',()=>{
    if(!window.confirm('Clear the entire breadboard? This only affects the breadboard, not the Wiring Lab or Workstation.'))return;
    mutate(()=>blankBreadboard(),'Cleared board. Connect source jacks to the rails to start.');
    selected=null;render();
  });
  $('#bb-reset-probes').addEventListener('click',()=>{
    meter={red:null,black:null};say('Cleared virtual probes.');render();
  });
  $('#bb-inspector').addEventListener('click',e=>{
    if(!selected)return;
    if(e.target.closest('#bb-delete')){
      const s=selected;
      mutate(d=>removeBoardItem(d,s.kind==='wire'?'wire':partKind(s.id),
        s.kind==='wire'?s.index:s.id),'Removed selected item.');
      selected=null;render();return;
    }
    if(e.target.closest('#bb-toggle')){
      const p=doc.switches.find(x=>x.id===selected.id);if(!p)return;
      mutate(d=>editBoardPart(d,p.id,{closed:!p.closed}),'Toggled switch '+p.id+'.');
    }
    if(e.target.closest('#bb-flip')){
      mutate(d=>editBoardPart(d,selected.id,{flip:true}),'Swapped the LED anode and cathode contacts.');
    }
  });
  $('#bb-inspector').addEventListener('change',e=>{
    if(!selected||selected.kind!=='component')return;
    if(e.target.id==='bb-ohms'){
      mutate(d=>editBoardPart(d,selected.id,{ohms:Number(e.target.value)}),'Resistor value updated.');
    }else if(e.target.id==='bb-led-color'){
      mutate(d=>editBoardPart(d,selected.id,{color:e.target.value}),'LED color updated.');
    }
  });
  $('#bb-export').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(doc,null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='phi-breadboard-layout.json';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    say('Exported a local breadboard layout JSON.');render();
  });
  $('#bb-import').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>50000)throw new RangeError('Breadboard JSON must be under 50 KB');
      const imported=validateBreadboard(JSON.parse(await file.text()));
      if(window.confirm('Replace the current breadboard layout with this validated imported file?')){
        mutate(()=>imported,'Imported a validated breadboard layout.');
        selected=null;render();
      }
    }catch(error){say('Import rejected: '+error.message);render();}
    e.target.value='';
  });
  $('#bb-send-to-wiring').addEventListener('click',()=>{
    try{
      const output=analyzeBreadboard(doc).circuit;
      if(!window.confirm('Replace your existing free Wiring Lab saved circuit with the breadboard electrical topology? The original breadboard will be retained.'))return;
      localStorage.setItem('phi-circuit-lab-wiring-v1',JSON.stringify(output));
      document.querySelector('header [data-view="builder"]')?.click();
    }catch(error){say('Could not transfer to the Wiring Lab: '+error.message);render();}
  });
  render();
}
