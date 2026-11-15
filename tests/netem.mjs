// "Casa" emulada: proxy TCP com latência, variação, banda limitada, corte de internet e
// travamento (conexões existentes param de responder sem fechar — como na troca Wi-Fi → 4G).
// A ordem dos bytes é preservada, como no TCP de verdade.
import net from 'node:net';

export function house(listen, target, cfg) {
  const pairs = new Set(); let up = true;
  const srv = net.createServer(c => {
    if (!up) return c.destroy();
    const s = net.connect(target, '127.0.0.1');
    const pair = { c, s, frozen: false }; pairs.add(pair);
    const pipe = (from, to) => {
      const q = []; let next = 0, timer = 0;
      const pump = () => {
        timer = 0;
        if (pair.frozen) return;
        while (q.length && q[0].at <= Date.now()) { const { d } = q.shift(); if (!to.destroyed && up) to.write(d); }
        if (q.length) timer = setTimeout(pump, Math.max(1, q[0].at - Date.now()));
        if (from.isPaused() && q.length < 50) from.resume();
      };
      from.on('data', d => {
        if (!up || pair.frozen) return;
        const now = Date.now(), tx = cfg.bw ? d.length / cfg.bw * 1000 : 0;
        next = Math.max(next + tx, now + cfg.lat + Math.random() * cfg.jit + tx);
        q.push({ d, at: next });
        if (q.length > 200) from.pause();
        if (!timer) timer = setTimeout(pump, Math.max(1, q[0].at - now));
      });
    };
    pipe(c, s); pipe(s, c);
    const kill = () => { c.destroy(); s.destroy(); pairs.delete(pair); };
    // o fechamento chega depois dos dados que já estavam a caminho
    const later = () => setTimeout(kill, cfg.lat + cfg.jit + (cfg.bw ? 500 : 50));
    c.on('error', later); s.on('error', later); c.on('close', later); s.on('close', later);
  });
  srv.listen(listen);
  return {
    cut() { up = false; pairs.forEach(p => { p.c.destroy(); p.s.destroy(); }); pairs.clear(); },   // sem internet
    restore() { up = true; },
    freeze() { pairs.forEach(p => { p.frozen = true; }); },   // conexões abertas travam; novas funcionam
    close() { up = false; pairs.forEach(p => { p.c.destroy(); p.s.destroy(); }); srv.close(); }
  };
}
