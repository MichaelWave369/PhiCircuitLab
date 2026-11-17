/**
 * Zero-npm-dependency Chromium smoke test for the PhiCircuitLab classroom.
 * Starts a local web server, uses Chrome DevTools Protocol, then closes it.
 * Chrome/Chromium must be available on PATH; no external services are used.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
const candidates=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
let chromeBin=null;
for(const bin of candidates){
  if(spawnSync('which',[bin],{stdio:'ignore'}).status===0){chromeBin=bin;break;}
}
if(!chromeBin)throw new Error('Chromium or Google Chrome is required to run the browser smoke test');

const server=createServer(async(req,res)=>{
  try{
    const requested=new URL(req.url,'http://127.0.0.1').pathname;
    const filename=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
    if(filename!==root&&!filename.startsWith(root+path.sep)){
      res.writeHead(403);res.end('Forbidden');return;
    }
    const body=await readFile(filename);
    res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream'});
    res.end(body);
  }catch(_){res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/';
const profile=await mkdtemp(path.join(os.tmpdir(),'phi-wiring-smoke-'));
// Chrome's pipe transport avoids flaky TCP debugging-port discovery on
// shared GitHub Actions runners, and keeps the browser debug endpoint private.
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--no-first-run','--no-default-browser-check',
  '--disable-background-networking','--disable-extensions',
  '--user-data-dir='+profile,'--remote-debugging-pipe',url],
  {stdio:['ignore','ignore','ignore','pipe','pipe']});

try {
  let serial=0,buffer='';
  const pending=new Map(),exceptions=[];
  const protocolOut=chrome.stdio[3];
  const protocolIn=chrome.stdio[4];
  protocolIn.on('data',chunk=>{
    buffer+=chunk.toString('utf8');
    let index;
    while((index=buffer.indexOf('\0'))!==-1){
      const item=buffer.slice(0,index);buffer=buffer.slice(index+1);
      if(!item.trim())continue;
      let packet;
      try{packet=JSON.parse(item);}catch(_){continue;}
      if(packet.method==='Runtime.exceptionThrown'){
        exceptions.push(packet.params?.exceptionDetails?.exception?.description||JSON.stringify(packet.params?.exceptionDetails)||'Browser JavaScript exception');
      }
      if(!packet.id)continue;
      const callback=pending.get(packet.id);
      if(!callback)continue;
      pending.delete(packet.id);
      clearTimeout(callback.timer);
      if(packet.error)callback.reject(new Error(packet.error.message));
      else callback.resolve(packet.result);
    }
  });
  const cdp=(method,params={},sessionId=null)=>new Promise((resolve,reject)=>{
    const id=++serial;
    const timer=setTimeout(()=>{
      pending.delete(id);reject(new Error('CDP timed out: '+method));
    },8000);
    pending.set(id,{resolve,reject,timer});
    const command={id,method,params};
    if(sessionId)command.sessionId=sessionId;
    protocolOut.write(JSON.stringify(command)+'\0');
  });
  let target;
  // Shared runners sometimes take longer than 8 seconds to start Chrome.
  // Retry the protocol handshake instead of failing on the first request.
  let startupError=null;
  const startupDeadline=Date.now()+45000;
  while(Date.now()<startupDeadline){
    if(chrome.exitCode!==null)throw new Error('Chromium exited during startup');
    try{
      const tabs=await cdp('Target.getTargets');
      target=tabs.targetInfos?.find(t=>t.type==='page');
      if(target)break;
    }catch(err){startupError=err;}
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  if(!target)throw new Error('Chromium did not create a page target: '+(startupError?.message||'startup timed out'));
  const attached=await cdp('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  const sessionId=attached.sessionId;
  await cdp('Runtime.enable',{},sessionId);
  async function evaluate(expression){
    const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);
    if(response.exceptionDetails)throw new Error('Browser exception: '+(response.exceptionDetails.exception?.description||response.exceptionDetails.text)+'\nIn expression: '+expression.slice(0,1400));
    return response.result.value;
  }
  const initial=await evaluate("(async()=>{for(let n=0;n<60&&!document.querySelector('#app-content h1');n++)await new Promise(r=>setTimeout(r,50));return {title:document.querySelector('#app-content h1')?.textContent,hasBuilder:!!document.querySelector('[data-view=builder]')}})()");
  assert.match(initial.title||'',/Build the knowledge/);
  assert.equal(initial.hasBuilder,true);
  console.log('PASS: classroom loads and exposes the Wiring Lab');
  const opened=await evaluate("(()=>{document.querySelector('[data-view=builder]').click();return {title:document.querySelector('#app-content h1')?.textContent,status:document.querySelector('#wiring-state')?.textContent}})()");
  assert.match(opened.title||'',/Wiring Sandbox/);
  assert.equal(opened.status,'Connected circuit');
  console.log('PASS: Wiring Lab opens and solves the series preset');
  const series=await evaluate("({current:document.querySelector('#wiring-current').textContent,eq:document.querySelector('#wiring-equivalent').textContent})");
  assert.equal(series.current,'4.500 mA');
  assert.equal(series.eq,'2000.00 Ω');
  const open=await evaluate("(()=>{const s=document.querySelector('#wiring-preset');s.value='open';s.dispatchEvent(new Event('change',{bubbles:true}));return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent}})()");
  assert.equal(open.status,'Open circuit');
  assert.equal(open.current,'0.000 mA');
  console.log('PASS: blank circuit reports open topology');
  for(const terminal of ['V+','R1:a','R1:b','R2:a','R2:b','GND']){
    const success=await evaluate("(()=>{const t=document.querySelector('[data-terminal="+JSON.stringify(terminal)+"]');if(!t)return false;t.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true;})()");
    assert.equal(success,true,'Missing SVG terminal: '+terminal);
  }
  const connected=await evaluate("({status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent,eq:document.querySelector('#wiring-equivalent').textContent})");
  assert.equal(connected.status,'Connected circuit');
  assert.equal(connected.current,'4.500 mA');
  assert.equal(connected.eq,'2000.00 Ω');
  console.log('PASS: user-drawn wires form a computed series network');
  const deleted=await evaluate("(()=>{document.querySelector('[data-wire-index=\"0\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-delete').click();return document.querySelector('#wiring-state').textContent})()");
  assert.equal(deleted,'Open circuit');
  console.log('PASS: deleting a wire breaks the live circuit');
  const undo=await evaluate("(()=>{document.querySelector('#wiring-undo').click();return document.querySelector('#wiring-state').textContent})()");
  assert.equal(undo,'Connected circuit');
  console.log('PASS: undo restores the circuit');
  const short=await evaluate("(()=>{const s=document.querySelector('#wiring-preset');s.value='open';s.dispatchEvent(new Event('change',{bubbles:true}));for(const t of ['V+','GND'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent}})()");
  assert.equal(short.status,'Ideal source short detected');
  assert.equal(short.current,'—');
  console.log('PASS: ideal short is diagnosed without inventing a current');
  // A switch should interrupt and restore a real user-built circuit.
  const switchOpen=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='switch';let exception=null;try{p.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){exception=e.message;}return {status:document.querySelector('#wiring-state').textContent,visible:!!document.querySelector('[data-part-id=S1]'),preset:p.value,optionCount:p.options.length,exception}})()");
  console.log('Switch preset transition:',JSON.stringify(switchOpen),'browser exceptions:',JSON.stringify(exceptions));
  assert.equal(switchOpen.status,'Open circuit');
  assert.equal(switchOpen.visible,true);
  const switchClosed=await evaluate("(()=>{document.querySelector('[data-part-id=S1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const toggle=document.querySelector('#wiring-toggle-switch');if(!toggle)return {error:'No switch toggle'};toggle.click();return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent,openText:document.querySelector('#wiring-toggle-switch')?.textContent}})()");
  assert.equal(switchClosed.status,'Connected circuit');
  assert.equal(switchClosed.current,'9.000 mA');
  assert.ok(!switchClosed.error);
  const toggledOff=await evaluate("(()=>{document.querySelector('#wiring-toggle-switch').click();return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent}})()");
  assert.equal(toggledOff.status,'Open circuit');
  assert.equal(toggledOff.current,'0.000 mA');
  console.log('PASS: switch toggling opens and closes the circuit in the browser');
  const switchUndo=await evaluate("(()=>{document.querySelector('#wiring-undo').click();return document.querySelector('#wiring-state').textContent})()");
  assert.equal(switchUndo,'Connected circuit');
  console.log('PASS: undo restores the previous switch position');
  const switchAdded=await evaluate("(()=>{document.querySelector('#wiring-add-switch').click();return !!document.querySelector('[data-part-id=S2]')})()");
  assert.equal(switchAdded,true);
  console.log('PASS: palette creates a second switch');
  const ledOn=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='led';p.dispatchEvent(new Event('change',{bubbles:true}));return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent,led:!!document.querySelector('[data-part-id=D1]'),row:document.querySelector('#wiring-readings-body').textContent}})()");
  assert.equal(ledOn.status,'Connected circuit');
  assert.equal(ledOn.current,'8.571 mA');
  assert.equal(ledOn.led,true);
  assert.match(ledOn.row, /D1/);
  assert.match(ledOn.row, /on/);
  console.log('PASS: forward LED with limiting resistor lights from calculated current');
  const green=await evaluate("(()=>{document.querySelector('[data-part-id=D1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const select=document.querySelector('#wiring-led-color');if(!select)return {error:'LED inspector not available'};select.value='green';select.dispatchEvent(new Event('change',{bubbles:true}));return {current:document.querySelector('#wiring-current').textContent,selected:document.querySelector('#wiring-led-color')?.value}})()");
  assert.ok(!green.error);
  assert.equal(green.selected,'green');
  assert.equal(green.current,'8.000 mA');
  console.log('PASS: LED color inspector changes model current');
  const reversed=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='reverse-led';p.dispatchEvent(new Event('change',{bubbles:true}));return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent,rows:document.querySelector('#wiring-readings-body').textContent,notes:document.querySelector('#wiring-notices').textContent}})()");
  assert.equal(reversed.status,'Open circuit');
  assert.equal(reversed.current,'0.000 mA');
  assert.match(reversed.rows,/reverse/);
  assert.match(reversed.notes,/Reverse-biased/);
  console.log('PASS: reverse LED polarity blocks current and warns');
  const unlimited=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='led-unlimited';p.dispatchEvent(new Event('change',{bubbles:true}));return {current:document.querySelector('#wiring-current').textContent,notes:document.querySelector('#wiring-notices').textContent}})()");
  assert.equal(unlimited.current,'150.000 mA');
  assert.match(unlimited.notes,/No resistor limits/);
  console.log('PASS: no-resistor LED topology raises explicit current-limiting warning');
  const addedLed=await evaluate("(()=>{document.querySelector('#wiring-add-led').click();return {added:!!document.querySelector('[data-part-id=D2]'),stored:JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1')).leds.length}})()");
  assert.equal(addedLed.added,true);
  assert.equal(addedLed.stored,2);
  console.log('PASS: component palette and local persistence include LEDs');
  // v0.6 virtual instrumentation must use the same electrical readings as
  // the circuit solver, without changing or adding a wire.
  const meterSupply=await evaluate("(()=>{const preset=document.querySelector('#wiring-preset');preset.value='series';preset.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#meter-source').click();return {mode:document.querySelector('#meter-mode').value,reading:document.querySelector('#meter-readout').textContent,wireCount:JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1')).wires.length}})()");
  assert.equal(meterSupply.mode,'voltage');
  assert.equal(meterSupply.reading,'9.000 V');
  assert.equal(meterSupply.wireCount,3);
  console.log('PASS: voltage meter reads source without adding a wire');
  const meterDrop=await evaluate("(()=>{const mode=document.querySelector('#meter-mode');mode.value='voltage';mode.dispatchEvent(new Event('change',{bubbles:true}));for(const t of ['R1:a','R1:b'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return {reading:document.querySelector('#meter-readout').textContent,labels:document.querySelector('#meter-probes').textContent}})()");
  assert.equal(meterDrop.reading,'4.500 V');
  assert.match(meterDrop.labels,/R1:a/);
  console.log('PASS: red/black terminal probes measure a resistor drop');
  const meterNegative=await evaluate("(()=>{for(const t of ['R1:b','R1:a'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return document.querySelector('#meter-readout').textContent})()");
  assert.equal(meterNegative,'-4.500 V');
  console.log('PASS: swapping voltage probe polarity changes sign');
  const meterContinuity=await evaluate("(()=>{const mode=document.querySelector('#meter-mode');mode.value='continuity';mode.dispatchEvent(new Event('change',{bubbles:true}));for(const t of ['V+','R1:a'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const connected=document.querySelector('#meter-readout').textContent;for(const t of ['R1:a','R1:b'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return {connected,blocked:document.querySelector('#meter-readout').textContent,details:document.querySelector('#meter-details').textContent}})()");
  assert.equal(meterContinuity.connected,'CONNECTED');
  assert.equal(meterContinuity.blocked,'OPEN');
  assert.match(meterContinuity.details,/not treated as a wire/i);
  console.log('PASS: continuity follows direct wires, not resistors');
  const meterCurrent=await evaluate("(()=>{const mode=document.querySelector('#meter-mode');mode.value='current';mode.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-part-id=R1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return {reading:document.querySelector('#meter-readout').textContent,part:document.querySelector('#meter-probes').textContent}})()");
  assert.equal(meterCurrent.reading,'4.500 mA');
  assert.equal(meterCurrent.part,'Part R1');
  console.log('PASS: current tool inspects signed resistor branch current');
  const meterOpenSwitch=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='switch';p.dispatchEvent(new Event('change',{bubbles:true}));const mode=document.querySelector('#meter-mode');mode.value='voltage';mode.dispatchEvent(new Event('change',{bubbles:true}));for(const t of ['S1:a','S1:b'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const before=document.querySelector('#meter-readout').textContent;document.querySelector('[data-part-id=S1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-toggle-switch').click();return {before,after:document.querySelector('#meter-readout').textContent}})()");
  assert.equal(meterOpenSwitch.before,'9.000 V');
  assert.equal(meterOpenSwitch.after,'0.000 V');
  console.log('PASS: voltage across an open switch falls when closed');
  const meterFloating=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='open';p.dispatchEvent(new Event('change',{bubbles:true}));const mode=document.querySelector('#meter-mode');mode.value='voltage';mode.dispatchEvent(new Event('change',{bubbles:true}));for(const t of ['R1:a','GND'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return {reading:document.querySelector('#meter-readout').textContent,details:document.querySelector('#meter-details').textContent}})()");
  assert.equal(meterFloating.reading,'—');
  assert.match(meterFloating.details,/floating/i);
  console.log('PASS: electrically floating probes show unavailable, not invented zero');
  const meterLed=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='led';p.dispatchEvent(new Event('change',{bubbles:true}));const mode=document.querySelector('#meter-mode');mode.value='voltage';mode.dispatchEvent(new Event('change',{bubbles:true}));for(const t of ['D1:a','D1:b'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const voltage=document.querySelector('#meter-readout').textContent;mode.value='current';mode.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-part-id=D1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return {voltage,current:document.querySelector('#meter-readout').textContent}})()");
  assert.equal(meterLed.voltage,'2.171 V');
  assert.equal(meterLed.current,'8.571 mA');
  console.log('PASS: diode-aware solver drives voltage and current measurements');
  // The Academy intentionally runs on a separate localStorage key.
  const academyLoaded=await evaluate("(()=>{const free=localStorage.getItem('phi-circuit-lab-wiring-v1');document.querySelector('[data-view=academy]').click();return {freeBefore:free,freeAfter:localStorage.getItem('phi-circuit-lab-wiring-v1'),title:document.querySelector('#app-content h1')?.textContent,missions:document.querySelectorAll('[data-academy-index]').length,score:document.querySelector('#academy-score')?.textContent}})()");
  assert.equal(academyLoaded.title,'Circuit Challenge Academy');
  assert.equal(academyLoaded.missions,9);
  assert.equal(academyLoaded.score,'0 / 900');
  assert.equal(academyLoaded.freeAfter,academyLoaded.freeBefore);
  console.log('PASS: Academy launches nine missions without overwriting free-build circuit');
  const solveAcademy=async(index,diagnosis,jsRepair)=>{
    const response=await evaluate("(()=>{const slot=document.querySelector('[data-academy-index=\""+index+"\"]');slot.click();const option=document.querySelector('#academy-prediction');option.value="+JSON.stringify(diagnosis)+";option.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#academy-lock').click();"+jsRepair+";document.querySelector('#academy-check').click();return {score:document.querySelector('#academy-score').textContent,cleared:document.querySelector('#academy-cleared').textContent,feedback:document.querySelector('#academy-feedback').textContent}})()");
    assert.match(response.feedback,/MISSION CLEARED/,JSON.stringify(response));
    assert.equal(response.cleared,(index+1)+' / 9',JSON.stringify(response));
    assert.equal(response.score,((index+1)*100)+' / 900',JSON.stringify(response));
    console.log('PASS: Academy mission '+(index+1)+' diagnosed and physically repaired in the wiring sandbox');
  };
  const tapTerminal=(a,b)=>"for(const t of ["+JSON.stringify(a)+","+JSON.stringify(b)+"])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))";
  await solveAcademy(0,'open',tapTerminal('V+','R1:a'));
  await solveAcademy(1,'open',tapTerminal('R1:b','R2:a'));
  await solveAcademy(2,'partial',tapTerminal('R2:b','GND'));
  await solveAcademy(3,'switch',"document.querySelector('[data-part-id=S1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-toggle-switch').click()");
  await solveAcademy(4,'reverse',"document.querySelector('[data-part-id=D1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-flip-led').click()");
  await solveAcademy(5,'overcurrent',"document.querySelector('[data-part-id=R1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const field=document.querySelector('#wiring-resistance');field.value='330';field.dispatchEvent(new Event('change',{bubbles:true}))");
  await solveAcademy(6,'threshold',"const range=document.querySelector('#wiring-supply');range.value='5';range.dispatchEvent(new Event('input',{bubbles:true}))");
  await solveAcademy(7,'short',"document.querySelector('[data-wire-index=\"3\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-delete').click()");
  await solveAcademy(8,'double',"document.querySelector('[data-part-id=S1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-toggle-switch').click();"+tapTerminal('R1:b','GND'));
  const academyPersist=await evaluate("(()=>{const before=JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1')).missions;const free=JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1'));document.querySelector('[data-view=builder]').click();const afterFree=JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1'));document.querySelector('[data-view=academy]').click();return {before,after:JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1')).missions,score:document.querySelector('#academy-score')?.textContent,freeBefore:free,freeAfter:afterFree}})()");
  assert.equal(academyPersist.score,'900 / 900');
  assert.deepEqual(academyPersist.freeBefore,academyPersist.freeAfter);
  assert.deepEqual(academyPersist.before,academyPersist.after);
  console.log('PASS: all nine scores survive route changes, free-build save stays isolated');
  const seedReset=await evaluate("(()=>{window.confirm=()=>true;const input=document.querySelector('#academy-seed-input');input.value='369';document.querySelector('#academy-seed-load').click();return {seed:document.querySelector('#academy-seed').textContent,score:document.querySelector('#academy-score').textContent,free:localStorage.getItem('phi-circuit-lab-wiring-v1')}})()");
  assert.equal(seedReset.seed,'369');
  assert.equal(seedReset.score,'0 / 900');
  assert.deepEqual(JSON.parse(seedReset.free),JSON.parse(academyLoaded.freeBefore));
  console.log('PASS: replaying a deterministic seed resets only the Academy run');
  // v0.8: Faults stay hidden until the learner collects unique
  // observations and commits a diagnosis. Play all eight work orders.
  const mysteryStart=await evaluate("(()=>{const free=JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1'));const academy=JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1'));document.querySelector('[data-view=mystery]').click();return {title:document.querySelector('#app-content h1')?.textContent,cases:document.querySelectorAll('[data-mystery-index]').length,score:document.querySelector('#mystery-score')?.textContent,hidden:document.querySelector('#mystery-repair').children.length===0,free,academy}})()");
  assert.equal(mysteryStart.title,'Mystery Circuit Diagnostics');
  assert.equal(mysteryStart.cases,8);
  assert.equal(mysteryStart.score,'0 / 800');
  assert.equal(mysteryStart.hidden,true);
  console.log('PASS: sealed mystery cases open with no visible schematic or exposed repair');
  const mysteryChoices=['open','partial','switch','reverse','overcurrent','threshold','short','double'];
  const mysteryRepairs=[
    "for(const t of ['V+','R1:a'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
    "for(const t of ['R2:b','GND'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))",
    "document.querySelector('[data-part-id=S1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-toggle-switch').click()",
    "document.querySelector('[data-part-id=D1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-flip-led').click()",
    "document.querySelector('[data-part-id=R1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const field=document.querySelector('#wiring-resistance');field.value='330';field.dispatchEvent(new Event('change',{bubbles:true}))",
    "const range=document.querySelector('#wiring-supply');range.value='5';range.dispatchEvent(new Event('input',{bubbles:true}))",
    "document.querySelector('[data-wire-index=\"3\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-delete').click()",
    "document.querySelector('[data-part-id=S1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-toggle-switch').click();for(const t of ['R1:b','GND'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))"
  ];
  for(let i=0;i<8;i++){
    const r=await evaluate("(()=>{const slot=document.querySelector('[data-mystery-index=\""+i+"\"]');slot.click();const before=document.querySelector('#mystery-repair').children.length===0;const mode=document.querySelector('#mystery-mode');const measure=document.querySelector('#mystery-measure');const red=document.querySelector('#mystery-red');const black=document.querySelector('#mystery-black');mode.value='voltage';mode.dispatchEvent(new Event('change',{bubbles:true}));red.value='V+';black.value='GND';measure.click();mode.value='current';mode.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#mystery-part').value='R1';measure.click();mode.value='continuity';mode.dispatchEvent(new Event('change',{bubbles:true}));red.value='R1:a';black.value='R1:b';measure.click();const notebook=document.querySelectorAll('#mystery-notebook li').length;const choice=document.querySelector('#mystery-choice');choice.value="+JSON.stringify(mysteryChoices[i])+";choice.dispatchEvent(new Event('change',{bubbles:true}));const lockedBefore=document.querySelector('#mystery-lock').disabled;document.querySelector('#mystery-lock').click();const revealed=!!document.querySelector('#mystery-repair #wiring-canvas');"+mysteryRepairs[i]+";document.querySelector('#mystery-check').click();return {before,notebook,lockedBefore,revealed,feedback:document.querySelector('#mystery-feedback').textContent,score:document.querySelector('#mystery-score').textContent,cleared:document.querySelector('#mystery-cleared').textContent}})()");
    assert.equal(r.before,true,'Case '+i+' leaked a schematic');
    assert.equal(r.notebook,3,'Case '+i+' did not collect 3 measurements');
    assert.equal(r.lockedBefore,false,'Case '+i+' cannot submit diagnosis');
    assert.equal(r.revealed,true,'Case '+i+' not revealed after diagnosis');
    assert.match(r.feedback,/CASE CLEARED/,'Case '+i+' failed: '+JSON.stringify(r));
    assert.equal(r.score,(i+1)*100+' / 800','Case '+i+' score: '+JSON.stringify(r));
    assert.equal(r.cleared,(i+1)+' / 8','Case '+i+' cleared: '+JSON.stringify(r));
    console.log('PASS: mystery case '+(i+1)+' measured, diagnosed and repaired through real controls');
  }
  const mysteryPersistence=await evaluate("(()=>{const saved=JSON.parse(localStorage.getItem('phi-circuit-lab-mystery-v1'));document.querySelector('[data-view=builder]').click();const free=JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1'));document.querySelector('[data-view=academy]').click();const academy=JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1'));document.querySelector('[data-view=mystery]').click();return {score:document.querySelector('#mystery-score').textContent,runBefore:saved,runAfter:JSON.parse(localStorage.getItem('phi-circuit-lab-mystery-v1')),free,academy}})()");
  assert.equal(mysteryPersistence.score,'800 / 800');
  assert.deepEqual(mysteryPersistence.free,mysteryStart.free);
  assert.deepEqual(mysteryPersistence.academy,mysteryStart.academy);
  assert.deepEqual(mysteryPersistence.runAfter,mysteryPersistence.runBefore);
  console.log('PASS: mystery scores survive navigation and are isolated from both existing workspaces');
  const mysterySeed=await evaluate("(()=>{window.confirm=()=>true;const seed=document.querySelector('#mystery-seed-input');seed.value='369';document.querySelector('#mystery-seed-load').click();return {seed:document.querySelector('#mystery-seed').textContent,score:document.querySelector('#mystery-score').textContent,hidden:document.querySelector('#mystery-repair').children.length===0}})()");
  assert.deepEqual(mysterySeed,{seed:'369',score:'0 / 800',hidden:true});
  console.log('PASS: mystery seed replay starts fresh and keeps all circuits sealed');
  // v0.9: scope traces are generated from the actual time-dependent RC
  // equations. Exercise controls, numerical cursor readings and persistence.
  const scopeStart=await evaluate("(()=>{const free=localStorage.getItem('phi-circuit-lab-wiring-v1');const academy=localStorage.getItem('phi-circuit-lab-academy-v1');const mystery=localStorage.getItem('phi-circuit-lab-mystery-v1');document.querySelector('[data-view=scope]').click();return {title:document.querySelector('#app-content h1')?.textContent,tau:document.querySelector('#scope-tau').textContent,source:!!document.querySelector('[data-scope-trace=source]'),cap:!!document.querySelector('[data-scope-trace=capacitor]'),r:!!document.querySelector('[data-scope-trace=resistor]'),free,academy,mystery}})()");
  assert.equal(scopeStart.title,'RC Signal Laboratory');
  assert.equal(scopeStart.tau,'100.000 ms');
  assert.equal(scopeStart.source,true);
  assert.equal(scopeStart.cap,true);
  assert.equal(scopeStart.r,true);
  console.log('PASS: oscilloscope route plots three simulated signals and correct time constant');
  const scopeOneTau=await evaluate("(()=>{const a=document.querySelector('#scope-cursor-a');a.value='125';a.dispatchEvent(new Event('input',{bubbles:true}));return {reading:document.querySelector('#scope-read-a').textContent,current:document.querySelector('#scope-current').textContent,tau:document.querySelector('#scope-tau').textContent}})()");
  assert.equal(scopeOneTau.reading,'5.000 V / 3.161 V');
  assert.equal(scopeOneTau.current,'1.839 mA');
  console.log('PASS: browser cursor at one RC tau measures analytic 63.2% charging');
  const scopePulse=await evaluate("(()=>{const select=document.querySelector('#scope-example');select.value='pulse';select.dispatchEvent(new Event('change',{bubbles:true}));return {waveform:document.querySelector('#scope-waveform').value,edge:document.querySelector('[data-scope-trace=source]').getAttribute('d').includes('L'),tau:document.querySelector('#scope-tau').textContent}})()");
  assert.equal(scopePulse.waveform,'pulse');
  assert.equal(scopePulse.edge,true);
  console.log('PASS: pulse preset generates exact input transition and plotted trace');
  const scopeDischarge=await evaluate("(()=>{const select=document.querySelector('#scope-example');select.value='discharge';select.dispatchEvent(new Event('change',{bubbles:true}));const a=document.querySelector('#scope-cursor-a');a.value='0';a.dispatchEvent(new Event('input',{bubbles:true}));return {initial:document.querySelector('#scope-read-a').textContent,current:document.querySelector('#scope-current').textContent}})()");
  assert.equal(scopeDischarge.initial,'0.000 V / 5.000 V');
  assert.equal(scopeDischarge.current,'-5.000 mA');
  console.log('PASS: real discharge model produces negative resistor current');
  const scopeSquare=await evaluate("(()=>{const select=document.querySelector('#scope-example');select.value='square';select.dispatchEvent(new Event('change',{bubbles:true}));const duty=document.querySelector('[data-scope=dutyPercent]');duty.value='25';duty.dispatchEvent(new Event('change',{bubbles:true}));const resist=document.querySelector('[data-scope=resistanceOhms]');resist.value='2000';resist.dispatchEvent(new Event('change',{bubbles:true}));return {waveform:document.querySelector('#scope-waveform').value,duty:document.querySelector('[data-scope=dutyPercent]').value,tau:document.querySelector('#scope-tau').textContent,sourcePath:document.querySelector('[data-scope-trace=source]').getAttribute('d').length,stored:JSON.parse(localStorage.getItem('phi-circuit-lab-scope-v1'))}})()");
  assert.equal(scopeSquare.waveform,'square');
  assert.equal(scopeSquare.duty,'25');
  assert.equal(scopeSquare.tau,'200.000 ms');
  assert.ok(scopeSquare.sourcePath>100);
  assert.equal(scopeSquare.stored.resistanceOhms,2000);
  console.log('PASS: square duty and resistor changes update physics and local scope settings');
  const scopeToggles=await evaluate("(()=>{const checkbox=document.querySelector('#scope-show-resistor');checkbox.checked=false;checkbox.dispatchEvent(new Event('change',{bubbles:true}));const hidden=!document.querySelector('[data-scope-trace=resistor]');checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));return {hidden,visible:!!document.querySelector('[data-scope-trace=resistor]')}})()");
  assert.deepEqual(scopeToggles,{hidden:true,visible:true});
  const scopeReject=await evaluate("(()=>{const field=document.querySelector('[data-scope=resistanceOhms]');field.value='-10';field.dispatchEvent(new Event('change',{bubbles:true}));return {field:field.value,error:document.querySelector('#scope-control-error').textContent,tau:document.querySelector('#scope-tau').textContent}})()");
  assert.equal(scopeReject.field,'2000');
  assert.match(scopeReject.error,/Resistance/);
  assert.equal(scopeReject.tau,'200.000 ms');
  console.log('PASS: scope rejects invalid inputs and preserves the last good model');
  const scopeIsolation=await evaluate("(()=>{const before=JSON.parse(localStorage.getItem('phi-circuit-lab-scope-v1'));document.querySelector('[data-view=home]').click();document.querySelector('[data-view=scope]').click();return {before,after:JSON.parse(localStorage.getItem('phi-circuit-lab-scope-v1')),tau:document.querySelector('#scope-tau').textContent,free:localStorage.getItem('phi-circuit-lab-wiring-v1'),academy:localStorage.getItem('phi-circuit-lab-academy-v1'),mystery:localStorage.getItem('phi-circuit-lab-mystery-v1')}})()");
  assert.deepEqual(scopeIsolation.before,scopeIsolation.after);
  assert.equal(scopeIsolation.tau,'200.000 ms');
  assert.deepEqual(JSON.parse(scopeIsolation.free),JSON.parse(scopeStart.free));
  assert.deepEqual(JSON.parse(scopeIsolation.academy),JSON.parse(scopeStart.academy));
  assert.deepEqual(JSON.parse(scopeIsolation.mystery),JSON.parse(scopeStart.mystery));
  console.log('PASS: scope settings persist and cannot overwrite free circuits or game progress');
  // v1.0 Workstation: a named project owns independent DC circuit, RC
  // signal configuration and notebook snapshots. Other releases stay intact.
  const wsStart=await evaluate("(()=>{const prior={free:JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1')),academy:JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1')),mystery:JSON.parse(localStorage.getItem('phi-circuit-lab-mystery-v1')),scope:JSON.parse(localStorage.getItem('phi-circuit-lab-scope-v1'))};document.querySelector('[data-view=workstation]').click();return {title:document.querySelector('#app-content h1')?.textContent,project:document.querySelector('#ws-project-select')?.value,tabs:document.querySelectorAll('[data-ws-tab]').length,prior}})()");
  assert.equal(wsStart.title,'Virtual Electronics Workstation');
  assert.equal(wsStart.project,'p1');
  assert.ok(wsStart.tabs>=4);
  console.log('PASS: v1.0 project dashboard opens with a separate local project');
  const wsMeter=await evaluate("(()=>{document.querySelector('.ws-tab[data-ws-tab=circuit]').click();document.querySelector('#meter-source').click();const readout=document.querySelector('#meter-readout').textContent;const enabled=!document.querySelector('#ws-capture-meter').disabled;document.querySelector('#ws-capture-meter').click();document.querySelector('.ws-tab[data-ws-tab=notes]').click();return {readout,enabled,count:document.querySelectorAll('#ws-notes-list li').length,note:document.querySelector('#ws-notes-list').textContent}})()");
  assert.equal(wsMeter.readout,'9.000 V');
  assert.equal(wsMeter.enabled,true);
  assert.equal(wsMeter.count,1);
  assert.match(wsMeter.note,/9\.000 V/);
  console.log('PASS: real DC meter measurements capture into a private project notebook');
  const wsNew=await evaluate("(()=>{document.querySelector('#ws-project-name').value='Circuit project B';document.querySelector('#ws-new').click();return {project:document.querySelector('#ws-project-select').value,total:document.querySelectorAll('#ws-project-select option').length,name:document.querySelector('#ws-project-name').value,notes:JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1')).projects.map(p=>p.notes.length)}})()");
  assert.deepEqual(wsNew,{project:'p2',total:2,name:'Circuit project B',notes:[1,0]});
  const wsChangeCircuit=await evaluate("(()=>{document.querySelector('.ws-tab[data-ws-tab=circuit]').click();const p=document.querySelector('#wiring-preset');p.value='led';p.dispatchEvent(new Event('change',{bubbles:true}));const state=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));return {status:document.querySelector('#wiring-state').textContent,leds:state.projects[1].circuit.leds.length,original:state.projects[0].circuit.leds.length}})()");
  assert.equal(wsChangeCircuit.status,'Connected circuit');
  assert.equal(wsChangeCircuit.leds,1);
  assert.equal(wsChangeCircuit.original,0);
  console.log('PASS: circuit changes save only to the active named project');
  const wsScope=await evaluate("(()=>{document.querySelector('.ws-tab[data-ws-tab=scope]').click();const mode=document.querySelector('#scope-waveform');mode.value='square';mode.dispatchEvent(new Event('change',{bubbles:true}));const ohms=document.querySelector('[data-scope=resistanceOhms]');ohms.value='2000';ohms.dispatchEvent(new Event('change',{bubbles:true}));const tau=document.querySelector('#scope-tau').textContent;document.querySelector('#ws-capture-scope').click();const state=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));return {tau,scope:state.projects[1].scope,original:state.projects[0].scope,notes:state.projects[1].notes}})()");
  assert.equal(wsScope.tau,'200.000 ms');
  assert.equal(wsScope.scope.waveform,'square');
  assert.equal(wsScope.scope.resistanceOhms,2000);
  assert.equal(wsScope.original.waveform,'step');
  assert.equal(wsScope.notes.length,1);
  assert.equal(wsScope.notes[0].source,'scope');
  assert.match(wsScope.notes[0].text,/200\.00 ms/);
  console.log('PASS: integrated scope saves independent signal settings and cursor evidence');
  const wsManual=await evaluate("(()=>{document.querySelector('.ws-tab[data-ws-tab=notes]').click();document.querySelector('#ws-manual-note').value='Checked resistor values before the test.';document.querySelector('#ws-add-note').click();const state=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));return {count:state.projects[1].notes.length,text:document.querySelector('#ws-notes-list').textContent}})()");
  assert.equal(wsManual.count,2);
  assert.match(wsManual.text,/Checked resistor values/);
  const wsSwitch=await evaluate("(()=>{const select=document.querySelector('#ws-project-select');select.value='p1';select.dispatchEvent(new Event('change',{bubbles:true}));const state=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));return {selected:select.value,p1notes:state.projects[0].notes.length,p2notes:state.projects[1].notes.length,active:state.activeId}})()");
  assert.equal(wsSwitch.selected,'p1');
  assert.equal(wsSwitch.active,'p1');
  assert.equal(wsSwitch.p1notes,1);
  assert.equal(wsSwitch.p2notes,2);
  const wsDup=await evaluate("(()=>{document.querySelector('#ws-duplicate').click();const state=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));return {active:state.activeId,count:state.projects.length,name:state.projects[2].name,notes:state.projects[2].notes.length}})()");
  assert.deepEqual(wsDup,{active:'p3',count:3,name:'My Electronics Bench copy',notes:1});
  const wsRenameDelete=await evaluate("(()=>{document.querySelector('#ws-project-name').value='Temporary backup';document.querySelector('#ws-rename').click();const before=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));window.confirm=()=>true;document.querySelector('#ws-delete').click();const after=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));return {renamed:before.projects[2].name,active:after.activeId,count:after.projects.length}})()");
  assert.deepEqual(wsRenameDelete,{renamed:'Temporary backup',active:'p1',count:2});
  console.log('PASS: project switching, cloning, renaming and deleting preserve other projects');
  const wsInvalid=await evaluate("(()=>{const before=document.querySelectorAll('#ws-project-select option').length;document.querySelector('#ws-project-name').value='   ';document.querySelector('#ws-new').click();return {message:document.querySelector('#ws-status').textContent,after:document.querySelectorAll('#ws-project-select option').length,before}})()");
  assert.equal(wsInvalid.before,wsInvalid.after);
  assert.match(wsInvalid.message,/name must contain/);
  const wsPersistence=await evaluate("(()=>{const previous=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));document.querySelector('[data-view=home]').click();document.querySelector('[data-view=workstation]').click();const next=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));const external={free:JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1')),academy:JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1')),mystery:JSON.parse(localStorage.getItem('phi-circuit-lab-mystery-v1')),scope:JSON.parse(localStorage.getItem('phi-circuit-lab-scope-v1'))};return {same:JSON.stringify(previous)===JSON.stringify(next),projects:next.projects.length,external}})()");
  assert.equal(wsPersistence.same,true);
  assert.equal(wsPersistence.projects,2);
  assert.deepEqual(wsPersistence.external,wsStart.prior);
  console.log('PASS: workstation survives navigation without touching legacy projects or saved scores');
  const wsImportGood=await evaluate("(async()=>{const incoming=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));incoming.projects[0].name='Restored from JSON';const file=new File([JSON.stringify(incoming)],'portfolio.json',{type:'application/json'});const input=document.querySelector('#ws-import');Object.defineProperty(input,'files',{configurable:true,value:[file]});window.confirm=()=>true;input.dispatchEvent(new Event('change',{bubbles:true}));for(let i=0;i<40&&document.querySelector('#ws-project-name')?.value!=='Restored from JSON';i++)await new Promise(resolve=>setTimeout(resolve,10));return {name:document.querySelector('#ws-project-name')?.value,count:document.querySelectorAll('#ws-project-select option').length,status:document.querySelector('#ws-status').textContent,version:JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1')).version}})()");
  assert.equal(wsImportGood.name,'Restored from JSON');
  assert.equal(wsImportGood.count,2);
  assert.equal(wsImportGood.version,1);
  assert.match(wsImportGood.status,/Imported a validated/);
  console.log('PASS: valid versioned project JSON imports through browser controls');
  const wsImportBad=await evaluate("(async()=>{const saved=localStorage.getItem('phi-circuit-lab-workstation-v1');const incoming=JSON.parse(saved);incoming.version=99;const file=new File([JSON.stringify(incoming)],'wrong-version.json',{type:'application/json'});const input=document.querySelector('#ws-import');Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new Event('change',{bubbles:true}));for(let i=0;i<40&&!document.querySelector('#ws-status').textContent.includes('Import rejected');i++)await new Promise(resolve=>setTimeout(resolve,10));return {unchanged:localStorage.getItem('phi-circuit-lab-workstation-v1')===saved,status:document.querySelector('#ws-status').textContent}})()");
  assert.equal(wsImportBad.unchanged,true);
  assert.match(wsImportBad.status,/Import rejected/);
  const wsBackup=await evaluate("(()=>{document.querySelector('#ws-export').click();return {status:document.querySelector('#ws-status').textContent,free:JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1')),academy:JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1')),mystery:JSON.parse(localStorage.getItem('phi-circuit-lab-mystery-v1')),scope:JSON.parse(localStorage.getItem('phi-circuit-lab-scope-v1'))}})()");
  assert.match(wsBackup.status,/Downloaded a validated/);
  assert.deepEqual({free:wsBackup.free,academy:wsBackup.academy,mystery:wsBackup.mystery,scope:wsBackup.scope},wsStart.prior);
  console.log('PASS: export control, rejected malformed imports and legacy save isolation');
  // v1.1: prove the miniature solderless breadboard uses the actual
  // electrical solver, enforces copper-strip boundaries and never silently
  // overwrites the original free-build circuit.
  const bbBegin=await evaluate("(()=>{const free=JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1'));const workstation=JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'));const academy=JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1'));document.querySelector('[data-view=breadboard]').click();return {title:document.querySelector('#app-content h1')?.textContent,holes:document.querySelectorAll('#bb-canvas [data-bb-contact]').length,status:document.querySelector('#bb-status')?.textContent,current:document.querySelector('#bb-current')?.textContent,lit:document.querySelectorAll('[data-bb-part][data-bb-lit=yes]').length,free,workstation,academy}})()");
  assert.equal(bbBegin.title,'Virtual Breadboard & Component Library');
  assert.equal(bbBegin.holes,146);
  assert.equal(bbBegin.status,'Connected circuit');
  assert.equal(bbBegin.lit,1);
  assert.match(bbBegin.current,/mA$/);
  console.log('PASS: physical breadboard route loads powered LED, 144 holes and two supply jacks');
  const bbCopper=await evaluate("(()=>{const select=document.querySelector('#bb-tool');select.value='continuity';select.dispatchEvent(new Event('change',{bubbles:true}));const tap=t=>document.querySelector('[data-bb-contact=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));tap('A3');tap('E3');const same=document.querySelector('#bb-meter-readout').textContent;tap('E3');tap('F3');const trench=document.querySelector('#bb-meter-readout').textContent;tap('P1');tap('P12');const rail=document.querySelector('#bb-meter-readout').textContent;tap('P1');tap('N1');const isolated=document.querySelector('#bb-meter-readout').textContent;return {same,trench,rail,isolated}})()");
  assert.deepEqual(bbCopper,{same:'CONNECTED',trench:'OPEN',rail:'CONNECTED',isolated:'OPEN'});
  console.log('PASS: browser continuity sees five-hole copper strips, isolated trench and separate rails');
  const bbVoltage=await evaluate("(()=>{const select=document.querySelector('#bb-tool');select.value='voltage';select.dispatchEvent(new Event('change',{bubbles:true}));for(const t of ['P12','N10'])document.querySelector('[data-bb-contact=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return {readout:document.querySelector('#bb-meter-readout').textContent,details:document.querySelector('#bb-meter-details').textContent}})()");
  assert.equal(bbVoltage.readout,'5.000 V');
  assert.match(bbVoltage.details,/high-impedance/);
  const bbResistor=await evaluate("(()=>{const select=document.querySelector('#bb-tool');select.value='select';select.dispatchEvent(new Event('change',{bubbles:true}));const before=document.querySelector('#bb-current').textContent;document.querySelector('[data-bb-part=R1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const field=document.querySelector('#bb-ohms');field.value='1000';field.dispatchEvent(new Event('change',{bubbles:true}));return {before,after:document.querySelector('#bb-current').textContent,ohms:JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1')).parts[0].ohms}})()");
  assert.notEqual(bbResistor.before,bbResistor.after);
  assert.equal(bbResistor.ohms,1000);
  console.log('PASS: virtual contact voltage and physical resistor editing update modeled LED current');
  const bbReverse=await evaluate("(()=>{window.confirm=()=>true;const e=document.querySelector('#bb-example');e.value='reverse-led';e.dispatchEvent(new Event('change',{bubbles:true}));const before=document.querySelector('#bb-current').textContent;const beforeLit=document.querySelector('[data-bb-part=D1]').dataset.bbLit;document.querySelector('[data-bb-part=D1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#bb-flip').click();return {before,beforeLit,afterLit:document.querySelector('[data-bb-part=D1]').dataset.bbLit,after:document.querySelector('#bb-current').textContent,led:JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1')).leds[0]}})()");
  assert.equal(bbReverse.before,'0.000 mA');
  assert.equal(bbReverse.beforeLit,'no');
  assert.equal(bbReverse.afterLit,'yes');
  assert.notEqual(bbReverse.after,'0.000 mA');
  assert.equal(bbReverse.led.a,'E5');
  console.log('PASS: physically reversing an LED changes real diode-solver conduction');
  const bbSwitch=await evaluate("(()=>{const e=document.querySelector('#bb-example');e.value='switch';e.dispatchEvent(new Event('change',{bubbles:true}));const before=document.querySelector('#bb-status').textContent;document.querySelector('[data-bb-part=S1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#bb-toggle').click();return {before,after:document.querySelector('#bb-status').textContent,current:document.querySelector('#bb-current').textContent}})()");
  assert.equal(bbSwitch.before,'Open circuit');
  assert.equal(bbSwitch.after,'Connected circuit');
  assert.equal(bbSwitch.current,'9.000 mA');
  console.log('PASS: breadboard switch physically breaks and completes the resistor circuit');
  const bbManual=await evaluate("(()=>{const e=document.querySelector('#bb-example');e.value='blank';e.dispatchEvent(new Event('change',{bubbles:true}));const tap=t=>document.querySelector('[data-bb-contact=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const mode=document.querySelector('#bb-tool');const tool=t=>{mode.value=t;mode.dispatchEvent(new Event('change',{bubbles:true}))};tool('jumper');tap('V+');tap('P1');tap('GND');tap('N1');tool('resistor');tap('E3');tap('F3');tool('jumper');tap('P3');tap('A3');tap('J3');tap('N3');return {status:document.querySelector('#bb-status').textContent,current:document.querySelector('#bb-current').textContent,parts:document.querySelectorAll('[data-bb-part]').length,wires:JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1')).wires.length}})()");
  assert.deepEqual(bbManual,{status:'Connected circuit',current:'5.000 mA',parts:1,wires:4});
  const bbUndo=await evaluate("(()=>{const wire=document.querySelector('[data-bb-wire=\"2\"]');wire.dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#bb-delete').click();const missing=document.querySelector('#bb-status').textContent;document.querySelector('#bb-undo').click();return {missing,restored:document.querySelector('#bb-status').textContent,current:document.querySelector('#bb-current').textContent}})()");
  assert.equal(bbUndo.missing,'Open circuit');
  assert.equal(bbUndo.restored,'Connected circuit');
  assert.equal(bbUndo.current,'5.000 mA');
  console.log('PASS: manual two-hole component/jumper placement and undo use real electrical connectivity');
  const bbNoTransfer=await evaluate("(()=>{const before=localStorage.getItem('phi-circuit-lab-wiring-v1');window.confirm=()=>false;document.querySelector('#bb-send-to-wiring').click();return {same:localStorage.getItem('phi-circuit-lab-wiring-v1')===before,stayed:!!document.querySelector('#bb-canvas')}})()");
  assert.deepEqual(bbNoTransfer,{same:true,stayed:true});
  const bbRetention=await evaluate("(()=>{const before=JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1'));document.querySelector('[data-view=home]').click();document.querySelector('[data-view=breadboard]').click();const after=JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1'));return {same:JSON.stringify(before)===JSON.stringify(after),status:document.querySelector('#bb-status').textContent,original:JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1'))}})()");
  assert.equal(bbRetention.same,true);
  assert.equal(bbRetention.status,'Connected circuit');
  assert.deepEqual(bbRetention.original,bbBegin.workstation);
  console.log('PASS: breadboard save is separate from Workstation and free Wiring Lab');
  const bbImportGood=await evaluate("(async()=>{const incoming=JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1'));incoming.supplyV=7;const file=new File([JSON.stringify(incoming)],'board.json',{type:'application/json'});const input=document.querySelector('#bb-import');Object.defineProperty(input,'files',{configurable:true,value:[file]});window.confirm=()=>true;input.dispatchEvent(new Event('change',{bubbles:true}));for(let i=0;i<40&&document.querySelector('#bb-current').textContent!=='7.000 mA';i++)await new Promise(r=>setTimeout(r,10));return {current:document.querySelector('#bb-current').textContent,supply:JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1')).supplyV}})()");
  assert.deepEqual(bbImportGood,{current:'7.000 mA',supply:7});
  const bbImportBad=await evaluate("(async()=>{const snapshot=localStorage.getItem('phi-circuit-lab-breadboard-v1');const incoming=JSON.parse(snapshot);incoming.version=99;const file=new File([JSON.stringify(incoming)],'invalid-board.json',{type:'application/json'});const input=document.querySelector('#bb-import');Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new Event('change',{bubbles:true}));for(let i=0;i<40&&!document.querySelector('#bb-message').textContent.includes('Import rejected');i++)await new Promise(r=>setTimeout(r,10));return {unchanged:snapshot===localStorage.getItem('phi-circuit-lab-breadboard-v1'),feedback:document.querySelector('#bb-message').textContent}})()");
  assert.equal(bbImportBad.unchanged,true);
  assert.match(bbImportBad.feedback,/Import rejected/);
  const bbRestoreVoltage=await evaluate("(()=>{const field=document.querySelector('#bb-supply');field.value='5';field.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#bb-export').click();return {current:document.querySelector('#bb-current').textContent,message:document.querySelector('#bb-message').textContent}})()");
  assert.equal(bbRestoreVoltage.current,'5.000 mA');
  assert.match(bbRestoreVoltage.message,/Exported/);
  console.log('PASS: validated breadboard import/export and rejected-invalid-file rollback');
  const bbTransfer=await evaluate("(()=>{window.confirm=()=>true;document.querySelector('#bb-send-to-wiring').click();return {view:document.querySelector('#app-content h1')?.textContent,status:document.querySelector('#wiring-state')?.textContent,current:document.querySelector('#wiring-current')?.textContent,source:JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1')).supplyV}})()");
  assert.equal(bbTransfer.view,'Wiring Sandbox');
  assert.equal(bbTransfer.status,'Connected circuit');
  assert.equal(bbTransfer.current,'5.000 mA');
  assert.equal(bbTransfer.source,5);
  console.log('PASS: confirmed explicit breadboard transfer opens the equivalent DC Wiring Lab circuit');
  const bbOtherSaves=await evaluate("(()=>({workstation:JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1')),academy:JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1'))}))()");
  assert.deepEqual(bbOtherSaves.workstation,bbBegin.workstation);
  assert.deepEqual(bbOtherSaves.academy,bbBegin.academy);
  console.log('PASS: circuit transfer leaves Workstation, Academy and Mystery work untouched');
  // v1.2: from saved schematic to independently verified breadboard with
  // read-only preview, precise build steps, refusal cases, and opt-in transfer.
  const bridgeStart=await evaluate("(()=>{const prior={free:JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1')),breadboard:JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1')),workstation:JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1')),academy:JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1')),mystery:JSON.parse(localStorage.getItem('phi-circuit-lab-mystery-v1'))};document.querySelector('[data-view=bridge]').click();return {title:document.querySelector('#app-content h1')?.textContent,source:document.querySelector('#bridge-source').value,preview:document.querySelector('#bridge-results').hidden,options:[...document.querySelector('#bridge-source').options].map(x=>x.value),prior}})()");
  assert.equal(bridgeStart.title,'Schematic-to-Breadboard Bridge');
  assert.equal(bridgeStart.source,'saved');
  assert.equal(bridgeStart.preview,true);
  assert.ok(bridgeStart.options.includes('workstation'));
  assert.ok(bridgeStart.options.includes('demo:series'));
  console.log('PASS: bridge opens with saved Wiring Lab schematic and untouched existing designs');
  const bridgeSaved=await evaluate("(()=>{document.querySelector('#bridge-plan').click();return {visible:!document.querySelector('#bridge-results').hidden,parts:document.querySelector('#bridge-parts').textContent,jumpers:document.querySelector('#bridge-wires').textContent,pairs:document.querySelector('#bridge-pairs').textContent,current:document.querySelector('#bridge-current').textContent,steps:document.querySelectorAll('#bridge-instructions li').length,holes:document.querySelectorAll('#bridge-canvas [data-bb-contact]').length,disabled:document.querySelector('#bridge-canvas [data-bb-contact]').getAttribute('tabindex'),status:document.querySelector('#bridge-status').textContent}})()");
  assert.equal(bridgeSaved.visible,true);
  assert.equal(bridgeSaved.parts,'1 / 12');
  assert.equal(bridgeSaved.jumpers,'4 / 40');
  assert.equal(bridgeSaved.pairs,'6 pairs');
  assert.equal(bridgeSaved.current,'5.000 mA');
  assert.equal(bridgeSaved.steps,6);
  assert.equal(bridgeSaved.holes,146);
  assert.equal(bridgeSaved.disabled,'-1');
  assert.match(bridgeSaved.status,/Verified/);
  console.log('PASS: one-component source receives correct hole placements and all six terminal-pair checks');
  const bridgeDecline=await evaluate("(()=>{const before=localStorage.getItem('phi-circuit-lab-breadboard-v1');window.confirm=()=>false;document.querySelector('#bridge-apply').click();return {preserved:before===localStorage.getItem('phi-circuit-lab-breadboard-v1'),stayed:!!document.querySelector('#bridge-canvas')}})()");
  assert.deepEqual(bridgeDecline,{preserved:true,stayed:true});
  console.log('PASS: declining schematic-to-breadboard transfer preserves previous board layout');
  const bridgeDemo=await evaluate("(()=>{const source=document.querySelector('#bridge-source');source.value='demo:series';source.dispatchEvent(new Event('change',{bubbles:true}));const cleared=document.querySelector('#bridge-results').hidden;document.querySelector('#bridge-plan').click();return {cleared,visible:!document.querySelector('#bridge-results').hidden,parts:document.querySelector('#bridge-parts').textContent,wires:document.querySelector('#bridge-wires').textContent,pairs:document.querySelector('#bridge-pairs').textContent,current:document.querySelector('#bridge-current').textContent,placed:document.querySelectorAll('#bridge-canvas [data-bb-part]').length,steps:document.querySelectorAll('#bridge-instructions li').length}})()");
  assert.equal(bridgeDemo.cleared,true);
  assert.equal(bridgeDemo.visible,true);
  assert.equal(bridgeDemo.parts,'2 / 12');
  assert.equal(bridgeDemo.wires,'5 / 40');
  assert.equal(bridgeDemo.pairs,'15 pairs');
  assert.equal(bridgeDemo.current,'4.500 mA');
  assert.equal(bridgeDemo.placed,2);
  assert.equal(bridgeDemo.steps,8);
  console.log('PASS: source changes invalidate stale plan, then route two series resistors correctly');
  const bridgeReverseLed=await evaluate("(()=>{const source=document.querySelector('#bridge-source');source.value='demo:reverse-led';source.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#bridge-plan').click();return {verified:document.querySelector('#bridge-status').textContent,unlit:document.querySelector('#bridge-canvas [data-bb-part=D1]').dataset.bbLit,source:document.querySelector('#bridge-current').textContent}})()");
  assert.match(bridgeReverseLed.verified,/Verified/);
  assert.equal(bridgeReverseLed.unlit,'no');
  assert.equal(bridgeReverseLed.source,'0.000 mA');
  const bridgeWorkstation=await evaluate("(()=>{const source=document.querySelector('#bridge-source');source.value='workstation';source.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#bridge-plan').click();return {status:document.querySelector('#bridge-status').textContent,parts:document.querySelector('#bridge-parts').textContent,source:source.value}})()");
  assert.match(bridgeWorkstation.status,/Verified/);
  assert.equal(bridgeWorkstation.source,'workstation');
  assert.equal(bridgeWorkstation.parts,'2 / 12');
  console.log('PASS: saved Workstation schematic and reversed LED map with accurate modeled outcomes');
  const bridgeBadSource=await evaluate("(()=>{const saved=localStorage.getItem('phi-circuit-lab-wiring-v1');const source=JSON.parse(saved);source.wires.push({a:'V+',b:'GND'});localStorage.setItem('phi-circuit-lab-wiring-v1',JSON.stringify(source));const pick=document.querySelector('#bridge-source');pick.value='saved';pick.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#bridge-plan').click();const result={hidden:document.querySelector('#bridge-results').hidden,message:document.querySelector('#bridge-status').textContent,oldBoard:JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1'))};localStorage.setItem('phi-circuit-lab-wiring-v1',saved);return result})()");
  assert.equal(bridgeBadSource.hidden,true);
  assert.match(bridgeBadSource.message,/source short/);
  assert.deepEqual(bridgeBadSource.oldBoard,bridgeStart.prior.breadboard);
  console.log('PASS: ideal-source-short schematics are refused without damaging existing designs');
  const bridgeOverCapacity=await evaluate("(()=>{const old=localStorage.getItem('phi-circuit-lab-wiring-v1');const base={version:1,supplyV:9,parts:Array.from({length:8},(_,i)=>({id:'R'+(i+1),ohms:330,x:150+i*70,y:170})),switches:Array.from({length:4},(_,i)=>({id:'S'+(i+1),closed:false,x:170+i*145,y:285})),leds:[{id:'D1',color:'red',x:400,y:380}],wires:[]};localStorage.setItem('phi-circuit-lab-wiring-v1',JSON.stringify(base));document.querySelector('#bridge-plan').click();const result={hidden:document.querySelector('#bridge-results').hidden,error:document.querySelector('#bridge-status').textContent};localStorage.setItem('phi-circuit-lab-wiring-v1',old);return result})()");
  assert.equal(bridgeOverCapacity.hidden,true);
  assert.match(bridgeOverCapacity.error,/supports only 12/);
  console.log('PASS: 13-part schematics are explicitly rejected as unsupported');
  const bridgeConfirm=await evaluate("(()=>{const source=document.querySelector('#bridge-source');source.value='demo:series';source.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#bridge-plan').click();const free=localStorage.getItem('phi-circuit-lab-wiring-v1');const workstation=localStorage.getItem('phi-circuit-lab-workstation-v1');window.confirm=()=>true;document.querySelector('#bridge-apply').click();return {title:document.querySelector('#app-content h1')?.textContent,current:document.querySelector('#bb-current')?.textContent,parts:document.querySelectorAll('#bb-canvas [data-bb-part]').length,wires:JSON.parse(localStorage.getItem('phi-circuit-lab-breadboard-v1')).wires.length,freePreserved:free===localStorage.getItem('phi-circuit-lab-wiring-v1'),workstationPreserved:workstation===localStorage.getItem('phi-circuit-lab-workstation-v1')}})()");
  assert.equal(bridgeConfirm.title,'Virtual Breadboard & Component Library');
  assert.equal(bridgeConfirm.current,'4.500 mA');
  assert.equal(bridgeConfirm.parts,2);
  assert.equal(bridgeConfirm.wires,5);
  assert.equal(bridgeConfirm.freePreserved,true);
  assert.equal(bridgeConfirm.workstationPreserved,true);
  console.log('PASS: confirmed transfer loads verified breadboard netlist and preserves source circuits');
  const bridgeFinal=await evaluate("(()=>({free:JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1')),workstation:JSON.parse(localStorage.getItem('phi-circuit-lab-workstation-v1')),academy:JSON.parse(localStorage.getItem('phi-circuit-lab-academy-v1')),mystery:JSON.parse(localStorage.getItem('phi-circuit-lab-mystery-v1'))}))()");
  assert.deepEqual(bridgeFinal.free,bridgeStart.prior.free);
  assert.deepEqual(bridgeFinal.workstation,bridgeStart.prior.workstation);
  assert.deepEqual(bridgeFinal.academy,bridgeStart.prior.academy);
  assert.deepEqual(bridgeFinal.mystery,bridgeStart.prior.mystery);
  console.log('PASS: completed bridge workflow respects all older laboratory and course progress');
  // The independent reactor page must work in Chrome, not only in Node model tests.
  const reactorLink=await evaluate("document.querySelector('a[href=\"./adaptive-reactor.html\"]')?.getAttribute('href')");
  assert.equal(reactorLink,'./adaptive-reactor.html');
  await cdp('Page.navigate',{url:url+'adaptive-reactor.html'},sessionId);
  let reactor=null;
  for(let attempt=0;attempt<35;attempt++){
    await new Promise(resolve=>setTimeout(resolve,120));
    try{
      reactor=await evaluate("({status:document.querySelector('#reactor-status')?.textContent,cards:document.querySelectorAll('.reactor-result').length,ledger:document.querySelectorAll('#reactor-ledger tr').length,paths:document.querySelectorAll('#reactor-power-chart path').length,link:document.querySelector('a[href=\"./docs/ADAPTIVE-REACTOR.md\"]')?.getAttribute('href')})");
      if(reactor?.status?.includes('SIMULATED'))break;
    }catch(_){/* Navigation may briefly destroy the old execution context. */}
  }
  assert.match(reactor?.status||'',/SIMULATED/);
  assert.equal(reactor.cards,3);
  assert.equal(reactor.ledger,9);
  assert.equal(reactor.paths,4);
  assert.equal(reactor.link,'./docs/ADAPTIVE-REACTOR.md');
  const changedReactor=await evaluate("(()=>{document.querySelector('#reactor-scenario').value='storm';document.querySelector('#reactor-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return {status:document.querySelector('#reactor-status').textContent,summary:document.querySelectorAll('.reactor-result').length,paths:document.querySelectorAll('#reactor-soc-chart path').length}})()");
  assert.match(changedReactor.status,/STORM.*SIMULATED/);
  assert.equal(changedReactor.summary,3);
  assert.equal(changedReactor.paths,3);
  console.log('PASS: Adaptive Reactor Lab loads, graphs results and recalculates storm scenario in Chrome');
  assert.deepEqual(exceptions,[]);
  console.log('PASS: no uncaught browser JavaScript exceptions');
} finally {
  // Chrome may still write into its profile for a moment after SIGTERM.
  // Wait for process exit, then retry removal. A cleanup race is not a
  // failed circuit test (the runner removes its temporary directory anyway).
  if(chrome.exitCode===null){
    chrome.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve=>chrome.once('exit',resolve)),
      new Promise(resolve=>setTimeout(resolve,2500))
    ]);
  }
  await new Promise(resolve=>server.close(resolve));
  try{await rm(profile,{recursive:true,force:true,maxRetries:15,retryDelay:100});}
  catch(error){console.warn('Chrome temporary-profile cleanup warning:',error.code);}
}
