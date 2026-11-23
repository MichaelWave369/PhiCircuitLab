/**
 * Dependency-free headless Chromium smoke test for the ΦREL-369 language UI.
 * The server injects a small ephemeral test driver into a copy of the HTML;
 * the production application itself has no test-only behavior.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const mime={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css"};
const candidates=[process.env.CHROME_BIN,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean);
const chromeBin=candidates.find(bin=>spawnSync("which",[bin],{stdio:"ignore"}).status===0);
if (!chromeBin) throw new Error("Chromium or Google Chrome required");

const driver = String.raw`<script type="module">
  try {
    const el = id => document.getElementById(id);
    if (!el("rel-state-lines").textContent.includes("A")) throw Error("initial runtime missing");
    el("rel-step").click();
    if (el("rel-runtime-tick").textContent !== "1") throw Error("step did not advance");
    el("rel-preset").value = "memory";
    el("rel-preset").dispatchEvent(new Event("change"));
    el("rel-shock").click();
    el("rel-step").click();
    if (!el("rel-memory-lines").textContent.includes("C")) throw Error("memory not rendered");
    el("rel-target").value = "XOR";
    el("rel-discover").click();
    if (!el("rel-discovery-report").textContent.includes("80 enumerated programs")) throw Error("discovery failed");
    el("rel-editor").value = "STATE A 0\nSTATE B 0\nSTATE C 0\nbad();";
    el("rel-compile").click();
    if (!el("rel-status").textContent.includes("Parse error")) throw Error("invalid DSL was accepted");
    document.body.setAttribute("data-rel-smoke","ok");
  } catch(error) {
    document.body.setAttribute("data-rel-smoke","error:"+error.message);
  }
</script>`;

const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,"http://127.0.0.1").pathname;
    const target=pathname==="/relational369-smoke.html" ? "/relational369.html" : pathname;
    const absolute=path.resolve(root,"."+target);
    if(!absolute.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    let text=await readFile(absolute,"utf8");
    if(pathname==="/relational369-smoke.html") text=text.replace("</body>",driver+"</body>");
    res.writeHead(200,{"content-type":mime[path.extname(target)]||"text/plain"});
    res.end(text);
  } catch(_){res.writeHead(404);res.end("Not found");}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const profile=await mkdtemp(path.join(os.tmpdir(),"phi-rel-smoke-"));
try {
  const url="http://127.0.0.1:"+server.address().port+"/relational369-smoke.html";
  const child=spawn(chromeBin,[
    "--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",
    "--disable-background-networking","--no-first-run","--disable-extensions",
    "--user-data-dir="+profile,"--virtual-time-budget=4000","--dump-dom",url
  ],{stdio:["ignore","pipe","pipe"]});
  const parts=[], errors=[];
  child.stdout.on("data",chunk=>parts.push(chunk));
  child.stderr.on("data",chunk=>errors.push(chunk));
  let expired=false;
  const timeout=setTimeout(()=>{expired=true;child.kill("SIGKILL");},45000);
  const code=await new Promise((resolve,reject)=>{
    child.on("error",reject);
    child.on("close",resolve);
  });
  clearTimeout(timeout);
  assert.equal(expired,false,"Chrome exceeded timeout");
  assert.equal(code,0,"Chromium exited: "+Buffer.concat(errors).toString().slice(-900));
  const html=Buffer.concat(parts).toString("utf8");
  assert.match(html,/data-rel-smoke="ok"/,html.match(/data-rel-smoke="[^"]*"/)?.[0]||"Smoke marker missing");
  console.log("PASS: ΦREL-369 browser loads, executes, perturbs, synthesizes, and rejects invalid code");
} finally {
  server.close();
  await rm(profile,{recursive:true,force:true});
}
