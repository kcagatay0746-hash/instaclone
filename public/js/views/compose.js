// Post composer: pick/drag an image, crop, filter, caption, publish.
import { API } from '../api.js';
import {
  el, icon, spinner, toast, loadImageFile, renderToDataUrl, cssFilter, FILTER_NAMES, bus,
} from '../ui.js';

export function composeView() {
  const column = el('div', { class: 'column' });
  column.append(el('div', { class: 'page-title-row' }, el('h1', { text: 'Yeni gönderi' })));
  const holder = el('div', {});
  column.append(holder);

  const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'hide' });
  let img = null;
  let filter = 'normal';
  let zoom = 1;
  let caption = '';
  let location = '';

  const dropzone = el('div', { class: 'dropzone' },
    el('div', { class: 'empty-ic' }, icon('image', 40)),
    el('h3', { text: 'Fotoğrafını buraya sürükle' }),
    el('p', { text: 'veya bilgisayarından bir görsel seç. JPEG, PNG, WebP veya GIF · en fazla 20MB.' }),
    el('button', { class: 'btn primary', onclick: () => fileInput.click() }, 'Fotoğraf seç'));

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', async (e) => {
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
      img = await loadImageFile(file);
      renderEditor();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function renderEditor() {
    const frameImg = el('img', { alt: 'Önizleme', src: img.src, style: { filter: cssFilter(filter), transform: `scale(${zoom})` } });
    const frame = el('div', { class: 'frame' }, frameImg);
    const preview = el('div', { class: 'preview' }, frame);

    const filterRow = el('div', { class: 'filters' }, FILTER_NAMES.map((name) => {
      const btn = el('button', { class: name === filter ? 'active' : '', title: name },
        el('div', { class: 'thumb' },
          el('img', { src: img.src, alt: name, style: { filter: cssFilter(name) } })),
        el('span', { text: FILTER_LABELS[name] || name }));
      btn.addEventListener('click', () => {
        filter = name;
        frameImg.style.filter = cssFilter(filter);
        filterRow.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      });
      return btn;
    }));

    const zoomInput = el('input', {
      type: 'range', min: '1', max: '2', step: '0.02', value: String(zoom), 'aria-label': 'Yakınlaştır',
    });
    zoomInput.addEventListener('input', () => {
      zoom = Number(zoomInput.value);
      frameImg.style.transform = `scale(${zoom})`;
    });

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

    const shareBtn = el('button', { class: 'btn primary block' }, 'Paylaş');
    shareBtn.addEventListener('click', async () => {
      shareBtn.disabled = true;
      shareBtn.replaceChildren(spinner('sm'), 'Paylaşılıyor…');
      try {
        const dataUrl = renderToDataUrl(img, { filter, aspect: 1, zoom, maxSize: 1080 });
        await API.createPost(dataUrl, caption, location);
        toast('Gönderin paylaşıldı 🎉');
        bus.emit('post:created');
        location.hash = '#/feed';
      } catch (err) {
        toast(err.message, 'error');
        shareBtn.disabled = false;
        shareBtn.replaceChildren('Paylaş');
      }
    });

    const panel = el('div', { class: 'panel' },
      el('div', { class: 'panel-scroll' },
        el('div', { class: 'field' }, el('label', { text: 'Açıklama' }), captionInput, counter),
        el('div', { class: 'field' }, el('label', { text: 'Konum' }), locationInput),
        el('div', { class: 'field' }, el('label', { text: 'Filtreler' }), filterRow),
        el('div', { class: 'zoom' }, icon('search', 15), zoomInput, icon('search', 22))),
      el('div', { class: 'foot' },
        shareBtn,
        el('div', { class: 'row' },
          el('button', { class: 'btn ghost sm', onclick: () => { img = null; holder.replaceChildren(dropzone); fileInput.value = ''; } }, 'Vazgeç'),
          el('span', { class: 'hint', text: 'Kare olarak kırpılır ve optimize edilir.' }))));

    const compose = el('div', { class: 'card compose' }, preview, panel);
    holder.replaceChildren(compose);
    setTimeout(() => captionInput.focus(), 80);
  }

  holder.append(dropzone, fileInput);
  return { node: column };
}

const FILTER_LABELS = {
  normal: 'Normal', clarendon: 'Clarendon', gingham: 'Gingham', moon: 'Moon', lark: 'Lark',
  juno: 'Juno', reyes: 'Reyes', valencia: 'Valencia', warm: 'Sıcak', cool: 'Soğuk',
};
