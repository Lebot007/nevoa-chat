// Teste de ponta a ponta do Névoa: 10 pessoas em 3 "casas" com redes diferentes + 1 visitante.
//   Casa A — fibra: P2P liberado, relays com 100 ms até o broker (como Brasil → Europa).
//   Casa B — 4G/CGNAT: P2P bloqueado, 150 ms ± 100 ms, banda de 100 KB/s.
//   Casa C — VPN corporativa: P2P bloqueado e só a porta 443 liberada (um único relay).
// Uso: node tests/e2e.mjs        (precisa do Google Chrome; CHROME=/caminho/do/chrome para outro)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { startBroker } from './broker.mjs';
import { house } from './netem.mjs';
import { serve } from './serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || 'google-chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── infraestrutura ──
const B = { b1: startBroker(18831), b2: startBroker(18832), b3: startBroker(18833) };   // b3 = "porta 443"
const H = {
  a1: house(19111, 18831, { lat: 100, jit: 20, bw: 0 }), a2: house(19112, 18832, { lat: 100, jit: 20, bw: 0 }), a3: house(19113, 18833, { lat: 100, jit: 20, bw: 0 }),
  b1: house(19211, 18831, { lat: 150, jit: 100, bw: 100000 }), b2: house(19212, 18832, { lat: 150, jit: 100, bw: 100000 }), b3: house(19213, 18833, { lat: 150, jit: 100, bw: 100000 }),
  c3: house(19313, 18833, { lat: 120, jit: 40, bw: 0 })
};
const web = serve(ROOT, 18780);
const relays = (...ports) => ports.map(p => `ws://localhost:${p}/mqtt`).join(',');
const QUERY = {
  A: '?relays=' + relays(19111, 19112, 19113),
  B: '?relays=' + relays(19211, 19212, 19213) + '&nop2p=1',
  C: '?relays=' + relays(1, 2, 19313) + '&nop2p=1'          // portas 1 e 2 = bloqueadas pela VPN
};
const urlFor = (link, h) => link.replace(/\?[^#]*/, '').replace('/index.html', '/index.html' + QUERY[h]);

const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=19340',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
  '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', 'about:blank'], { stdio: 'ignore' });
// espera o Chrome abrir (em máquinas de CI a primeira abertura pode levar vários segundos)
for (let i = 0; ; i++) {
  try { await fetch('http://127.0.0.1:19340/json/version'); break; }
  catch { if (i > 120) { console.error('Chrome não abriu em 60 s'); process.exit(1); } await sleep(500); }
}

