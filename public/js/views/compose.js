// Composer: photo OR video, crop/zoom/filters for photos, poster capture for videos.
import { API } from '../api.js';
import {
  el, icon, spinner, toast, loadImageFile, loadVideoFile, renderToDataUrl, fileToDataUrl,
  cssFilter, FILTER_NAMES, bus,
} from '../ui.js';

const FILTER_LABELS = {
  normal: 'Normal', clarendon: 'Clarendon', gingham: 'Gingham', moon: 'Moon', lark: 'Lark',
  juno: 'Juno', reyes: 'Reyes', valencia: 'Valencia', warm: 'Sıcak', cool: 'Soğuk',
};

export function composeView() {
  const column = el('div', { class: 'column' });
  column.append(el('div', { class: 'page-title-row' }, el('h1', { text: 'Yeni gönderi' })));
  const holder = el('div', {});
  column.append(holder);

  const fileInput = el('input', { type: 'file', accept: 'image/*,video/*', class: 'hide' });
  let media = null; // { kind: 'photo'|'video', source, file }
  let filter = 'normal';
  let zoom = 1;
  let caption = '';
  let location = '';

  const dropzone = el('div', { class: 'dropzone' },
    el('div', { class: 'empty-ic' }, icon('camera', 40)),
    el('h3', { text: 'Fotoğraf veya video yükle' }),
    el('p', { text: 'Sürükle bırak ya da seç. Fotoğraf: JPEG/PNG/WebP · Video: MP4/WebM (en fazla 25MB, 2 dk).' }),
    el('button', { class: 'btn primary', onclick: () => fileInput.click() }, 'Dosya seç'),
    el('div', { class: 'hint', text: 'Video yüklersen ilk kareden kapak görseli otomatik oluşturulur.' }));

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) load(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) load(fileInput.files[0]);
  });

  async function load(file) {
    try {
      if (file.type.startsWith('video/')) {
        media = { kind: 'video', source: await loadVideoFile(file), file };
      } else {
        media = { kind: 'photo', source: await loadImageFile(file), file };
      }
      filter = 'normal';
      zoom = 1;
      renderEditor();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function renderEditor() {
    const isVideo = media.kind === 'video';
    const previewEl = isVideo
      ? el('video', {
        src: media.source.src, controls: true, playsinline: true, loop: true, muted: true,
        class: 'compose-video', 'aria-label': 'Video önizleme',
      })
      : el('img', { alt: 'Önizleme', src: media.source.src, style: { filter: cssFilter(filter), transform: `scale(${zoom})` } });

    const frame = el('div', { class: 'frame' }, previewEl);
    const preview = el('div', { class: 'preview' }, frame);

    let filtersBlock = null;
    let zoomBlock = null;
    if (!isVideo) {
      const filterRow = el('div', { class: 'filters' }, FILTER_NAMES.map((name) => {
        const btn = el('button', { class: name === filter ? 'active' : '', title: name, type: 'button' },
          el('div', { class: 'thumb' }, el('img', { src: media.source.src, alt: name, style: { filter: cssFilter(name) } })),
          el('span', { text: FILTER_LABELS[name] || name }));
        btn.addEventListener('click', () => {
          filter = name;
          previewEl.style.filter = cssFilter(filter);
          filterRow.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
        });
        return btn;
      }));

      const zoomInput = el('input', {
        type: 'range', min: '1', max: '2', step: '0.02', value: String(zoom), 'aria-label': 'Yakınlaştır',
      });
      zoomInput.addEventListener('input', () => {
        zoom = Number(zoomInput.value);
        previewEl.style.transform = `scale(${zoom})`;
      });

      filtersBlock = el('div', { class: 'field' }, el('label', { text: 'Filtreler' }), filterRow);
      zoomBlock = el('div', { class: 'zoom' }, icon('search', 15), zoomInput, icon('search', 22));
    } else {
      filtersBlock = el('div', { class: 'field' },
        el('label', { text: 'Video' }),
        el('p', { class: 'hint', text: `${Math.round(media.source.duration)} saniye · kapak görseli videodan alınacak. Reels akışında öne çıkar.` }));
    }

    const captionInput = el('textarea', {
      placeholder: 'Bir açıklama yaz… #etiketler @bahsetmeler',
      maxlength: '2200',
      oninput: () => {
        caption = captionInput.value;
        counter.textContent = `${caption.length}/2200`;
      },
    });
    const counter = el('div', { class: 'counter', text: '0/2200' });
    const locationInput = el('input', { class: 'input', placeholder: 'Konum ekle (isteğe bağlı)', maxlength: '100' });
    locationInput.addEventListener('input', () => { location = locationInput.value; });

    const shareBtn = el('button', { class: 'btn primary block' }, isVideo ? 'Videoyu paylaş' : 'Paylaş');
    shareBtn.addEventListener('click', async () => {
      shareBtn.disabled = true;
      shareBtn.replaceChildren(spinner('sm'), 'Paylaşılıyor…');
      try {
        if (isVideo) {
          const poster = renderToDataUrl(media.source, { aspect: 1, maxSize: 1080 });
          const dataUrl = await fileToDataUrl(media.file);
          await API.createVideoPost(dataUrl, poster, caption, location);
        } else {
          const dataUrl = renderToDataUrl(media.source, { filter, aspect: 1, zoom, maxSize: 1080 });
          await API.createPost(dataUrl, caption, location);
        }
        toast('Gönderin paylaşıldı 🎉');
        bus.emit('post:created');
        window.location.hash = isVideo ? '#/reels' : '#/feed';
      } catch (err) {
        toast(err.message, 'error');
        shareBtn.disabled = false;
        shareBtn.replaceChildren(isVideo ? 'Videoyu paylaş' : 'Paylaş');
      }
    });

    const panel = el('div', { class: 'panel' },
      el('div', { class: 'panel-scroll' },
        el('div', { class: 'field' }, el('label', { text: 'Açıklama' }), captionInput, counter),
        el('div', { class: 'field' }, el('label', { text: 'Konum' }), locationInput),
        filtersBlock,
        zoomBlock),
      el('div', { class: 'foot' },
        shareBtn,
        el('div', { class: 'row' },
          el('button', {
            class: 'btn ghost sm',
            onclick: () => { media = null; holder.replaceChildren(dropzone); fileInput.value = ''; },
          }, 'Vazgeç'),
          el('span', { class: 'hint', text: isVideo ? 'Video olduğu gibi yüklenir.' : 'Kare olarak kırpılır ve optimize edilir.' }))));

    const compose = el('div', { class: 'card compose' }, preview, panel);
    holder.replaceChildren(compose);
    setTimeout(() => captionInput.focus(), 80);
  }

  holder.append(dropzone, fileInput);
  return { node: column };
}
