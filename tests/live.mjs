// Validação do site PUBLICADO (GitHub Pages) com os brokers públicos REAIS.
//   1) o site publicado é idêntico ao código do repositório
//   2) cada broker público aceita conexão MQTT por WebSocket seguro
//   3) 4 navegadores no site publicado: entram, conversam, arquivo, admin passa adiante, encerra
// Uso: node tests/live.mjs   (SITE=https://... para outro endereço; precisa de internet e do Chrome)
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.SITE || 'https://lebot007.github.io/nevoa-chat/').replace(/\/?$/, '/');
const CHROME = process.env.CHROME || 'google-chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const log = (k, v, ok = true) => { if (!ok) fails++; console.log((ok ? '✔ ' : '✘ ') + k.padEnd(60), v); };
const sha = b => createHash('sha256').update(b).digest('hex').slice(0, 16);

// ── 1) site publicado = repositório (o deploy do Pages pode levar alguns minutos) ──
for (const f of ['index.html', 'app.js', 'styles.css']) {
  const local = sha(await readFile(join(ROOT, f)));
  let pub = '', tries = 0;
  for (; tries < 30; tries++) {
    try { pub = sha(Buffer.from(await (await fetch(SITE + f + '?v=' + Date.now(), { cache: 'no-store' })).arrayBuffer())); } catch { pub = 'erro'; }
    if (pub === local) break;
    await sleep(10000);
  }
  log(`publicado = repositório: ${f}`, pub === local ? 'idêntico' : `publicado ${pub} ≠ repo ${local}`, pub === local);
}

