import {
  DEFAULT_SCOPE_CONFIG, validateScopeConfig, scopeTauSeconds,
  simulateScope, scopeSampleAt, scopeCursorPair, scopeCsv
} from './scope-engine.mjs';

const STORAGE_KEY='phi-circuit-lab-scope-v1';
const formatSeconds=t=>{
  if(t<.001)return (t*1e6).toFixed(3)+' µs';
  if(t<1)return (t*1000).toFixed(3)+' ms';
  return t.toFixed(3)+' s';
};
const fmtV=v=>v.toFixed(3)+' V';
const fmtMa=v=>(v*1000).toFixed(3)+' mA';
const safe=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;');

function scopeLayout(){
  return '<div class="scope-header"><span class="eyebrow">VIRTUAL HARDWARE LABORATORY • v0.9</span>'+
    '<h1>RC Signal Laboratory</h1>'+
    '<p>Study voltage and current over time with an ideal one-resistor, one-capacitor low-pass circuit. '+
    'Our virtual oscilloscope plots an actual mathematical transient, not a looping decorative animation.</p></div>'+
    '<section class="panel scope-toolbar" aria-label="Oscilloscope circuit and source controls">'+
    '<div class="scope-top-row"><label>Quick experiment<select id="scope-example" class="lab-select">'+
    '<option value="charge">RC charging step</option><option value="discharge">Initial capacitor discharge</option>'+
    '<option value="pulse">Single square pulse</option><option value="square">Periodic square wave</option>'+
    '<option value="custom">Custom saved configuration</option></select></label>'+
    '<label>Source mode<select data-scope="waveform" id="scope-waveform" class="lab-select">'+
    '<option value="step">DC step at t=0</option><option value="pulse">Pulse, then 0 V</option>'+
    '<option value="square">Periodic square, 0 to amplitude</option></select></label></div>'+
    '<div class="scope-form-grid">'+
    '<label>Source amplitude (V)<input data-scope="supplyV" type="number" min="0" max="12" step="0.5" value="5"></label>'+
    '<label>Resistor (Ω)<input data-scope="resistanceOhms" type="number" min="100" max="1000000" step="100" value="1000"></label>'+
    '<label>Capacitor (µF)<input data-scope="capacitanceMicroF" type="number" min="1" max="1000" step="1" value="100"></label>'+
    '<label>Initial capacitor V<input data-scope="initialV" type="number" min="0" max="12" step="0.5" value="0"></label>'+
    '<label>Time window (× τ)<input data-scope="windowTau" type="number" min="2" max="24" step="1" value="8"></label>'+
    '<label>Pulse width (× τ)<input data-scope="pulseWidthTau" type="number" min=".25" max="12" step=".25" value="2"></label>'+
    '<label>Square period (× τ)<input data-scope="periodTau" type="number" min="1" max="12" step=".5" value="4"></label>'+
    '<label>Duty cycle (%)<input data-scope="dutyPercent" type="number" min="10" max="90" step="5" value="50"></label>'+
    '</div><p class="micro" id="scope-control-error" role="status" aria-live="polite"></p></section>'+
    '<section class="panel scope-display-section" aria-label="Two-channel waveform oscilloscope">'+
    '<div class="scope-headerbar"><div><span class="eyebrow">SCOPE • SIMULATED DC SIGNALS</span>'+
    '<h2>Oscilloscope trace</h2></div>'+
    '<div class="scope-toggles"><label><input id="scope-show-resistor" type="checkbox" checked> Show R voltage</label>'+
    '<button id="scope-export" class="button" type="button">Export CSV</button></div></div>'+
    '<div class="scope-legend" aria-label="Signal legend"><span class="scope-source">Source V</span>'+
    '<span class="scope-capacitor">Capacitor V</span><span class="scope-resistor">Resistor V</span></div>'+
    '<div class="scope-svg-wrap"><svg id="scope-screen" viewBox="0 0 940 440" role="img" '+
    'aria-label="Source voltage, capacitor charging voltage and resistor drop over time"></svg></div>'+
    '<div class="scope-cursor-controls">'+
    '<label>Cursor A <input id="scope-cursor-a" type="range" min="0" max="1000" value="250"></label>'+
    '<label>Cursor B <input id="scope-cursor-b" type="range" min="0" max="1000" value="650"></label></div>'+
    '<div class="scope-readouts"><div><small>Time constant τ = R × C</small><strong id="scope-tau">—</strong></div>'+
    '<div><small>10–90% step rise</small><strong id="scope-rise">—</strong></div>'+
    '<div><small>Cursor A: source / capacitor</small><strong id="scope-read-a">—</strong></div>'+
    '<div><small>Cursor B: capacitor</small><strong id="scope-read-b">—</strong></div>'+
    '<div><small>Δ time (B − A)</small><strong id="scope-delta-t">—</strong></div>'+
    '<div><small>Δ capacitor V (B − A)</small><strong id="scope-delta-v">—</strong></div>'+
    '<div><small>Cursor A: R current</small><strong id="scope-current">—</strong></div>'+
    '<div><small>Cursor A: stored energy</small><strong id="scope-energy">—</strong></div></div>'+
    '<p class="micro" id="scope-notices" aria-live="polite"></p></section>'+
    '<section class="panel scope-explain"><h2>What the trace proves</h2>'+
    '<p><strong>RC differential equation:</strong> C × dV<sub>C</sub>/dt = (V<sub>in</sub> − V<sub>C</sub>)/R. '+
    'Between input transitions, the exact solution is V<sub>C</sub>(t + Δt) = V<sub>in</sub> + '+
    '(V<sub>C</sub>(t) − V<sub>in</sub>)e<sup>−Δt/RC</sup>. '+
    'The source jumps; capacitor voltage stays continuous, and the resistor current can jump.</p>'+
    '<p>At one time constant after a clean 0 → V step, the capacitor reaches about <strong>63.2%</strong> '+
    'of the way to the new source value. The textbook 10–90% step rise time is approximately 2.197τ. '+
    'The displayed rise-time number assumes an isolated step; it is not the measured rise time of a short pulse.</p>'+
    '<p class="micro">This is a specialized ideal series RC simulation, not a general capacitor component inside the '+
    'Wiring Lab, a hardware oscilloscope, an analog-to-digital converter, SPICE, or a physical safety test. '+
    'No source impedance, capacitor ESR/leakage, probe loading, frequency-dependent effects or real tolerances.</p>'+
    '</section>';
}

