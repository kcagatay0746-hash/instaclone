'use strict';
const { HttpError } = require('./util');

const POST_SQL = `
  SELECT p.id, p.image, p.caption, p.location, p.created_at, p.kind, p.video, p.views,
    u.id AS uid, u.username, u.name, u.avatar,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
    EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = :me) AS liked,
    EXISTS(SELECT 1 FROM saves s WHERE s.post_id = p.id AND s.user_id = :me) AS saved,
    EXISTS(SELECT 1 FROM post_views v WHERE v.post_id = p.id AND v.user_id = :me) AS viewed
  FROM posts p JOIN users u ON u.id = p.user_id`;

// Builds the post serializer pools shared by feed & post route modules.
function createPostHelpers(core) {
  const { q, imgUrl, rowUser } = core;

  const COMMENT_SQL = `SELECT c.id, c.text, c.created_at, u.id AS uid, u.username, u.name, u.avatar
    FROM comments c JOIN users u ON u.id = c.user_id`;

  const shapeComment = (c, me) => ({
    id: c.id, text: c.text, created_at: c.created_at, user: rowUser(c), mine: c.uid === me,
  });

  const recentComments = (postId, me) =>
    q(`${COMMENT_SQL} WHERE c.post_id = ? ORDER BY c.id DESC LIMIT 2`).all(postId).reverse().map((c) => shapeComment(c, me));

  const shapePost = (r, me = 0) => ({
    id: r.id,
    image: imgUrl(r.image),
    video: imgUrl(r.video),
    kind: r.kind || 'photo',
    views: r.views || 0,
    viewed: !!r.viewed,
    caption: r.caption,
    location: r.location,
    created_at: r.created_at,
    user: rowUser(r),
    likes: r.likes,
    comments: r.comments,
    liked: !!r.liked,
    saved: !!r.saved,
    recent: recentComments(r.id, me),
  });

  function getPost(id, me) {
    const r = q(`${POST_SQL} WHERE p.id = :id`).get({ me, id });
    if (!r) throw new HttpError(404, 'Gönderi bulunamadı.');
    return shapePost(r, me);
  }

  return { shapePost, getPost, shapeComment, recentComments, POST_SQL, COMMENT_SQL };
}

module.exports = { createPostHelpers, POST_SQL };