// ── 2) brokers públicos reais ──
const mqttStr = s => { const b = Buffer.from(s); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 255]), b]); };
function connectPacket(user){
  const parts = [mqttStr('MQTT'), Buffer.from([4, user ? 0x82 : 0x02, 0, 30]), mqttStr('nvtest' + Math.random().toString(16).slice(2, 10))];
  if (user) parts.push(mqttStr(user));
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x10, body.length]), body]);
}
const appSrc = await readFile(join(ROOT, 'app.js'), 'utf8');
const brokers = [...appSrc.matchAll(/\{ url: '(wss:[^']+)'(?:, user: '([^']+)')? \}/g)].map(m => ({ url: m[1], user: m[2] }));
let okBrokers = 0;
for (const b of brokers) {
  const t0 = Date.now();
  const r = await new Promise(res => {
    let ws; const to = setTimeout(() => { try { ws.close(); } catch {} res('sem resposta em 10 s'); }, 10000);
    try { ws = new WebSocket(b.url, 'mqtt'); } catch (e) { clearTimeout(to); return res('erro: ' + e.message); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(connectPacket(b.user));
    ws.onmessage = e => { const d = new Uint8Array(e.data); clearTimeout(to); ws.close(); res(d[0] >> 4 === 2 && d[3] === 0 ? 'ok' : 'recusado (código ' + d[3] + ')'); };
    ws.onerror = () => { clearTimeout(to); res('conexão falhou'); };
  });
  if (r === 'ok') okBrokers++;
  log('broker ' + b.url.replace('wss://', ''), r === 'ok' ? `conectou em ${Date.now() - t0} ms` : r, r === 'ok' || true);   // um broker fora não reprova: os outros cobrem
}
log('brokers públicos funcionando', `${okBrokers} de ${brokers.length}`, okBrokers >= 2);

// ── 3) conversa real no site publicado ──
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=19440',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; ; i++) { try { await fetch('http://127.0.0.1:19440/json/version'); break; } catch { if (i > 120) { console.error('Chrome não abriu'); process.exit(1); } await sleep(500); } }
async function page(label){
  const t = await (await fetch('http://127.0.0.1:19440/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const errs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errs.push(label + ': ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 160));
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cmd('Network.enable'); await cmd('Network.setCacheDisabled', { cacheDisabled: true });
  const ev = async x => (await cmd('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value;
  return { label, cmd, ev, errs };
}
const count = p => p.ev(`document.querySelector('#member-count').textContent`);
const view = p => p.ev(`document.querySelector('.view.active')?.id`);
const say = (p, t) => p.ev(`(()=>{const i=document.querySelector('#input');i.value=${JSON.stringify(t)};i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#btn-send').click()})()`);
const has = (p, t) => p.ev(`[...document.querySelectorAll('#msg-list .msg .txt')].some(e=>e.textContent===${JSON.stringify(t)})`);
const until = async (fn, s = 30) => { const t0 = Date.now(); while (Date.now() - t0 < s * 1000) { if (await fn()) return ((Date.now() - t0) / 1000).toFixed(1) + 's'; await sleep(400); } return null; };
const isAdm = p => p.ev(`/admin/.test(document.querySelector('#btn-end-label').textContent)`);
const diag = async p => { await p.ev(`document.querySelector('#btn-diag-side').click()`); await sleep(300); const t = await p.ev(`[...document.querySelectorAll('#diag-grid dt')].map(d=>d.textContent+': '+d.nextElementSibling.textContent).join(' | ')`); await p.ev(`document.querySelector('#btn-diag-close').click()`); return t; };

const all = [];
try {
  const H = await page('anfitrião'); all.push(H);
  await H.cmd('Page.navigate', { url: SITE }); await sleep(3000);
  log('site publicado abre', await H.ev('document.title'), /Névoa/.test(await H.ev('document.title')));
  await H.ev(`document.querySelector('#btn-create').click()`); await sleep(1500);
  const link = await H.ev('location.href');
  log('sala criada (link com chave e prova de admin)', /#r=.*&k=.*&h=/.test(link) ? 'ok' : link, /#r=.*&k=.*&h=/.test(link));
  const G = [];
  for (let i = 0; i < 3; i++) {
    const p = await page('convidado ' + (i + 1)); G.push(p); all.push(p);
    await p.cmd('Page.navigate', { url: link }); await sleep(2000);
    await p.ev(`document.querySelector('#btn-preview-go').click()`);
    await sleep(500);
  }
  let t = await until(async () => (await Promise.all(all.map(count))).every(c => c === '4/10'), 60);
  log('4 pessoas conectadas pelos brokers reais', t || (await Promise.all(all.map(count))).join(' '), !!t);
  log('diagnóstico do anfitrião', await diag(H));

  const t0 = Date.now();
  await say(G[0], 'oi pelo site publicado');
  t = await until(async () => (await Promise.all([H, G[1], G[2]].map(p => has(p, 'oi pelo site publicado')))).every(Boolean), 20);
  log('mensagem chega aos outros 3', t ? `${Date.now() - t0} ms` : 'não chegou', !!t);
  await Promise.all([H, G[1], G[2]].map((p, i) => say(p, 'simultanea ' + i)));
  t = await until(async () => (await G[0].ev(`[...document.querySelectorAll('#msg-list .msg .txt')].filter(e=>e.textContent.startsWith('simultanea')).length`)) === 3, 20);
  log('3 mensagens simultâneas chegam', t || 'faltou', !!t);

  await G[1].ev(`(()=>{const f=new File([new Uint8Array(150000).map((_,i)=>i%251)],'teste.bin');const dt=new DataTransfer();dt.items.add(f);const inp=document.querySelector('#file-input');inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  const fileOk = p => p.ev(`[...document.querySelectorAll('#msg-list .msg.in')].some(m=>/teste\\.bin/.test(m.textContent)&&!!m.querySelector('a[download]'))`);
  t = await until(async () => (await Promise.all([H, G[0], G[2]].map(fileOk))).every(Boolean), 60);
  log('arquivo de 150 KB chega aos outros 3', t || 'não chegou', !!t);

  log('anfitrião é o admin', (await isAdm(H)) ? 'sim' : 'não', await isAdm(H));
  await H.cmd('Page.navigate', { url: 'about:blank' });
  t = await until(async () => (await Promise.all(G.map(count))).every(c => c === '3/10'), 30);
  log('anfitrião fecha a aba → os 3 seguem', t || (await Promise.all(G.map(count))).join(' '), !!t);
  t = await until(() => isAdm(G[0]), 20);
  log('admin passa para o 1º convidado', t || 'não passou', !!t);
  await say(G[2], 'sem o anfitriao');
  t = await until(async () => (await Promise.all([G[0], G[1]].map(p => has(p, 'sem o anfitriao')))).every(Boolean), 20);
  log('conversa continua sem o anfitrião', t || 'não chegou', !!t);

  await G[0].ev(`document.querySelector('#btn-end').click()`); await sleep(500); await G[0].ev(`document.querySelector('#btn-adm-end').click()`);
  t = await until(async () => (await Promise.all(G.map(view))).every(v => v === 'view-ended'), 20);
  log('novo admin encerra → todos apagados', t || (await Promise.all(G.map(view))).join(','), !!t);
} catch (e) { fails++; console.error('✘ teste abortado:', e); }
const errs = all.flatMap(p => p.errs);
log('erros de JavaScript no site publicado', errs.length ? errs.slice(0, 3).join(' | ') : 'nenhum', !errs.length);
console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
chrome.kill();
setTimeout(() => process.exit(fails ? 1 : 0), 300);
