'use strict';
// WebRTC signaling: the server only relays SDP offer/answer + call state over SSE.
const { HttpError, clampStr } = require('./util');

const LABEL = { audio: 'Sesli arama', video: 'Görüntülü arama' };
const fmtDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

module.exports = function callRoutes(core) {
  const { q, now, route, rateLimit, userByName, userCard, push } = core;

  const otherOf = (call, me) => (call.caller_id === me ? call.callee_id : call.caller_id);

  function shapeCall(call, me) {
    const other = q('SELECT * FROM users WHERE id = ?').get(otherOf(call, me));
    const duration = call.answered_at && call.ended_at
      ? Math.max(0, Math.round((call.ended_at - call.answered_at) / 1000))
      : 0;
    return {
      id: call.id,
      kind: call.kind,
      status: call.status,
      direction: call.caller_id === me ? 'outgoing' : 'incoming',
      created_at: call.created_at,
      answered_at: call.answered_at,
      ended_at: call.ended_at,
      duration,
      user: userCard(other),
    };
  }

  function summaryFor(call, status) {
    const label = LABEL[call.kind] || LABEL.audio;
    if (status === 'declined') return `${label} · reddedildi`;
    if (status === 'missed' || status === 'cancelled') return `${label} · cevapsız`;
    const seconds = call.answered_at && call.ended_at
      ? Math.max(0, Math.round((call.ended_at - call.answered_at) / 1000))
      : 0;
    return seconds > 0 ? `${label} · ${fmtDuration(seconds)}` : `${label} · sona erdi`;
  }

  function finish(call, status, endedBy) {
    const t = now();
    q('UPDATE calls SET status = ?, ended_at = ? WHERE id = ?').run(status, t, call.id);
    const updated = q('SELECT * FROM calls WHERE id = ?').get(call.id);
    const summary = summaryFor(updated, status);
    // keep a line in the DM thread so both sides see the call in their history
    q(`INSERT INTO messages (from_id, to_id, text, read, created_at, kind, call_id)
       VALUES (?,?,?,1,?, 'call', ?)`).run(updated.caller_id, updated.callee_id, summary, t, updated.id);
    const payload = {
      callId: updated.id,
      status,
      summary,
      duration: updated.answered_at ? Math.max(0, Math.round((t - updated.answered_at) / 1000)) : 0,
      by: endedBy ? endedBy.username : null,
    };
    push(updated.caller_id, 'call:ended', payload);
    push(updated.callee_id, 'call:ended', payload);
    return { ok: true, summary, call: shapeCall(updated, endedBy ? endedBy.id : updated.caller_id) };
  }

  route('POST', '/api/calls', (ctx) => {
    rateLimit(`call:${ctx.user.id}`, 60, 60 * 60 * 1000);
    const callee = userByName(clampStr(ctx.body.username, 30));
    if (callee.id === ctx.user.id) throw new HttpError(400, 'Kendinizi arayamazsınız.');
    const kind = ctx.body.kind === 'video' ? 'video' : 'audio';
    const offer = typeof ctx.body.offer === 'string' ? ctx.body.offer : '';
    if (offer.length < 10 || offer.length > 20000) throw new HttpError(400, 'Arama teklifi (SDP) geçersiz.');

    const busy = q(`SELECT * FROM calls
      WHERE status IN ('ringing','active')
        AND (callee_id IN (:me, :other) OR caller_id IN (:me, :other))
      ORDER BY id DESC LIMIT 1`).get({ me: ctx.user.id, other: callee.id });
    if (busy) {
      const mine = busy.caller_id === ctx.user.id || busy.callee_id === ctx.user.id;
      throw new HttpError(409, mine ? 'Zaten devam eden bir araman var.' : `${callee.username} şu anda başka bir aramada.`);
    }

    const t = now();
    const r = q(`INSERT INTO calls (caller_id, callee_id, kind, status, offer, created_at)
      VALUES (?,?,?, 'ringing', ?, ?)`).run(ctx.user.id, callee.id, kind, offer, t);
    const id = Number(r.lastInsertRowid);
    const caller = q('SELECT * FROM users WHERE id = ?').get(ctx.user.id);
    push(callee.id, 'call:incoming', {
      call: { id, kind, status: 'ringing', created_at: t, offer, from: userCard(caller) },
    });
    ctx.status = 201;
    return { call: { id, kind, status: 'ringing', created_at: t, to: userCard(callee) } };
  });

  route('GET', '/api/calls/history', (ctx) => {
    const rows = q(`SELECT * FROM calls WHERE caller_id = ? OR callee_id = ?
      ORDER BY id DESC LIMIT 40`).all(ctx.user.id, ctx.user.id);
    return { calls: rows.map((c) => shapeCall(c, ctx.user.id)) };
  });

  route('GET', '/api/calls/:id', (ctx) => {
    const call = q('SELECT * FROM calls WHERE id = ?').get(Number(ctx.params.id));
    if (!call) throw new HttpError(404, 'Arama bulunamadı.');
    if (call.caller_id !== ctx.user.id && call.callee_id !== ctx.user.id) throw new HttpError(403, 'Bu aramayı göremezsiniz.');
    return { call: shapeCall(call, ctx.user.id), status: call.status };
  });

  // Callee accepts: store the SDP answer and let the caller know.
  route('POST', '/api/calls/:id/answer', (ctx) => {
    const call = q('SELECT * FROM calls WHERE id = ?').get(Number(ctx.params.id));
    if (!call) throw new HttpError(404, 'Arama bulunamadı.');
    if (call.callee_id !== ctx.user.id) throw new HttpError(403, 'Bu aramayı yanıtlayamazsınız.');
    if (call.status !== 'ringing') throw new HttpError(409, 'Arama artık çalmıyor.');
    const answer = typeof ctx.body.answer === 'string' ? ctx.body.answer : '';
    if (answer.length < 10 || answer.length > 20000) throw new HttpError(400, 'Yanıt (SDP) geçersiz.');
    const t = now();
    q('UPDATE calls SET status = ?, answer = ?, answered_at = ? WHERE id = ?').run('active', answer, t, call.id);
    push(call.caller_id, 'call:answered', { callId: call.id, answer, at: t });
    return { ok: true, call: { id: call.id, status: 'active', answered_at: t } };
  });

  route('POST', '/api/calls/:id/decline', (ctx) => {
    const call = q('SELECT * FROM calls WHERE id = ?').get(Number(ctx.params.id));
    if (!call) throw new HttpError(404, 'Arama bulunamadı.');
    if (call.callee_id !== ctx.user.id) throw new HttpError(403, 'Bu aramayı reddedemezsiniz.');
    if (!['ringing', 'active'].includes(call.status)) return { ok: true, call: shapeCall(call, ctx.user.id) };
    return finish(call, 'declined', ctx.user);
  });

  route('POST', '/api/calls/:id/end', (ctx) => {
    const call = q('SELECT * FROM calls WHERE id = ?').get(Number(ctx.params.id));
    if (!call) throw new HttpError(404, 'Arama bulunamadı.');
    if (call.caller_id !== ctx.user.id && call.callee_id !== ctx.user.id) throw new HttpError(403, 'Bu aramayı bitiremezsiniz.');
    if (['ended', 'declined', 'missed', 'cancelled'].includes(call.status)) {
      return { ok: true, call: shapeCall(call, ctx.user.id) };
    }
    const reason = clampStr(ctx.body.reason, 20);
    let status = 'ended';
    if (call.status === 'ringing') {
      status = ctx.user.id === call.caller_id ? (reason === 'timeout' ? 'missed' : 'cancelled') : 'declined';
    }
    return finish(call, status, ctx.user);
  });
};
