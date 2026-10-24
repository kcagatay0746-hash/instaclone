'use strict';
const { HttpError, clampStr, extractMentions } = require('./util');

const COMMENT_SQL = `SELECT c.id, c.text, c.created_at, u.id AS uid, u.username, u.name, u.avatar
  FROM comments c JOIN users u ON u.id = c.user_id`;

module.exports = function commentRoutes(core) {
  const { q, now, route, rateLimit, rowUser, notify } = core;

  const shapeComment = (c, me) => ({
    id: c.id,
    text: c.text,
    created_at: c.created_at,
    user: rowUser(c),
    mine: c.uid === me,
  });

  route('GET', '/api/posts/:id/comments', (ctx) => {
    const rows = q(`${COMMENT_SQL} WHERE c.post_id = ? ORDER BY c.id ASC LIMIT 500`).all(Number(ctx.params.id));
    return { comments: rows.map((c) => shapeComment(c, ctx.user.id)) };
  });

  route('POST', '/api/posts/:id/comments', (ctx) => {
    rateLimit(`comment:${ctx.user.id}`, 200, 60 * 60 * 1000);
    const post = q('SELECT * FROM posts WHERE id = ?').get(Number(ctx.params.id));
    if (!post) throw new HttpError(404, 'Gönderi bulunamadı.');
    const text = clampStr(ctx.body.text, 1000);
    if (!text) throw new HttpError(400, 'Yorum boş olamaz.');
    const r = q('INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?,?,?,?)')
      .run(post.id, ctx.user.id, text, now());
    notify(post.user_id, ctx.user.id, 'comment', post.id, text.slice(0, 120));
    for (const name of extractMentions(text)) {
      const m = q('SELECT id FROM users WHERE username = ?').get(name);
      if (m && m.id !== post.user_id) notify(m.id, ctx.user.id, 'mention', post.id, text.slice(0, 120));
    }
    ctx.status = 201;
    const row = q(`${COMMENT_SQL} WHERE c.id = ?`).get(Number(r.lastInsertRowid));
    return { comment: shapeComment(row, ctx.user.id) };
  });

  route('DELETE', '/api/comments/:id', (ctx) => {
    const c = q(`SELECT c.*, p.user_id AS post_owner FROM comments c
      JOIN posts p ON p.id = c.post_id WHERE c.id = ?`).get(Number(ctx.params.id));
    if (!c) throw new HttpError(404, 'Yorum bulunamadı.');
    if (c.user_id !== ctx.user.id && c.post_owner !== ctx.user.id) throw new HttpError(403, 'Bu yorumu silemezsiniz.');
    q('DELETE FROM comments WHERE id = ?').run(c.id);
    return { ok: true };
  });
};
