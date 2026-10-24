'use strict';
const { HttpError } = require('./util');

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

module.exports = function storyRoutes(core) {
  const { q, now, route, rateLimit, saveImage, imgUrl } = core;

  route('GET', '/api/stories', (ctx) => {
    const since = now() - STORY_TTL_MS;
    const rows = q(`SELECT s.id, s.image, s.created_at, u.id AS uid, u.username, u.name, u.avatar,
        EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = :me) AS seen
      FROM stories s JOIN users u ON u.id = s.user_id
      WHERE s.created_at > :since
        AND (s.user_id = :me OR s.user_id IN (SELECT followee_id FROM follows WHERE follower_id = :me))
      ORDER BY s.id ASC`).all({ me: ctx.user.id, since });

    const byUser = new Map();
    for (const r of rows) {
      if (!byUser.has(r.uid)) {
        byUser.set(r.uid, {
          user: { id: r.uid, username: r.username, name: r.name, avatar: imgUrl(r.avatar) },
          stories: [],
          all_seen: true,
        });
      }
      const g = byUser.get(r.uid);
      g.stories.push({ id: r.id, image: imgUrl(r.image), created_at: r.created_at, seen: !!r.seen });
      if (!r.seen) g.all_seen = false;
    }
    const groups = [...byUser.values()].sort((a, b) => {
      if (a.user.id === ctx.user.id) return -1;
      if (b.user.id === ctx.user.id) return 1;
      return Number(a.all_seen) - Number(b.all_seen);
    });
    return { groups };
  });

  route('POST', '/api/stories', (ctx) => {
    rateLimit(`story:${ctx.user.id}`, 60, 60 * 60 * 1000);
    const image = saveImage(ctx.body.image);
    q('INSERT INTO stories (user_id, image, created_at) VALUES (?,?,?)').run(ctx.user.id, image, now());
    ctx.status = 201;
    return { ok: true };
  });

  route('POST', '/api/stories/:id/view', (ctx) => {
    const s = q('SELECT id FROM stories WHERE id = ?').get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'Hikaye bulunamadı.');
    q('INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?,?)').run(s.id, ctx.user.id);
    return { ok: true };
  });

  route('DELETE', '/api/stories/:id', (ctx) => {
    const s = q('SELECT * FROM stories WHERE id = ?').get(Number(ctx.params.id));
    if (!s) throw new HttpError(404, 'Hikaye bulunamadı.');
    if (s.user_id !== ctx.user.id) throw new HttpError(403, 'Bu hikayeyi silemezsiniz.');
    q('DELETE FROM stories WHERE id = ?').run(s.id);
    return { ok: true };
  });
};