function svgWaveform(trace,cursors,showResistor){
  const X0=68,X1=912,Y0=30,Y1=389;
  const all=trace.samples;
  const min=Math.min(0,...all.map(p=>Math.min(p.sourceV,p.capacitorV,
    showResistor?p.resistorV:0)));
  const max=Math.max(.5,...all.map(p=>Math.max(p.sourceV,p.capacitorV,
    showResistor?p.resistorV:0)));
  const pad=Math.max(.25,(max-min)*.08);
  const ymin=min-pad,ymax=max+pad;
  const x=t=>X0+(X1-X0)*(t/trace.durationSeconds);
  const y=v=>Y1-(Y1-Y0)*(v-ymin)/(ymax-ymin);
  const line=(items,key)=>items.map((p,i)=>(i?'L':'M')+
    x(p.timeSeconds).toFixed(2)+' '+y(p[key]).toFixed(2)).join(' ');
  // Include BOTH sides of every voltage-source step, rather than allowing
  // finite screen sampling to draw an artificial diagonal ramp.
  let previous=trace.config.supplyV;
  const sourcePlot=[{timeSeconds:0,sourceV:previous}];
  const resistorEdges=[];
  for(const edge of trace.edges){
    const at=scopeSampleAt(trace.config,edge.timeSeconds);
    sourcePlot.push({timeSeconds:edge.timeSeconds,sourceV:previous});
    sourcePlot.push({timeSeconds:edge.timeSeconds,sourceV:edge.levelAfterV});
    resistorEdges.push({...at,resistorV:previous-at.capacitorV,side:-1});
    resistorEdges.push({...at,resistorV:edge.levelAfterV-at.capacitorV,side:0});
    previous=edge.levelAfterV;
  }
  sourcePlot.push({timeSeconds:trace.durationSeconds,sourceV:previous});
  const resistorPoints=all.map(p=>({...p,side:1})).concat(resistorEdges)
    .sort((a,b)=>a.timeSeconds-b.timeSeconds||a.side-b.side);
  const guides=[];
  for(let i=0;i<=8;i++){
    const xx=X0+(X1-X0)*i/8;
    guides.push('<line x1="'+xx+'" y1="'+Y0+'" x2="'+xx+'" y2="'+Y1+
      '" stroke="#2b3d54" stroke-width="1"/>');
  }
  for(let i=0;i<=6;i++){
    const v=ymin+(ymax-ymin)*i/6,yy=y(v);
    guides.push('<line x1="'+X0+'" y1="'+yy+'" x2="'+X1+'" y2="'+yy+
      '" stroke="#2b3d54" stroke-width="1"/>'+
      '<text x="'+(X0-8)+'" y="'+(yy+4)+'" text-anchor="end" fill="#b7c8dd" font-size="12">'+
      v.toFixed(2)+'</text>');
  }
  const marks=[['A',cursors.a,'#ffda85'],['B',cursors.b,'#ee9fff']].map(([label,p,color])=>
    '<line x1="'+x(p.timeSeconds)+'" y1="'+Y0+'" x2="'+x(p.timeSeconds)+
      '" y2="'+Y1+'" stroke="'+color+'" stroke-width="2" stroke-dasharray="5 6"/>'+
      '<circle cx="'+x(p.timeSeconds)+'" cy="'+y(p.capacitorV)+
      '" r="5" fill="'+color+'"/>'+
      '<text x="'+(x(p.timeSeconds)+6)+'" y="'+(Y0+20)+'" fill="'+color+
      '" font-size="15" font-weight="700">'+label+'</text>').join('');
  return '<rect x="0" y="0" width="940" height="440" fill="#091929" rx="10"/>'+
    '<text x="14" y="20" fill="#abc1d9" font-size="13">V</text>'+
    '<text x="875" y="421" fill="#abc1d9" font-size="13">time</text>'+
    guides.join('')+
    '<path data-scope-trace="source" d="'+line(sourcePlot,'sourceV')+'" fill="none" stroke="#ffcc76" stroke-width="2.2"/>'+
    '<path data-scope-trace="capacitor" d="'+line(all,'capacitorV')+'" fill="none" stroke="#55e2df" stroke-width="3"/>'+
    (showResistor?'<path data-scope-trace="resistor" d="'+line(resistorPoints,'resistorV')+
      '" fill="none" stroke="#a28cff" stroke-width="2.2"/>':'')+
    marks+
    '<text x="'+X0+'" y="422" fill="#b7c8dd" font-size="13">0</text>'+
    '<text x="'+X1+'" y="422" text-anchor="end" fill="#b7c8dd" font-size="13">'+
    safe(formatSeconds(trace.durationSeconds))+'</text>';
}

