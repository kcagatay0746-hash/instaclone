'use strict';
const { HttpError, clampStr, likeEscape } = require('./util');
const { createPostHelpers, POST_SQL } = require('./posts-helpers');

const PAGE = 9;
const EXPLORE_PAGE = 18;

module.exports = function feedRoutes(core) {
  const { q, route, userCard } = core;
  const { shapePost } = createPostHelpers(core);

  route('GET', '/api/feed', (ctx) => {
    const before = Number(ctx.query.get('before')) || Number.MAX_SAFE_INTEGER;
    const rows = q(`${POST_SQL}
      WHERE p.id < :before AND (p.user_id = :me OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = :me))
      ORDER BY p.id DESC LIMIT :lim`).all({ me: ctx.user.id, before, lim: PAGE + 1 });
    const posts = rows.slice(0, PAGE).map((r) => shapePost(r, ctx.user.id));
    return { posts, next: rows.length > PAGE ? posts[posts.length - 1].id : null };
  });

  route('GET', '/api/explore', (ctx) => {
    const offset = Math.max(0, Number(ctx.query.get('offset')) || 0);
    const rows = q(`${POST_SQL} WHERE p.user_id != :me
      ORDER BY (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) DESC, p.id DESC
      LIMIT :lim OFFSET :off`).all({ me: ctx.user.id, lim: EXPLORE_PAGE + 1, off: offset });
    return {
      posts: rows.slice(0, EXPLORE_PAGE).map((r) => shapePost(r, ctx.user.id)),
      next: rows.length > EXPLORE_PAGE ? offset + EXPLORE_PAGE : null,
    };
  });

  // Full-screen Reels: videos first, then popular photos (discovery feed).
  route('GET', '/api/reels', (ctx) => {
    const offset = Math.max(0, Number(ctx.query.get('offset')) || 0);
    const rows = q(`${POST_SQL}
      ORDER BY CASE WHEN p.kind = 'video' THEN 0 ELSE 1 END, p.id DESC
      LIMIT :lim OFFSET :off`).all({ me: ctx.user.id, lim: 7, off: offset });
    return {
      posts: rows.slice(0, 6).map((r) => shapePost(r, ctx.user.id)),
      next: rows.length > 6 ? offset + 6 : null,
    };
  });

  route('GET', '/api/saved', (ctx) => {
    const rows = q(`${POST_SQL} WHERE p.id IN (SELECT post_id FROM saves WHERE user_id = :me)
      ORDER BY (SELECT created_at FROM saves s WHERE s.post_id = p.id AND s.user_id = :me) DESC
      LIMIT 100`).all({ me: ctx.user.id });
    return { posts: rows.map((r) => shapePost(r, ctx.user.id)) };
  });

  route('GET', '/api/search', (ctx) => {
    const term = clampStr(ctx.query.get('q') || '', 50).replace(/^[@#]/, '');
    if (!term) return { users: [], tags: [] };
    const esc = likeEscape(term);
    const users = q(`SELECT * FROM users
      WHERE username LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\'
      ORDER BY (username LIKE ? ESCAPE '\\') DESC, username LIMIT 15`)
      .all(`%${esc}%`, `%${esc}%`, `${esc}%`).map(userCard);
    const tags = q(`SELECT tag, COUNT(*) AS posts FROM hashtags
      WHERE tag LIKE ? ESCAPE '\\' GROUP BY tag ORDER BY posts DESC LIMIT 10`)
      .all(`${likeEscape(term.toLowerCase())}%`);
    return { users, tags };
  });

  route('GET', '/api/tags/:tag', (ctx) => {
    let tag;
    try {
      tag = decodeURIComponent(ctx.params.tag).slice(0, 50).toLowerCase();
    } catch {
      throw new HttpError(400, 'Geçersiz etiket.');
    }
    const rows = q(`${POST_SQL} WHERE p.id IN (SELECT post_id FROM hashtags WHERE tag = :tag)
      ORDER BY p.id DESC LIMIT 60`).all({ me: ctx.user.id, tag });
    return { tag, count: rows.length, posts: rows.map((r) => shapePost(r, ctx.user.id)) };
  });

  // People who already follow me but I don't follow back (quick "add" list).
  route('GET', '/api/people/follows-me', (ctx) => {
    const rows = q(`SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.followee_id = :me
        AND u.id NOT IN (SELECT followee_id FROM follows WHERE follower_id = :me)
      ORDER BY f.created_at DESC LIMIT 20`).all({ me: ctx.user.id });
    return { users: rows.map(userCard) };
  });

  route('GET', '/api/suggestions', (ctx) => {
    const rows = q(`SELECT u.* FROM users u
      WHERE u.id != :me AND u.id NOT IN (SELECT followee_id FROM follows WHERE follower_id = :me)
      ORDER BY (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) DESC, u.id LIMIT 6`)
      .all({ me: ctx.user.id });
    return { users: rows.map(userCard) };
  });
};
