/* Névoa — chat anônimo P2P efêmero. MIT © 2026 Lebot007 */
(() => {
'use strict';

/* ───────── constantes ───────── */
const CHUNK = 12 * 1024;                 // bytes por pedaço de arquivo
const MAX_FILE = 8 * 1024 * 1024;        // 8 MB
const MAX_TEXT = 4000;
const TTL = 12 * 3600 * 1000;            // histórico local cifrado: 12 h
const MAX_STORE = 300;
const PREFIX = 'nevoa-';
const BASE_TITLE = 'Névoa — chat anônimo e efêmero';
const QR_URLS = [
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'
];
const MAX_MEMBERS = 10;               // contando o anfitrião
const ADMIT_WAIT = 3500;              // ao entrar, espera as apresentações antes de contar a sala
const WIRE_V = 2;                     // versão do quadro no fio
const ANIMALS = ['Corvo','Raposa','Lince','Garça','Orca','Falcão','Jaguar','Coruja','Lobo','Axolote','Pantera','Grou'];
const ADJS = ['Âmbar','Cobalto','Carmim','Violeta','Grafite','Turquesa','Escarlate','Índigo','Dourado','Prateado','Obsidiana','Ciano'];
const AV = [['#7C5CFF','#B44DFF'],['#35E0E6','#2E7CFF'],['#FF4D9E','#FF8A5C'],['#3DDC97','#35E0E6'],
            ['#FFB020','#FF5468'],['#55A6FF','#7C5CFF'],['#C24DFF','#FF4D9E'],['#2ECCB0','#7CE05C']];
const REACTIONS = ['👍','❤️','😂','😮','😢','🙏'];
const PBKDF2_ITER = 150000;
const EMOJIS = ['😀','😄','😂','🙂','😉','😍','😘','🤔','😎','🥳','😢','😡','👍','👎','🙏','😭','💪','🔥','✨','❤️','💜','💙','🎉','🎁','☕','🍕','🎂','🌙','⭐','👀','🤝','✅','❌','⏳','🔒','🎵','🚀','😴','🤯','😅','🙃','😇','🤫','🫶','💡','⚡','🌈','📎','🗑️'];

/* ───────── utilitários ───────── */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const te = new TextEncoder(), td = new TextDecoder();
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const hex = u => [...u].map(b => b.toString(16).padStart(2, '0')).join('');
const uid = () => hex(rand(8));
const pick = a => a[Math.floor(Math.random() * a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const b64u = u => { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const ub64 = s => { s = String(s).replace(/-/g,'+').replace(/_/g,'/'); while (s.length % 4) s += '=';
  const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n/1024).toFixed(1).replace('.',',') + ' KB' : (n/1048576).toFixed(1).replace('.',',') + ' MB';
const fmtTime = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const truncName = s => s.length > 28 ? s.slice(0, 26) + '…' : s;
function richText(raw){
  let s = String(raw).replace(/\u0000/g, '');
  const blocks = [], inlines = [];
  s = s.replace(/```([^]*?)```/g, (m, c) => { blocks.push(c.replace(/^\n/, '').replace(/\n$/, '')); return '\u0000B' + (blocks.length - 1) + '\u0000'; });
  s = s.replace(/`([^`\n]+)`/g, (m, c) => { inlines.push(c); return '\u0000I' + (inlines.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/(https?:\/\/[^\s<]+)/g, m => {
    let url = m, trail = '';
    const t = url.match(/[.,;:!?)\]}'"]+$/);
    if (t) { trail = t[0]; url = url.slice(0, -trail.length); }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000I(\d+)\u0000/g, (m, i) => `<code class="inline">${esc(inlines[+i])}</code>`);
  s = s.replace(/\u0000B(\d+)\u0000/g, (m, i) => `<div class="code-block"><pre>${esc(blocks[+i])}</pre><button class="cb-copy" type="button">copiar</button></div>`);
  return s;
}
function loadLib(urls){
  return new Promise((res, rej) => {
    const tryAt = i => {
      if (i >= urls.length) return rej(new Error('lib'));
      const s = document.createElement('script');
      s.src = urls[i]; s.onload = res; s.onerror = () => tryAt(i + 1);
      document.head.appendChild(s);
    };
    tryAt(0);
  });
}
const svg = (inner, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  lock: svg('<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  alert: svg('<path d="M12 3 2.5 20h19z"/><path d="M12 10v4m0 3h.01"/>'),
  file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  image: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 5-4 3 2 4-3 2 2"/>'),
  download: svg('<path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M5 20h14"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  retry: svg('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  check1: svg('<path d="M4 8l4 4 9-10"/>', '0 0 22 14'),
  check2: svg('<path d="M1.5 8.5l3.5 3.5 8-9.5"/><path d="M10 10.5l1.5 1.5 8-9.5"/>', '0 0 22 14'),
  reply: svg('<path d="M9 17 4 12l5-5"/><path d="M4 12h10a6 6 0 0 1 6 6v2"/>'),
  smile: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
  edit: svg('<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>'),
  pin: svg('<path d="M12 17v5"/><path d="M9 3h6l1 7 2.5 2.5H5.5L8 10z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>')
};

/* ───────── estado ───────── */
function genMe(){ return { name: pick(ANIMALS) + ' ' + pick(ADJS), color: Math.floor(Math.random() * AV.length), auto: true }; }
const S = {
  role: null, roomId: null, keyB64: null, cryptoKey: null,
  connected: false, wasConnected: false, ended: false, linkUp: false, admitted: false, admitAt: 0,
  myId: null, myIdBytes: null, joinedAt: 0, members: new Map(), hostTag: null,
  seen: new Map(), mySent: new Map(), sentAt: new Map(), leaveFrame: null, gone: new Map(),
  peers: new Map(), rtcStash: new Map(), p2pFails: new Map(), p2pRetry: new Map(), returning: false,
  bootId: hex(rand(4)),                 // muda a cada carregamento da página (F5)
  helloSeq: 0,
  adminKey: null, dh: null, keySent: new Map(), adminNoteTimer: 0, adminNoted: undefined,
  deadBoots: new Set(),                 // páginas que disseram "saí": um olá atrasado delas não traz ninguém de volta                          // ordem dos "olás": chegam por vários caminhos, às vezes fora de ordem
  view: 'landing', netState: 'idle', me: genMe(), greeted: false,
  messages: [], msgIndex: new Map(), msgNodes: new Map(),
  transfersIn: new Map(), transfersOut: new Map(), outFiles: new Map(), outQueue: [], outBusy: false,
  pendingReads: [], unread: 0, rtt: 0, lastDay: '', pillN: 0,
  typingStop: 0, saveTimer: 0, lastTyping: 0,
  storageOk: true, keyFails: 0, createdAt: 0, soundOn: true, qrLib: false, dragDepth: 0,
  replyTo: null, editingId: null, pinnedId: null, searchQuery: '',
  presence: 'online',
  saltB64: null, hasPassword: false,
  disconnects: 0,
  blurOn: true, p2pPref: true, theme: 'nevoa', accent: '#8B7CFF',
  recorder: null, recChunks: [], recTimer: 0, recStart: 0
};

/* ───────── DOM ───────── */
const msgList = $('#msg-list'), msgScroll = $('#msg-scroll'), emptyState = $('#empty-state');
const input = $('#input'), btnSend = $('#btn-send'), charCount = $('#char-count');
const scrollPill = $('#scroll-pill'), scrollPillN = $('#scroll-pill-n');
const sidebar = $('#sidebar'), scrim = $('#scrim'), chatMain = $('#chat-main'), dropOverlay = $('#drop-overlay');
const emojiPop = $('#emoji-pop'), fileInput = $('#file-input');
const latency = $('#latency'), waitStatus = $('#wait-status');
const modalConfirm = $('#modal-confirm'), modalName = $('#modal-name'), lightbox = $('#lightbox');
const toasts = $('#toasts');

/* ───────── toasts ───────── */
function toast(type, msg){
  while (toasts.children.length >= 4) toasts.firstChild.remove();
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `${type === 'ok' ? ICONS.check1 : type === 'info' ? ICONS.info : ICONS.alert}<span>${esc(msg)}</span>`;
  toasts.appendChild(t);
  setTimeout(() => { t.classList.add('bye'); setTimeout(() => t.remove(), 240); }, 3600);
}

/* ───────── som (sintetizado, sem assets) ───────── */
let AC = null, master = null;
function ensureAudio(){
  if (AC) return;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    AC = new C(); master = AC.createGain(); master.gain.value = .5; master.connect(AC.destination);
  } catch {}
}
function tone(f0, f1, dur, type, vol, when = 0){
  if (!AC || AC.state !== 'running') return;
  const t = AC.currentTime + when;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + .015);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + .05);
}
function sound(n){
  if (!S.soundOn || !AC) return;
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  if (n === 'send') tone(760, 1180, .1, 'sine', .25);
  else if (n === 'recv') tone(640, 470, .12, 'sine', .2);
  else if (n === 'connect') { tone(523, 523, .12, 'sine', .22); tone(784, 784, .16, 'sine', .22, .1); }
  else if (n === 'file') { tone(660, 880, .09, 'sine', .2); tone(880, 1100, .12, 'sine', .18, .08); }
  else if (n === 'end') tone(420, 150, .4, 'triangle', .18);
  else if (n === 'error') tone(200, 140, .18, 'square', .1);
}
function renderSound(){
  $('#ic-sound-on').hidden = !S.soundOn;
  $('#ic-sound-off').hidden = S.soundOn;
  $('#btn-sound').setAttribute('aria-pressed', String(S.soundOn));
}
function toggleSound(){
  S.soundOn = !S.soundOn;
  try { localStorage.setItem('nevoa:pref:sound', S.soundOn ? '1' : '0'); } catch {}
  renderSound();
  if (S.soundOn) { ensureAudio(); if (AC) AC.resume().catch(() => {}); sound('send'); }
  toast('info', S.soundOn ? 'Sons ativados.' : 'Sons desativados.');
}

/* ───────── views ───────── */
function showView(v){
  S.view = v;
  document.body.dataset.view = v;
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  document.body.classList.toggle('app-mode', v !== 'landing');
  window.scrollTo(0, 0);
  if (v === 'chat') {
    requestAnimationFrame(() => scrollToBottom(false));
    if (innerWidth >= 960) input.focus();
  }
  refreshConnHelp();
}
function showError(msg){ $('#error-text').textContent = msg; showView('error'); }

/* ───────── perfis / status ───────── */
function setAvatar(el, p){
  if (p) {
    el.classList.remove('avatar-ghost');
    const c = AV[Math.abs(p.color) % AV.length];
    el.style.background = `linear-gradient(135deg,${c[0]},${c[1]})`;
    el.textContent = (p.name || '?').trim().charAt(0).toUpperCase();
  } else { el.classList.add('avatar-ghost'); el.style.background = ''; el.textContent = '?'; }
}
function renderMe(){
  setAvatar($('#me-avatar'), S.me);
  $('#me-name').textContent = S.me.name;
  const adm = iAmAdmin();
  $('#me-role').textContent = 'você · ' + (adm ? 'admin' : S.role ? 'convidado' : '—');
  $('#btn-end-label').textContent = adm ? 'Encerrar ou sair (admin)' : 'Sair da conversa';
  $('#btn-end-top').setAttribute('aria-label', adm ? 'Encerrar para todos ou sair' : 'Sair da conversa');
  $('#btn-end-top').title = adm ? 'Encerrar para todos ou sair' : 'Sair da conversa';
}
function renderMembers(){
  const box = $('#member-list');
  if (box) {
    const list = admittedMembers();
    const admin = activeAdminId();
    box.innerHTML = list.length ? list.map(m => {
      const c = AV[m.color % AV.length];
      return `<div class="participant"><span class="avatar" style="background:linear-gradient(135deg,${c[0]},${c[1]})">${esc(m.name.charAt(0).toUpperCase())}</span>` +
        `<div class="p-info"><span class="p-name">${esc(m.name)}</span><span class="p-role">${m.id === admin ? 'admin' : 'convidado'}${m.presence === 'away' ? ' · ausente' : ''} · ${isDirect(m.id) ? 'direto' : 'relay'}</span></div>` +
        `<span class="dot dot-${m.presence === 'away' ? 'warn' : 'on'}"></span></div>`;
    }).join('') : '<p class="member-empty">Ninguém mais por aqui ainda. Envie o link — cabem até ' + MAX_MEMBERS + ' pessoas.</p>';
  }
  const n = admittedMembers().length + (S.admitted ? 1 : 0);
  $('#member-count').textContent = n + '/' + MAX_MEMBERS;
  const av = $('#peer-avatar-h');
  av.classList.remove('avatar-ghost'); av.classList.add('avatar-group');
  av.textContent = String(Math.max(1, n));
  $('#peer-name-h').textContent = 'Conversa em grupo';
}
function typingText(){
  const t = admittedMembers().filter(m => m.typing);
  if (!t.length) return '';
  return t.length === 1 ? t[0].name + ' está digitando' : t.length + ' pessoas digitando';
}
function refreshStatus(){
  const on = S.connected;
  const others = admittedMembers().length;
  const typing = on ? typingText() : '';
  let txt, cls;
  if (on) {
    txt = others ? (others + 1) + ' na conversa · criptografado' : 'só você por enquanto · criptografado';
    cls = 'on';
  } else {
    const map = { waiting:['aguardando pessoas…','warn'], connecting:['conectando…','warn'], joining:['entrando na sala…','warn'],
      retry:['reconectando…','warn'], idle:['—','off'] };
    [txt, cls] = map[S.netState] || ['offline','off'];
  }
  $('#peer-status-h').innerHTML = typing ? esc(typing) + '<span class="tdots"><i></i><i></i><i></i></span>' : esc(txt);
  $('#room-status-dot').className = 'dot dot-' + cls;
  $('#room-status-text').textContent = txt;
  waitStatus.textContent = !on ? (S.linkUp ? 'Entrando na sala…' : 'Conectando ao relay cifrado…')
    : (others ? txt : 'Aguardando pessoas entrarem… (até ' + MAX_MEMBERS + ')');
  latency.hidden = !on;
  updateSendBtn();
  refreshConnHelp();
}
function setStatus(k){ S.netState = k; refreshStatus(); }
function bestRtt(){
  const d = directPeers().map(p => p.rtt).filter(Boolean).sort((a, b) => a - b);
  return d.length ? d[Math.floor(d.length / 2)] : S.rtt;          // mediana do caminho direto, senão o relay
}
function renderLatency(){
  const r = bestRtt();
  latency.textContent = r + ' ms';
  latency.dataset.q = r < 150 ? 'good' : r < 400 ? 'ok' : 'bad';
  latency.title = directPeers().length ? 'Conexão direta com ' + directPeers().length + ' pessoa(s)' : 'Via relay cifrado';
}

/* ───────── criptografia ───────── */
const importKey = bytes => crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
// quadro no fio: [versão][remetente 8][iv 12][cifra]. Versão e remetente entram como AAD:
// ninguém consegue trocar o remetente de um quadro sem a chave.
async function makeFrame(kind, body){
  const iv = rand(12), head = new Uint8Array(9);
  head[0] = WIRE_V; head.set(S.myIdBytes, 1);
  const plain = new Uint8Array(1 + body.length); plain[0] = kind; plain.set(body, 1);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: head }, S.cryptoKey, plain));
  const f = new Uint8Array(21 + ct.length); f.set(head, 0); f.set(iv, 9); f.set(ct, 21);
  return f;
}
async function sendJSON(o, opts){
  if (!S.cryptoKey || S.ended || !S.myIdBytes || !R.on) return false;
  try { const f = await makeFrame(1, te.encode(JSON.stringify(o))); return netSend(f, opts); }
  catch { return false; }
}
function keyFail(){
  S.keyFails++;
  if (S.keyFails === 1) toast('error', 'Falha de criptografia — o link pode estar incorreto.');
  if (S.keyFails >= 3 && !S.connected) showError('As chaves não conferem. Peça um novo link a quem te convidou.');
}
/* ───────── persistência local cifrada ───────── */
const skey = () => 'nevoa:v1:' + S.roomId + ':' + S.myId;   // por participante: abas no mesmo navegador não se misturam
const rkey = (id) => 'nevoa:role:' + (id || S.roomId);
function buildPayload(){
  return {
    v: 1, createdAt: S.createdAt, me: S.me, greeted: S.greeted, pinnedId: S.pinnedId,
    messages: S.messages.slice(-MAX_STORE).map(m => {
      const b = { id: m.id, kind: m.kind, dir: m.dir, ts: m.ts, status: m.status };
      if (m.from) { b.from = m.from; b.fromName = m.fromName; b.fromColor = m.fromColor; }
      if (m.replyTo) b.replyTo = m.replyTo;
      if (m.reactions && Object.keys(m.reactions).length) b.reactions = m.reactions;
      if (m.edited) b.edited = true;
      if (m.kind === 'text' || m.kind === 'sys') { b.text = m.text; if (m.icon) b.icon = m.icon; }
      if (m.kind === 'file') { b.name = m.name; b.size = m.size; b.mime = m.mime; b.status = 'expired'; }
      else if (b.status === 'sending' || b.status === 'receiving') b.status = 'failed';
      return b;
    })
  };
}
function saveSoon(){ clearTimeout(S.saveTimer); S.saveTimer = setTimeout(saveNow, 250); }
async function saveNow(){
  if (S.ended || !S.cryptoKey || !S.storageOk || !S.roomId) return;
  try {
    const iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, S.cryptoKey, te.encode(JSON.stringify(buildPayload()))));
    if (S.ended) return;
    localStorage.setItem(skey(), JSON.stringify({ v: 1, exp: Date.now() + TTL, iv: b64u(iv), ct: b64u(ct) }));
  } catch {
    S.storageOk = false;
    toast('warn', 'Armazenamento local indisponível — a conversa fica só na memória.');
  }
}
async function restore(){
  try {
    const raw = localStorage.getItem(skey());
    if (!raw) return;
    const o = JSON.parse(raw);
    if (!o.exp || o.exp < Date.now()) { localStorage.removeItem(skey()); return; }
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(o.iv) }, S.cryptoKey, ub64(o.ct));
    const d = JSON.parse(td.decode(pt));
    if (d.v !== 1) return;
    S.createdAt = d.createdAt || Date.now();
    if (d.me && d.me.name) S.me = d.me;
    S.greeted = !!d.greeted;
    if (d.pinnedId) S.pinnedId = d.pinnedId;
    (d.messages || []).forEach(m => { normReactions(m); S.messages.push(m); S.msgIndex.set(m.id, m); appendMessage(m, true); });
    if (S.messages.length) {
      const sm = sysMsg('Histórico local restaurado — cifrado apenas neste dispositivo.', 'info');
      S.messages.push(sm); S.msgIndex.set(sm.id, sm); appendMessage(sm, true);
      scrollToBottom(false);
    }
    if (S.pinnedId && !S.msgIndex.has(S.pinnedId)) S.pinnedId = null;
    renderPinned(); markPinned();
  } catch { try { localStorage.removeItem(skey()); } catch {} }
}
function sweepStorage(){
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('nevoa:v1:')) {
        try { const o = JSON.parse(localStorage.getItem(k)); if (!o.exp || o.exp < Date.now()) localStorage.removeItem(k); }
        catch { localStorage.removeItem(k); }
      }
    }
  } catch {}
}

/* ───────── rede em grupo: canal cifrado no relay (MQTT público sobre WebSocket) ─────────
   Cada sala é um canal. Todos publicam e recebem nele; os quadros já saem cifrados
   (AES-256-GCM) do navegador. Os brokers só veem bytes cifrados — a chave fica no link.
   Vários brokers em paralelo: se um cai ou é bloqueado na rede de alguém, os outros seguem. */
const RELAYS_DEFAULT = [
  { url: 'wss://broker.emqx.io:8084/mqtt' },
  { url: 'wss://broker.hivemq.com:8884/mqtt' },
  { url: 'wss://mqtt.eclipseprojects.io/mqtt' },             // porta 443: passa por VPN e firewall corporativo
  { url: 'wss://demo.tbmq.io/mqtt', user: 'demo' },           // porta 443
  { url: 'wss://test.mosquitto.org:8081/mqtt' }
];
// só em localhost (desenvolvimento/testes): ?relays=ws://...,ws://... e ?nop2p=1
const IS_DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const QS = new URLSearchParams(location.search);
const RELAYS = IS_DEV && QS.get('relays') ? QS.get('relays').split(',').filter(Boolean).map(u => ({ url: u })) : RELAYS_DEFAULT;
const P2P_OK = !(IS_DEV && QS.get('nop2p') === '1') && typeof RTCPeerConnection === 'function';
// P2P revela o IP aos outros participantes (como qualquer WebRTC): a pessoa pode desligar
const p2pOn = () => P2P_OK && S.p2pPref;
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const R = { on: false, gen: 0, links: [], topic: '', hb: 0, prune: 0, lastAnnounce: 0 };

function mqttPacket(head, ...parts){
  let len = 0; parts.forEach(p => { len += p.length; });
  const h = [head]; let n = len;
  do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; h.push(b); } while (n > 0);
  const out = new Uint8Array(h.length + len); out.set(h, 0);
  let o = h.length; parts.forEach(p => { out.set(p, o); o += p.length; });
  return out;
}
const mqttStr = str => { const b = te.encode(str); const o = new Uint8Array(2 + b.length); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; };

function relayLink(cfg, idx, gen){
  const url = cfg.url;
  const L = { url, idx, ws: null, ready: false, dead: false, ka: 0, timer: 0, ct: 0, fails: 0, lastRx: 0, buf: new Uint8Array(0) };
  // espera crescente entre tentativas: 1 s, 2 s, 4 s… até 10 s (com variação para não sincronizar todo mundo)
  const backoff = () => Math.min(10000, 1000 * 2 ** Math.min(L.fails, 4)) * (.75 + Math.random() * .5);
  const schedule = ms => { clearTimeout(L.timer); if (!L.dead && R.gen === gen) L.timer = setTimeout(open, ms); };
  function packet(first, body){
    const type = first >> 4, ws = L.ws;
    if (type === 2) {                                   // CONNACK
      if (body[1] !== 0) { reset(); return; }
      ws.send(mqttPacket(0x82, [0, 1], mqttStr(R.topic), [0]));
    } else if (type === 9) {                            // SUBACK: pronto para conversar
      L.ready = true; L.fails = 0; clearTimeout(L.ct);
      onLinkChange();
    } else if (type === 3) {                            // PUBLISH
      if (body.length < 2) return;
      let p = 2 + ((body[0] << 8) | body[1]);
      if ((first >> 1) & 3) p += 2;
      if (p <= body.length) wireRecv(body.slice(p), false, L.idx);
    }
  }
  function feed(chunk){
    const b = new Uint8Array(L.buf.length + chunk.length); b.set(L.buf, 0); b.set(chunk, L.buf.length); L.buf = b;
    for (;;) {
      const buf = L.buf;
      if (buf.length < 2) return;
      let mul = 1, len = 0, i = 1, x;
      do { if (i >= buf.length) return; x = buf[i++]; len += (x & 127) * mul; mul *= 128; } while ((x & 128) && i < 5);
      if (buf.length < i + len) return;
      const first = buf[0], body = buf.subarray(i, i + len);
      L.buf = buf.slice(i + len);
      try { packet(first, body); } catch {}
    }
  }
  // derruba a conexão atual (fechada, travada ou recusada) e agenda outra
  function reset(){
    const ws = L.ws; L.ws = null;
    clearInterval(L.ka); clearTimeout(L.ct);
    if (ws) { ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null; try { ws.close(); } catch {} }
    const was = L.ready; L.ready = false;
    if (was) onLinkChange();
    L.fails++;
    schedule(backoff());
  }
  function open(){
    clearTimeout(L.timer); L.timer = 0;
    if (L.dead || R.gen !== gen) return;
    if (L.ws) return;
    let ws;
    try { ws = new WebSocket(url, 'mqtt'); } catch { L.fails++; schedule(backoff()); return; }
    ws.binaryType = 'arraybuffer'; L.ws = ws; L.buf = new Uint8Array(0); L.lastRx = Date.now();
    L.ct = setTimeout(() => { if (L.ws === ws && !L.ready) reset(); }, 12000);   // não ficou pronto em 12 s
    ws.onopen = () => {
      try {
        const flags = cfg.user ? 0x82 : 0x02;            // sessão limpa (+ usuário quando o broker pede)
        const parts = [mqttStr('MQTT'), [4, flags, 0, 30], mqttStr('nv' + uid() + uid().slice(0, 4))];
        if (cfg.user) parts.push(mqttStr(cfg.user));
        ws.send(mqttPacket(0x10, ...parts));
      } catch {}
      // batimento MQTT a cada 5 s; nada recebido há 13 s = conexão travada (troca de Wi-Fi/4G, celular dormiu).
      // Reconecta bem antes dos 45 s em que os outros considerariam a pessoa fora da sala.
      L.ka = setInterval(() => {
        if (L.ws !== ws) return;
        if (Date.now() - L.lastRx > 13000) { reset(); return; }
        try { if (ws.readyState === 1) ws.send(new Uint8Array([0xC0, 0])); } catch {}
      }, 5000);
    };
    ws.onmessage = e => { L.lastRx = Date.now(); if (e.data instanceof ArrayBuffer) feed(new Uint8Array(e.data)); };
    ws.onerror = () => {};
    ws.onclose = () => { if (L.ws === ws) reset(); };
  }
  L.pub = payload => { try { if (L.ready && L.ws && L.ws.readyState === 1) { L.ws.send(mqttPacket(0x30, mqttStr(R.topic), payload)); return true; } } catch {} return false; };
  L.kick = () => { if (!L.ws) { L.fails = 0; open(); } };
  // ao voltar para a aba / rede voltar: conexão parada há muito tempo provavelmente morreu
  L.check = () => { if (L.ws && Date.now() - L.lastRx > 12000) reset(); else L.kick(); };
  L.close = () => { L.dead = true; clearTimeout(L.timer); clearTimeout(L.ct); clearInterval(L.ka); const ws = L.ws; L.ws = null; if (ws) { ws.onclose = null; try { ws.close(); } catch {} } };
  open();
  return L;
}
const readyLinks = () => R.links.filter(l => l.ready);
const linkMask = () => R.links.reduce((m, l, i) => l.ready ? m | (1 << i) : m, 0);

/* envio: cada quadro vai direto (P2P) para quem está conectado direto e pelo relay.
   Texto/controle: relay por todos os brokers prontos (redundância; quem recebe descarta cópias).
   Arquivos: relay só para quem NÃO está direto, pelo menor conjunto de brokers que alcança essas pessoas. */
function coverLinks(members){
  const ready = R.links.filter(l => l.ready);
  let left = (members || admittedMembers()).map(m => m.ln || 0).filter(x => x);
  const pick = [];
  while (left.length) {
    let best = null, bc = 0;
    for (const l of ready) {
      if (pick.includes(l)) continue;
      const c = left.filter(x => x & (1 << l.idx)).length;
      if (c > bc) { bc = c; best = l; }
    }
    if (!best) break;
    pick.push(best); left = left.filter(x => !(x & (1 << best.idx)));
  }
  return pick.length ? pick : ready.slice(0, 1);
}
const relayOnly = () => admittedMembers().filter(m => !isDirect(m.id));
function netSend(f, opts = {}){
  let n = 0;
  directPeers().forEach(p => { try { if (p.dc.bufferedAmount < 8 * 1048576) { p.dc.send(f); n++; } } catch {} });
  let ls;
  if (opts.cover) { const need = relayOnly(); ls = need.length ? coverLinks(need) : []; }
  else ls = readyLinks();
  let r = 0; ls.forEach(l => { if (l.pub(f)) r++; });
  if (n + r) {
    const k = hex(f.subarray(9, 21));
    S.mySent.set(k, Date.now()); trimMap(S.mySent, 3000);
    if (opts.rtt && r) S.sentAt.set(k, Date.now()), trimMap(S.sentAt, 200);
  }
  return n + r > 0;
}
/* ponte entre brokers: se alguém só alcança brokers que o remetente não usa (ex.: VPN só com a porta 443,
   ou um broker ainda reconectando), outro participante repassa o quadro. São os mesmos bytes cifrados;
   quem recebe descarta cópias.
   A decisão usa POR ONDE o quadro realmente chegou (não o que cada um anunciou, que fica desatualizado
   logo depois de uma queda): se ele não apareceu em nenhum broker que o destinatário escuta, o primeiro
   da fila repassa; se esse não conseguir, o próximo repassa um pouco depois, e assim por diante. */
function relayForward(f, from, k){
  if (!S.admitted || !R.on) return;
  const targets = [...S.members.values()].filter(m => m.id !== from && m.ln);
  if (!targets.length) return;
  const order = [...admittedMembers().map(x => x.id), S.myId].filter(id => id !== from).sort();
  const rank = Math.max(0, order.indexOf(S.myId));
  setTimeout(() => {
    if (!R.on || S.ended || !S.admitted) return;
    const seenMask = S.seen.get(k) || 0;
    const out = new Set(), dc = new Set();
    for (const m of targets) {
      if (!S.members.has(m.id) || (m.ln & seenMask)) continue;   // já está num broker que ele escuta
      if (isDirect(m.id)) { dc.add(m.id); continue; }
      const l = R.links.find(x => x.ready && (m.ln & (1 << x.idx)));
      if (l) out.add(l);
    }
    out.forEach(l => { if (l.pub(f)) S.seen.set(k, (S.seen.get(k) || 0) | (1 << l.idx)); });
    dc.forEach(id => { const p = S.peers.get(id); try { if (p && p.dc && p.dc.readyState === 'open') p.dc.send(f); } catch {} });
  }, 300 + rank * 150 + Math.random() * 60);
}
function trimMap(m, max){ if (m.size <= max) return; const it = m.keys(); while (m.size > max * .8) m.delete(it.next().value); }

/* recebimento em fila: decifrar é assíncrono, a fila mantém a ordem de chegada */
let wireQ = Promise.resolve();
function wireRecv(d, viaDC, linkIdx){ wireQ = wireQ.then(() => onWire(d, viaDC, linkIdx)).catch(() => {}); }
async function onWire(f, viaDC, linkIdx){
  if (S.ended || !S.cryptoKey || !S.myId || f.length < 22 || f[0] !== WIRE_V) return;
  const from = hex(f.subarray(1, 9)), k = hex(f.subarray(9, 21));
  const bit = linkIdx >= 0 ? 1 << linkIdx : 0;
  if (S.seen.has(k)) {                                    // mesma mensagem por outro broker: só anota por onde chegou
    if (bit) S.seen.set(k, S.seen.get(k) | bit);
    return;
  }
  S.seen.set(k, bit); trimMap(S.seen, 6000);
  if (from === S.myId) {
    if (S.mySent.has(k)) {                               // eco do que eu mesmo mandei: mede a latência
      const t0 = S.sentAt.get(k);
      if (t0) { S.sentAt.delete(k); S.rtt = Math.max(1, Date.now() - t0); renderLatency(); renderQuality(); }
      return;
    }
    newIdentity();                                       // outra aba (duplicada) usa o meu id: troco o meu
    return;
  }
  let pt;
  try { pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: f.slice(9, 21), additionalData: f.slice(0, 9) }, S.cryptoKey, f.slice(21))); }
  catch { keyFail(); return; }
  if (S.ended || pt.length < 1) return;
  relayForward(f, from, k);                              // só quadros autênticos são repassados
  if (pt[0] === 1) {
    let o; try { o = JSON.parse(td.decode(pt.subarray(1))); } catch { return; }
    if (o && typeof o.t === 'string') handle(o, from);
  } else if (pt[0] === 2) {
    const b = pt.subarray(1);
    if (b.length < 20) return;
    const mb = S.members.get(from); if (mb) mb.lastSeen = Date.now();
    onChunk(hex(b.slice(0, 16)), new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(16), b.slice(20), from);
  }
}

/* ───────── conexão direta (WebRTC) entre participantes, quando a rede deixa ─────────
   Combinada pelo próprio canal cifrado (sem servidor extra). O relay continua sempre ligado:
   cada quadro vai pelos dois caminhos e quem recebe fica com o que chegar primeiro (as cópias
   são descartadas). Resultado: a latência é a do caminho mais rápido, e se o P2P cair nada se perde.
   Em 4G/CGNAT, VPN ou NAT simétrico o P2P costuma não abrir — aí tudo segue pelo relay. */
const directPeers = () => [...S.peers.values()].filter(p => p.dc && p.dc.readyState === 'open');
const isDirect = id => { const p = S.peers.get(id); return !!(p && p.dc && p.dc.readyState === 'open'); };
function p2pSync(){
  if (!p2pOn() || !S.admitted || S.ended) return;
  const now = Date.now();
  admittedMembers().forEach(m => {
    // quem tem o id menor inicia: evita os dois lados oferecerem ao mesmo tempo
    if (S.peers.has(m.id) || S.myId > m.id || (S.p2pRetry.get(m.id) || 0) > now) return;
    p2pOpen(m.id);
  });
}
function p2pNew(id, initiator){
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const p = { id, pc, dc: null, rtt: 0, initiator, cands: S.rtcStash.get(id) || [], hasRemote: false, timer: 0, giveUp: 0 };
  S.rtcStash.delete(id);
  S.peers.set(id, p);
  pc.onicecandidate = e => {
    if (!e.candidate || S.peers.get(id) !== p) return;
    const c = e.candidate.toJSON ? e.candidate.toJSON() : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex };
    sendJSON({ t: 'rtc', to: id, k: 'cand', c });
  };
  pc.onconnectionstatechange = () => {
    if (S.peers.get(id) !== p) return;
    const st = pc.connectionState;
    if (st === 'failed' || st === 'closed') p2pDrop(id, true);
    else if (st === 'disconnected') {
      clearTimeout(p.timer);
      p.timer = setTimeout(() => { if (S.peers.get(id) === p && pc.connectionState === 'disconnected') p2pDrop(id, true); }, 8000);
    }
  };
  pc.ondatachannel = e => p2pBind(p, e.channel);
  // não abriu em 20 s: desiste por ora (o relay segue) e tenta mais tarde
  p.giveUp = setTimeout(() => { if (S.peers.get(id) === p && !isDirect(id)) p2pDrop(id, true); }, 20000);
  return p;
}
function p2pBind(p, dc){
  p.dc = dc; dc.binaryType = 'arraybuffer';
  dc.onopen = () => {
    if (S.peers.get(p.id) !== p) return;
    clearTimeout(p.giveUp); S.p2pFails.delete(p.id); S.p2pRetry.delete(p.id);
    p2pPing(p); renderMembers(); updateConn();
  };
  dc.onclose = () => { if (S.peers.get(p.id) === p) p2pDrop(p.id, true); };
  dc.onmessage = e => {
    const d = e.data;
    if (typeof d === 'string') {                         // ping/pong de latência do caminho direto
      if (d[0] === 'p') { try { dc.send('q' + d.slice(1)); } catch {} }
      else if (d[0] === 'q') { const r = Date.now() - Number(d.slice(1)); if (r >= 0 && r < 30000) { p.rtt = Math.max(1, r); renderLatency(); } }
      return;
    }
    if (d instanceof ArrayBuffer) wireRecv(new Uint8Array(d), true);
  };
}
function p2pPing(p){ try { if (p.dc && p.dc.readyState === 'open') p.dc.send('p' + Date.now()); } catch {} }
async function p2pOpen(id){
  const p = p2pNew(id, true);
  try {
    p2pBind(p, p.pc.createDataChannel('nevoa', { ordered: true }));
    const o = await p.pc.createOffer(); await p.pc.setLocalDescription(o);
    if (S.peers.get(id) === p) sendJSON({ t: 'rtc', to: id, k: 'offer', sdp: p.pc.localDescription.sdp });
  } catch { p2pDrop(id, true); }
}
async function onRtc(o, from){
  if (!p2pOn() || o.to !== S.myId || !S.admitted || S.ended) return;
  const mb = S.members.get(from);
  if (!mb || !mb.adm) return;
  let p = S.peers.get(from);
  try {
    if (o.k === 'offer' && from < S.myId) {             // só aceita oferta de quem deve iniciar
      if (p) p2pDrop(from, false);                       // oferta nova substitui a conexão velha
      p = p2pNew(from, false);
      await p.pc.setRemoteDescription({ type: 'offer', sdp: String(o.sdp || '') });
      p.hasRemote = true; await p2pFlush(p);
      const a = await p.pc.createAnswer(); await p.pc.setLocalDescription(a);
      if (S.peers.get(from) === p) sendJSON({ t: 'rtc', to: from, k: 'answer', sdp: p.pc.localDescription.sdp });
    } else if (o.k === 'answer' && p && p.initiator && !p.hasRemote) {
      await p.pc.setRemoteDescription({ type: 'answer', sdp: String(o.sdp || '') });
      p.hasRemote = true; await p2pFlush(p);
    } else if (o.k === 'cand' && o.c && typeof o.c === 'object') {
      if (!p) {                                          // candidato chegou antes da oferta (outro broker foi mais rápido)
        const st = S.rtcStash.get(from) || []; if (st.length < 60) st.push(o.c); S.rtcStash.set(from, st);
      } else if (p.hasRemote) await p.pc.addIceCandidate(o.c).catch(() => {});
      else if (p.cands.length < 60) p.cands.push(o.c);
    }
  } catch { if (p && S.peers.get(from) === p) p2pDrop(from, true); }
}
async function p2pFlush(p){ const cs = p.cands.splice(0); for (const c of cs) { try { await p.pc.addIceCandidate(c); } catch {} } }
function p2pDrop(id, retry){
  const p = S.peers.get(id);
  if (!p) return;
  S.peers.delete(id);
  clearTimeout(p.timer); clearTimeout(p.giveUp);
  try { if (p.dc) { p.dc.onclose = null; p.dc.close(); } } catch {}
  try { p.pc.onconnectionstatechange = null; p.pc.close(); } catch {}
  if (retry && !S.ended) {                              // nova tentativa: 30 s, 60 s, 2 min… até 5 min
    const n = (S.p2pFails.get(id) || 0) + 1; S.p2pFails.set(id, n);
    S.p2pRetry.set(id, Date.now() + Math.min(300000, 30000 * 2 ** (n - 1)));
  }
  renderMembers(); updateConn();
}
function p2pCloseAll(){ [...S.peers.keys()].forEach(id => p2pDrop(id, false)); S.rtcStash.clear(); S.p2pFails.clear(); S.p2pRetry.clear(); }

/* ───────── participantes ───────── */
const byJoin = (a, b) => (a.joinedAt - b.joinedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const admittedMembers = () => [...S.members.values()].filter(m => m.adm).sort(byJoin);
const memberName = id => { const m = S.members.get(id); return m ? m.name : 'Alguém'; };
function idKey(){ return 'nevoa:me:' + S.roomId; }
function loadIdentity(){
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem(idKey()) || 'null'); } catch {}
  if (o && /^[0-9a-f]{16}$/.test(o.id) && Number(o.joinedAt) > 0) { S.myId = o.id; S.joinedAt = Number(o.joinedAt); S.returning = true; }
  else { S.myId = hex(rand(8)); S.joinedAt = Date.now(); S.returning = false; }
  S.myIdBytes = new Uint8Array(S.myId.match(/../g).map(h => parseInt(h, 16)));
  saveIdentity();
}
function saveIdentity(){ try { sessionStorage.setItem(idKey(), JSON.stringify({ id: S.myId, joinedAt: S.joinedAt })); } catch {} }
function newIdentity(){
  S.myId = hex(rand(8)); S.myIdBytes = new Uint8Array(S.myId.match(/../g).map(h => parseInt(h, 16)));
  saveIdentity(); announce(false, true);
}
function helloPayload(re){
  return { t: 'hello', re: re ? 1 : 0, v: 2, name: S.me.name, color: S.me.color, role: S.role,
    joinedAt: S.joinedAt, adm: S.admitted ? 1 : 0, presence: S.presence, ln: linkMask(), boot: S.bootId, seq: ++S.helloSeq };
}
async function announce(re, force){
  if (!R.on || S.ended) return;
  if (!re && !force && Date.now() - R.lastAnnounce < 1500) return;
  if (!re) R.lastAnnounce = Date.now();
  const p = helloPayload(re);
  if (S.dh) p.ek = S.dh.pub;
  // quem tem a chave de admin prova isso assinando o próprio "olá"
  if (S.adminKey) { p.apk = S.adminKey.pub; try { p.asig = await adminSign('hello|' + S.roomId + '|' + S.myId + '|' + p.boot + '|' + p.seq); } catch {} }
  sendJSON(p, { rtt: true });
  prepLeave();
}
async function prepLeave(){             // "saí" já cifrado: ao fechar a aba não dá tempo de cifrar
  try { S.leaveFrame = await makeFrame(1, te.encode(JSON.stringify({ t: 'leave' }))); } catch {}
}
function onLinkChange(){
  const up = readyLinks().length > 0;
  if (up && !S.linkUp) {
    S.linkUp = true;
    // quem só recarregou a página (mesma identidade) já tinha vaga: espera menos
    if (!S.admitAt) S.admitAt = Date.now() + (S.role === 'host' ? 0 : S.returning ? 1200 : ADMIT_WAIT);
    if (S.wasConnected) S.disconnects++;
  } else if (!up && S.linkUp) S.linkUp = false;
  if (up) announce(false);              // apresenta-se (todos respondem) — também informa os brokers que alcanço
  setTimeout(checkAdmission, S.admitAt ? Math.max(0, S.admitAt - Date.now()) + 30 : 0);
  updateConn();
}
function checkAdmission(){
  if (S.admitted || S.ended || !S.linkUp || !S.admitAt || Date.now() < S.admitAt) return;
  const now = Date.now();
  const list = [...S.members.values()].filter(m => now - m.lastSeen < memberTTL(m));
  list.push({ id: S.myId, joinedAt: S.joinedAt });
  list.sort(byJoin);
  if (list.findIndex(x => x.id === S.myId) >= MAX_MEMBERS) {
    sendJSON({ t: 'leave' }).finally(() => wipe('full'));
    return;
  }
  S.admitted = true;
  // apelido automático repetido na sala? sorteia outro (apelido escolhido pela pessoa não é mexido)
  if (S.me.auto !== false) {
    const taken = new Set(admittedMembers().map(m => m.name));
    for (let i = 0; i < 40 && taken.has(S.me.name); i++) S.me.name = pick(ANIMALS) + ' ' + pick(ADJS);
    renderMe();
  }
  announce(false, true);                // agora como participante admitido
  admittedMembers().forEach(m => { m.shown = true; });
  if (!S.greeted) {
    S.greeted = true;
    pushMessage(sysMsg('Conversa em grupo protegida com criptografia ponta a ponta (AES-256-GCM). Até ' + MAX_MEMBERS + ' pessoas.'));
  } else pushMessage(sysMsg('Você voltou à conversa.', 'info'));
  if (S.view === 'waiting' && admittedMembers().length) showView('chat');
  sound('connect'); fogDissipate();
  renderMembers(); updateConn(); flushReads(); saveSoon(); p2pSync();
  // quem é o admin ao entrar não vira aviso; só as trocas daqui em diante
  setTimeout(() => { if (!S.ended && S.adminNoted === undefined) { S.adminNoted = activeAdminId(); adminChanged(); } }, 4000);
}
// reforço do limite: se alguém chegou além dos 10 (ex.: não enxergou parte da sala ao entrar),
// o participante admitido de menor id avisa essa pessoa
function checkOverflow(id){
  if (!S.admitted) return;
  const now = Date.now();
  const fresh = [...S.members.values()].filter(x => now - x.lastSeen < memberTTL(x));
  fresh.push({ id: S.myId, joinedAt: S.joinedAt, adm: true });
  fresh.sort(byJoin);
  if (fresh.findIndex(x => x.id === id) < MAX_MEMBERS) return;
  const boss = fresh.filter(x => x.adm).slice(0, MAX_MEMBERS).map(x => x.id).sort()[0];
  if (boss === S.myId) sendJSON({ t: 'full', to: id });
}
const memberTTL = m => m.presence === 'away' ? 150000 : 45000;   // aba oculta: navegador atrasa os timers
function pruneMembers(){
  const now = Date.now();
  S.members.forEach(m => { if (now - m.lastSeen > memberTTL(m)) removeMember(m.id, false); });
  checkAdmission();
}
function removeMember(id, announced){
  const m = S.members.get(id);
  if (!m) return;
  clearTimeout(m.typingTimer);
  S.members.delete(id);
  p2pDrop(id, false); S.p2pFails.delete(id); S.p2pRetry.delete(id);
  if (m.isAdmin || S.adminKey) adminChanged();
  if (m.shown) { S.gone.set(id, Date.now()); trimMap(S.gone, 200); }
  if (m.shown && S.admitted && !S.ended) {
    // se for só um F5, a pessoa volta em segundos com o mesmo id: não poluímos a conversa
    const name = m.name;
    setTimeout(() => { if (!S.ended && !S.members.has(id)) { pushMessage(sysMsg(name + ' saiu da conversa.', 'info')); } }, announced ? 8000 : 0);
  }
  renderMembers(); refreshStatus();
}
function updateConn(){
  const was = S.connected;
  const up = S.linkUp || directPeers().length > 0;          // relay fora mas P2P de pé: segue conversando
  S.connected = !S.ended && up && S.admitted;
  if (S.connected && !was) S.wasConnected = true;
  if (!up) setStatus(S.wasConnected ? 'retry' : 'connecting');
  else if (!S.admitted) setStatus(S.linkUp ? 'joining' : 'connecting');
  else setStatus('online');
}

function relayStop(){
  R.on = false; R.gen++;
  clearInterval(R.hb); clearInterval(R.prune); R.hb = R.prune = 0;
  const ls = R.links; R.links = [];
  setTimeout(() => ls.forEach(l => l.close()), 700);     // dá tempo do "saí" sair
  S.linkUp = false;
}
async function relayStart(){
  relayStop();
  const gen = R.gen, room = S.roomId;
  if (!room) return;
  if (!window.WebSocket) { showError('Este navegador não suporta WebSocket. Atualize o navegador.'); return; }
  let d;
  try { d = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('nevoa-relay:' + room))); } catch { return; }
  if (R.gen !== gen || S.ended || S.roomId !== room) return;
  R.topic = 'nevoa/' + hex(d.slice(0, 16)) + '/all';
  R.on = true;
  R.links = RELAYS.map((c, i) => relayLink(c, i, gen));
  R.hb = setInterval(() => { if (S.linkUp) announce(true); directPeers().forEach(p2pPing); p2pSync(); adminDuty(); }, 10000);   // batimento: presença, latência, P2P
  R.prune = setInterval(pruneMembers, 5000);
  updateConn();
}
function kickLinks(){ R.links.forEach(l => l.check()); }

/* ───────── protocolo ───────── */
function handle(o, from){
  if (S.ended) return;
  const mb = S.members.get(from);
  if (mb) mb.lastSeen = Date.now();
  else if (o.t !== 'hello' && o.t !== 'leave' && o.t !== 'end') {
    // participante que ainda não se apresentou (perdemos o hello): pede apresentação
    announce(false);
  }
  switch (o.t) {
    case 'hello': {
      // quem saiu há menos de 1 min e voltou (F5, rede caiu) não gera outro "entrou"
      // "olá" atrasado de uma página que já disse "saí" (chegou por outro broker/P2P depois do "saí"): ignora
      if (S.deadBoots.has(from + ':' + String(o.boot || ''))) break;
      // "olá" atrasado (chegou depois de um mais novo por outro broker/P2P): só conta como sinal de vida
      if (mb && mb.boot && mb.boot === String(o.boot || '') && Number(o.seq) <= (mb.seq || 0)) {
        if (!o.re) setTimeout(() => announce(true), 120 + Math.random() * 700);
        break;
      }
      const m = mb || { id: from, typing: false, typingTimer: 0, shown: Date.now() - (S.gone.get(from) || 0) < 60000 };
      m.seq = Number(o.seq) || 0;
      const prevName = m.name;
      // a pessoa recarregou a página: a conexão direta antiga morreu, refaz já (sem esperar o retry)
      if (o.boot && m.boot && m.boot !== o.boot) { p2pDrop(from, false); S.p2pRetry.delete(from); S.p2pFails.delete(from); }
      m.boot = String(o.boot || '').slice(0, 16);
      if (typeof o.ek === 'string') m.ek = o.ek.slice(0, 120);
      if (o.apk && o.asig) {
        adminVerify(o.apk, o.asig, 'hello|' + S.roomId + '|' + from + '|' + m.boot + '|' + o.seq).then(ok => {
          if (S.members.get(from) === m && m.isAdmin !== ok) { m.isAdmin = ok; adminChanged(); }
        });
      } else if (m.isAdmin) { m.isAdmin = false; adminChanged(); }
      m.name = String(o.name || 'Anônimo').slice(0, 24).trim() || 'Anônimo';
      m.color = Math.abs(Number(o.color) || 0) % AV.length;
      m.role = o.role === 'host' ? 'host' : 'guest';
      m.joinedAt = Number(o.joinedAt) || Date.now();
      m.adm = !!o.adm;
      m.presence = ['online', 'away'].includes(o.presence) ? o.presence : 'online';
      m.ln = Number(o.ln) || 0;
      m.lastSeen = Date.now();
      S.members.set(from, m);
      if (!o.re) setTimeout(() => announce(true), 120 + Math.random() * 700);   // responde quem chegou
      checkOverflow(from);
      if (m.adm && !m.shown) {
        m.shown = true;
        if (S.admitted) {
          pushMessage(sysMsg(m.name + ' entrou na conversa.', 'info'));
          sound('connect');
          if (S.view === 'waiting') { showView('chat'); fogDissipate(); }
        }
      } else if (prevName && prevName !== m.name && m.shown) saveSoon();
      renderMembers(); refreshStatus(); p2pSync(); adminDuty();
      break;
    }
    case 'leave':                                                  // final = clicou em Sair (aviso na hora); sem final pode ser só F5
      if (mb) {
        if (mb.boot) { S.deadBoots.add(from + ':' + mb.boot); if (S.deadBoots.size > 500) S.deadBoots.delete(S.deadBoots.values().next().value); }
        removeMember(from, !o.final);
      }
      break;
    case 'full':                                                   // quem já está na sala avisa: passou de 10
      if (o.to === S.myId && mb && mb.adm && !S.ended) sendJSON({ t: 'leave' }).finally(() => wipe('full'));
      break;   // final = clicou em Sair (aviso na hora); sem final pode ser só F5
    case 'msg': {
      const id = String(o.id || '').slice(0, 32);
      if (!id || S.msgIndex.has(id)) break;
      const text = typeof o.text === 'string' ? o.text.slice(0, MAX_TEXT) : '';
      if (!text.trim()) break;
      const m = { id, kind: 'text', dir: 'in', from, fromName: memberName(from), fromColor: mb ? mb.color : 0,
        ts: Number(o.ts) || Date.now(), text, status: 'delivered', reactions: {} };
      if (o.replyTo) m.replyTo = String(o.replyTo).slice(0, 32);
      if (mb) { clearTimeout(mb.typingTimer); mb.typing = false; refreshStatus(); }
      pushMessage(m);
      sendJSON({ t: 'ack', id: m.id });
      maybeRead(m); sound('recv'); bumpUnread();
      break;
    }
    case 'ack': {
      const m = S.msgIndex.get(String(o.id));
      if (m && m.dir === 'out' && m.status === 'sent') { m.status = 'delivered'; updateMsg(m); saveSoon(); }
      break;
    }
    case 'read': {
      let ch = false;
      (Array.isArray(o.ids) ? o.ids.slice(0, 500) : []).forEach(id => {
        const m = S.msgIndex.get(String(id));
        if (!m || m.dir !== 'out' || m.status === 'read') return;
        m.readBy = m.readBy || [];
        if (!m.readBy.includes(from)) m.readBy.push(from);
        // "lida" (azul) quando todos que estão na conversa leram
        const others = admittedMembers().map(x => x.id);
        const st = others.length && others.every(x => m.readBy.includes(x)) ? 'read' : 'delivered';
        if (m.status !== st) { m.status = st; updateMsg(m); ch = true; }
      });
      if (ch) saveSoon();
      break;
    }
    case 'typing': {
      if (!mb) break;
      clearTimeout(mb.typingTimer);
      mb.typing = !!o.on;
      if (mb.typing) mb.typingTimer = setTimeout(() => { mb.typing = false; refreshStatus(); }, 3500);
      refreshStatus();
      break;
    }
    case 'file': onFileMeta(o, from); break;
    case 'file-done': {
      const m = S.msgIndex.get(String(o.id));
      if (m && m.dir === 'out' && m.status === 'sent') { m.status = 'delivered'; updateMsg(m); saveSoon(); }
      break;
    }
    case 'file-cancel': {
      const m = S.msgIndex.get(String(o.id));
      if (m && m.kind === 'file' && m.from === from && m.status === 'receiving') {
        const tr = S.transfersIn.get(m.tid);
        if (tr) { clearTimeout(tr.timer); S.transfersIn.delete(m.tid); }
        m.status = 'canceled'; updateMsg(m); saveSoon();
      }
      break;
    }
    case 'react': {
      const m = S.msgIndex.get(String(o.id));
      if (!m || m.kind === 'sys') break;
      const e = String(o.emoji || '').slice(0, 8);
      if (!REACTIONS.includes(e)) break;
      setReaction(m, e, from, !!o.on);
      updateMsg(m); saveSoon();
      break;
    }
    case 'edit': {
      const m = S.msgIndex.get(String(o.id));
      if (!m || m.kind !== 'text' || m.from !== from) break;      // só o autor edita
      const text = typeof o.text === 'string' ? o.text.slice(0, MAX_TEXT) : '';
      if (!text.trim()) break;
      m.text = text; m.edited = true; updateMsg(m); saveSoon();
      break;
    }
    case 'del': {                                                  // qualquer participante pode apagar
      const m = S.msgIndex.get(String(o.id));
      if (m && m.kind !== 'sys') {
        removeMessageLocal(m);
        if (m.from !== from) toast('info', memberName(from) + ' apagou uma mensagem.');
      }
      break;
    }
    case 'pin': {
      const id = String(o.id || '');
      if (o.on && S.msgIndex.has(id)) S.pinnedId = id;
      else if (S.pinnedId === id) S.pinnedId = null;
      renderPinned(); markPinned(); saveSoon();
      break;
    }
    case 'presence': {
      if (!mb) break;
      mb.presence = o.state === 'away' ? 'away' : 'online';
      renderMembers();
      break;
    }
    case 'profile': {
      if (!mb) break;
      const n = String(o.name || '').slice(0, 24).trim();
      if (n) { mb.name = n; renderMembers(); refreshStatus(); }
      break;
    }
    case 'rtc': onRtc(o, from); break;
    case 'akey': onAdminKey(o); break;                              // chave de admin entregue a mim                            // combinação da conexão direta
    case 'end': verifyEnd(o, from); break;                         // só o admin (assinatura confere com o link) encerra
  }
}
/* ───────── admin transferível ─────────
   Quem cria a sala gera uma chave de assinatura (ECDSA P-256). O link leva só a "impressão digital"
   (hash) da chave pública (&h=). Quem tem a chave privada prova ser admin assinando seus "olás", e só
   um "encerrar" assinado por ela apaga a conversa de todos.
   Sucessão: o admin entrega uma cópia da chave ao próximo da fila (quem entrou primeiro depois dele),
   cifrada só para essa pessoa (ECDH). Se o admin sai — mesmo fechando a aba de repente —, o próximo
   já tem a chave e assume; e assim por diante. Se o admin original volta, retoma o posto. */
const EC_SIGN = { name: 'ECDSA', namedCurve: 'P-256' }, EC_HASH = { name: 'ECDSA', hash: 'SHA-256' };
const EC_DH = { name: 'ECDH', namedCurve: 'P-256' };
const admKey = () => 'nevoa:adm:' + S.roomId;
const tagOf = async raw => b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)).slice(0, 16));
const pubCache = new Map();               // chave pública (b64) -> CryptoKey que confere com o link, ou null
async function adminPub(b64){
  if (pubCache.has(b64)) return pubCache.get(b64);
  let k = null;
  try {
    const raw = ub64(b64);
    if (S.hostTag && await tagOf(raw) === S.hostTag) k = await crypto.subtle.importKey('raw', raw, EC_SIGN, false, ['verify']);
  } catch { k = null; }
  pubCache.set(b64, k);
  return k;
}
async function adminVerify(pubB64, sigB64, text){
  const k = await adminPub(String(pubB64 || ''));
  if (!k) return false;
  try { return await crypto.subtle.verify(EC_HASH, k, ub64(String(sigB64 || '')), te.encode(text)); } catch { return false; }
}
async function adminSign(text){ return b64u(new Uint8Array(await crypto.subtle.sign(EC_HASH, S.adminKey.priv, te.encode(text)))); }
async function setAdminKey(jwk, pubB64, persist){
  if (!(await adminPub(pubB64))) throw new Error('a chave não confere com o link');
  const priv = await crypto.subtle.importKey('jwk', jwk, EC_SIGN, true, ['sign']);
  S.adminKey = { priv, jwk, pub: pubB64 };
  if (persist) { try { sessionStorage.setItem(admKey(), JSON.stringify({ jwk, pub: pubB64 })); } catch {} }
}
async function createAdminKey(){
  const kp = await crypto.subtle.generateKey(EC_SIGN, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  S.hostTag = await tagOf(raw);
  await setAdminKey(await crypto.subtle.exportKey('jwk', kp.privateKey), b64u(raw), true);
}
async function loadAdminKey(){
  try {
    const o = JSON.parse(sessionStorage.getItem(admKey()) || 'null');
    if (o && o.jwk && o.pub) await setAdminKey(o.jwk, o.pub, false);
  } catch { S.adminKey = null; }
}
async function ensureDH(){                // par de chaves desta aba para receber a chave de admin cifrada
  if (S.dh) return;
  const kp = await crypto.subtle.generateKey(EC_DH, false, ['deriveKey']);
  S.dh = { priv: kp.privateKey, pub: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))) };
}
async function dhKey(otherPubB64, usage){
  const pub = await crypto.subtle.importKey('raw', ub64(otherPubB64), EC_DH, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, S.dh.priv, { name: 'AES-GCM', length: 256 }, false, [usage]);
}
// admin ativo: dentre quem prova ter a chave, quem entrou primeiro (todos calculam igual)
function activeAdminId(){
  const c = admittedMembers().filter(m => m.isAdmin);
  if (S.adminKey && S.admitted) c.push({ id: S.myId, joinedAt: S.joinedAt });
  c.sort(byJoin);
  return c.length ? c[0].id : null;
}
const iAmAdmin = () => !!S.adminKey && S.admitted && activeAdminId() === S.myId;
const nextInLine = () => admittedMembers().find(m => m.id !== S.myId);   // já ordenados por chegada
// o admin ativo garante que o próximo da fila já tem a chave (assim uma saída repentina não deixa a sala sem admin)
async function adminDuty(){
  if (!iAmAdmin() || !S.dh) return;
  const next = nextInLine();
  if (!next || next.isAdmin || !next.ek) return;
  if (S.keySent.get(next.id) === next.ek) return;                         // já entregue para esta aba dele
  S.keySent.set(next.id, next.ek);
  try {
    const k = await dhKey(next.ek, 'encrypt');
    const iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(S.roomId + '|' + next.id) }, k,
      te.encode(JSON.stringify({ jwk: S.adminKey.jwk, pub: S.adminKey.pub }))));
    sendJSON({ t: 'akey', to: next.id, ek: S.dh.pub, iv: b64u(iv), ct: b64u(ct) });
  } catch { S.keySent.delete(next.id); }
}
async function onAdminKey(o){
  if (o.to !== S.myId || S.adminKey || !S.dh || !S.hostTag) return;
  try {
    const k = await dhKey(String(o.ek || ''), 'decrypt');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(String(o.iv || '')), additionalData: te.encode(S.roomId + '|' + S.myId) }, k, ub64(String(o.ct || '')));
    const d = JSON.parse(td.decode(pt));
    await setAdminKey(d.jwk, d.pub, true);
    announce(false, true);                                               // passa a provar a chave nos "olás"
    adminChanged();
  } catch {}
}
// troca de admin: a tela atualiza na hora; o aviso na conversa espera 8 s (um F5 do admin não gera aviso)
function adminChanged(){
  renderMe(); renderMembers();
  clearTimeout(S.adminNoteTimer);
  S.adminNoteTimer = setTimeout(() => {
    if (S.ended || !S.admitted || S.adminNoted === undefined) return;
    const a = activeAdminId();
    if (a === S.adminNoted) return;
    S.adminNoted = a;
    if (!a) return;
    if (a === S.myId) { pushMessage(sysMsg('Você agora é o admin: pode encerrar a conversa para todos.', 'info')); toast('info', 'Você agora é o admin da conversa.'); }
    else pushMessage(sysMsg(memberName(a) + ' agora é o admin da conversa.', 'info'));
  }, 8000);
  adminDuty();
}
async function verifyEnd(o, from){
  let ok = false;
  if (o.apk && o.sig && S.hostTag) {                                     // assinado pela chave de admin
    const ts = Number(o.ts) || 0;
    ok = Math.abs(Date.now() - ts) < 600000 && await adminVerify(o.apk, o.sig, 'end|' + S.roomId + '|' + ts);
  } else if (o.secret && S.hostTag) {                                    // salas antigas (segredo em vez de assinatura)
    try { ok = await tagOf(ub64(String(o.secret))) === S.hostTag; } catch { ok = false; }
  } else if (!S.hostTag) { const mb = S.members.get(from); ok = !!(mb && mb.role === 'host'); }   // link sem &h=
  if (ok && !S.ended) wipe('host-ended');
}
async function endForAll(){
  const ts = Date.now();
  const msg = { t: 'end', ts };
  if (S.adminKey) { msg.apk = S.adminKey.pub; msg.sig = await adminSign('end|' + S.roomId + '|' + ts); }
  await sendJSON(msg);
  setTimeout(() => wipe('me'), 200);
}
async function leaveRoom(){
  if (iAmAdmin()) await adminDuty();                                     // garante que o próximo recebeu a chave
  await sendJSON({ t: 'leave', final: 1 });
  setTimeout(() => wipe('left'), 200);
}

/* ───────── mensagens / render ───────── */
const sysMsg = (text, icon = 'lock') => ({ id: uid(), kind: 'sys', dir: 'sys', ts: Date.now(), text, icon, status: 'sys' });
const dayKey = ts => new Date(ts).toDateString();
function dayLabel(ts){
  const d = new Date(ts), n = new Date();
  const diff = (new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000;
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) });
}
function ticks(st){
  const map = { sending: ICONS.clock, sent: ICONS.check1, delivered: ICONS.check2, read: ICONS.check2,
    failed: ICONS.alert, canceled: ICONS.x, expired: ICONS.clock };
  return `<span class="ticks t-${esc(st)}">${map[st] || ICONS.clock}</span>`;
}
const metaRow = m => `<div class="meta"><span class="time">${fmtTime(m.ts)}${m.edited ? '<span class="edited-mark">editada</span>' : ''}</span>${m.dir === 'out' ? ticks(m.status) : ''}</div>`;
function fileSub(m){
  if (m.status === 'sending') return `${Math.round((m.progress || 0) * 100)}% · ${fmtSize(m.size)}`;
  if (m.status === 'receiving') return `${fmtSize(m.bytes || 0)} de ${fmtSize(m.size)}`;
  if (m.status === 'failed') return 'falhou · conexão interrompida';
  if (m.status === 'canceled') return 'cancelado';
  if (m.status === 'expired') return 'expirado · arquivos não são gravados';
  return fmtSize(m.size);
}
function fileCard(m){
  const ic = (m.mime || '').startsWith('image/') ? ICONS.image : ICONS.file;
  const pct = Math.round((m.progress || 0) * 100);
  const active = m.status === 'sending' || m.status === 'receiving';
  let act = '';
  if (m.dir === 'out' && m.status === 'sending')
    act = `<button class="icon-btn sm" data-action="cancel" data-id="${m.id}" aria-label="Cancelar envio">${ICONS.x}</button>`;
  else if (m.dir === 'out' && m.status === 'failed' && S.outFiles.has(m.id))
    act = `<button class="icon-btn sm" data-action="retry" data-id="${m.id}" aria-label="Tentar novamente">${ICONS.retry}</button>`;
  else if (m.blobUrl)
    act = `<a class="icon-btn sm" href="${m.blobUrl}" download="${esc(m.name)}" aria-label="Baixar ${esc(m.name)}">${ICONS.download}</a>`;
  return `<div class="file-card"><span class="file-ic">${ic}</span><div class="file-info">` +
    `<span class="file-name" title="${esc(m.name)}">${esc(m.name)}</span><span class="file-sub">${esc(fileSub(m))}</span>` +
    (active ? `<span class="progress"><i style="width:${pct}%"></i></span>` : '') +
    `</div>${act}</div>`;
}
function quoteBlock(m){
  if (!m.replyTo) return '';
  const q = S.msgIndex.get(m.replyTo);
  const name = q ? (q.dir === 'out' ? 'Você' : (q.fromName || 'Anônimo')) : 'Mensagem';
  const text = q ? (q.kind === 'text' ? q.text : (q.name || 'Arquivo')) : 'Mensagem apagada';
  return `<div class="quote-block" data-action="jump" data-id="${esc(m.replyTo)}"><div class="q-name">${esc(name)}</div><div class="q-text">${esc(text)}</div></div>`;
}
// reações: emoji -> lista de ids de quem reagiu
function normReactions(m){
  const r = m.reactions || {};
  Object.keys(r).forEach(e => {
    if (Array.isArray(r[e])) return;
    const a = []; if (r[e] && r[e].me && S.myId) a.push(S.myId); if (r[e] && r[e].peer) a.push('antigo');
    if (a.length) r[e] = a; else delete r[e];
  });
  m.reactions = r;
}
function setReaction(m, e, who, on){
  normReactions(m);
  const a = (m.reactions[e] || []).filter(x => x !== who);
  if (on) a.push(who);
  if (a.length) m.reactions[e] = a; else delete m.reactions[e];
}
function reactionsRow(m){
  const r = m.reactions || {};
  const keys = Object.keys(r).filter(e => Array.isArray(r[e]) && r[e].length);
  if (!keys.length) return '';
  return `<div class="reactions">` + keys.map(e => {
    const mine = r[e].includes(S.myId);
    return `<button class="reaction-chip${mine ? ' mine' : ''}" data-action="react-toggle" data-id="${m.id}" data-emoji="${esc(e)}">${e}<span class="rc-n">${r[e].length}</span></button>`;
  }).join('') + `</div>`;
}
function msgTools(m){
  const canEdit = m.dir === 'out' && m.kind === 'text';
  return `<div class="msg-tools">` +
    `<button data-action="reply" data-id="${m.id}" title="Responder" aria-label="Responder">${ICONS.reply}</button>` +
    `<button data-action="react" data-id="${m.id}" title="Reagir" aria-label="Reagir">${ICONS.smile}</button>` +
    (canEdit ? `<button data-action="edit" data-id="${m.id}" title="Editar" aria-label="Editar">${ICONS.edit}</button>` : '') +
    `<button data-action="pin" data-id="${m.id}" title="Fixar" aria-label="Fixar">${ICONS.pin}</button>` +
    `<button data-action="delete" data-id="${m.id}" title="Apagar" aria-label="Apagar">${ICONS.trash}</button>` +
    `</div>`;
}
function senderTag(m){
  if (m.dir !== 'in') return '';
  const c = AV[(m.fromColor || 0) % AV.length];
  return `<div class="sender" style="color:${c[0]}">${esc(m.fromName || 'Anônimo')}</div>`;
}
function bubbleInner(m){
  return senderTag(m) + bubbleBody(m);
}
function bubbleBody(m){
  if (m.kind === 'text') return quoteBlock(m) + `<div class="txt">${richText(m.text)}</div>${metaRow(m)}${reactionsRow(m)}`;
  const isImg = (m.mime || '').startsWith('image/');
  const isAudio = (m.mime || '').startsWith('audio/');
  if (isAudio && m.blobUrl)
    return quoteBlock(m) + `<div class="voice-note"><audio controls src="${m.blobUrl}"></audio></div>${metaRow(m)}${reactionsRow(m)}`;
  if (isImg && m.blobUrl)
    return quoteBlock(m) + `<button class="img-wrap" data-action="preview" data-id="${m.id}"><img src="${m.blobUrl}" alt="${esc(m.name)}" loading="lazy"></button>${metaRow(m)}${reactionsRow(m)}`;
  if (isImg && m.status === 'receiving')
    return `<div class="img-ph">${ICONS.image}<span class="file-sub">${esc(fileSub(m))}</span><span class="progress"><i style="width:${Math.round((m.progress||0)*100)}%"></i></span></div>${metaRow(m)}`;
  return quoteBlock(m) + fileCard(m) + metaRow(m) + reactionsRow(m);
}
function buildMsg(m){
  const node = document.createElement('div');
  node.dataset.id = m.id;
  if (m.kind === 'sys') {
    node.className = 'msg sys';
    node.innerHTML = `<span class="sys-pill">${ICONS[m.icon] || ICONS.lock}<span>${esc(m.text)}</span></span>`;
    return node;
  }
  node.className = 'msg ' + (m.dir === 'out' ? 'out' : 'in');
  if (m.dir === 'in') {
    const av = document.createElement('span');
    av.className = 'avatar';
    setAvatar(av, { name: m.fromName || '?', color: m.fromColor || 0 });
    node.appendChild(av);
  }
  const b = document.createElement('div');
  const isImg = m.kind === 'file' && (m.mime || '').startsWith('image/') && m.blobUrl;
  b.className = 'bubble' + (isImg ? ' img' : '');
  b.innerHTML = bubbleInner(m);
  node.appendChild(b);
  node.insertAdjacentHTML('beforeend', msgTools(m));
  if (S.pinnedId === m.id) node.classList.add('pinned-msg');
  return node;
}
function updateMsg(m){
  const node = S.msgNodes.get(m.id);
  if (!node || m.kind === 'sys') return;
  const b = node.querySelector('.bubble');
  const isImg = m.kind === 'file' && (m.mime || '').startsWith('image/') && m.blobUrl;
  b.className = 'bubble' + (isImg ? ' img' : '');
  b.innerHTML = bubbleInner(m);
}
function updateProgress(m){
  const node = S.msgNodes.get(m.id);
  if (!node) return;
  const bar = node.querySelector('.progress i');
  if (bar) bar.style.width = Math.round((m.progress || 0) * 100) + '%';
  const sub = node.querySelector('.file-sub');
  if (sub) sub.textContent = fileSub(m);
}
const nearBottom = () => msgScroll.scrollHeight - msgScroll.scrollTop - msgScroll.clientHeight < 140;
// "grudado no fim": só deixa de acompanhar as mensagens novas quando a PESSOA rola para cima.
// (Medir a distância na hora falha quando chegam várias seguidas: a rolagem suave ainda está a caminho.)
let stickBottom = true, lastScrollTop = 0;
function trackStick(){
  const t = msgScroll.scrollTop;
  if (nearBottom()) stickBottom = true;
  else if (t < lastScrollTop - 4) stickBottom = false;          // subiu: está lendo mensagens antigas
  lastScrollTop = t;
}
/* teclado do celular: o app ocupa exatamente a área visível. Sem isso o teclado só cobre a página
   (iPhone, e Chrome do Android desde a versão 108): ao chegar mensagem o navegador desfaz o
   "empurrão" que tinha dado e a barra de digitar some atrás do teclado. */
function fitViewport(){
  const vv = window.visualViewport;
  if (!vv || Math.abs((vv.scale || 1) - 1) > .01) return;       // zoom com dois dedos: não mexe
  const h = Math.round(vv.height), top = Math.max(0, Math.round(vv.offsetTop));
  if (!h || (h === S.vvH && top === S.vvTop)) return;
  const stick = S.view === 'chat' && stickBottom;               // estava no fim da conversa? continua no fim
  S.vvH = h; S.vvTop = top;
  const r = document.documentElement.style;
  r.setProperty('--app-h', h + 'px');
  r.setProperty('--app-top', top + 'px');
  if (stick) requestAnimationFrame(() => { msgScroll.scrollTop = msgScroll.scrollHeight; });
}
function scrollToBottom(smooth){
  stickBottom = true;
  msgScroll.scrollTo({ top: msgScroll.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  hidePill();
}
function hidePill(){ scrollPill.hidden = true; S.pillN = 0; }
function appendMessage(m, silent){
  const dk = dayKey(m.ts);
  if (dk !== S.lastDay) {
    S.lastDay = dk;
    const d = document.createElement('div');
    d.className = 'day-sep';
    d.innerHTML = `<span>${dayLabel(m.ts)}</span>`;
    msgList.appendChild(d);
  }
  const node = buildMsg(m);
  S.msgNodes.set(m.id, node);
  msgList.appendChild(node);
  emptyState.hidden = true;
  if (!silent) {
    if (m.dir === 'out' || stickBottom) scrollToBottom(true);
    else {
      S.pillN++;
      scrollPillN.textContent = S.pillN === 1 ? '1 nova mensagem' : S.pillN + ' novas mensagens';
      scrollPill.hidden = false;
    }
  }
}
function pushMessage(m){
  S.messages.push(m);
  S.msgIndex.set(m.id, m);
  appendMessage(m, false);
  saveSoon();
}
function maybeRead(m){
  if (document.visibilityState === 'visible' && document.hasFocus() && S.view === 'chat') sendJSON({ t: 'read', ids: [m.id] });
  else S.pendingReads.push(m.id);
}
function flushReads(){
  if (S.pendingReads.length && S.connected) sendJSON({ t: 'read', ids: S.pendingReads.splice(0) });
  S.unread = 0;
  document.title = BASE_TITLE;
}
function bumpUnread(){
  if (document.visibilityState !== 'visible' || !document.hasFocus()) {
    S.unread++;
    document.title = `(${S.unread}) Névoa`;
  }
}

/* ───────── arquivos ───────── */
function armTransferTimeout(tid){
  const tr = S.transfersIn.get(tid);
  if (!tr) return;
  clearTimeout(tr.timer);
  tr.timer = setTimeout(() => {
    const m = S.msgIndex.get(tr.id);
    S.transfersIn.delete(tid);
    if (m && m.status === 'receiving') {
      m.status = 'failed'; updateMsg(m); saveSoon();
      toast('warn', 'Transferência interrompida: ' + truncName(m.name));
    }
  }, 30000);
}
function onFileMeta(o, from){
  const size = Number(o.size), total = Number(o.total);
  const tid = String(o.tid || '');
  const id = String(o.id || '').slice(0, 32);
  if (!id || !(size > 0 && size <= MAX_FILE) || total !== Math.ceil(size / CHUNK) || !/^[0-9a-f]{32}$/.test(tid) || S.transfersIn.has(tid)) return;
  const old = S.msgIndex.get(id);
  if (old && !(old.from === from && ['failed', 'canceled'].includes(old.status))) return;   // reenvio do autor reaproveita o card
  const mb = S.members.get(from);
  const m = old || {
    id, kind: 'file', dir: 'in', ts: Number(o.ts) || Date.now(), from, fromName: memberName(from), fromColor: mb ? mb.color : 0,
    name: String(o.name || 'arquivo').slice(0, 120), size, mime: String(o.mime || 'application/octet-stream').slice(0, 100),
    total, tid, status: 'receiving', progress: 0, bytes: 0
  };
  m.tid = tid; m.total = total; m.status = 'receiving'; m.progress = 0; m.bytes = 0;
  S.transfersIn.set(tid, { id: m.id, from, total, received: 0, bytes: 0, parts: new Array(total), timer: 0 });
  armTransferTimeout(tid);
  if (old) updateMsg(m); else pushMessage(m);
}
function onChunk(tid, idx, data, from){
  const tr = S.transfersIn.get(tid);
  if (!tr || tr.from !== from || idx >= tr.total || tr.parts[idx]) return;
  tr.parts[idx] = data; tr.received++; tr.bytes += data.length;
  const m = S.msgIndex.get(tr.id);
  if (!m) { clearTimeout(tr.timer); S.transfersIn.delete(tid); return; }
  m.progress = tr.received / tr.total; m.bytes = tr.bytes;
  if (tr.received === tr.total) {
    clearTimeout(tr.timer); S.transfersIn.delete(tid);
    m.blobUrl = URL.createObjectURL(new Blob(tr.parts, { type: m.mime }));
    m.status = 'delivered';
    updateMsg(m);
    sendJSON({ t: 'file-done', id: m.id });
    maybeRead(m); sound('recv'); bumpUnread(); saveSoon();
    if (stickBottom) scrollToBottom(true);
  } else {
    armTransferTimeout(tid);
    if (tr.received % 4 === 0) updateProgress(m);
  }
}
async function waitBuffer(){
  const viaRelay = relayOnly().length > 0;
  if (viaRelay) await sleep(30);                         // relay público: ritmo moderado para não ser limitado
  const busy = () => directPeers().some(p => p.dc.bufferedAmount > 1048576) ||
    (viaRelay && coverLinks(relayOnly()).some(l => l.ws && l.ws.bufferedAmount > 262144));
  while (busy() && S.connected && !S.ended) await sleep(viaRelay ? 40 : 10);
}
function queueFile(file, existing){
  S.outQueue.push({ file, m: existing || null });
  processOutQueue();
}
async function processOutQueue(){
  if (S.outBusy) return;
  S.outBusy = true;
  try {
    while (S.outQueue.length && !S.ended) {
      const { file, m } = S.outQueue.shift();
      if (!S.connected) {
        if (m) { m.status = 'failed'; updateMsg(m); }
        toast('warn', 'Sem conexão — envio cancelado.');
        continue;
      }
      await sendFile(file, m);
    }
  } finally { S.outBusy = false; }
}
async function sendFile(file, m){
  const tidBytes = rand(16), tid = hex(tidBytes);
  const total = Math.max(1, Math.ceil(file.size / CHUNK));
  if (!m) {
    m = { id: uid(), kind: 'file', dir: 'out', ts: Date.now(), name: file.name.slice(0, 120),
      size: file.size, mime: (file.type || 'application/octet-stream').slice(0, 100), status: 'sending', progress: 0 };
    S.outFiles.set(m.id, file);
    pushMessage(m);
  }
  m.tid = tid; m.total = total; m.status = 'sending'; m.progress = 0;
  updateMsg(m);
  const ctl = { canceled: false };
  S.transfersOut.set(tid, ctl);
  const ok = await sendJSON({ t: 'file', id: m.id, tid, ts: m.ts, name: m.name, size: m.size, mime: m.mime, total });
  if (!ok) { m.status = 'failed'; updateMsg(m); S.transfersOut.delete(tid); saveSoon(); return; }
  sound('send');
  try {
    for (let i = 0; i < total; i++) {
      if (S.ended || ctl.canceled || !S.connected) throw new Error('abort');
      const buf = new Uint8Array(await file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK)).arrayBuffer());
      const plain = new Uint8Array(20 + buf.length);
      plain.set(tidBytes, 0);
      new DataView(plain.buffer).setUint32(16, i);
      plain.set(buf, 20);
      const f = await makeFrame(2, plain);
      await waitBuffer();
      if (S.ended || ctl.canceled || !S.connected) throw new Error('abort');
      if (!netSend(f, { cover: true })) throw new Error('offline');
      m.progress = (i + 1) / total;
      if (i % 4 === 3 || i === total - 1) updateProgress(m);
    }
    m.status = 'sent'; m.progress = 1;
    updateMsg(m); saveSoon();
  } catch {
    if (S.ended) return;
    if (ctl.canceled) { m.status = 'canceled'; sendJSON({ t: 'file-cancel', tid, id: m.id }); }
    else m.status = 'failed';
    updateMsg(m); saveSoon();
  } finally { S.transfersOut.delete(tid); }
}
function handleFiles(list){
  if (!S.connected) { toast('warn', 'Conecte-se antes de enviar arquivos.'); return; }
  let n = 0;
  for (const f of list) {
    if (f.size > MAX_FILE) { toast('error', `"${truncName(f.name)}" passa de 8 MB e não foi enviado.`); continue; }
    if (f.size === 0) { toast('warn', 'Arquivo vazio ignorado.'); continue; }
    if (n >= 6) { toast('warn', 'Máximo de 6 arquivos por vez.'); break; }
    queueFile(f); n++;
  }
}

/* ───────── composer ───────── */
function autogrow(){ input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; }
function updateCharCount(){
  const n = input.value.length;
  if (n >= 3600) { charCount.hidden = false; charCount.textContent = n + ' / ' + MAX_TEXT; charCount.classList.toggle('over', n >= MAX_TEXT); }
  else charCount.hidden = true;
}
function updateSendBtn(){ btnSend.disabled = !S.connected || !input.value.trim(); }
function typingPing(){
  if (!S.connected) return;
  const now = Date.now();
  if (now - S.lastTyping > 1200) { S.lastTyping = now; sendJSON({ t: 'typing', on: true }); }
  clearTimeout(S.typingStop);
  S.typingStop = setTimeout(() => { S.lastTyping = 0; sendJSON({ t: 'typing', on: false }); }, 2600);
}
async function sendText(){
  const text = input.value.replace(/\s+$/, '');
  if (!text.trim()) return;
  if (!S.connected) { toast('warn', 'Sem conexão — aguarde reconectar.'); return; }
  if (S.editingId) {
    const m = S.msgIndex.get(S.editingId);
    if (m && m.dir === 'out' && m.kind === 'text') {
      const ok = await sendJSON({ t: 'edit', id: m.id, text });
      if (ok) { m.text = text; m.edited = true; updateMsg(m); saveSoon(); }
    }
    cancelEdit();
    input.value = ''; autogrow(); updateCharCount(); updateSendBtn(); input.focus();
    return;
  }
  const m = { id: uid(), kind: 'text', dir: 'out', ts: Date.now(), text, status: 'sent', reactions: {} };
  if (S.replyTo) m.replyTo = S.replyTo;
  const payload = { t: 'msg', id: m.id, ts: m.ts, text };
  if (m.replyTo) payload.replyTo = m.replyTo;
  const ok = await sendJSON(payload);
  if (!ok) { toast('error', 'Falha ao enviar. Tente novamente.'); return; }
  pushMessage(m);
  cancelReply();
  input.value = ''; autogrow(); updateCharCount(); updateSendBtn();
  clearTimeout(S.typingStop); S.lastTyping = 0;
  sendJSON({ t: 'typing', on: false });
  sound('send');
  input.focus();
}

/* ───────── convite / QR ───────── */
const hashStr = () => '#r=' + S.roomId + '&k=' + S.keyB64 + (S.saltB64 ? '&s=' + S.saltB64 : '') + (S.hostTag ? '&h=' + S.hostTag : '');
const inviteLink = () => location.href.split('#')[0] + hashStr();
function renderInvite(){
  const l = inviteLink();
  ['#invite-link', '#invite-link-side'].forEach(s => { const e = $(s); e.textContent = l; e.title = l; });
  $('#room-id').textContent = S.roomId.slice(0, 10) + '…';
  $('#room-created').textContent = 'criada às ' + fmtTime(S.createdAt);
  if (S.qrLib) drawQRs();
}
function drawQRs(){
  if (typeof window.qrcode !== 'function' || !S.roomId) return;
  const l = inviteLink();
  [['#qr-waiting', 180], ['#qr-side', 140]].forEach(([sel, size]) => {
    const c = $(sel);
    try {
      const qr = window.qrcode(0, 'L');
      qr.addData(l); qr.make();
      const n = qr.getModuleCount(), margin = 2;
      const cell = Math.max(2, Math.floor(size / (n + margin * 2)));
      const dim = cell * (n + margin * 2);
      c.width = dim; c.height = dim;
      const x = c.getContext('2d');
      x.fillStyle = '#F2EFFF'; x.fillRect(0, 0, dim, dim);
      x.fillStyle = '#12102A';
      for (let r = 0; r < n; r++) for (let col = 0; col < n; col++)
        if (qr.isDark(r, col)) x.fillRect((col + margin) * cell, (r + margin) * cell, cell, cell);
    } catch { const w = c.closest('.qr-card,.qr-wrap'); if (w) w.hidden = true; }
  });
}
async function copyLink(auto = false){
  const l = inviteLink();
  let ok = false;
  try { await navigator.clipboard.writeText(l); ok = true; }
  catch {
    const t = document.createElement('textarea');
    t.value = l; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
  }
  const note = $('#auto-copy-note');
  if (note){
    note.classList.toggle('manual', !ok);
    note.innerHTML = ok
      ? ICONS.check1 + '<span>Link copiado automaticamente. Cole no WhatsApp, SMS ou onde preferir.</span>'
      : ICONS.alert + '<span>Toque em <b>Copiar</b> e envie o link para quem vai participar (até ' + (MAX_MEMBERS - 1) + ' pessoas).</span>';
  }
  if (ok) toast('ok', auto ? 'Link copiado automaticamente. Envie para quem vai participar.' : 'Link copiado.');
  else if (!auto) toast('error', 'Não foi possível copiar — selecione o link manualmente.');
  return ok;
}
async function shareLink(){
  if (navigator.share) {
    try { await navigator.share({ title: 'Névoa', text: 'Entre na nossa conversa privada (anônima e criptografada):', url: inviteLink() }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  copyLink();
}

/* ───────── compartilhamento fácil / entrada por convite ───────── */
function shareTo(kind){
  const l = inviteLink();
  const text = 'Entre na nossa conversa privada no Névoa (anônima, criptografada e sem cadastro):';
  const url = kind === 'whatsapp'
    ? 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + l)
    : 'https://t.me/share/url?url=' + encodeURIComponent(l) + '&text=' + encodeURIComponent(text);
  window.open(url, '_blank', 'noopener,noreferrer');
  toast('info', 'Compartilhamento aberto. Envie o link para o grupo.');
}
function extractInvite(text){
  const t = String(text || '').trim();
  const candidates = [];
  const um = t.match(/https?:\/\/[^\s<>"']+/);
  if (um) candidates.push(um[0]);
  candidates.push(t);
  for (let c of candidates){
    c = c.replace(/[.,;:!?)\]}'"]+$/, '');
    const i = c.indexOf('#');
    const hash = (i >= 0 ? c.slice(i + 1) : c).replace(/^[?#]/, '');
    const p = new URLSearchParams(hash);
    const r = p.get('r'), k = p.get('k'), s = p.get('s'), h = p.get('h');
    if (validHash({ r, k, s, h })) return { r, k, s, h };
  }
  return null;
}
function openJoin(){
  $('#join-input').value = '';
  $('#join-error').hidden = true;
  $('#modal-join').hidden = false;
  setTimeout(() => $('#join-input').focus(), 50);
}
function goJoin(){
  const inv = extractInvite($('#join-input').value);
  if (!inv){
    const e = $('#join-error');
    e.textContent = 'Link incompleto. Cole o convite inteiro, incluindo tudo depois do #.';
    e.hidden = false;
    return;
  }
  $('#modal-join').hidden = true;
  history.replaceState(null, '', location.href.split('#')[0] + '#r=' + inv.r + '&k=' + inv.k + (inv.s ? '&s=' + inv.s : '') + (inv.h ? '&h=' + inv.h : ''));
  location.reload();
}
function refreshConnHelp(){
  const box = $('#conn-help');
  if (!box) return;
  const show = S.view === 'chat' && !S.connected && !S.ended && S.roomId;
  box.hidden = !show;
  if (!show) return;
  const T = $('#conn-help-title'), P = $('#conn-help-text');
  if (S.linkUp) {
    T.textContent = 'Entrando na sala…';
    P.textContent = 'Verificando quem já está na conversa. Leva só alguns segundos.';
  } else if (S.wasConnected) {
    T.textContent = 'Reconectando…';
    P.textContent = 'A internet oscilou. Voltamos sozinhos assim que ela voltar.';
  } else {
    T.textContent = 'Conectando automaticamente…';
    P.textContent = 'Abrindo o canal cifrado da sala. Mantenha esta aba aberta.';
  }
}

/* ───────── encerrar / limpar ───────── */
function cleanupTimers(){
  ['typingStop','saveTimer'].forEach(k => { clearTimeout(S[k]); S[k] = 0; });
}
function resetSession(){
  S.ended = false; S.roomId = null; S.keyB64 = null; S.role = null;
  S.greeted = false; S.wasConnected = false; S.keyFails = 0; S.netState = 'idle';
  S.admitted = false; S.admitAt = 0; S.linkUp = false; S.myId = null; S.myIdBytes = null; S.joinedAt = 0;
  S.hostTag = null; S.disconnects = 0;
  S.adminKey = null; S.dh = null; S.keySent.clear(); S.adminNoted = undefined; clearTimeout(S.adminNoteTimer); pubCache.clear();
  S.me = genMe(); renderMe();
  S.replyTo = null; S.editingId = null; S.pinnedId = null; S.searchQuery = '';
}
function wipe(reason){
  if (S.ended) return;
  S.ended = true;
  cleanupTimers();
  S.transfersIn.forEach(tr => clearTimeout(tr.timer));
  relayStop(); p2pCloseAll();
  S.connected = false;
  S.members.forEach(m => clearTimeout(m.typingTimer)); S.members.clear();
  S.seen.clear(); S.mySent.clear(); S.sentAt.clear(); S.gone.clear(); S.deadBoots.clear(); S.leaveFrame = null; S.rtt = 0;
  S.messages.forEach(m => { if (m.blobUrl) { try { URL.revokeObjectURL(m.blobUrl); } catch {} } });
  try { localStorage.removeItem(skey()); } catch {}
  try { sessionStorage.removeItem(rkey()); sessionStorage.removeItem(idKey()); sessionStorage.removeItem(admKey()); } catch {}
  S.messages = []; S.msgIndex.clear(); S.msgNodes.clear();
  S.transfersIn.clear(); S.transfersOut.clear(); S.outFiles.clear();
  S.outQueue = []; S.outBusy = false; S.pendingReads = [];
  S.replyTo = null; S.editingId = null; S.pinnedId = null; S.searchQuery = '';
  stopRecording();
  $('#reply-bar').hidden = true; $('#pinned-banner').hidden = true; $('#search-bar').hidden = true;
  closeReactPop(); if (delModal) delModal.hidden = true;
  S.cryptoKey = null;
  S.lastDay = ''; S.pillN = 0; S.unread = 0; S.rtt = 0;
  msgList.innerHTML = ''; emptyState.hidden = false; hidePill();
  closeLightbox(); closeSidebar();
  ['#qr-waiting','#qr-side'].forEach(s => { const c = $(s); const x = c.getContext('2d'); if (x) x.clearRect(0, 0, c.width, c.height); });
  history.replaceState(null, '', location.pathname + location.search);
  document.title = BASE_TITLE;
  if (reason === 'cancel') { resetSession(); showView('landing'); return; }
  const T = $('#ended-title'), P = $('#ended-text');
  if (reason === 'host-ended') { T.textContent = 'O admin encerrou a conversa'; P.textContent = 'Mensagens, arquivos e a chave de criptografia foram apagados deste dispositivo. Nenhum registro ficou em servidores.'; }
  else if (reason === 'left') { T.textContent = 'Você saiu da conversa'; P.textContent = 'As mensagens, os arquivos e a chave foram apagados deste dispositivo. Os outros participantes continuam conversando.'; }
  else if (reason === 'full') { T.textContent = 'Sala cheia'; P.textContent = 'Esta conversa já tem ' + MAX_MEMBERS + ' pessoas, o máximo permitido. Nada foi guardado neste dispositivo.'; }
  else { T.textContent = 'Conversa encerrada'; P.textContent = 'Mensagens, arquivos e a chave de criptografia foram apagados de todos os aparelhos. Não há como recuperar — nenhum registro ficou em servidores.'; }
  showView('ended');
  if (reason !== 'full') sound('end');
}
let confirmCb = null;
function openConfirm(title, text, okLabel, onOk){
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#btn-confirm-ok').textContent = okLabel;
  confirmCb = onOk;
  modalConfirm.hidden = false;
  $('#btn-confirm-cancel').focus();
}
function confirmEnd(){
  if (iAmAdmin()) { openAdminMenu(); return; }
  openConfirm('Sair da conversa?',
    'As mensagens e arquivos serão apagados deste aparelho. Os outros continuam conversando. Só o admin pode encerrar para todos.',
    'Sair da conversa', leaveRoom);
}
let admModal = null;
function openAdminMenu(){
  if (!admModal) {
    admModal = document.createElement('div'); admModal.className = 'modal'; admModal.hidden = true;
    admModal.innerHTML = '<div class="modal-card"><h3>Você é o admin</h3><p id="adm-menu-text"></p><div class="modal-actions" style="flex-direction:column;gap:8px">' +
      '<button id="btn-adm-end" class="btn btn-danger btn-block">Encerrar e apagar para todos</button>' +
      '<button id="btn-adm-leave" class="btn btn-ghost btn-block">Sair e passar o admin</button>' +
      '<button id="btn-adm-cancel" class="btn btn-ghost btn-block">Cancelar</button></div></div>';
    document.body.appendChild(admModal);
    admModal.querySelector('#btn-adm-end').addEventListener('click', () => { admModal.hidden = true; endForAll(); });
    admModal.querySelector('#btn-adm-leave').addEventListener('click', () => { admModal.hidden = true; leaveRoom(); });
    admModal.querySelector('#btn-adm-cancel').addEventListener('click', () => { admModal.hidden = true; });
    admModal.addEventListener('click', e => { if (e.target === admModal) admModal.hidden = true; });
  }
  const next = nextInLine();
  $('#adm-menu-text').textContent = 'Encerrar apaga mensagens, arquivos e a chave de todos os aparelhos, agora. ' +
    (next ? 'Se só sair, ' + next.name + ' passa a ser o admin.' : 'Se só sair, a sala fica vazia.');
  admModal.querySelector('#btn-adm-leave').textContent = next ? 'Sair e passar o admin para ' + next.name : 'Sair da conversa';
  admModal.hidden = false;
}

/* ───────── lightbox / sidebar / emoji ───────── */
function openLightbox(m){
  $('#lightbox-img').src = m.blobUrl;
  $('#lightbox-img').alt = m.name;
  const dl = $('#lightbox-download');
  dl.href = m.blobUrl; dl.download = m.name;
  lightbox.hidden = false;
}
function closeLightbox(){ lightbox.hidden = true; $('#lightbox-img').src = ''; }
function openSidebar(){ sidebar.classList.add('open'); scrim.classList.add('show'); }
function closeSidebar(){ sidebar.classList.remove('open'); scrim.classList.remove('show'); }
function buildEmoji(){
  EMOJIS.forEach(e => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = e; b.setAttribute('aria-label', 'Emoji ' + e);
    b.addEventListener('click', () => {
      const s = input.selectionStart || 0, en = input.selectionEnd || 0;
      input.setRangeText(e, s, en, 'end');
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
    emojiPop.appendChild(b);
  });
}

/* ───────── criar / entrar ───────── */
const readHash = () => { const p = new URLSearchParams(location.hash.replace(/^#/, '')); return { r: p.get('r'), k: p.get('k'), s: p.get('s'), h: p.get('h') }; };
const validHash = h => {
  if (!/^[0-9a-f]{24}$/.test(h.r || '')) return false;
  if (h.h && !/^[A-Za-z0-9_-]{22}$/.test(h.h)) return false;
  const k = h.k || '';
  if (h.s) return /^[A-Za-z0-9_-]{80}$/.test(k) && /^[A-Za-z0-9_-]{22}$/.test(h.s);
  return /^[A-Za-z0-9_-]{43}$/.test(k);
};
async function createRoom(password){
  if (S.roomId) return;
  const kb = rand(32);
  S.role = 'host'; S.roomId = hex(rand(12)); S.createdAt = Date.now();
  try {
    if (password) {
      const salt = rand(16);
      S.keyB64 = b64u(await wrapKey(kb, password, salt)); S.saltB64 = b64u(salt); S.hasPassword = true;
    } else { S.keyB64 = b64u(kb); S.saltB64 = null; S.hasPassword = false; }
  } catch { showError('Não foi possível proteger a sala com senha.'); return; }
  // chave de admin: só quem a tem encerra para todos (o link leva só o hash da chave pública)
  try { await createAdminKey(); await ensureDH(); } catch { showError('Não foi possível gerar as chaves da sala.'); return; }
  try { sessionStorage.setItem(rkey(), JSON.stringify({ role: 'host' })); } catch {}
  try { S.cryptoKey = await importKey(kb); } catch { showError('Não foi possível gerar a chave de criptografia.'); return; }
  history.replaceState(null, '', hashStr());
  loadIdentity();
  await restore();
  renderInvite(); renderMe(); renderMembers();
  showView('waiting'); setStatus('connecting');
  relayStart();
  copyLink(true);
}
async function joinRoom(h, password){
  S.role = 'guest'; S.roomId = h.r; S.createdAt = Date.now(); S.hostTag = h.h || null;
  let kb;
  if (h.s) {
    if (!password) { pendingJoin = h; pendingResume = false; $('#pass-join-error').hidden = true; $('#modal-pass-join').hidden = false; setTimeout(() => $('#pass-join-input').focus(), 50); return; }
    try { kb = await unwrapKey(ub64(h.k), password, ub64(h.s)); }
    catch { pendingJoin = h; pendingResume = false; const e = $('#pass-join-error'); e.textContent = 'Senha incorreta. Tente novamente.'; e.hidden = false; $('#modal-pass-join').hidden = false; return; }
    S.saltB64 = h.s; S.hasPassword = true;
  } else { kb = ub64(h.k); S.saltB64 = null; S.hasPassword = false; }
  S.keyB64 = h.k;
  try { S.cryptoKey = await importKey(kb); } catch { showError('A chave do link é inválida.'); return; }
  $('#modal-pass-join').hidden = true; pendingJoin = null;
  loadIdentity();
  try { await ensureDH(); await loadAdminKey(); } catch {}
  await restore();
  renderInvite(); renderMe(); renderMembers();
  showView('chat'); setStatus('connecting');
  relayStart();
}

/* ───────── fundo: partículas de névoa ───────── */
function initFx(){
  const cv = $('#fx'), ctx = cv.getContext('2d');
  if (!ctx) return;   // anima sempre, mesmo com "reduzir movimento" no aparelho
  const COLORS = ['139,124,255', '53,224,230', '255,77,158'];
  const sprites = COLORS.map(c => {
    const s = document.createElement('canvas'); s.width = s.height = 64;
    const x = s.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${c},.9)`); g.addColorStop(1, `rgba(${c},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return s;
  });
  let W = 0, H = 0, parts = [], raf = 0;
  function resize(){
    const dpr = 1;   // partículas são borradas: resolução extra só custa GPU
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(28, Math.max(12, Math.floor(W * H / 45000)));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 20 + Math.random() * 70, s: .1 + Math.random() * .35,
      c: Math.floor(Math.random() * 3), a: .04 + Math.random() * .09, p: Math.random() * Math.PI * 2
    }));
  }
  let last = 0;
  function loop(t){
    raf = requestAnimationFrame(loop);
    // ~30 fps bastam para partículas lentas; pausa fora da landing e com a aba oculta
    if (document.hidden || S.view !== 'landing' || t - last < 33) return;
    const dt = Math.min(3, (t - last) / 16.7); last = t;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y -= p.s * dt; p.x += Math.sin(t * .0003 + p.p) * .2 * dt;
      if (p.y < -p.r) { p.y = H + p.r; p.x = Math.random() * W; }
      ctx.globalAlpha = p.a * (.6 + .4 * Math.sin(t * .001 + p.p));
      ctx.drawImage(sprites[p.c], p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    ctx.globalAlpha = 1;
  }
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  resize();
  raf = requestAnimationFrame(loop);
}
function initReveal(){
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .1, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(el => io.observe(el));
  const links = $$('.top-link');
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  ['como', 'privacidade', 'usar'].forEach(id => { const s = document.getElementById(id); if (s) spy.observe(s); });
}

/* ───────── eventos ───────── */
function wireEvents(){
  $('#btn-create').addEventListener('click', () => createRoom());
  $('#btn-create-2').addEventListener('click', () => createRoom());
  $('#btn-join-paste').addEventListener('click', openJoin);
  $('#btn-whatsapp').addEventListener('click', () => shareTo('whatsapp'));
  $('#btn-telegram').addEventListener('click', () => shareTo('telegram'));
  $('#btn-retry-now').addEventListener('click', () => { toast('info', 'Tentando conectar agora…'); kickLinks(); });
  $('#btn-sound').addEventListener('click', toggleSound);
  $('#btn-copy-link').addEventListener('click', copyLink);
  $('#btn-copy-side').addEventListener('click', copyLink);
  $('#btn-share').addEventListener('click', shareLink);
  $('#btn-share-side').addEventListener('click', shareLink);
  $('#btn-cancel-waiting').addEventListener('click', () => wipe('cancel'));
  $('#btn-end').addEventListener('click', confirmEnd);
  $('#btn-end-top').addEventListener('click', confirmEnd);
  $('#btn-new').addEventListener('click', () => { resetSession(); showView('landing'); });
  $('#btn-reload').addEventListener('click', () => location.reload());
  $('#btn-menu').addEventListener('click', openSidebar);
  $('#btn-close-side').addEventListener('click', closeSidebar);
  scrim.addEventListener('click', closeSidebar);

  // Névoa+
  $('#btn-create-pass').addEventListener('click', () => { $('#pass-create-error').hidden = true; $('#modal-pass-create').hidden = false; setTimeout(() => $('#pass-create-input').focus(), 50); });
  $('#btn-pass-create-go').addEventListener('click', submitPassCreate);
  $('#btn-pass-create-cancel').addEventListener('click', () => { $('#modal-pass-create').hidden = true; });
  $('#pass-create-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') submitPassCreate(); });
  $('#btn-pass-join-go').addEventListener('click', submitPassJoin);
  $('#btn-pass-join-cancel').addEventListener('click', () => { $('#modal-pass-join').hidden = true; pendingJoin = null; pendingResume = false; resetSession(); showView('landing'); });
  $('#pass-join-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitPassJoin(); });
  $('#btn-preview-go').addEventListener('click', () => { const h = pendingPreview; $('#modal-preview').hidden = true; if (h) joinRoom(h); });
  $('#btn-preview-cancel').addEventListener('click', () => { $('#modal-preview').hidden = true; pendingPreview = null; history.replaceState(null, '', location.pathname + location.search); showView('landing'); });
  $('#btn-reply-cancel').addEventListener('click', () => { cancelReply(); cancelEdit(); });
  $('#btn-mic').addEventListener('click', toggleRecording);
  const morePop = $('#more-pop');
  $('#btn-more').addEventListener('click', e => { e.stopPropagation(); morePop.hidden = !morePop.hidden; });
  document.addEventListener('click', e => { if (!morePop.hidden && !morePop.contains(e.target) && !e.target.closest('#btn-more')) morePop.hidden = true; });
  $('#mp-attach').addEventListener('click', () => { morePop.hidden = true; fileInput.click(); });
  $('#mp-emoji').addEventListener('click', () => { morePop.hidden = true; emojiPop.hidden = !emojiPop.hidden; });
  $('#mp-mic').addEventListener('click', () => { morePop.hidden = true; toggleRecording(); });
  $('#btn-search').addEventListener('click', openSearch);
  $('#btn-search-close').addEventListener('click', closeSearch);
  $('#search-input').addEventListener('input', e => applySearch(e.target.value));
  $('#pinned-banner').addEventListener('click', e => { if (e.target.closest('#btn-unpin')) return; if (S.pinnedId) jumpToMessage(S.pinnedId); });
  $('#btn-unpin').addEventListener('click', () => { if (S.pinnedId) togglePin(S.pinnedId); });
  $('#btn-diag').addEventListener('click', openDiag);
  $('#btn-diag-side').addEventListener('click', openDiag);
  $('#btn-diag-close').addEventListener('click', () => { $('#modal-diag').hidden = true; });
  $('#btn-appear').addEventListener('click', openAppear);
  $('#btn-appear-top').addEventListener('click', openAppear);
  $('#btn-appear-close').addEventListener('click', () => { $('#modal-appear').hidden = true; });
  $('#appear-color').addEventListener('input', e => { S.accent = e.target.value; applyAccent(); savePrefs(); syncAppear(); });
  $('#appear-blur').addEventListener('change', e => { S.blurOn = e.target.checked; savePrefs(); if (!S.blurOn) setBlurred(false); });
  $('#appear-p2p').addEventListener('change', e => {
    S.p2pPref = e.target.checked; savePrefs();
    if (!S.p2pPref) { p2pCloseAll(); toast('info', 'Conexão direta desligada: tudo passa pelo relay cifrado.'); }
    else { p2pSync(); toast('info', 'Conexão direta ligada.'); }
    renderMembers(); renderLatency();
  });
  $('#btn-sound-chat').addEventListener('click', toggleSound);
  $('#btn-split').addEventListener('click', openSplit);
  $('#btn-split-room').addEventListener('click', () => copyText(S.roomId || '', 'Código da sala copiado.'));
  $('#btn-split-key').addEventListener('click', () => copyText(S.keyB64 || '', 'Chave copiada. Envie por outro canal.'));
  $('#btn-split-close').addEventListener('click', () => { $('#modal-split').hidden = true; });

  input.addEventListener('input', () => { autogrow(); updateSendBtn(); updateCharCount(); typingPing(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } });
  input.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) if (it.kind === 'file') {
      const f = it.getAsFile();
      if (f) { e.preventDefault(); handleFiles([f]); }
      return;
    }
  });
  btnSend.addEventListener('click', sendText);
  $('#btn-attach').addEventListener('click', () => {
    if (!S.connected) { toast('warn', 'Conecte-se antes de enviar arquivos.'); return; }
    fileInput.click();
  });
  fileInput.addEventListener('change', () => { handleFiles([...fileInput.files]); fileInput.value = ''; });
  $('#btn-emoji').addEventListener('click', e => { e.stopPropagation(); emojiPop.hidden = !emojiPop.hidden; });
  document.addEventListener('click', e => {
    if (!emojiPop.hidden && !emojiPop.contains(e.target) && e.target !== $('#btn-emoji')) emojiPop.hidden = true;
  });

  msgList.addEventListener('click', e => {
    const cb = e.target.closest('.cb-copy');
    if (cb) { const pre = cb.parentElement.querySelector('pre'); if (pre) copyText(pre.textContent, 'Código copiado.'); return; }
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const act = b.dataset.action;
    if (act === 'jump') { jumpToMessage(b.dataset.id); return; }
    const m = S.msgIndex.get(b.dataset.id);
    if (!m) return;
    if (act === 'preview' && m.blobUrl) openLightbox(m);
    else if (act === 'cancel') { const c = S.transfersOut.get(m.tid); if (c) c.canceled = true; }
    else if (act === 'retry') {
      const f = S.outFiles.get(m.id);
      if (!f) { toast('warn', 'Arquivo não está mais na memória. Anexe novamente.'); return; }
      if (!S.connected) { toast('warn', 'Sem conexão no momento.'); return; }
      queueFile(f, m);
    }
    else if (act === 'reply') startReply(m.id);
    else if (act === 'react') openReactPop(m, b);
    else if (act === 'react-toggle') toggleReaction(m.id, b.dataset.emoji);
    else if (act === 'edit') startEdit(m.id);
    else if (act === 'pin') togglePin(m.id);
    else if (act === 'delete') openDeleteMenu(m);
  });
  msgScroll.addEventListener('scroll', () => { trackStick(); if (nearBottom()) hidePill(); });
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', fitViewport);
    visualViewport.addEventListener('scroll', fitViewport);
  }
  addEventListener('resize', fitViewport);
  input.addEventListener('focus', () => { fitViewport(); setTimeout(fitViewport, 120); setTimeout(fitViewport, 400); });
  fitViewport();
  scrollPill.addEventListener('click', () => scrollToBottom(true));

  chatMain.addEventListener('dragenter', e => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); S.dragDepth++; dropOverlay.hidden = false; }
  });
  chatMain.addEventListener('dragover', e => { if (!dropOverlay.hidden) e.preventDefault(); });
  chatMain.addEventListener('dragleave', () => { S.dragDepth = Math.max(0, S.dragDepth - 1); if (!S.dragDepth) dropOverlay.hidden = true; });
  chatMain.addEventListener('drop', e => {
    e.preventDefault(); S.dragDepth = 0; dropOverlay.hidden = true;
    if (e.dataTransfer && e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]);
  });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => e.preventDefault());

  $('#btn-confirm-ok').addEventListener('click', () => { modalConfirm.hidden = true; const cb = confirmCb; confirmCb = null; if (cb) cb(); });
  $('#btn-confirm-cancel').addEventListener('click', () => { modalConfirm.hidden = true; confirmCb = null; });
  modalConfirm.addEventListener('click', e => { if (e.target === modalConfirm) { modalConfirm.hidden = true; confirmCb = null; } });

  $('#btn-edit-name').addEventListener('click', () => {
    $('#name-input').value = S.me.name;
    modalName.hidden = false;
    $('#name-input').focus(); $('#name-input').select();
  });
  const saveName = () => {
    const v = $('#name-input').value.trim().slice(0, 24);
    if (!v) { toast('warn', 'Digite um apelido.'); return; }
    S.me.name = v; S.me.auto = false; renderMe();
    sendJSON({ t: 'profile', name: v });
    saveSoon();
    modalName.hidden = true;
    toast('ok', 'Apelido atualizado.');
  };
  $('#btn-name-save').addEventListener('click', saveName);
  $('#btn-name-cancel').addEventListener('click', () => { modalName.hidden = true; });
  $('#name-input').addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });
  modalName.addEventListener('click', e => { if (e.target === modalName) modalName.hidden = true; });

  $('#btn-join-cancel').addEventListener('click', () => { $('#modal-join').hidden = true; });
  $('#btn-join-go').addEventListener('click', goJoin);
  $('#modal-join').addEventListener('click', e => { if (e.target === $('#modal-join')) $('#modal-join').hidden = true; });
  $('#join-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); goJoin(); } });
  $('#join-input').addEventListener('paste', () => setTimeout(() => { if (extractInvite($('#join-input').value)) goJoin(); }, 120));
  $('#lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!lightbox.hidden) closeLightbox();
    else if (!modalConfirm.hidden) { modalConfirm.hidden = true; confirmCb = null; }
    else if (!modalName.hidden) modalName.hidden = true;
    else if (!$('#modal-join').hidden) $('#modal-join').hidden = true;
    else if (!$('#modal-preview').hidden) $('#modal-preview').hidden = true;
    else if (!$('#modal-pass-create').hidden) $('#modal-pass-create').hidden = true;
    else if (!$('#modal-pass-join').hidden) $('#modal-pass-join').hidden = true;
    else if (!$('#modal-diag').hidden) $('#modal-diag').hidden = true;
    else if (!$('#modal-appear').hidden) $('#modal-appear').hidden = true;
    else if (!$('#modal-split').hidden) $('#modal-split').hidden = true;
    else if (admModal && !admModal.hidden) admModal.hidden = true;
    else if (delModal && !delModal.hidden) { delModal.hidden = true; delTarget = null; }
    else if (reactPop && !reactPop.hidden) closeReactPop();
    else if (!$('#search-bar').hidden) closeSearch();
    else if (!$('#reply-bar').hidden) { cancelReply(); cancelEdit(); }
    else if (!emojiPop.hidden) emojiPop.hidden = true;
    else closeSidebar();
  });

  const wake = () => { ensureAudio(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); };
  document.addEventListener('pointerdown', wake, { passive: true });
  document.addEventListener('keydown', wake);

  addEventListener('focus', flushReads);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushReads(); });
  addEventListener('online', () => { if (!S.ended) kickLinks(); });
  addEventListener('hashchange', () => { const h = readHash(); if ((h.r || null) !== S.roomId || S.ended) location.reload(); });
}

/* ───────── Névoa+ : resposta, reações, edição, apagar, fixar, busca, voz, diagnóstico, aparência, privacidade ───────── */
let pendingJoin = null, pendingResume = false, pendingPreview = null;
let reactPop = null, reactTarget = null, delModal = null, delTarget = null;

async function deriveWrapKey(password, saltBytes){
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITER, hash:'SHA-256' }, base, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function wrapKey(kb, password, saltBytes){
  const wk = await deriveWrapKey(password, saltBytes);
  const iv = rand(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, wk, kb));
  const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12); return out;
}
async function unwrapKey(wrapped, password, saltBytes){
  const wk = await deriveWrapKey(password, saltBytes);
  return new Uint8Array(await crypto.subtle.decrypt({ name:'AES-GCM', iv: wrapped.slice(0,12) }, wk, wrapped.slice(12)));
}

function startReply(id){
  const m = S.msgIndex.get(id); if (!m || m.kind === 'sys') return;
  S.editingId = null; S.replyTo = id;
  $('#reply-label').textContent = 'Respondendo a ' + (m.dir === 'out' ? 'você' : (m.fromName || 'Anônimo'));
  $('#reply-text').textContent = m.kind === 'text' ? m.text : (m.name || 'Arquivo');
  $('#reply-bar').hidden = false; input.focus();
}
function cancelReply(){ S.replyTo = null; $('#reply-bar').hidden = true; }
function startEdit(id){
  const m = S.msgIndex.get(id); if (!m || m.dir !== 'out' || m.kind !== 'text') return;
  S.replyTo = null; S.editingId = id;
  input.value = m.text; autogrow(); updateCharCount(); updateSendBtn();
  $('#reply-label').textContent = 'Editando mensagem'; $('#reply-text').textContent = m.text;
  $('#reply-bar').hidden = false; input.focus();
}
function cancelEdit(){ S.editingId = null; $('#reply-bar').hidden = true; }

function toggleReaction(id, emoji){
  const m = S.msgIndex.get(id); if (!m || m.kind === 'sys') return;
  normReactions(m);
  const on = !(m.reactions[emoji] || []).includes(S.myId);
  setReaction(m, emoji, S.myId, on);
  updateMsg(m); saveSoon();
  sendJSON({ t:'react', id, emoji, on });
}
function ensureReactPop(){
  if (reactPop) return;
  reactPop = document.createElement('div'); reactPop.className = 'react-pop'; reactPop.hidden = true; reactPop.style.position = 'fixed';
  REACTIONS.forEach(e => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = e;
    b.addEventListener('click', () => { if (reactTarget) toggleReaction(reactTarget, e); closeReactPop(); });
    reactPop.appendChild(b);
  });
  document.body.appendChild(reactPop);
  document.addEventListener('click', ev => { if (!reactPop.hidden && !reactPop.contains(ev.target) && !ev.target.closest('[data-action="react"]')) closeReactPop(); });
}
function openReactPop(m, anchor){
  ensureReactPop(); reactTarget = m.id; reactPop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const pw = reactPop.offsetWidth, ph = reactPop.offsetHeight;
  const x = Math.min(Math.max(8, r.left), innerWidth - pw - 8);
  let y = r.top - ph - 6; if (y < 8) y = r.bottom + 6;
  reactPop.style.left = x + 'px'; reactPop.style.top = y + 'px';
}
function closeReactPop(){ if (reactPop) reactPop.hidden = true; reactTarget = null; }

function removeMessageLocal(m){
  S.messages = S.messages.filter(x => x.id !== m.id);
  S.msgIndex.delete(m.id);
  const node = S.msgNodes.get(m.id); if (node) node.remove();
  S.msgNodes.delete(m.id);
  if (m.blobUrl) { try { URL.revokeObjectURL(m.blobUrl); } catch {} }
  if (S.pinnedId === m.id) { S.pinnedId = null; renderPinned(); }
  if (S.replyTo === m.id) cancelReply();
  if (S.editingId === m.id) cancelEdit();
  saveSoon();
}
function deleteForMe(m){ removeMessageLocal(m); toast('info', 'Mensagem apagada para você.'); }
function deleteForEveryone(m){
  if (!S.connected) { toast('warn', 'Sem conexão — não dá para apagar para todos agora.'); return; }
  sendJSON({ t:'del', id: m.id }); removeMessageLocal(m); toast('info', 'Mensagem apagada para todos.');
}
function ensureDelModal(){
  if (delModal) return;
  delModal = document.createElement('div'); delModal.className = 'modal'; delModal.hidden = true;
  delModal.innerHTML = '<div class="modal-card"><h3>Apagar mensagem</h3><p>Como você quer apagar?</p><div class="modal-actions" style="flex-direction:column;gap:8px"><button id="btn-del-everyone" class="btn btn-danger btn-block">Apagar para todos</button><button id="btn-del-me" class="btn btn-ghost btn-block">Apagar para mim</button><button id="btn-del-cancel" class="btn btn-ghost btn-block">Cancelar</button></div></div>';
  document.body.appendChild(delModal);
  delModal.querySelector('#btn-del-everyone').addEventListener('click', () => { delModal.hidden = true; if (delTarget) deleteForEveryone(delTarget); delTarget = null; });
  delModal.querySelector('#btn-del-me').addEventListener('click', () => { delModal.hidden = true; if (delTarget) deleteForMe(delTarget); delTarget = null; });
  delModal.querySelector('#btn-del-cancel').addEventListener('click', () => { delModal.hidden = true; delTarget = null; });
  delModal.addEventListener('click', e => { if (e.target === delModal) { delModal.hidden = true; delTarget = null; } });
}
function openDeleteMenu(m){ ensureDelModal(); delTarget = m; delModal.hidden = false; }

function togglePin(id){
  const on = S.pinnedId !== id;
  S.pinnedId = on ? id : null;
  sendJSON({ t:'pin', id, on });
  renderPinned(); markPinned(); saveSoon();
}
function renderPinned(){
  const m = S.pinnedId ? S.msgIndex.get(S.pinnedId) : null;
  if (!m) { $('#pinned-banner').hidden = true; return; }
  $('#pinned-text').textContent = m.kind === 'text' ? m.text : (m.name || 'Arquivo');
  $('#pinned-banner').hidden = false;
}
function markPinned(){ S.msgNodes.forEach((node, id) => node.classList.toggle('pinned-msg', id === S.pinnedId)); }

function openSearch(){ $('#search-bar').hidden = false; $('#search-input').focus(); }
function closeSearch(){ $('#search-bar').hidden = true; $('#search-input').value = ''; applySearch(''); }
function applySearch(q){
  S.searchQuery = q.trim().toLowerCase();
  let hits = 0;
  S.msgNodes.forEach((node, id) => {
    const m = S.msgIndex.get(id);
    if (!m || m.kind === 'sys') { node.classList.remove('search-hidden','search-hit'); return; }
    const text = (m.kind === 'text' ? m.text : (m.name || '')).toLowerCase();
    const match = !S.searchQuery || text.includes(S.searchQuery);
    node.classList.toggle('search-hidden', !match);
    node.classList.toggle('search-hit', !!S.searchQuery && match);
    if (S.searchQuery && match) hits++;
  });
  $('#search-count').textContent = S.searchQuery ? hits + ' resultado' + (hits === 1 ? '' : 's') : '';
  let sep = null, visible = 0;
  [...msgList.children].forEach(n => {
    if (n.classList.contains('day-sep')) { if (sep) sep.style.display = visible ? '' : 'none'; sep = n; visible = 0; }
    else if (n.classList.contains('msg') && !n.classList.contains('search-hidden')) visible++;
  });
  if (sep) sep.style.display = visible ? '' : 'none';
}

async function toggleRecording(){
  if (S.recorder && S.recorder.state === 'recording') { stopRecording(); return; }
  if (!S.connected) { toast('warn', 'Conecte-se antes de gravar.'); return; }
  if (!navigator.mediaDevices || !window.MediaRecorder) { toast('error', 'Gravação de voz não suportada neste navegador.'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    S.recorder = rec; S.recChunks = []; S.recStart = Date.now();
    rec.ondataavailable = e => { if (e.data && e.data.size) S.recChunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      clearInterval(S.recTimer); $('#rec-indicator').classList.remove('show'); $('#btn-mic').classList.remove('recording');
      const blob = new Blob(S.recChunks, { type: rec.mimeType || 'audio/webm' });
      S.recorder = null; S.recChunks = [];
      if (blob.size > MAX_FILE) { toast('error', 'Gravação muito longa (máx. 8 MB).'); return; }
      if (blob.size > 0) {
        const secs = Math.max(1, Math.round((Date.now() - S.recStart) / 1000));
        queueFile(new File([blob], 'mensagem-de-voz-' + secs + 's.webm', { type: blob.type }));
      }
    };
    rec.start(250);
    $('#btn-mic').classList.add('recording'); $('#rec-indicator').classList.add('show');
    S.recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - S.recStart) / 1000);
      $('#rec-time').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      if (s >= 120) stopRecording();
    }, 500);
  } catch { toast('error', 'Não foi possível acessar o microfone. Verifique a permissão.'); }
}
function stopRecording(){ if (S.recorder && S.recorder.state === 'recording') { try { S.recorder.stop(); } catch {} } }

function openDiag(){
  const rows = [
    ['Papel', iAmAdmin() ? 'admin' : S.role ? 'convidado' : '—'], ['Admin da sala', (() => { const a = activeAdminId(); return !a ? 'ninguém no momento' : a === S.myId ? 'você' : memberName(a); })()], ['Sala', S.roomId ? S.roomId.slice(0,12) + '…' : '—'],
    ['Conectado', S.connected ? 'sim' : 'não'], ['Estado da rede', S.netState],
    ['Participantes', (admittedMembers().length + (S.admitted ? 1 : 0)) + ' de ' + MAX_MEMBERS],
    ['Rota', (() => { const t = admittedMembers().length, d = admittedMembers().filter(m => isDirect(m.id)).length; return t ? d + ' direto (P2P) · ' + (t - d) + ' pelo relay' : '—'; })()],
    ['Latência direta', directPeers().length ? directPeers().map(p => (p.rtt || '?') + ' ms').join(', ') : '—'],
    ['Latência relay', S.rtt ? S.rtt + ' ms' : '—'],
    ['P2P', p2pOn() ? 'ativado' : 'desativado'],
    ['Relays prontos', readyLinks().length + '/' + R.links.length + (readyLinks().length ? ' · ' + readyLinks().map(l => l.url.split('/')[2].split(':')[0]).join(', ') : '')],
    ['Quedas', String(S.disconnects)],
    ['Senha na sala', S.hasPassword ? 'sim' : 'não']
  ];
  $('#diag-grid').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  $('#modal-diag').hidden = false;
}

// [id, nome, fundo, destaque sugerido, claro?]
const THEMES = [
  ['nevoa','Névoa','#0B0D1E','#8B7CFF',0], ['meianoite','Meia-noite','#030409','#55A6FF',0],
  ['oceano','Oceano','#071a26','#35E0E6',0], ['floresta','Floresta','#0b1a12','#3DDC97',0],
  ['crepusculo','Crepúsculo','#1d0f17','#FF6B8B',0], ['claro','Claro','#f2f3fa','#5B4BE8',1],
  ['papel','Papel','#f5efe4','#B5562B',1], ['contraste','Contraste','#000000','#FFD400',0]
];
const ACCENTS = ['#8B7CFF','#5B4BE8','#35E0E6','#3DDC97','#FF6B8B','#FFB020','#B5562B','#55A6FF'];
function applyTheme(){
  const t = THEMES.find(x => x[0] === S.theme) || THEMES[0];
  document.body.className = document.body.className.replace(/\btheme-\S+/g, '').trim();
  if (t[0] !== 'nevoa') document.body.classList.add('theme-' + t[0]);
  if (t[4]) document.body.classList.add('theme-light');
  const mc = document.querySelector('meta[name="theme-color"]'); if (mc) mc.content = t[2];
}
function applyAccent(){
  document.documentElement.style.setProperty('--accent', S.accent);
  document.documentElement.style.setProperty('--accent-deep', S.accent);
}
function savePrefs(){ try { localStorage.setItem('nevoa:pref:theme', S.theme); localStorage.setItem('nevoa:pref:accent', S.accent); localStorage.setItem('nevoa:pref:blur', S.blurOn ? '1' : '0'); localStorage.setItem('nevoa:pref:p2p', S.p2pPref ? '1' : '0'); } catch {} }
function loadPrefs(){
  try { S.theme = localStorage.getItem('nevoa:pref:theme') || 'nevoa'; S.accent = localStorage.getItem('nevoa:pref:accent') || '#8B7CFF'; S.blurOn = localStorage.getItem('nevoa:pref:blur') !== '0'; S.p2pPref = localStorage.getItem('nevoa:pref:p2p') !== '0'; } catch {}
  applyTheme(); applyAccent();
}
function buildAppearPanel(){
  const tw = $('#appear-themes'); tw.innerHTML = '';
  THEMES.forEach(([id, label, bg, acc]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'appear-theme'; b.dataset.theme = id;
    b.style.background = `linear-gradient(135deg, ${bg} 55%, ${acc})`; b.setAttribute('aria-label', 'Tema ' + label);
    b.innerHTML = `<i style="background:${acc}"></i><span>${label}</span>`;
    b.addEventListener('click', () => { S.theme = id; S.accent = acc; applyTheme(); applyAccent(); savePrefs(); syncAppear(); });
    tw.appendChild(b);
  });
  const sw = $('#appear-swatches'); sw.innerHTML = '';
  ACCENTS.forEach(c => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'appear-swatch'; b.style.background = c; b.dataset.accent = c;
    b.addEventListener('click', () => { S.accent = c; applyAccent(); savePrefs(); syncAppear(); });
    sw.appendChild(b);
  });
}
function syncAppear(){
  $$('#appear-themes .appear-theme').forEach(b => b.classList.toggle('active', b.dataset.theme === S.theme));
  $$('#appear-swatches .appear-swatch').forEach(b => b.classList.toggle('active', b.dataset.accent === S.accent));
  $('#appear-color').value = S.accent; $('#appear-blur').checked = S.blurOn; $('#appear-p2p').checked = S.p2pPref;
}
function openAppear(){ buildAppearPanel(); syncAppear(); $('#modal-appear').hidden = false; }

function setBlurred(on){
  if (!S.blurOn) on = false;
  if (S.view !== 'chat' && S.view !== 'waiting') on = false;
  document.body.classList.toggle('privacy-blurred', !!on);
}
function initPrivacyBlur(){
  document.addEventListener('visibilitychange', () => setBlurred(document.hidden));
  addEventListener('blur', () => setBlurred(true));
  addEventListener('focus', () => setBlurred(false));
  $('#privacy-shield').addEventListener('click', () => setBlurred(false));
}

function showInvitePreview(h){
  pendingPreview = h;
  $('#preview-id').textContent = 'Sala ' + h.r.slice(0,10) + '…';
  $('#preview-lock').hidden = !h.s;
  $('#modal-preview').hidden = false;
}
function submitPassJoin(){
  const pw = $('#pass-join-input').value;
  if (!pw) { const e = $('#pass-join-error'); e.textContent = 'Digite a senha.'; e.hidden = false; return; }
  $('#pass-join-input').value = '';
  const h = pendingJoin;
  if (!h) { $('#modal-pass-join').hidden = true; return; }
  if (pendingResume) resumeHost(h, pw); else joinRoom(h, pw);
}
function submitPassCreate(){
  const p1 = $('#pass-create-input').value, p2 = $('#pass-create-confirm').value;
  const e = $('#pass-create-error');
  if (p1.length < 4) { e.textContent = 'Use pelo menos 4 caracteres.'; e.hidden = false; return; }
  if (p1 !== p2) { e.textContent = 'As senhas não conferem.'; e.hidden = false; return; }
  e.hidden = true; $('#modal-pass-create').hidden = true;
  $('#pass-create-input').value = ''; $('#pass-create-confirm').value = '';
  createRoom(p1);
}

function renderQuality(){
  const badge = $('#quality-badge');
  if (!S.connected) { badge.hidden = true; return; }
  badge.hidden = false;
  let q = 'good', label = 'boa';
  const r = bestRtt();
  if (r >= 400 || S.disconnects >= 3) { q = 'bad'; label = 'instável'; }
  else if (r >= 150 || S.disconnects >= 1) { q = 'ok'; label = 'regular'; }
  badge.dataset.q = q; $('#quality-text').textContent = label;
}
function sendPresence(state){ S.presence = state; if (S.connected) sendJSON({ t:'presence', state }); }
function initPresence(){
  document.addEventListener('visibilitychange', () => {
    sendPresence(document.hidden ? 'away' : 'online');
    // voltou para a aba (celular desbloqueado): confere se as conexões sobreviveram e se reapresenta
    if (!document.hidden && R.on && !S.ended) { kickLinks(); announce(false); }
  });
}

function openSplit(){
  $('#split-room').textContent = S.roomId || '—';
  $('#split-key').textContent = S.keyB64 ? S.keyB64.slice(0,24) + '…' : '—';
  $('#modal-split').hidden = false;
}
async function copyText(t, okMsg){ try { await navigator.clipboard.writeText(t); toast('ok', okMsg); } catch { toast('error', 'Não foi possível copiar.'); } }

function fogDissipate(){
  const f = $('#fog-veil');
  f.classList.add('show');
  requestAnimationFrame(() => requestAnimationFrame(() => { f.classList.add('dissipate'); setTimeout(() => f.classList.remove('show','dissipate'), 1200); }));
}
function jumpToMessage(id){
  const node = S.msgNodes.get(id);
  if (!node) { toast('info', 'Mensagem não encontrada.'); return; }
  node.scrollIntoView({ behavior:'smooth', block:'center' });
  node.classList.add('search-hit');
  setTimeout(() => node.classList.remove('search-hit'), 1600);
}

/* ───────── boot ───────── */
async function resumeHost(h, password){
  S.role = 'host'; S.roomId = h.r; S.createdAt = Date.now(); S.hostTag = h.h || null;
  let kb;
  if (h.s) {
    if (!password) { pendingJoin = h; pendingResume = true; $('#pass-join-error').hidden = true; $('#modal-pass-join').hidden = false; setTimeout(() => $('#pass-join-input').focus(), 50); return; }
    try { kb = await unwrapKey(ub64(h.k), password, ub64(h.s)); }
    catch { pendingJoin = h; pendingResume = true; const e = $('#pass-join-error'); e.textContent = 'Senha incorreta. Tente novamente.'; e.hidden = false; $('#modal-pass-join').hidden = false; return; }
    S.saltB64 = h.s; S.hasPassword = true;
  } else { kb = ub64(h.k); S.saltB64 = null; S.hasPassword = false; }
  S.keyB64 = h.k;
  try { S.cryptoKey = await importKey(kb); } catch { showError('A chave do link é inválida.'); return; }
  $('#modal-pass-join').hidden = true; pendingJoin = null; pendingResume = false;
  loadIdentity();
  try { await ensureDH(); await loadAdminKey(); } catch {}
  await restore();
  history.replaceState(null, '', hashStr());
  renderInvite(); renderMe(); renderMembers();
  showView(S.messages.length > 0 ? 'chat' : 'waiting');
  setStatus('connecting');
  relayStart();
}

async function boot(){
  wireEvents(); buildEmoji(); initFx(); initReveal();
  $('#year').textContent = new Date().getFullYear();
  try { S.soundOn = localStorage.getItem('nevoa:pref:sound') !== '0'; } catch {}
  renderSound(); renderMe(); sweepStorage();
  loadPrefs(); initPrivacyBlur(); initPresence();

  if (!window.crypto || !crypto.subtle) {
    showError('Este contexto não expõe WebCrypto. Abra o site via HTTPS (ou localhost) em um navegador atualizado.');
    return;
  }
  loadLib(QR_URLS)
    .then(() => { S.qrLib = true; if (S.roomId) drawQRs(); })
    .catch(() => { ['#qr-card', '#qr-card-side'].forEach(s => { const e = $(s); if (e) e.hidden = true; }); });

  const h = readHash();
  if (h.r || h.k) {
    if (!validHash(h)) {
      toast('error', 'Link inválido ou incompleto.');
      history.replaceState(null, '', location.pathname + location.search);
      showView('landing');
      return;
    }
    let saved = null;
    try { const raw = sessionStorage.getItem(rkey(h.r)); saved = raw === 'host' ? { role: 'host' } : JSON.parse(raw || 'null'); } catch {}
    if (saved && saved.role === 'host') await resumeHost(h);
    else showInvitePreview(h);
  } else showView('landing');
}
if (IS_DEV) window.__nevoa = { S, R, sendJSON, directPeers, iAmAdmin, activeAdminId };   // só em localhost, para os testes automáticos
// página restaurada do cache de voltar/avançar: ela já disse "saí" ao sair, então volta com outra identificação de página
addEventListener('pageshow', e => { if (e.persisted && R.on && !S.ended) { S.bootId = hex(rand(4)); S.helloSeq = 0; kickLinks(); announce(false, true); } });
addEventListener('pagehide', () => { try { if (S.leaveFrame && R.on) netSend(S.leaveFrame); } catch {} });
boot();
})();
