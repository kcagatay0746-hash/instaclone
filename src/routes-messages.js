'use strict';
const { HttpError, clampStr } = require('./util');

module.exports = function messageRoutes(core) {
  const { q, now, route, rateLimit, userCard, userByName, push } = core;

  route('GET', '/api/messages', (ctx) => {
    const me = ctx.user.id;
    const convs = q(`SELECT other, MAX(id) AS mid FROM (
        SELECT CASE WHEN from_id = :me THEN to_id ELSE from_id END AS other, id
        FROM messages WHERE from_id = :me OR to_id = :me
      ) GROUP BY other ORDER BY mid DESC LIMIT 100`).all({ me });
    return {
      conversations: convs.map((c) => {
        const m = q('SELECT * FROM messages WHERE id = ?').get(c.mid);
        const u = q('SELECT * FROM users WHERE id = ?').get(c.other);
        const unread = q('SELECT COUNT(*) n FROM messages WHERE from_id = ? AND to_id = ? AND read = 0').get(c.other, me).n;
        return { user: userCard(u), last: { text: m.text, created_at: m.created_at, mine: m.from_id === me }, unread };
      }),
    };
  });

  route('GET', '/api/messages/:username', (ctx) => {
    const other = userByName(ctx.params.username);
    const me = ctx.user.id;
    q('UPDATE messages SET read = 1 WHERE from_id = ? AND to_id = ? AND read = 0').run(other.id, me);
    const rows = q(`SELECT * FROM (
        SELECT * FROM messages
        WHERE (from_id = :me AND to_id = :o) OR (from_id = :o AND to_id = :me)
        ORDER BY id DESC LIMIT 200
      ) ORDER BY id ASC`).all({ me, o: other.id });
    return {
      user: userCard(other),
      messages: rows.map((m) => ({ id: m.id, text: m.text, created_at: m.created_at, mine: m.from_id === me })),
    };
  });

  route('POST', '/api/messages/:username', (ctx) => {
    rateLimit(`dm:${ctx.user.id}`, 300, 60 * 60 * 1000);
    const other = userByName(ctx.params.username);
    if (other.id === ctx.user.id) throw new HttpError(400, 'Kendinize mesaj gönderemezsiniz.');
    const text = clampStr(ctx.body.text, 2000);
    if (!text) throw new HttpError(400, 'Mesaj boş olamaz.');
    const t = now();
    const r = q('INSERT INTO messages (from_id, to_id, text, read, created_at) VALUES (?,?,?,0,?)')
      .run(ctx.user.id, other.id, text, t);
    const msg = { id: Number(r.lastInsertRowid), text, created_at: t };
    push(other.id, 'message', { from: ctx.user.username, fromName: ctx.user.name, message: { ...msg, mine: false } });
    ctx.status = 201;
    return { message: { ...msg, mine: true } };
  });
};
