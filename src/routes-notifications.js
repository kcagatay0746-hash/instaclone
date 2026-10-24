'use strict';

module.exports = function notificationRoutes(core) {
  const { q, route, imgUrl } = core;

  route('GET', '/api/notifications', (ctx) => {
    const rows = q(`SELECT n.id, n.type, n.post_id, n.text, n.read, n.created_at,
        u.id AS uid, u.username, u.name, u.avatar, p.image AS post_image
      FROM notifications n JOIN users u ON u.id = n.actor_id
      LEFT JOIN posts p ON p.id = n.post_id
      WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 60`).all(ctx.user.id);
    return {
      notifications: rows.map((r) => ({
        id: r.id,
        type: r.type,
        post_id: r.post_id,
        text: r.text,
        read: !!r.read,
        created_at: r.created_at,
        user: { id: r.uid, username: r.username, name: r.name, avatar: imgUrl(r.avatar) },
        post_image: imgUrl(r.post_image),
      })),
    };
  });

  route('POST', '/api/notifications/read', (ctx) => {
    q('UPDATE notifications SET read = 1 WHERE user_id = ?').run(ctx.user.id);
    return { ok: true };
  });
};