export function mountScopeLab(root,options={}){
  const {initialConfig=null,storageKey=STORAGE_KEY,
    onConfigChange=null,onScopeSnapshot=null}=options;
  root.innerHTML=scopeLayout();
  let config={...DEFAULT_SCOPE_CONFIG};
  if(initialConfig)config=validateScopeConfig(initialConfig);
  else if(storageKey!==null){
    try{
      const raw=localStorage.getItem(storageKey);
      if(raw)config=validateScopeConfig(JSON.parse(raw));
    }catch(_){/* Bad private storage must not crash the scope. */}
  }
  const fields=Object.keys(DEFAULT_SCOPE_CONFIG);
  const selectors=Object.fromEntries(fields.map(key=>[key,root.querySelector('[data-scope="'+key+'"]')]));
  function persist(){
    if(storageKey!==null){
      try{localStorage.setItem(storageKey,JSON.stringify(config));}
      catch(_){/* Some browsers block local writes. */}
    }
  }
  function writeFields(){
    for(const key of fields)selectors[key].value=String(config[key]);
  }
  function render(){
    const trace=simulateScope(config);
    const cursorA=Number(root.querySelector('#scope-cursor-a').value)/1000;
    const cursorB=Number(root.querySelector('#scope-cursor-b').value)/1000;
    const cursors=scopeCursorPair(trace,cursorA,cursorB);
    root.querySelector('#scope-screen').innerHTML=
      svgWaveform(trace,cursors,root.querySelector('#scope-show-resistor').checked);
    const set=(id,value)=>root.querySelector(id).textContent=value;
    set('#scope-tau',formatSeconds(trace.tauSeconds));
    set('#scope-rise',formatSeconds(trace.riseTime1090Seconds));
    set('#scope-read-a',fmtV(cursors.a.sourceV)+' / '+fmtV(cursors.a.capacitorV));
    set('#scope-read-b',fmtV(cursors.b.capacitorV));
    set('#scope-delta-t',formatSeconds(Math.abs(cursors.deltaTimeSeconds))+
      (cursors.deltaTimeSeconds<0?' (B before A)':''));
    set('#scope-delta-v',fmtV(cursors.deltaCapacitorV));
    set('#scope-current',fmtMa(cursors.a.currentA));
    set('#scope-energy',(cursors.a.energyJ*1000).toFixed(4)+' mJ');
    set('#scope-notices',trace.notes.join(' '));
    persist();
    if(typeof onConfigChange==='function')onConfigChange(validateScopeConfig(config));
    if(typeof onScopeSnapshot==='function'){
      onScopeSnapshot({
        waveform:config.waveform,tauSeconds:trace.tauSeconds,
        cursorATimeSeconds:cursors.a.timeSeconds,
        cursorBTimeSeconds:cursors.b.timeSeconds,
        capacitorA:cursors.a.capacitorV,capacitorB:cursors.b.capacitorV,
        sourceA:cursors.a.sourceV,currentA:cursors.a.currentA,
        deltaTimeSeconds:cursors.deltaTimeSeconds,
        deltaCapacitorV:cursors.deltaCapacitorV
      });
    }
  }
  writeFields();
  root.querySelector('#scope-example').value='custom';
  for(const el of root.querySelectorAll('[data-scope]')){
    el.addEventListener('change',()=>{
      const key=el.dataset.scope;
      const value=key==='waveform'?el.value:Number(el.value);
      try{
        config=validateScopeConfig({...config,[key]:value});
        root.querySelector('#scope-control-error').textContent='';
        root.querySelector('#scope-example').value='custom';
      }catch(error){
        root.querySelector('#scope-control-error').textContent=error.message;
        el.value=String(config[key]);
        return;
      }
      render();
    });
  }
  root.querySelector('#scope-example').addEventListener('change',e=>{
    const kind=e.target.value;
    if(kind==='custom')return;
    config={...DEFAULT_SCOPE_CONFIG};
    if(kind==='discharge'){config.supplyV=0;config.initialV=5;}
    if(kind==='pulse'){config.waveform='pulse';config.pulseWidthTau=2;}
    if(kind==='square'){config.waveform='square';config.periodTau=4;config.dutyPercent=50;}
    writeFields();root.querySelector('#scope-control-error').textContent='';
    render();
  });
  for(const id of ['#scope-cursor-a','#scope-cursor-b']){
    root.querySelector(id).addEventListener('input',render);
  }
  root.querySelector('#scope-show-resistor').addEventListener('change',render);
  root.querySelector('#scope-export').addEventListener('click',()=>{
    const data=scopeCsv(simulateScope(config));
    const blob=new Blob([data],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='phi-rc-scope.csv';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  render();
}