async function page(label){
  const t = await (await fetch('http://127.0.0.1:19340/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const errs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errs.push(label + ': ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 160));
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Emulation.setFocusEmulationEnabled', { enabled: true });
  // registra a hora de chegada de cada mensagem (para medir latência)
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `window.__arr={};new MutationObserver(()=>{document.querySelectorAll('#msg-list .msg .txt').forEach(e=>{if(!(e.textContent in window.__arr))window.__arr[e.textContent]=Date.now()})}).observe(document,{subtree:true,childList:true});` });
  const ev = async x => (await cmd('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value;
  return { label, cmd, ev, errs };
}

// ── utilidades ──
let fails = 0;
const log = (k, v, ok = true) => { if (!ok) fails++; console.log((ok ? '✔ ' : '✘ ') + k.padEnd(64), v); };
const count = p => p.ev(`document.querySelector('#member-count').textContent`);
const view = p => p.ev(`document.querySelector('.view.active')?.id`);
const connected = p => p.ev(`!!(window.__nevoa && __nevoa.S.connected)`);
const say = (p, t) => p.ev(`(()=>{const i=document.querySelector('#input');i.value=${JSON.stringify(t)};i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#btn-send').click()})()`);
const has = (p, t) => p.ev(`[...document.querySelectorAll('#msg-list .msg .txt')].some(e=>e.textContent===${JSON.stringify(t)})`);
const until = async (fn, s = 30) => { const t0 = Date.now(); while (Date.now() - t0 < s * 1000) { if (await fn()) return ((Date.now() - t0) / 1000).toFixed(1) + 's'; await sleep(300); } return null; };
const allCount = async (ps, n) => (await Promise.all(ps.map(count))).every(c => c === n + '/10');
const allHave = async (ps, t) => (await Promise.all(ps.map(p => has(p, t)))).every(Boolean);
const missing = async (ps, t) => (await Promise.all(ps.map(async p => (await has(p, t)) ? null : p.label))).filter(Boolean).join(', ');
const sentAt = (p, t) => p.ev(`(()=>{for(const m of __nevoa.S.msgIndex.values())if(m.text===${JSON.stringify(t)})return m.ts})()`);
const arrivedAt = (p, t) => p.ev(`window.__arr[${JSON.stringify(t)}]`);
async function deliveryMs(from, to, text){
  await say(from, text); await until(() => has(to, text), 15);
  return (await arrivedAt(to, text)) - (await sentAt(from, text));
}

try {
  // 1) anfitrião (casa A) + 9 convidados: 3 em A, 3 em B, 3 em C
  const host = await page('A-anfitrião');
  await host.cmd('Page.navigate', { url: 'http://localhost:18780/index.html' + QUERY.A }); await sleep(1500);
  await host.ev(`document.querySelector('#btn-create').click()`); await sleep(1200);
  const link = await host.ev('location.href');
  log('anfitrião cria a sala (link com prova do anfitrião)', /&h=/.test(link) ? 'ok' : 'sem &h=', /&h=/.test(link));
  const plan = ['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C'];
  const G = [];
  for (let i = 0; i < plan.length; i++) {
    const p = await page(plan[i] + (i + 1)); p.house = plan[i]; G.push(p);
    await p.cmd('Page.navigate', { url: urlFor(link, plan[i]) }); await sleep(700);
    await p.ev(`document.querySelector('#btn-preview-go').click()`);
  }
  host.house = 'A';
  const all = [host, ...G];
  const inH = h => all.filter(p => p.house === h);
  let t = await until(() => allCount(all, 10), 60);
  log('10 pessoas em 3 redes diferentes conectadas', t || (await Promise.all(all.map(count))).join(' '), !!t);

  // 2) P2P: casa A conecta direto entre si; B e C (CGNAT/VPN) ficam no relay
  t = await until(async () => (await host.ev(`__nevoa.directPeers().length`)) === 3, 30);
  log('casa A: conexão direta (P2P) entre os 4 da fibra', t ? 'anfitrião direto com 3' : 'direto com ' + await host.ev(`__nevoa.directPeers().length`), !!t);
  const bDirect = await G[1].ev(`__nevoa.directPeers().length`);
  log('casas B e C (sem P2P) seguem pelo relay', 'diretos em B: ' + bDirect, bDirect === 0);

  // 3) latência: direto × relay
  const dA = await deliveryMs(G[0], G[3], 'lat fibra-fibra');
  const dB = await deliveryMs(G[0], G[1], 'lat fibra-4g');
  log('latência fibra → fibra (P2P)', dA + ' ms', dA < 120);
  log('latência fibra → 4G (relay)', dB + ' ms', dB < 2000);
  log('P2P mais rápido que o relay', (dB - dA) + ' ms a menos', dA < dB);

  // 4) quem está na VPN (só 443) e no 4G fala com todos
  await say(G[2], 'oi da vpn');
  t = await until(() => allHave(all.filter(p => p !== G[2]), 'oi da vpn'), 15);
  log('VPN (só porta 443) → mensagem chega aos outros 9', t || 'faltou: ' + await missing(all.filter(p => p !== G[2]), 'oi da vpn'), !!t);
  await say(G[4], 'oi do 4g');
  t = await until(() => allHave(all.filter(p => p !== G[4]), 'oi do 4g'), 15);
  log('4G/CGNAT → mensagem chega aos outros 9', t || 'faltou: ' + await missing(all.filter(p => p !== G[4]), 'oi do 4g'), !!t);
  t = await until(async () => (await G[4].ev(`[...document.querySelectorAll('#msg-list .msg.out')].slice(-1)[0]?.querySelector('.ticks')?.className`))?.includes('t-read'), 15);
  log('✓✓ azul quando os 9 leram', t || 'não ficou azul', !!t);

  // 5) mensagens simultâneas, sem duplicar
  await Promise.all([0, 1, 2, 3, 5].map(i => say(G[i], 'simultanea ' + i)));
  t = await until(async () => (await host.ev(`[...document.querySelectorAll('#msg-list .msg .txt')].filter(e=>e.textContent.startsWith('simultanea')).length`)) === 5, 15);
  log('5 mensagens simultâneas chegam', t || 'faltou', !!t);
  const dup = await G[6].ev(`[...document.querySelectorAll('#msg-list .msg .txt')].filter(e=>e.textContent==='oi da vpn').length`);
  log('sem duplicatas (P2P + 3 brokers → 1 mensagem)', String(dup), dup === 1);

  // 6) digitando
  await G[5].ev(`(()=>{const i=document.querySelector('#input');i.value='abc';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  t = await until(async () => /digitando/.test(await host.ev(`document.querySelector('#peer-status-h').textContent`)), 8);
  log('anfitrião vê "Fulano está digitando"', t ? await host.ev(`document.querySelector('#peer-status-h').textContent`) : 'não viu', !!t);
  await G[5].ev(`(()=>{const i=document.querySelector('#input');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);

  // 7) arquivo de 300 KB (P2P para a casa A, relay para B e C)
  await G[0].ev(`(()=>{const f=new File([new Uint8Array(300000).map((_,i)=>i%251)],'grupo.bin');const dt=new DataTransfer();dt.items.add(f);const inp=document.querySelector('#file-input');inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  const fileOk = p => p.ev(`[...document.querySelectorAll('#msg-list .msg.in')].some(m=>/grupo\\.bin/.test(m.textContent)&&!!m.querySelector('a[download]'))`);
  t = await until(async () => (await Promise.all(all.filter(p => p !== G[0]).map(fileOk))).every(Boolean), 60);
  log('arquivo 300 KB chega aos outros 9 (inclusive 4G lento)', t || (await Promise.all(all.filter(p => p !== G[0]).map(fileOk))).map(x => x ? 1 : 0).join(''), !!t);

  // 8) um broker cai para todo mundo
  B.b1.kill(); await sleep(1500);
  await say(G[1], 'apos queda do broker');
  t = await until(() => allHave(all.filter(p => p !== G[1]), 'apos queda do broker'), 15);
  log('broker principal cai → conversa segue pelos outros', t || 'faltou: ' + await missing(all.filter(p => p !== G[1]), 'apos queda do broker'), !!t);

  // 9) casa B fica 12 s sem internet
  H.b1.cut(); H.b2.cut(); H.b3.cut(); await sleep(12000);
  log('durante a queda, a casa B mostra "reconectando"', await G[1].ev(`document.querySelector('#peer-status-h').textContent`), !(await connected(G[1])));
  // a internet volta, mas o broker que a VPN usa continua fora para a casa B:
  // a mensagem da casa B só chega à VPN se alguém fizer a ponte entre os brokers
  H.b1.restore(); H.b2.restore();
  t = await until(async () => (await Promise.all(all.map(connected))).every(Boolean) && await allCount(all, 10), 30);
  log('casa B volta sozinha', t || 'não voltou', !!t);
  await say(G[1], 'voltei da queda');
  t = await until(() => allHave(all.filter(p => p !== G[1]), 'voltei da queda'), 15);
  log('mensagem depois da queda chega a todos', t || 'faltou: ' + await missing(all.filter(p => p !== G[1]), 'voltei da queda'), !!t);
  log('  (casa B sem o broker da VPN: chegou pela ponte)', (await G[1].ev(`__nevoa.R.links[2].ready`)) ? 'broker da VPN já estava pronto' : 'sim', true);
  H.b3.restore();

  // 9b) conexão da casa B com o broker da VPN trava sem fechar (parece ativa, mas não entrega nada):
  // a casa B ainda anuncia esse broker, então só quem olha por onde a mensagem REALMENTE chegou faz a ponte
  await sleep(3000);
  H.b3.freeze();
  await say(G[4], 'com conexao meio travada');
  t = await until(() => allHave(inH('C'), 'com conexao meio travada'), 8);
  log('conexão travada no meio do caminho → ponte entrega à VPN', t || 'faltou: ' + await missing(inH('C'), 'com conexao meio travada'), !!t);
  t = await until(async () => (await Promise.all(inH('B').map(connected))).every(Boolean) && await allCount(all, 10), 40);
  log('casa B se recupera da conexão travada', t || 'não recuperou', !!t);

  // 10) casa C troca de rede (Wi-Fi → 4G): conexões abertas travam sem fechar
  const C = inH('C');
  await Promise.all(C.map(p => p.ev(`__nevoa.R.links.forEach(l => { if (l.ws) l.ws.__antiga = 1; })`)));
  H.c3.freeze();
  // recuperou = abriu um WebSocket novo e ficou pronto (o antigo travado foi descartado)
  t = await until(async () => (await Promise.all(C.map(p => p.ev(`__nevoa.R.links.some(l => l.ready && l.ws && !l.ws.__antiga)`)))).every(Boolean), 60);
  log('casa C: conexão travada é detectada e refeita', t || 'não recuperou em 60 s', !!t);
  await say(G[2], 'teste pos troca de rede');
  t = await until(() => allHave(all.filter(p => p !== G[2]), 'teste pos troca de rede'), 15);
  log('mensagem da casa C depois da troca de rede', t || 'não chegou', !!t);
  const saiu = await host.ev(`[...document.querySelectorAll('.sys-pill')].filter(e=>/saiu/.test(e.textContent)).length`);
  log('troca de rede não gera "saiu" para os outros', saiu + ' aviso(s)', saiu === 0);

  // 11) relay da casa A cai inteiro, mas o P2P segura a conversa entre eles
  H.a1.cut(); H.a2.cut(); H.a3.cut(); await sleep(1500);
  await say(G[3], 'so pelo p2p');
  t = await until(() => allHave(inH('A').filter(p => p !== G[3]), 'so pelo p2p'), 10);
  log('casa A sem relay: P2P mantém a conversa entre eles', t || 'não chegou', !!t);
  H.a1.restore(); H.a2.restore(); H.a3.restore();
  t = await until(async () => (await Promise.all(inH('A').map(p => p.ev('__nevoa.S.linkUp')))).every(Boolean), 30);
  log('relay da casa A volta sozinho', t || 'não voltou', !!t);

  // 12) 11ª pessoa
  const X = await page('visitante');
  await X.cmd('Page.navigate', { url: urlFor(link, 'B') }); await sleep(800); await X.ev(`document.querySelector('#btn-preview-go').click()`);
  t = await until(async () => (await view(X)) === 'view-ended', 25);
  log('11ª pessoa recebe "Sala cheia"', t ? await X.ev(`document.querySelector('#ended-title').textContent`) : await view(X), !!t);
  await sleep(2500);
  const cnts = await Promise.all(all.map(count));
  log('grupo continua com 10', cnts.every(c => c === '10/10') ? '10/10 em todos' : cnts.join(' '), cnts.every(c => c === '10/10'));

  // 13) qualquer um apaga qualquer mensagem; convidado não encerra a sala
  await say(host, 'msg do anfitriao'); await until(() => has(G[2], 'msg do anfitriao'), 10);
  await G[2].ev(`(()=>{const n=[...document.querySelectorAll('#msg-list .msg.in')].find(m=>m.querySelector('.txt')?.textContent==='msg do anfitriao');n.querySelector('[data-action=delete]').click();document.querySelector('#btn-del-everyone').click()})()`);
  t = await until(async () => !(await Promise.all(all.map(p => has(p, 'msg do anfitriao')))).some(Boolean), 10);
  log('convidado apaga msg do anfitrião para todos', t || 'ainda aparece', !!t);
  await G[5].ev(`__nevoa.sendJSON({ t:'end', secret:'AAAAAAAAAAAAAAAAAAAAAA' })`); await sleep(3000);
  const vs = await Promise.all(all.map(view));
  log('convidado NÃO consegue encerrar para todos', vs.every(v => v === 'view-chat') ? 'ninguém caiu' : vs.join(','), vs.every(v => v === 'view-chat'));

  // 14) convidado sai pelo botão
  await G[8].ev(`document.querySelector('#btn-end').click()`); await sleep(300); await G[8].ev(`document.querySelector('#btn-confirm-ok').click()`);
  t = await until(() => allCount(all.slice(0, 9), 9), 15);
  log('convidado sai → todos veem 9/10', t || 'não atualizou', !!t);
  t = await until(async () => /saiu/.test(await host.ev(`[...document.querySelectorAll('.sys-pill')].map(e=>e.textContent).join()`)), 3);
  log('aviso "saiu da conversa" aparece na hora', t ? 'sim' : 'não', !!t);

  // 15) anfitrião fecha a aba → grupo continua e o admin passa para quem entrou primeiro (A1)
  const rest = G.slice(0, 8);
  const isAdm = p => p.ev('__nevoa.iAmAdmin()');
  log('antes: anfitrião é o admin', (await isAdm(host)) ? 'sim' : 'não', await isAdm(host));
  await host.cmd('Page.navigate', { url: 'about:blank' });
  t = await until(() => allCount(rest, 8), 20);
  log('anfitrião fecha a aba → os 8 seguem', t || 'caiu', !!t);
  await say(G[1], 'sem anfitriao');
  t = await until(() => allHave(rest.filter(p => p !== G[1]), 'sem anfitriao'), 15);
  log('conversa continua sem o anfitrião', t || 'faltou: ' + await missing(rest.filter(p => p !== G[1]), 'sem anfitriao'), !!t);
  t = await until(() => isAdm(G[0]), 15);
  log('admin passa para o 1º a entrar (A1)', t || 'não passou', !!t);
  const admId = await G[0].ev('__nevoa.S.myId');
  t = await until(async () => (await Promise.all(rest.map(p => p.ev('__nevoa.activeAdminId()')))).every(a => a === admId), 15);
  log('todos concordam que A1 é o admin', t || 'divergência', !!t);
  log('botão do novo admin', await G[0].ev(`document.querySelector('#btn-end-label').textContent`), /admin/.test(await G[0].ev(`document.querySelector('#btn-end-label').textContent`)));
  t = await until(async () => /agora é o admin/.test(await G[3].ev(`[...document.querySelectorAll('.sys-pill')].map(e=>e.textContent).join()`)), 15);
  log('aviso "Fulano agora é o admin" para os outros', t ? 'sim' : 'não apareceu', !!t);

  // 16) novo admin dá F5: continua admin, sem avisos
  await sleep(2000);
  const antes = await G[1].ev(`document.querySelectorAll('.sys-pill').length`);
  await G[0].cmd('Page.reload'); await sleep(1500); await G[0].ev(`document.querySelector('#btn-preview-go')?.click()`);
  t = await until(() => allCount(rest, 8), 25);
  log('admin dá F5 → volta à conversa', t || 'não voltou', !!t);
  t = await until(() => isAdm(G[0]), 15);
  log('após F5 continua admin', t || 'perdeu o admin', !!t);
  t = await until(async () => (await G[0].ev(`__nevoa.directPeers().length`)) >= 1, 20);
  log('após F5, P2P com a casa A é refeito', t || 'não refez', !!t);
  await sleep(9000);
  const depois = await G[1].ev(`document.querySelectorAll('.sys-pill').length`);
  log('F5 do admin não gera avisos', 'avisos novos: ' + (depois - antes), depois === antes);

  // 17) anfitrião volta e retoma o admin; depois fecha de novo e o admin volta para A1
  await host.cmd('Page.navigate', { url: link }); await sleep(1500);
  t = await until(() => allCount([host, ...rest], 9), 25);
  log('anfitrião volta (mesma aba)', t || await count(host), !!t);
  t = await until(async () => (await isAdm(host)) && !(await isAdm(G[0])), 15);
  log('anfitrião retoma o admin', t || 'não retomou', !!t);
  await host.cmd('Page.navigate', { url: 'about:blank' });
  t = await until(() => isAdm(G[0]), 15);
  log('anfitrião sai de novo → A1 volta a ser admin', t || 'não voltou', !!t);

  // 18) A1 sai passando o admin → B2 (2º a entrar) assume
  await G[0].ev(`document.querySelector('#btn-end').click()`); await sleep(400);
  const leaveTxt = await G[0].ev(`document.querySelector('#btn-adm-leave')?.textContent`);
  log('menu do admin oferece "Sair e passar o admin"', leaveTxt || 'sem menu', /passar o admin/.test(leaveTxt || ''));
  await G[0].ev(`document.querySelector('#btn-adm-leave').click()`);
  const rest2 = G.slice(1, 8);
  t = await until(() => isAdm(G[1]), 15);
  log('A1 sai → admin passa para B2 (4G, nunca foi anfitrião)', t || 'não passou', !!t);
  t = await until(() => allCount(rest2, 7), 15);
  log('todos veem 7/10', t || 'não atualizou', !!t);

  // 19) quem não é admin não encerra, nem com assinatura falsa
  await G[4].ev(`__nevoa.sendJSON({ t:'end', ts: Date.now(), apk: 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', sig: 'AAAA' })`);
  await sleep(3000);
  const vs2 = await Promise.all(rest2.map(view));
  log('assinatura falsa de "encerrar" é ignorada', vs2.every(v => v === 'view-chat') ? 'ninguém caiu' : vs2.join(','), vs2.every(v => v === 'view-chat'));

  // 20) o novo admin (B2) encerra para todos
  const ids = await Promise.all(rest2.map(p => p.ev('__nevoa.S.myId')));
  await G[1].ev(`document.querySelector('#btn-end').click()`); await sleep(400); await G[1].ev(`document.querySelector('#btn-adm-end').click()`);
  t = await until(async () => (await Promise.all(rest2.map(view))).every(v => v === 'view-ended'), 15);
  log('novo admin encerra → todos apagados', t ? await G[2].ev(`document.querySelector('#ended-title').textContent`) : (await Promise.all(rest2.map(view))).join(','), !!t);
  // (todas as abas do teste dividem o mesmo navegador: confere só os dados de cada participante)
  const left = await Promise.all(rest2.map((p, i) => p.ev(`Object.keys(localStorage).filter(k=>k.startsWith('nevoa:v1:') && k.endsWith(${JSON.stringify(ids[i])})).length + Object.keys(sessionStorage).filter(k=>k.startsWith('nevoa:adm:') || k.startsWith('nevoa:me:')).length + document.querySelectorAll('#msg-list .msg').length + __nevoa.S.peers.size`)));
  log('nada sobrou (storage, chave de admin, tela, P2P)', left.join(','), left.every(x => x === 0));

  const errs = [...all, X].flatMap(p => p.errs);
  log('erros de JavaScript em todas as abas', errs.length ? errs.slice(0, 3).join(' | ') : 'nenhum', !errs.length);
} catch (e) {
  fails++; console.error('✘ teste abortado:', e);
} finally {
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  chrome.kill(); web.close(); Object.values(H).forEach(h => h.close()); Object.values(B).forEach(b => b.close());
  setTimeout(() => process.exit(fails ? 1 : 0), 300);
}
