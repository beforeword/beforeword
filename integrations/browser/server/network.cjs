'use strict';
const net = require('node:net');
const crypto = require('node:crypto');
function canonicalIP(raw) {
  if (typeof raw !== 'string' || raw.length > 64 || raw.includes('%')) return null;
  let ip = raw;
  if (ip.startsWith('::ffff:') && net.isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  const version = net.isIP(ip);
  if (version === 4) return ip;
  if (version === 6) {
    try { return new URL(`http://[${ip}]/`).hostname.slice(1, -1); } catch { return null; }
  }
  return null;
}
function clientAddress(request, trustedProxyIPs, passenger = false) {
  // Passenger's secure headers are usable only in its selected Unix listener.
  // A TCP request, including a direct development request, can never opt in.
  if (passenger && request.socket.remoteAddress === undefined) {
    const secureIP = canonicalIP(request.headers['!~passenger-client-address']);
    if (secureIP) return secureIP;
  }
  const socketIP = canonicalIP(request.socket.remoteAddress);
  if (!socketIP) return 'unavailable-socket-address';
  if (!trustedProxyIPs.has(socketIP)) return socketIP;
  const header = request.headers['x-forwarded-for'];
  if (typeof header !== 'string' || header.length > 1024) return socketIP;
  const raw = header.split(',');
  if (!raw.length || raw.length > 8) return socketIP;
  const chain = raw.map(value => canonicalIP(value.trim()));
  if (chain.some(value => !value)) return socketIP;
  let selected = socketIP;
  for (let index = chain.length - 1; index >= 0 && trustedProxyIPs.has(selected); index -= 1) selected = chain[index];
  return selected;
}
function networkIdentifier(request, configuration) {
  return crypto.createHmac('sha256', configuration.networkSalt)
    .update('beforeword-network-v1\0' + clientAddress(request, configuration.trustedProxyIPs, configuration.passenger)).digest('hex');
}
module.exports = { canonicalIP, clientAddress, networkIdentifier };
