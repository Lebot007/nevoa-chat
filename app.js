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
const PEER_URLS = [
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
];
const QR_URLS = [
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'
];
const PEER_OPTS = {
  host: '0.peerjs.com', port: 443, path: '/', secure: true, debug: 0,
  config: { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }
    // NAT simétrico/firewall restritivo: adicione um TURN próprio, ex.:
    // { urls: ['turn:SEU_HOST:3478', 'turn:SEU_HOST:443?transport=tcp'], username: '...', credential: '...' }
  ]}
};
const ANIMALS = ['Corvo','Raposa','Lince','Garça','Orca','Falcão','Jaguar','Coruja','Lobo','Axolote','Pantera','Grou'];
const ADJS = ['Âmbar','Cobalto','Carmim','Violeta','Grafite','Turquesa','Escarlate','Índigo','Dourado','Prateado','Obsidiana','Ciano'];
const AV = [['#7C5CFF','#B44DFF'],['#35E0E6','#2E7CFF'],['#FF4D9E','#FF8A5C'],['#3DDC97','#35E0E6'],
            ['#FFB020','#FF5468'],['#55A6FF','#7C5CFF'],['#C24DFF','#FF4D9E'],['#2ECCB0','#7CE05C']];
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
  return String(raw).split(/(https?:\/\/[^\s]+)/g).map(p => {
    if (/^https?:\/\//.test(p)) {
      let url = p, trail = '';
      const m = url.match(/[.,;:!?)\]}'"]+$/);
      if (m) { trail = m[0]; url = url.slice(0, -trail.length); }
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>${esc(trail)}`;
    }
    return esc(p);
  }).join('');
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
  check2: svg('<path d="M1.5 8.5l3.5 3.5 8-9.5"/><path d="M10 10.5l1.5 1.5 8-9.5"/>', '0 0 22 14')
};

/* ───────── estado ───────── */
function genMe(){ return { name: pick(ANIMALS) + ' ' + pick(ADJS), color: Math.floor(Math.random() * AV.length) }; }
const S = {
  role: null, roomId: null, keyB64: null, cryptoKey: null,
  peer: null, conn: null, connected: false, wasConnected: false, ended: false,
  view: 'landing', netState: 'idle', me: genMe(), peerProfile: null, peerTyping: false, greeted: false,
  messages: [], msgIndex: new Map(), msgNodes: new Map(),
  transfersIn: new Map(), transfersOut: new Map(), outFiles: new Map(), outQueue: [], outBusy: false,
  pendingReads: [], unread: 0, rtt: 0, lastDay: '', pillN: 0,
  retryTimer: 0, dialTimeout: 0, pingTimer: 0, typingStop: 0, typingHide: 0, saveTimer: 0, lastTyping: 0,
  storageOk: true, keyFails: 0, createdAt: 0, soundOn: true, qrLib: false, dragDepth: 0
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
  $('#me-role').textContent = 'você · ' + (S.role === 'host' ? 'anfitrião' : S.role === 'guest' ? 'convidado' : '—');
}
function renderPeer(){
  const p = S.peerProfile;
  setAvatar($('#peer-avatar'), p); setAvatar($('#peer-avatar-h'), p);
  $('#peer-name').textContent = p ? p.name : '—';
  $('#peer-name-h').textContent = p ? p.name : 'Aguardando…';
}
function refreshStatus(){
  const on = S.connected;
  let txt, cls;
  if (on) { txt = S.peerTyping ? 'digitando' : 'online · criptografado'; cls = 'on'; }
  else {
    const map = { waiting:['aguardando convite…','warn'], connecting:['conectando…','warn'], handshake:['trocando chaves…','warn'],
      retry:['reconectando…','warn'], 'host-offline':['aguardando anfitrião…','warn'], signal:['reconectando ao sinal…','warn'],
      waitreturn:['aguardando retorno…','warn'], idle:['—','off'] };
    [txt, cls] = map[S.netState] || ['offline','off'];
  }
  $('#peer-status-h').innerHTML = (on && S.peerTyping)
    ? 'digitando<span class="tdots"><i></i><i></i><i></i></span>' : esc(txt);
  $('#room-status-dot').className = 'dot dot-' + cls;
  $('#room-status-text').textContent = txt;
  $('#peer-status').className = 'dot dot-' + (on ? 'on' : 'off');
  $('#peer-role').textContent = S.peerProfile ? (S.role === 'host' ? 'convidado' : 'anfitrião') : 'aguardando';
  waitStatus.textContent = (S.role === 'host' && !on)
    ? (S.netState === 'signal' ? 'Reconectando ao servidor de sinal…' : 'Aguardando a outra pessoa entrar…') : txt;
  latency.hidden = !on;
  updateSendBtn();
  refreshConnHelp();
}
function setStatus(k){ S.netState = k; refreshStatus(); }
function renderLatency(){
  latency.textContent = S.rtt + ' ms';
  latency.dataset.q = S.rtt < 150 ? 'good' : S.rtt < 400 ? 'ok' : 'bad';
}
function showTyping(on){
  S.peerTyping = !!on && S.connected;
  refreshStatus();
  clearTimeout(S.typingHide);
  if (S.peerTyping) S.typingHide = setTimeout(() => { S.peerTyping = false; refreshStatus(); }, 3500);
}

/* ───────── criptografia ───────── */
const importKey = bytes => crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
async function makeFrame(type, plain){
  const iv = rand(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, S.cryptoKey, plain));
  const f = new Uint8Array(13 + ct.length);
  f[0] = type; f.set(iv, 1); f.set(ct, 13);
  return f;
}
async function sendJSON(o){
  if (!S.conn || !S.conn.open || !S.cryptoKey || S.ended) return false;
  try { const f = await makeFrame(1, te.encode(JSON.stringify(o))); S.conn.send(f.buffer); return true; }
  catch { return false; }
}
async function toU8(d){
  if (d instanceof Uint8Array) return d;
  if (d instanceof ArrayBuffer) return new Uint8Array(d);
  if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
  if (d && typeof d.arrayBuffer === 'function') return new Uint8Array(await d.arrayBuffer());
  return null;
}
function keyFail(){
  S.keyFails++;
  if (S.keyFails === 1) toast('error', 'Falha de criptografia — o link pode estar incorreto.');
  if (S.keyFails >= 3 && !S.connected) showError('As chaves não conferem. Peça um novo link ao anfitrião.');
}
async function onData(raw){
  const f = await toU8(raw);
  if (!f || f.length < 14 || !S.cryptoKey || S.ended) return;
  let pt;
  try { pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: f.slice(1, 13) }, S.cryptoKey, f.slice(13))); }
  catch { keyFail(); return; }
  if (f[0] === 1) {
    let o; try { o = JSON.parse(td.decode(pt)); } catch { return; }
    if (o && typeof o.t === 'string') handle(o);
  } else if (f[0] === 2) {
    if (pt.length < 20) return;
    onChunk(hex(pt.slice(0, 16)), new DataView(pt.buffer, pt.byteOffset, pt.byteLength).getUint32(16), pt.slice(20));
  }
}

/* ───────── persistência local cifrada ───────── */
const skey = () => 'nevoa:v1:' + S.roomId;
const rkey = (id) => 'nevoa:role:' + (id || S.roomId);
function buildPayload(){
  return {
    v: 1, createdAt: S.createdAt, me: S.me, peer: S.peerProfile, greeted: S.greeted,
    messages: S.messages.slice(-MAX_STORE).map(m => {
      const b = { id: m.id, kind: m.kind, dir: m.dir, ts: m.ts, status: m.status };
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
    if (d.peer && d.peer.name) S.peerProfile = d.peer;
    S.greeted = !!d.greeted;
    (d.messages || []).forEach(m => { S.messages.push(m); S.msgIndex.set(m.id, m); appendMessage(m, true); });
    if (S.messages.length) {
      const sm = sysMsg('Histórico local restaurado — cifrado apenas neste dispositivo.', 'info');
      S.messages.push(sm); S.msgIndex.set(sm.id, sm); appendMessage(sm, true);
      scrollToBottom(false);
    }
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

/* ───────── rede / PeerJS ───────── */
function startPing(){
  clearInterval(S.pingTimer);
  sendJSON({ t: 'ping', ts: Date.now() });
  S.pingTimer = setInterval(() => { if (S.connected) sendJSON({ t: 'ping', ts: Date.now() }); }, 6000);
}
function stopPing(){ clearInterval(S.pingTimer); S.pingTimer = 0; }

function attachConn(c){
  if (S.ended) { try { c.close(); } catch {} return; }
  if (S.conn && S.conn !== c) { try { S.conn.close(); } catch {} }
  S.conn = c; S.connected = false;
  c.on('open', () => {
    if (S.ended) return;
    clearTimeout(S.dialTimeout);
    setStatus('handshake');
    sendJSON({ t: 'hello', v: 1, name: S.me.name, color: S.me.color, role: S.role });
    startPing();
    if (S.view === 'waiting') showView('chat');
  });
  c.on('data', onData);
  c.on('close', () => {
    if (S.ended || S.conn !== c) return;
    const was = S.connected;
    S.connected = false; S.peerTyping = false;
    stopPing();
    if (was) { pushMessage(sysMsg('Conexão interrompida — tentando restabelecer.', 'info')); sound('error'); }
    if (S.role === 'guest') { setStatus('retry'); scheduleRetry(1400 + Math.random() * 900); }
    else setStatus('waitreturn');
  });
  c.on('error', () => {});
}

function initHost(attempt){
  if (S.ended) return;
  const p = new Peer(PREFIX + S.roomId, PEER_OPTS);
  S.peer = p;
  p.on('open', () => { if (!S.ended && !S.connected) setStatus(S.view === 'waiting' ? 'waiting' : 'waitreturn'); });
  p.on('connection', c => {
    if (S.ended) { try { c.close(); } catch {} return; }
    if (S.conn && S.conn.open && !S.wasConnected) {   // sala cheia: só dois (reconexão não conta)
      c.on('open', async () => {
        try { const f = await makeFrame(1, te.encode(JSON.stringify({ t: 'full' }))); c.send(f.buffer); } catch {}
        setTimeout(() => { try { c.close(); } catch {} }, 400);
      });
      return;
    }
    attachConn(c);
  });
  p.on('disconnected', () => {
    if (S.ended || p.destroyed) return;
    setStatus('signal');
    setTimeout(() => { if (!S.ended && !p.destroyed) { try { p.reconnect(); } catch {} } }, 1800);
  });
  p.on('error', e => {
    if (S.ended) return;
    const t = e && e.type;
    if (t === 'unavailable-id') {
      try { p.destroy(); } catch {}
      if (attempt < 8) setTimeout(() => { if (!S.ended) initHost(attempt + 1); }, 1600);
      else showError('A sala não pôde ser registrada no servidor de sinal. Recarregue para tentar de novo.');
    } else if (['network','server-error','socket-error','socket-closed','ssl-unavailable'].includes(t)) {
      if (!S.connected) setStatus('signal');
      setTimeout(() => {
        if (S.ended) return;
        if (p.destroyed) initHost(attempt);
        else { try { p.reconnect(); } catch { initHost(attempt); } }
      }, 2600);
    }
  });
}

function initGuest(){
  if (S.ended) return;
  const p = new Peer(undefined, PEER_OPTS);
  S.peer = p;
  p.on('open', dial);
  p.on('disconnected', () => {
    if (S.ended || p.destroyed) return;
    setStatus('signal');
    setTimeout(() => { if (!S.ended && !p.destroyed) { try { p.reconnect(); } catch {} } }, 2000);
  });
  p.on('error', e => {
    if (S.ended) return;
    const t = e && e.type;
    if (t === 'peer-unavailable') { setStatus('host-offline'); scheduleRetry(3200); }
    else if (['network','server-error','socket-error','socket-closed','ssl-unavailable'].includes(t)) {
      setStatus('signal'); scheduleRetry(3000);
    }
  });
}
function dial(){
  const p = S.peer;
  if (S.ended || !p || p.destroyed || !p.open) return;
  if (S.conn && S.conn.open) return;
  setStatus('connecting');
  const c = p.connect(PREFIX + S.roomId, { reliable: true, serialization: 'binary', metadata: { app: 'nevoa', v: 1 } });
  attachConn(c);
  clearTimeout(S.dialTimeout);
  S.dialTimeout = setTimeout(() => {
    if (!S.ended && S.conn === c && !c.open) {
      try { c.close(); } catch {}
      setStatus('host-offline'); scheduleRetry(2500);
    }
  }, 12000);
}
function scheduleRetry(ms){
  clearTimeout(S.retryTimer);
  S.retryTimer = setTimeout(() => {
    if (S.ended) return;
    const p = S.peer;
    if (!p || p.destroyed) { initGuest(); return; }
    if (p.open) dial();
    else { try { p.reconnect(); } catch { initGuest(); } }
  }, ms);
}

/* ───────── protocolo ───────── */
function handle(o){
  if (S.ended) return;
  switch (o.t) {
    case 'hello': {
      S.peerProfile = { name: String(o.name || 'Anônimo').slice(0, 24), color: Math.abs(Number(o.color) || 0) % AV.length };
      renderPeer();
      const first = !S.connected;
      S.connected = true; S.wasConnected = true; S.keyFails = 0;
      clearTimeout(S.retryTimer); clearTimeout(S.dialTimeout);
      setStatus('online');
      if (!S.greeted) {
        S.greeted = true;
        pushMessage(sysMsg('Conexão direta estabelecida. Criptografia ponta a ponta ativa (AES-256-GCM).'));
      } else if (first) pushMessage(sysMsg('Reconectado.', 'info'));
      if (first) sound('connect');
      flushReads(); saveSoon();
      break;
    }
    case 'profile':
      if (S.peerProfile) {
        const n = String(o.name || '').slice(0, 24).trim();
        if (n) { S.peerProfile.name = n; renderPeer(); saveSoon(); }
      }
      break;
    case 'msg': {
      const text = typeof o.text === 'string' ? o.text.slice(0, MAX_TEXT) : '';
      if (!text.trim()) break;
      const m = { id: String(o.id || uid()).slice(0, 32), kind: 'text', dir: 'in', ts: Number(o.ts) || Date.now(), text, status: 'delivered' };
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
      (Array.isArray(o.ids) ? o.ids : []).forEach(id => {
        const m = S.msgIndex.get(String(id));
        if (m && m.dir === 'out' && m.status !== 'read') { m.status = 'read'; updateMsg(m); ch = true; }
      });
      if (ch) saveSoon();
      break;
    }
    case 'typing': showTyping(!!o.on); break;
    case 'file': onFileMeta(o); break;
    case 'file-done': {
      const m = S.msgIndex.get(String(o.id));
      if (m && m.dir === 'out') { m.status = 'delivered'; updateMsg(m); saveSoon(); }
      break;
    }
    case 'file-cancel': {
      const m = S.msgIndex.get(String(o.id));
      if (m && m.kind === 'file' && m.status === 'receiving') {
        const tr = S.transfersIn.get(m.tid);
        if (tr) { clearTimeout(tr.timer); S.transfersIn.delete(m.tid); }
        m.status = 'canceled'; updateMsg(m); saveSoon();
      }
      break;
    }
    case 'ping': sendJSON({ t: 'pong', ts: o.ts }); break;
    case 'pong': {
      const r = Date.now() - Number(o.ts || Date.now());
      if (r >= 0 && r < 30000) { S.rtt = Math.max(1, r); renderLatency(); }
      break;
    }
    case 'bye': wipe('peer'); break;
    case 'full':
      if (S.wasConnected) { try { if (S.conn) S.conn.close(); } catch {} }  // corrida de reconexão: tenta de novo
      else wipe('full');
      break;
  }
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
const metaRow = m => `<div class="meta"><span class="time">${fmtTime(m.ts)}</span>${m.dir === 'out' ? ticks(m.status) : ''}</div>`;
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
function bubbleInner(m){
  if (m.kind === 'text') return `<div class="txt">${richText(m.text)}</div>${metaRow(m)}`;
  const isImg = (m.mime || '').startsWith('image/');
  if (isImg && m.blobUrl)
    return `<button class="img-wrap" data-action="preview" data-id="${m.id}"><img src="${m.blobUrl}" alt="${esc(m.name)}" loading="lazy"></button>${metaRow(m)}`;
  if (isImg && m.status === 'receiving')
    return `<div class="img-ph">${ICONS.image}<span class="file-sub">${esc(fileSub(m))}</span><span class="progress"><i style="width:${Math.round((m.progress||0)*100)}%"></i></span></div>${metaRow(m)}`;
  return fileCard(m) + metaRow(m);
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
    setAvatar(av, S.peerProfile);
    node.appendChild(av);
  }
  const b = document.createElement('div');
  const isImg = m.kind === 'file' && (m.mime || '').startsWith('image/') && m.blobUrl;
  b.className = 'bubble' + (isImg ? ' img' : '');
  b.innerHTML = bubbleInner(m);
  node.appendChild(b);
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
function scrollToBottom(smooth){
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
    if (m.dir === 'out' || nearBottom()) scrollToBottom(true);
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
function onFileMeta(o){
  const size = Number(o.size), total = Number(o.total);
  const tid = String(o.tid || '');
  if (!(size > 0 && size <= MAX_FILE) || total !== Math.ceil(size / CHUNK) || !/^[0-9a-f]{32}$/.test(tid) || S.transfersIn.has(tid)) return;
  const m = {
    id: String(o.id || uid()).slice(0, 32), kind: 'file', dir: 'in', ts: Number(o.ts) || Date.now(),
    name: String(o.name || 'arquivo').slice(0, 120), size, mime: String(o.mime || 'application/octet-stream').slice(0, 100),
    total, tid, status: 'receiving', progress: 0, bytes: 0
  };
  S.transfersIn.set(tid, { id: m.id, total, received: 0, bytes: 0, parts: new Array(total), timer: 0 });
  armTransferTimeout(tid);
  pushMessage(m);
}
function onChunk(tid, idx, data){
  const tr = S.transfersIn.get(tid);
  if (!tr || idx >= tr.total || tr.parts[idx]) return;
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
    if (nearBottom()) scrollToBottom(true);
  } else {
    armTransferTimeout(tid);
    if (tr.received % 4 === 0) updateProgress(m);
  }
}
async function waitBuffer(){
  const dc = S.conn && S.conn.dataChannel;
  while (dc && dc.bufferedAmount > 4 * 1048576 && S.connected && !S.ended) await sleep(25);
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
      S.conn.send(f.buffer);
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
  const m = { id: uid(), kind: 'text', dir: 'out', ts: Date.now(), text, status: 'sent' };
  const ok = await sendJSON({ t: 'msg', id: m.id, ts: m.ts, text });
  if (!ok) { toast('error', 'Falha ao enviar. Tente novamente.'); return; }
  pushMessage(m);
  input.value = ''; autogrow(); updateCharCount(); updateSendBtn();
  clearTimeout(S.typingStop); S.lastTyping = 0;
  sendJSON({ t: 'typing', on: false });
  sound('send');
  input.focus();
}

/* ───────── convite / QR ───────── */
const inviteLink = () => location.href.split('#')[0] + '#r=' + S.roomId + '&k=' + S.keyB64;
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
      : ICONS.alert + '<span>Toque em <b>Copiar</b> e envie o link para a outra pessoa.</span>';
  }
  if (ok) toast('ok', auto ? 'Link copiado automaticamente. Envie para a outra pessoa.' : 'Link copiado.');
  else if (!auto) toast('error', 'Não foi possível copiar — selecione o link manualmente.');
  return ok;
}
async function shareLink(){
  if (navigator.share) {
    try { await navigator.share({ title: 'Névoa', text: 'Entre na minha conversa privada (anônima e criptografada):', url: inviteLink() }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  copyLink();
}

/* ───────── compartilhamento fácil / entrada por convite ───────── */
function shareTo(kind){
  const l = inviteLink();
  const text = 'Entre na minha conversa privada no Névoa (anônima, criptografada e sem cadastro):';
  const url = kind === 'whatsapp'
    ? 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + l)
    : 'https://t.me/share/url?url=' + encodeURIComponent(l) + '&text=' + encodeURIComponent(text);
  window.open(url, '_blank', 'noopener,noreferrer');
  toast('info', 'Compartilhamento aberto. Envie o link para uma pessoa.');
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
    const r = p.get('r'), k = p.get('k');
    if (validHash({ r, k })) return { r, k };
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
  history.replaceState(null, '', location.href.split('#')[0] + '#r=' + inv.r + '&k=' + inv.k);
  location.reload();
}
function refreshConnHelp(){
  const box = $('#conn-help');
  if (!box) return;
  const show = S.view === 'chat' && !S.connected && (S.role === 'guest' || S.wasConnected);
  box.hidden = !show;
  if (!show) return;
  const T = $('#conn-help-title'), P = $('#conn-help-text');
  if (S.role === 'host'){
    T.textContent = 'Aguardando a outra pessoa voltar';
    P.textContent = 'A conexão caiu. Estamos tentando restabelecer automaticamente.';
  } else if (S.netState === 'host-offline'){
    T.textContent = 'O anfitrião ainda não está online';
    P.textContent = 'Peça para a pessoa abrir o site e manter a aba aberta. Tentamos conectar sozinhos.';
  } else if (S.netState === 'signal'){
    T.textContent = 'Reconectando ao serviço de encontro';
    P.textContent = 'Isso costuma levar poucos segundos. Você não precisa fazer nada.';
  } else {
    T.textContent = 'Conectando automaticamente…';
    P.textContent = 'Estamos localizando o outro navegador. Mantenha esta aba aberta.';
  }
}

/* ───────── encerrar / limpar ───────── */
function cleanupTimers(){
  ['retryTimer','dialTimeout','typingStop','typingHide','saveTimer'].forEach(k => { clearTimeout(S[k]); S[k] = 0; });
  clearInterval(S.pingTimer); S.pingTimer = 0;
}
function resetSession(){
  S.ended = false; S.roomId = null; S.keyB64 = null; S.role = null;
  S.greeted = false; S.wasConnected = false; S.keyFails = 0; S.netState = 'idle';
  S.me = genMe(); renderMe();
}
function wipe(reason){
  if (S.ended) return;
  S.ended = true;
  cleanupTimers();
  S.transfersIn.forEach(tr => clearTimeout(tr.timer));
  try { if (S.conn) S.conn.close(); } catch {}
  try { if (S.peer) S.peer.destroy(); } catch {}
  S.conn = null; S.peer = null; S.connected = false; S.peerTyping = false;
  S.messages.forEach(m => { if (m.blobUrl) { try { URL.revokeObjectURL(m.blobUrl); } catch {} } });
  try { localStorage.removeItem(skey()); } catch {}
  try { sessionStorage.removeItem(rkey()); } catch {}
  S.messages = []; S.msgIndex.clear(); S.msgNodes.clear();
  S.transfersIn.clear(); S.transfersOut.clear(); S.outFiles.clear();
  S.outQueue = []; S.outBusy = false; S.pendingReads = [];
  S.cryptoKey = null; S.peerProfile = null;
  S.lastDay = ''; S.pillN = 0; S.unread = 0; S.rtt = 0;
  msgList.innerHTML = ''; emptyState.hidden = false; hidePill();
  closeLightbox(); closeSidebar();
  ['#qr-waiting','#qr-side'].forEach(s => { const c = $(s); const x = c.getContext('2d'); if (x) x.clearRect(0, 0, c.width, c.height); });
  history.replaceState(null, '', location.pathname + location.search);
  document.title = BASE_TITLE;
  renderPeer();
  if (reason === 'cancel') { resetSession(); showView('landing'); return; }
  const T = $('#ended-title'), P = $('#ended-text');
  if (reason === 'peer') { T.textContent = 'A outra pessoa encerrou'; P.textContent = 'A conversa foi encerrada pelo outro participante. Mensagens, arquivos e a chave de criptografia foram apagados deste dispositivo. Nenhum registro ficou em servidores.'; }
  else if (reason === 'full') { T.textContent = 'Sala cheia'; P.textContent = 'Esta conversa é privada e cabe apenas duas pessoas. Nada foi guardado neste dispositivo.'; }
  else { T.textContent = 'Conversa encerrada'; P.textContent = 'Mensagens, arquivos e a chave de criptografia foram apagados dos dois navegadores. Não há como recuperar — nenhum registro ficou em servidores.'; }
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
  openConfirm('Encerrar e apagar tudo?',
    'Mensagens, arquivos e a chave de criptografia serão removidos dos dois navegadores, agora. Não há como recuperar.',
    'Encerrar e apagar',
    async () => { await sendJSON({ t: 'bye' }); setTimeout(() => wipe('me'), 150); });
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
const readHash = () => { const p = new URLSearchParams(location.hash.replace(/^#/, '')); return { r: p.get('r'), k: p.get('k') }; };
const validHash = h => /^[0-9a-f]{24}$/.test(h.r || '') && /^[A-Za-z0-9_-]{43}$/.test(h.k || '');
async function createRoom(){
  if (S.roomId) return;
  const kb = rand(32);
  S.role = 'host'; S.roomId = hex(rand(12)); S.keyB64 = b64u(kb); S.createdAt = Date.now();
  try { sessionStorage.setItem(rkey(), 'host'); } catch {}
  try { S.cryptoKey = await importKey(kb); } catch { showError('Não foi possível gerar a chave de criptografia.'); return; }
  history.replaceState(null, '', '#r=' + S.roomId + '&k=' + S.keyB64);
  await restore();
  renderInvite(); renderMe(); renderPeer();
  showView('waiting'); setStatus('waiting');
  initHost(0);
  copyLink(true);
}
async function joinRoom(h){
  S.role = 'guest'; S.roomId = h.r; S.keyB64 = h.k; S.createdAt = Date.now();
  try { S.cryptoKey = await importKey(ub64(h.k)); } catch { showError('A chave do link é inválida.'); return; }
  await restore();
  renderInvite(); renderMe(); renderPeer();
  showView('chat'); setStatus('connecting');
  initGuest();
}

/* ───────── fundo: partículas de névoa ───────── */
function initFx(){
  const cv = $('#fx'), ctx = cv.getContext('2d');
  if (!ctx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(42, Math.max(18, Math.floor(W * H / 32000)));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 20 + Math.random() * 70, s: .1 + Math.random() * .35,
      c: Math.floor(Math.random() * 3), a: .04 + Math.random() * .09, p: Math.random() * Math.PI * 2
    }));
  }
  function loop(t){
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y -= p.s; p.x += Math.sin(t * .0003 + p.p) * .2;
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
  }), { threshold: .15 });
  $$('.reveal').forEach(el => io.observe(el));
  const links = $$('.top-link');
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  ['como', 'privacidade', 'usar'].forEach(id => { const s = document.getElementById(id); if (s) spy.observe(s); });
}

/* ───────── eventos ───────── */
function wireEvents(){
  $('#btn-create').addEventListener('click', createRoom);
  $('#btn-create-2').addEventListener('click', createRoom);
  $('#btn-join-paste').addEventListener('click', openJoin);
  $('#btn-whatsapp').addEventListener('click', () => shareTo('whatsapp'));
  $('#btn-telegram').addEventListener('click', () => shareTo('telegram'));
  $('#btn-retry-now').addEventListener('click', () => {
    if (S.role === 'guest'){ toast('info', 'Tentando conectar agora…'); scheduleRetry(0); }
    else if (S.peer && !S.peer.destroyed && S.peer.disconnected){ try { S.peer.reconnect(); } catch {} }
  });
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
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const m = S.msgIndex.get(b.dataset.id);
    if (!m) return;
    if (b.dataset.action === 'preview' && m.blobUrl) openLightbox(m);
    else if (b.dataset.action === 'cancel') { const c = S.transfersOut.get(m.tid); if (c) c.canceled = true; }
    else if (b.dataset.action === 'retry') {
      const f = S.outFiles.get(m.id);
      if (!f) { toast('warn', 'Arquivo não está mais na memória. Anexe novamente.'); return; }
      if (!S.connected) { toast('warn', 'Sem conexão no momento.'); return; }
      queueFile(f, m);
    }
  });
  msgScroll.addEventListener('scroll', () => { if (nearBottom()) hidePill(); });
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
    S.me.name = v; renderMe();
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
    else if (!emojiPop.hidden) emojiPop.hidden = true;
    else closeSidebar();
  });

  const wake = () => { ensureAudio(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); };
  document.addEventListener('pointerdown', wake, { passive: true });
  document.addEventListener('keydown', wake);

  addEventListener('focus', flushReads);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushReads(); });
  addEventListener('online', () => {
    if (S.ended || S.connected) return;
    if (S.role === 'guest') scheduleRetry(300);
    else if (S.peer && !S.peer.destroyed && S.peer.disconnected) { try { S.peer.reconnect(); } catch {} }
  });
  addEventListener('hashchange', () => { const h = readHash(); if ((h.r || null) !== S.roomId || S.ended) location.reload(); });
}

/* ───────── boot ───────── */
async function resumeHost(h){
  S.role = 'host'; S.roomId = h.r; S.keyB64 = h.k; S.createdAt = Date.now();
  try { S.cryptoKey = await importKey(ub64(h.k)); } catch { showError('A chave do link é inválida.'); return; }
  await restore();
  history.replaceState(null, '', '#r=' + S.roomId + '&k=' + S.keyB64);
  renderInvite(); renderMe(); renderPeer();
  const had = S.messages.length > 0;
  showView(had ? 'chat' : 'waiting');
  setStatus(had ? 'waitreturn' : 'waiting');
  initHost(0);
}

async function boot(){
  wireEvents(); buildEmoji(); initFx(); initReveal();
  $('#year').textContent = new Date().getFullYear();
  try { S.soundOn = localStorage.getItem('nevoa:pref:sound') !== '0'; } catch {}
  renderSound(); renderMe(); sweepStorage();

  if (!window.crypto || !crypto.subtle) {
    showError('Este contexto não expõe WebCrypto. Abra o site via HTTPS (ou localhost) em um navegador atualizado.');
    return;
  }
  try { await loadLib(PEER_URLS); }
  catch { showError('Não foi possível carregar a biblioteca de conexão (PeerJS). Verifique sua internet e recarregue.'); return; }
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
    let role = null;
    try { role = sessionStorage.getItem(rkey(h.r)); } catch {}
    if (role === 'host') await resumeHost(h);
    else await joinRoom(h);
  } else showView('landing');
}
boot();
})();
