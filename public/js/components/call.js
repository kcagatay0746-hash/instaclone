// Voice & video calls over WebRTC. The server only relays SDP (offer/answer) via SSE.
import { API } from '../api.js';
import { el, icon, avatar, toast, bus } from '../ui.js';
import { state } from '../store.js';

// LAN / same-device calls work without a TURN server (host candidates).
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const RING_TIMEOUT = 45000;

let session = null;
let incoming = null;

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function waitIce(pc, ms = 2500) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    let timer = null;
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    pc.addEventListener('icegatheringstatechange', check);
    timer = setTimeout(done, ms);
  });
}

async function getMedia(kind) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Bu tarayıcı kamera/mikrofon erişimini desteklemiyor.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
    });
  } catch (err) {
    if (err && err.name === 'NotAllowedError') throw new Error('Kamera/mikrofon izni verilmedi.');
    throw new Error('Kamera veya mikrofona erişilemedi.');
  }
}

function remoteEl(kind) {
  return kind === 'video'
    ? el('video', { class: 'call-remote', autoplay: true, playsinline: true, 'aria-label': 'Karşı taraf' })
    : el('audio', { class: 'call-audio', autoplay: true });
}

function buildOverlay({ kind, user, onHangup, onMute, onCamera, incomingMode = false, onAccept, onDecline }) {
  const remote = remoteEl(kind);
  const local = el('video', { class: 'call-local', autoplay: true, muted: true, playsinline: true });
  const status = el('div', { class: 'call-status', text: incomingMode ? 'Gelen arama…' : 'Çalıyor…' });
  const timerEl = el('div', { class: 'call-timer hide', text: '0:00' });

  const muteBtn = el('button', { class: 'call-btn', 'aria-label': 'Sesi kapat' }, icon('sun', 24), el('span', { text: 'Sessiz' }));
  const camBtn = el('button', { class: 'call-btn', 'aria-label': 'Kamerayı kapat' }, icon('camera', 24), el('span', { text: 'Kamera' }));

  const controls = incomingMode
    ? el('div', { class: 'call-controls' },
      el('button', { class: 'call-btn danger', onclick: onDecline }, icon('close', 26), el('span', { text: 'Reddet' })),
      el('button', { class: 'call-btn accept', onclick: onAccept }, icon(kind === 'video' ? 'camera' : 'message', 26), el('span', { text: 'Yanıtla' })))
    : el('div', { class: 'call-controls' },
      muteBtn,
      kind === 'video' ? camBtn : null,
      el('button', { class: 'call-btn danger', onclick: onHangup }, icon('close', 26), el('span', { text: 'Kapat' })));

  const overlay = el('div', { class: `call-screen ${kind}${incomingMode ? ' incoming' : ''}` },
    remote,
    el('div', { class: 'call-top' },
      el('div', { class: 'call-peer' },
        avatar(user, 40),
        el('div', {},
          el('b', { text: user.name || user.username }),
          el('span', { class: 'muted', text: `@${user.username}` }))),
      el('span', { class: 'call-kind', text: kind === 'video' ? 'Görüntülü arama' : 'Sesli arama' })),
    el('div', { class: 'call-center' },
      kind === 'video' ? null : el('div', { class: 'call-avatar' }, avatar(user, 132)),
      status,
      timerEl),
    local,
    controls);

  muteBtn.addEventListener('click', () => onMute(muteBtn));
  if (kind === 'video') camBtn.addEventListener('click', () => onCamera(camBtn));

  document.getElementById('overlay-root').append(overlay);
  document.body.classList.add('modal-open');
  return {
    overlay,
    remote,
    local,
    status,
    timerEl,
    muteBtn,
    camBtn,
    setStatus(text) { status.textContent = text; },
    remove() {
      overlay.remove();
      if (!document.querySelector('.call-screen')) document.body.classList.remove('modal-open');
    },
  };
}

function wirePc(pc, ui) {
  const remote = new MediaStream();
  pc.addEventListener('track', (e) => {
    if (e.streams && e.streams[0]) ui.remote.srcObject = e.streams[0];
    else {
      remote.addTrack(e.track);
      ui.remote.srcObject = remote;
    }
    ui.remote.play?.().catch(() => {});
  });
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed' && session) {
      toast('Bağlantı koptu', 'error');
      hangup('connection-lost');
    }
  });
}

function startTimer(sess) {
  sess.startedAt = Date.now();
  sess.ui.timerEl.classList.remove('hide');
  sess.ui.setStatus('Bağlandı');
  clearInterval(sess.timer);
  sess.timer = setInterval(() => {
    const secs = Math.round((Date.now() - sess.startedAt) / 1000);
    sess.ui.timerEl.textContent = fmtClock(secs);
  }, 1000);
}

