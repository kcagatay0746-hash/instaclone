'use strict';
const { HttpError } = require('./util');
const { POST_SQL, createPostHelpers } = require('./posts-helpers');

module.exports = function userRoutes(core) {
  const { q, now, route, userCard, userByName, notify } = core;
  const { shapePost } = createPostHelpers(core);

  function profileOf(username, me) {
    const u = userByName(username);
    const count = (sql) => q(sql).get(u.id).n;
    return {
      ...userCard(u),
      bio: u.bio,
      created_at: u.created_at,
      posts: count('SELECT COUNT(*) n FROM posts WHERE user_id = ?'),
      followers: count('SELECT COUNT(*) n FROM follows WHERE followee_id = ?'),
      following: count('SELECT COUNT(*) n FROM follows WHERE follower_id = ?'),
      is_following: !!q('SELECT 1 x FROM follows WHERE follower_id=? AND followee_id=?').get(me ?? 0, u.id),
      follows_me: !!q('SELECT 1 x FROM follows WHERE follower_id=? AND followee_id=?').get(u.id, me ?? 0),
      is_me: me === u.id,
    };
  }

  route('GET', '/api/users/:username', (ctx) => ({ user: profileOf(ctx.params.username, ctx.user.id) }));

  route('GET', '/api/users/:username/posts', (ctx) => {
    const u = userByName(ctx.params.username);
    const rows = q(`${POST_SQL} WHERE p.user_id = :uid ORDER BY p.id DESC LIMIT 120`).all({ me: ctx.user.id, uid: u.id });
    return { posts: rows.map((r) => shapePost(r, ctx.user.id)) };
  });

  const listFollow = (col, other) => (ctx) => {
    const u = userByName(ctx.params.username);
    const rows = q(`SELECT u.* FROM follows f JOIN users u ON u.id = f.${other}
      WHERE f.${col} = ? ORDER BY f.created_at DESC LIMIT 200`).all(u.id);
    const mine = new Set(q('SELECT followee_id FROM follows WHERE follower_id = ?').all(ctx.user.id).map((r) => r.followee_id));
    return { users: rows.map((r) => ({ ...userCard(r), is_following: mine.has(r.id), is_me: r.id === ctx.user.id })) };
  };
  route('GET', '/api/users/:username/followers', listFollow('followee_id', 'follower_id'));
  route('GET', '/api/users/:username/following', listFollow('follower_id', 'followee_id'));

  route('POST', '/api/users/:username/follow', (ctx) => {
    const u = userByName(ctx.params.username);
    if (u.id === ctx.user.id) throw new HttpError(400, 'Kendinizi takip edemezsiniz.');
    const r = q('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)')
      .run(ctx.user.id, u.id, now());
    if (r.changes) notify(u.id, ctx.user.id, 'follow');
    return { user: profileOf(u.username, ctx.user.id) };
  });

  route('DELETE', '/api/users/:username/follow', (ctx) => {
    const u = userByName(ctx.params.username);
    q('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(ctx.user.id, u.id);
    return { user: profileOf(u.username, ctx.user.id) };
  });
};
