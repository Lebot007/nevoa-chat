// Broker MQTT 3.1.1 mínimo sobre WebSocket, só para os testes (substitui os brokers públicos).
// Entrega cada PUBLISH partido em 2 frames WebSocket, para exercitar a remontagem do cliente.
import http from 'node:http';
import crypto from 'node:crypto';

function frame(d) {
  const n = d.length; let h;
  if (n < 126) h = Buffer.from([0x82, n]);
  else if (n < 65536) { h = Buffer.alloc(4); h[0] = 0x82; h[1] = 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x82; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, d]);
}

export function startBroker(port) {
  const clients = new Set();
  const srv = http.createServer((q, r) => r.end());
  srv.on('upgrade', (req, sock) => {
    const acc = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\nSec-WebSocket-Protocol: mqtt\r\n\r\n');
    const c = { sock, topics: new Set() }; clients.add(c); let buf = Buffer.alloc(0);
    const mqtt = p => {
      const type = p[0] >> 4; let i = 1, len = 0, mul = 1, x;
      do { x = p[i++]; len += (x & 127) * mul; mul *= 128; } while (x & 128);
      const body = p.subarray(i, i + len);
      if (type === 1) sock.write(frame(Buffer.from([0x20, 2, 0, 0])));
      else if (type === 8) { const tl = body.readUInt16BE(2); c.topics.add(body.subarray(4, 4 + tl).toString()); sock.write(frame(Buffer.from([0x90, 3, body[0], body[1], 0]))); }
      else if (type === 12) sock.write(frame(Buffer.from([0xD0, 0])));
      else if (type === 3) {
        const tl = body.readUInt16BE(0); const t = body.subarray(2, 2 + tl).toString(); const whole = Buffer.from(p.subarray(0, i + len));
        for (const o of clients) if (o.topics.has(t)) { const cut = Math.min(3, whole.length - 1); o.sock.write(frame(whole.subarray(0, cut))); o.sock.write(frame(whole.subarray(cut))); }
      }
    };
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (buf.length < 2) return;
        let n = buf[1] & 127, o = 2;
        if (n === 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); o = 4; }
        else if (n === 127) { if (buf.length < 10) return; n = Number(buf.readBigUInt64BE(2)); o = 10; }
        if (buf.length < o + 4 + n) return;
        const mask = buf.subarray(o, o + 4); const pl = Buffer.from(buf.subarray(o + 4, o + 4 + n));
        for (let k = 0; k < n; k++) pl[k] ^= mask[k & 3];
        const op = buf[0] & 15; buf = buf.subarray(o + 4 + n);
        if (op === 8) { sock.end(); return; }
        if (op === 2) mqtt(pl);
      }
    });
    const rm = () => clients.delete(c); sock.on('close', rm); sock.on('error', rm);
  });
  srv.listen(port);
  return {
    // derruba o broker inteiro (todos os clientes) e recusa novas conexões
    kill() { clients.forEach(c => c.sock.destroy()); srv.close(); },
    close() { clients.forEach(c => c.sock.destroy()); srv.close(); }
  };
}