function teardown() {
  if (!session) return;
  clearTimeout(session.timeout);
  clearInterval(session.timer);
  try { session.local.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
  try { session.pc.close(); } catch { /* ignore */ }
  session.ui.remove();
  session = null;
}

async function hangup(reason = 'hangup', { remote = false } = {}) {
  const current = session;
  if (!current) return;
  teardown();
  if (!remote) {
    try { await API.endCall(current.id, reason); } catch { /* ignore */ }
  }
}

export async function startCall(username, kind = 'audio') {
  if (session) {
    toast('Zaten devam eden bir araman var.', 'error');
    return;
  }
  let local = null;
  let ui = null;
  try {
    const { user } = await API.user(username);
    local = await getMedia(kind);
    ui = buildOverlay({
      kind,
      user,
      onHangup: () => hangup('hangup'),
      onMute: () => {},
      onCamera: () => {},
    });
    ui.local.srcObject = local;
    ui.local.play?.().catch(() => {});
    ui.setStatus('Çalıyor…');

    const pc = new RTCPeerConnection(RTC_CONFIG);
    wirePc(pc, ui);
    local.getTracks().forEach((t) => pc.addTrack(t, local));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);

    const res = await API.startCall(username, kind, JSON.stringify(pc.localDescription));
    session = { id: res.call.id, kind, user, pc, local, ui, timer: null, startedAt: null };
    session.timeout = setTimeout(() => {
      toast('Cevap verilmedi', 'error');
      hangup('timeout');
    }, RING_TIMEOUT);

    ui.muteBtn.onclick = () => {
      const on = !ui.muteBtn.classList.contains('off');
      local.getAudioTracks().forEach((t) => { t.enabled = !on; });
      ui.muteBtn.classList.toggle('off', on);
      ui.muteBtn.querySelector('span').textContent = on ? 'Sesi aç' : 'Sessiz';
    };
    if (kind === 'video') {
      ui.camBtn.onclick = () => {
        const off = !ui.camBtn.classList.contains('off');
        local.getVideoTracks().forEach((t) => { t.enabled = !off; });
        ui.camBtn.classList.toggle('off', off);
        ui.camBtn.querySelector('span').textContent = off ? 'Kamerayı aç' : 'Kamera';
      };
    }
  } catch (err) {
    if (local) local.getTracks().forEach((t) => t.stop());
    if (ui) ui.remove();
    toast(err.message, 'error');
  }
}

function showIncoming(invite) {
  if (incoming || session) {
    API.declineCall(invite.id).catch(() => {});
    return;
  }
  const ui = buildOverlay({
    kind: invite.kind,
    user: invite.from,
    incomingMode: true,
    onAccept: () => acceptIncoming(),
    onDecline: () => declineIncoming(),
    onHangup: () => {},
    onMute: () => {},
    onCamera: () => {},
  });
  incoming = { invite, ui, timeout: setTimeout(() => declineIncoming(true), RING_TIMEOUT) };
  toast(`${invite.from.name || invite.from.username} ${invite.kind === 'video' ? 'görüntülü' : 'sesli'} arıyor…`);
}

function declineIncoming(silent = false) {
  if (!incoming) return;
  const { invite, ui, timeout } = incoming;
  clearTimeout(timeout);
  incoming = null;
  ui.remove();
  API.declineCall(invite.id).catch(() => {});
  if (!silent) toast('Arama reddedildi');
}

async function acceptIncoming() {
  if (!incoming) return;
  const { invite, ui, timeout } = incoming;
  clearTimeout(timeout);
  incoming = null;
  let local = null;
  try {
    local = await getMedia(invite.kind);
    ui.local.srcObject = local;
    ui.local.play?.().catch(() => {});
    ui.setStatus('Bağlanıyor…');
    const pc = new RTCPeerConnection(RTC_CONFIG);
    wirePc(pc, ui);
    local.getTracks().forEach((t) => pc.addTrack(t, local));
    await pc.setRemoteDescription(JSON.parse(invite.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIce(pc);
    await API.answerCall(invite.id, JSON.stringify(pc.localDescription));

    session = { id: invite.id, kind: invite.kind, user: invite.from, pc, local, ui, timer: null, startedAt: null };
    startTimer(session);
    ui.muteBtn.onclick = () => {
      const on = !ui.muteBtn.classList.contains('off');
      local.getAudioTracks().forEach((t) => { t.enabled = !on; });
      ui.muteBtn.classList.toggle('off', on);
      ui.muteBtn.querySelector('span').textContent = on ? 'Sesi aç' : 'Sessiz';
    };
    if (invite.kind === 'video') {
      ui.camBtn.onclick = () => {
        const off = !ui.camBtn.classList.contains('off');
        local.getVideoTracks().forEach((t) => { t.enabled = !off; });
        ui.camBtn.classList.toggle('off', off);
        ui.camBtn.querySelector('span').textContent = off ? 'Kamerayı aç' : 'Kamera';
      };
    }
  } catch (err) {
    if (local) local.getTracks().forEach((t) => t.stop());
    ui.remove();
    toast(err.message, 'error');
    API.declineCall(invite.id).catch(() => {});
  }
}

let initialized = false;
export function initCalls() {
  if (initialized) return;
  initialized = true;
  bus.on('call:event', async ({ type, data }) => {
    if (type === 'incoming') return showIncoming(data.call);
    if (!session) return;
    if (type === 'answered' && data.callId === session.id) {
      try {
        await session.pc.setRemoteDescription(JSON.parse(data.answer));
        startTimer(session);
      } catch {
        toast('Arama bağlantısı kurulamadı', 'error');
        hangup('failed');
      }
    } else if (type === 'declined' && data.callId === session.id) {
      toast('Arama reddedildi', 'error');
      hangup('declined', { remote: true });
    } else if (type === 'ended' && data.callId === session.id) {
      toast(data.summary || 'Arama sona erdi');
      hangup('ended', { remote: true });
    }
  });
}

void state;
export { RTC_CONFIG };
