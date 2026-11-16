// Teclado do celular: a barra de digitar não pode sumir atrás do teclado quando chegam mensagens.
// O teclado virtual não existe em navegador automatizado, então o teste controla a área visível
// (visualViewport) como o celular faria: encolhe (Android) ou encolhe e "empurra" a página (iPhone).
// Uso: node tests/teclado.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { startBroker } from './broker.mjs';
import { serve } from './serve.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
startBroker(18881); const web = serve(ROOT, 18795);
const Q = '?nop2p=1&relays=ws://localhost:18881/mqtt';
const chrome = spawn(process.env.CHROME || 'google-chrome', ['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=19355','about:blank'], { stdio: 'ignore' });
for (;;) { try { await fetch('http://127.0.0.1:19355/json/version'); break; } catch { await sleep(300); } }
async function page(mobile){ const t = await (await fetch('http://127.0.0.1:19355/json/new?about:blank', { method: 'PUT' })).json(); const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r); let id = 0; const pend = new Map(); const errs=[]; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.method==='Runtime.exceptionThrown') errs.push(JSON.stringify(m.params.exceptionDetails).slice(0,200)); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } }; const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }); await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
  if (mobile) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    // visualViewport falso: o teste controla a área visível como o teclado faria
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const f=new EventTarget();f.width=390;f.height=844;f.offsetTop=0;f.offsetLeft=0;f.scale=1;Object.defineProperty(window,'visualViewport',{value:f,configurable:true});window.__kb=(h,top)=>{f.height=h;f.offsetTop=top;f.dispatchEvent(new Event('resize'));f.dispatchEvent(new Event('scroll'));};})()` });
  }
  const ev = async x => (await cmd('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value; return { cmd, ev, errs }; }
const say = (p, t) => p.ev(`(()=>{const i=document.querySelector('#input');i.value=${JSON.stringify(t)};i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#btn-send').click()})()`);
const H = await page(false); await H.cmd('Page.navigate', { url: 'http://localhost:18795/index.html' + Q }); await sleep(1200);
await H.ev(`document.querySelector('#btn-create').click()`); await sleep(1000); const link = await H.ev('location.href');
const M = await page(true); await M.cmd('Page.navigate', { url: link }); await sleep(1200); await M.ev(`document.querySelector('#btn-preview-go').click()`); await sleep(5000);
for (let i = 0; i < 15; i++) await say(H, 'mensagem antiga ' + i);
await sleep(1500);
const state = () => M.ev(`(()=>{const c=document.querySelector('.composer').getBoundingClientRect(), vv=visualViewport, last=[...document.querySelectorAll('#msg-list .msg')].pop().getBoundingClientRect(); return {comp:[Math.round(c.top),Math.round(c.bottom)], visivel:[vv.offsetTop, vv.offsetTop+vv.height], ultimaMsg:Math.round(last.bottom), compVisivel: c.top>=vv.offsetTop-1 && c.bottom<=vv.offsetTop+vv.height+1, ultimaVisivel: last.bottom<=c.top+1 && last.bottom>vv.offsetTop}})()`);
let fails = 0;
{ // a versão no ?v= do index.html precisa ser a mesma do app.js (senão o navegador pode usar arquivo velho)
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8'), js = readFileSync(join(ROOT, 'app.js'), 'utf8');
  const v = (js.match(/APP_VERSION = '([^']+)'/) || [])[1];
  const ok = !!v && html.includes('app.js?v=' + v) && html.includes('styles.css?v=' + v);
  console.log((ok ? '✔ ' : '✘ ') + 'versão do index.html = versão do app.js'.padEnd(48), v || 'sem versão'); if (!ok) fails++;
} const check = (k, s) => { const ok = s.compVisivel && s.ultimaVisivel; if (!ok) fails++; console.log((ok?'✔ ':'✘ ')+k.padEnd(48), JSON.stringify(s)); };
check('sem teclado', await state());
await M.ev(`document.querySelector('#input').focus()`);
// Android: área visível encolhe (teclado de 336 px)
await M.ev('__kb(508, 0)'); await sleep(400);
check('Android: teclado abre', await state());
for (let i = 0; i < 4; i++) { await say(H, 'nova android ' + i); await sleep(400); }
await sleep(1200);
check('Android: chegam 4 mensagens com teclado aberto', await state());
// caso do print do Galaxy S24 (Chrome): teclado aberto e a página levemente empurrada (~48 px)
await M.ev('__kb(508, 48)'); await sleep(400);
for (let i = 0; i < 4; i++) { await say(H, 'galaxy ' + i); await sleep(300); }
await sleep(1200);
check('Galaxy S24: empurrão leve + 4 mensagens', await state());
await M.ev('__kb(508, 0)'); await sleep(300);
// iPhone: área visível encolhe E a página é "empurrada" 336 px para cima
await M.ev('__kb(508, 336)'); await sleep(400);
check('iPhone: teclado abre (página empurrada)', await state());
for (let i = 0; i < 4; i++) { await say(H, 'nova iphone ' + i); await sleep(400); }
await sleep(1200);
check('iPhone: chegam 4 mensagens com teclado aberto', await state());
// iPhone desfaz o empurrão enquanto o teclado segue aberto (o que causava o bug)
await M.ev('__kb(508, 0)'); await sleep(400);
check('iPhone: navegador desfaz o empurrão', await state());
await say(M, 'respondendo com teclado aberto'); await sleep(800);
check('eu respondo com teclado aberto', await state());
await M.ev('__kb(844, 0)'); await sleep(400);
check('teclado fecha', await state());
// zoom com dois dedos não deve mexer no layout
await M.ev(`visualViewport.scale=2; __kb(422, 0)`); await sleep(300);
const z = await M.ev(`getComputedStyle(document.documentElement).getPropertyValue('--app-h')`);
console.log((z.trim()==='844px'?'✔ ':'✘ ')+'zoom com dois dedos não mexe no layout'.padEnd(48), z); if (z.trim()!=='844px') fails++;
// lendo mensagens antigas: mensagem nova não pode puxar para o fim
await M.ev(`(async()=>{const s=document.querySelector('#msg-scroll');s.scrollTop=s.scrollHeight;await new Promise(r=>setTimeout(r,100));s.scrollTop=200;await new Promise(r=>setTimeout(r,150));})()`);
await say(H, 'chegou enquanto eu lia'); await sleep(1500);
const lendo = await M.ev(`({top: document.querySelector('#msg-scroll').scrollTop, aviso: !document.querySelector('#scroll-pill').hidden})`);
const okLendo = lendo.top < 400 && lendo.aviso;
console.log((okLendo?'✔ ':'✘ ')+'lendo antigas: não puxa e mostra aviso'.padEnd(48), JSON.stringify(lendo)); if (!okLendo) fails++;
console.log('erros JS:', [...H.errs, ...M.errs].length ? [...H.errs, ...M.errs] : 'nenhum'); if (H.errs.length+M.errs.length) fails++;
console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nTUDO OK');
chrome.kill(); web.close(); setTimeout(() => process.exit(fails ? 1 : 0), 300);
