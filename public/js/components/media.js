// Shared media renderer: photo, video player, or a broken-image fallback.
import { el, icon, fmt } from '../ui.js';

export function postMedia(post, {
  controls = true, autoplay = false, muted = true, loop = false, className = '', onView,
} = {}) {
  if (post.kind === 'video' && post.video) {
    const video = el('video', {
      muted: muted ? true : null,
      autoplay: autoplay ? true : null,
      loop: loop ? true : null,
      playsinline: true,
      preload: 'metadata',
      poster: post.image || '',
      src: post.video,
      controls: controls ? true : null,
      class: className,
      'aria-label': post.caption || 'Video',
    });
    // properties (not just attributes) so autoplay is allowed by every browser
    video.muted = !!muted;
    video.playsInline = true;
    if (onView && autoplay) {
      let counted = false;
      const count = () => {
        if (counted) return;
        counted = true;
        onView();
      };
      video.addEventListener('play', count, { once: true });
      setTimeout(count, 1200);
    }
    return video;
  }
  const img = el('img', {
    src: post.image,
    alt: post.caption || 'Gönderi',
    loading: 'lazy',
    draggable: 'false',
    class: className,
  });
  img.addEventListener('error', () => img.replaceWith(el('div', { class: 'img-fallback', text: 'Görsel yüklenemedi' })), { once: true });
  return img;
}

export function playBadge() {
  return el('span', { class: 'play-badge' }, icon('play', 16));
}

export function viewCount(post) {
  return Number(post.views || 0) > 0 ? `${fmt.count(post.views)} görüntülenme` : '';
}
