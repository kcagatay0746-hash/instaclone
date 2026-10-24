'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { HttpError, clampStr, extractTags, extractMentions } = require('./util');
const { createPostHelpers } = require('./posts-helpers');

module.exports = function postRoutes(core) {
  const { q, now, route, rateLimit, saveImage, saveVideo, savePlaceholder, userCard, notify, uploadDir } = core;
  const { getPost } = createPostHelpers(core);

  route('POST', '/api/posts', (ctx) => {
    rateLimit(`post:${ctx.user.id}`, 60, 60 * 60 * 1000);
    const caption = clampStr(ctx.body.caption, 2200);
    const location = clampStr(ctx.body.location, 100);
    const video = ctx.body.video ? saveVideo(ctx.body.video) : null;
    // image doubles as the poster frame for videos
    const image = video
      ? (ctx.body.poster ? saveImage(ctx.body.poster) : savePlaceholder())
      : saveImage(ctx.body.image);
    const kind = video ? 'video' : 'photo';
    const r = q('INSERT INTO posts (user_id, image, caption, location, created_at, kind, video) VALUES (?,?,?,?,?,?,?)')
      .run(ctx.user.id, image, caption, location, now(), kind, video);
    const id = Number(r.lastInsertRowid);
    for (const t of extractTags(caption)) {
      q('INSERT OR IGNORE INTO hashtags (post_id, tag) VALUES (?,?)').run(id, t);
    }
    for (const name of extractMentions(caption)) {
      const m = q('SELECT id FROM users WHERE username = ?').get(name);
      if (m) notify(m.id, ctx.user.id, 'mention', id, caption.slice(0, 120));
    }
    ctx.status = 201;
    return { post: getPost(id, ctx.user.id) };
  });

  route('GET', '/api/posts/:id', (ctx) => ({ post: getPost(Number(ctx.params.id), ctx.user.id) }));

  route('DELETE', '/api/posts/:id', (ctx) => {
    const p = q('SELECT * FROM posts WHERE id = ?').get(Number(ctx.params.id));
    if (!p) throw new HttpError(404, 'Gönderi bulunamadı.');
    if (p.user_id !== ctx.user.id) throw new HttpError(403, 'Bu gönderiyi silemezsiniz.');
    q('DELETE FROM posts WHERE id = ?').run(p.id);
    for (const file of [p.image, p.video]) {
      if (file) fs.rm(path.join(uploadDir, file), { force: true }, () => {});
    }
    return { ok: true };
  });

  // Counts a unique view per user (used by reels + video posts).
  route('POST', '/api/posts/:id/view', (ctx) => {
    const post = q('SELECT id, user_id FROM posts WHERE id = ?').get(Number(ctx.params.id));
    if (!post) throw new HttpError(404, 'Gönderi bulunamadı.');
    const r = q('INSERT OR IGNORE INTO post_views (post_id, user_id, created_at) VALUES (?,?,?)')
      .run(post.id, ctx.user.id, now());
    if (r.changes) q('UPDATE posts SET views = views + 1 WHERE id = ?').run(post.id);
    const views = q('SELECT views FROM posts WHERE id = ?').get(post.id).views;
    return { views, counted: !!r.changes };
  });

  const toggle = (table, on) => (ctx) => {
    const post = q('SELECT * FROM posts WHERE id = ?').get(Number(ctx.params.id));
    if (!post) throw new HttpError(404, 'Gönderi bulunamadı.');
    if (on) {
      const r = q(`INSERT OR IGNORE INTO ${table} (user_id, post_id, created_at) VALUES (?,?,?)`)
        .run(ctx.user.id, post.id, now());
      if (table === 'likes' && r.changes) notify(post.user_id, ctx.user.id, 'like', post.id);
    } else {
      q(`DELETE FROM ${table} WHERE user_id = ? AND post_id = ?`).run(ctx.user.id, post.id);
    }
    return { post: getPost(post.id, ctx.user.id) };
  };
  route('POST', '/api/posts/:id/like', toggle('likes', true));
  route('DELETE', '/api/posts/:id/like', toggle('likes', false));
  route('POST', '/api/posts/:id/save', toggle('saves', true));
  route('DELETE', '/api/posts/:id/save', toggle('saves', false));

  route('GET', '/api/posts/:id/likes', (ctx) => {
    const rows = q(`SELECT u.* FROM likes l JOIN users u ON u.id = l.user_id
      WHERE l.post_id = ? ORDER BY l.created_at DESC LIMIT 100`).all(Number(ctx.params.id));
    return { users: rows.map(userCard) };
  });
};
