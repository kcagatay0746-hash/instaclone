// Thin fetch wrapper: JSON in, JSON out, Turkish error messages.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Bir şeyler ters gitti.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const API = {
  me: () => api('/api/me'),
  login: (username, password) => api('/api/login', { method: 'POST', body: { username, password } }),
  register: (username, name, password) => api('/api/register', { method: 'POST', body: { username, name, password } }),
  logout: () => api('/api/logout', { method: 'POST', body: {} }),
  updateMe: (patch) => api('/api/me', { method: 'PATCH', body: patch }),

  feed: (before) => api(`/api/feed${before ? `?before=${before}` : ''}`),
  explore: (offset) => api(`/api/explore?offset=${offset || 0}`),
  saved: () => api('/api/saved'),
  suggestions: () => api('/api/suggestions'),
  search: (q) => api(`/api/search?q=${encodeURIComponent(q)}`),
  tag: (tag) => api(`/api/tags/${encodeURIComponent(tag)}`),

  post: (id) => api(`/api/posts/${id}`),
  createPost: (image, caption, location) => api('/api/posts', { method: 'POST', body: { image, caption, location } }),
  deletePost: (id) => api(`/api/posts/${id}`, { method: 'DELETE', body: {} }),
  like: (id, on) => api(`/api/posts/${id}/like`, { method: on ? 'POST' : 'DELETE', body: {} }),
  save: (id, on) => api(`/api/posts/${id}/save`, { method: on ? 'POST' : 'DELETE', body: {} }),
  likers: (id) => api(`/api/posts/${id}/likes`),

  comments: (id) => api(`/api/posts/${id}/comments`),
  comment: (id, text) => api(`/api/posts/${id}/comments`, { method: 'POST', body: { text } }),
  deleteComment: (id) => api(`/api/comments/${id}`, { method: 'DELETE', body: {} }),

  user: (username) => api(`/api/users/${encodeURIComponent(username)}`),
  userPosts: (username) => api(`/api/users/${encodeURIComponent(username)}/posts`),
  followers: (username) => api(`/api/users/${encodeURIComponent(username)}/followers`),
  following: (username) => api(`/api/users/${encodeURIComponent(username)}/following`),
  follow: (username, on) => api(`/api/users/${encodeURIComponent(username)}/follow`, { method: on ? 'POST' : 'DELETE', body: on ? {} : undefined }),

  stories: () => api('/api/stories'),
  addStory: (image) => api('/api/stories', { method: 'POST', body: { image } }),
  viewStory: (id) => api(`/api/stories/${id}/view`, { method: 'POST', body: {} }),
  deleteStory: (id) => api(`/api/stories/${id}`, { method: 'DELETE' }),

  notifications: () => api('/api/notifications'),
  readNotifications: () => api('/api/notifications/read', { method: 'POST', body: {} }),

  conversations: () => api('/api/messages'),
  thread: (username) => api(`/api/messages/${encodeURIComponent(username)}`),
  sendMessage: (username, text) => api(`/api/messages/${encodeURIComponent(username)}`, { method: 'POST', body: { text } }),
};
