'use strict';
const photos = Array.isArray(window.AXELLE_PHOTOS) ? window.AXELLE_PHOTOS : [];
const el = id => document.getElementById(id);
const dialog = el('viewer');
let currentPhoto = null;
let currentVersion = 'original';

function imagePath(src) {
  if (typeof src !== 'string') throw new Error('Chemin image manquant');
  const parsed = new URL(src, location.href);
  if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) throw new Error('Format de lien refusé');
  if (parsed.origin !== location.origin) throw new Error('Les images doivent être hébergées avec la galerie');
  return parsed.href;
}

function setVersion(version) {
  const asset = currentPhoto[version];
  if (!asset) return;
  currentVersion = version;
  el('viewer-image').src = imagePath(asset.src);
  el('viewer-image').alt = `${currentPhoto.title} — ${version === 'original' ? 'original' : 'retouche IA'}`;
  el('download').href = imagePath(asset.src);
  el('download').download = asset.filename;
  el('open-image').href = imagePath(asset.src);
  el('show-original').setAttribute('aria-pressed', String(version === 'original'));
  el('show-edited').setAttribute('aria-pressed', String(version === 'edited'));
  el('share-status').textContent = '';
}

function openPhoto(photo, version) {
  currentPhoto = photo;
  el('viewer-title').textContent = photo.title;
  el('show-edited').disabled = !photo.edited;
  setVersion(version);
  dialog.showModal();
}

function figure(photo, version) {
  const asset = photo[version];
  const result = document.createElement('figure');
  result.className = 'photo';
  if (asset) {
    const button = document.createElement('button');
    button.className = 'photo-button';
    button.setAttribute('aria-label', `Agrandir ${photo.title}, ${version === 'original' ? 'original' : 'retouche IA'}`);
    button.addEventListener('click', () => openPhoto(photo, version));
    const img = document.createElement('img');
    img.src = imagePath(asset.src);
    img.alt = `${photo.title} — ${version === 'original' ? 'original' : 'retouche IA'}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    button.append(img);
    result.append(button);
  } else {
    const pending = document.createElement('div');
    pending.className = 'pending';
    pending.textContent = photo.retouchStatus === 'unavailable' ? 'Retouche indisponible · original conservé' : 'Retouche en attente';
    result.append(pending);
  }
  const caption = document.createElement('figcaption');
  const label = document.createElement('span');
  label.textContent = version === 'original' ? '01 / ORIGINAL' : '02 / RETOUCHE IA';
  caption.append(label);
  if (asset) {
    const link = document.createElement('a');
    link.href = imagePath(asset.src);
    link.download = asset.filename;
    link.textContent = '↓';
    link.setAttribute('aria-label', `Télécharger ${photo.title}, ${version === 'original' ? 'original' : 'retouche IA'}`);
    caption.append(link);
  }
  result.append(caption);
  return result;
}

function render() {
  const query = el('search').value.trim().toLocaleLowerCase('fr');
  const visible = photos.filter(photo => `${photo.id} ${photo.title}`.toLocaleLowerCase('fr').includes(query) && (el('filter').value !== 'ready' || photo.edited));
  const fragment = document.createDocumentFragment();
  for (const photo of visible) {
    const card = document.createElement('article');
    card.className = 'card';
    const top = document.createElement('div');
    top.className = 'card-top';
    const title = document.createElement('h2');
    title.textContent = photo.title;
    const number = document.createElement('span');
    number.textContent = String(photo.id).padStart(3, '0');
    top.append(title, number);
    const pair = document.createElement('div');
    pair.className = 'pair';
    pair.style.setProperty('--photo-ratio', photo.orientation === 'P' ? '2 / 3' : '3 / 2');
    pair.append(figure(photo, 'original'), figure(photo, 'edited'));
    card.append(top, pair);
    fragment.append(card);
  }
  el('grid').replaceChildren(fragment);
  el('no-results').hidden = !photos.length || visible.length > 0;
  el('result-count').textContent = `${visible.length} / ${photos.length}`;
}

el('search').addEventListener('input', render);
el('filter').addEventListener('change', render);
el('close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
el('show-original').addEventListener('click', () => setVersion('original'));
el('show-edited').addEventListener('click', () => setVersion('edited'));
el('share').addEventListener('click', async () => {
  const asset = currentPhoto[currentVersion];
  if (!navigator.share || !navigator.canShare) {
    el('share-status').textContent = 'Utilise « Ouvrir le fichier », puis enregistre l’image depuis ton navigateur.';
    return;
  }
  try {
    el('share').disabled = true;
    const response = await fetch(imagePath(asset.src));
    if (!response.ok) throw new Error('Téléchargement indisponible');
    const blob = await response.blob();
    const file = new File([blob], asset.filename, { type: blob.type || 'image/jpeg' });
    if (!navigator.canShare({ files: [file] })) throw new Error('Partage de fichier indisponible');
    await navigator.share({ files: [file], title: currentPhoto.title });
  } catch (error) {
    if (error.name !== 'AbortError') el('share-status').textContent = 'Utilise « Ouvrir le fichier », puis enregistre l’image depuis ton navigateur.';
  } finally { el('share').disabled = false; }
});
el('toolbar').hidden = photos.length === 0;
el('empty').hidden = photos.length !== 0;
if (photos.length) el('total').textContent = `${photos.length} FAVORIS · ${photos.filter(photo => photo.edited).length} RETOUCHES`;
render();
