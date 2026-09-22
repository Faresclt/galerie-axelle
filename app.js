'use strict';
const photos = Array.isArray(window.AXELLE_PHOTOS) ? window.AXELLE_PHOTOS : [];
const el = id => document.getElementById(id);
const dialog = el('viewer');
let currentPhoto = null;
let currentVersion = 'original';
const versionNames = { original: 'Original', edited: 'Retouche légère', deep: 'Retouche en profondeur', purple: 'Essai fond violet', expression: 'Expression naturelle' };

const assetKey = (photo, version) => `${photo.title}:${version}`;
const validKeys = new Set(photos.flatMap(photo => Object.keys(versionNames).filter(v => photo[v]).map(v => assetKey(photo,v))));
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const favorites = AxelleSelection.load(storage, validKeys);
let preparingSelection = false;
function selectedAssets() {
  return photos.flatMap(photo => Object.keys(versionNames).filter(v => photo[v] && favorites.has(assetKey(photo,v))).map(version => ({photo,version,asset:photo[version]})));
}
function updateLikes() {
  document.querySelectorAll('[data-like-key]').forEach(button => {
    const active = favorites.has(button.dataset.likeKey);
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? '♥' : '♡';
  });
  if(currentPhoto) {
    const active=favorites.has(assetKey(currentPhoto,currentVersion));
    el('viewer-like').setAttribute('aria-pressed',String(active));
    el('viewer-like').textContent=active ? '♥ Sélectionnée' : '♡ Garder';
  }
  el('favorite-count').textContent=`${favorites.size} version${favorites.size>1?'s':''} sélectionnée${favorites.size>1?'s':''}`;
  el('download-selection').disabled=!favorites.size || preparingSelection;
}
function toggleLike(photo,version) {
  const key=assetKey(photo,version);
  if(favorites.has(key)) favorites.delete(key); else favorites.add(key);
  try { storage.setItem('axelle-favorites-v1',JSON.stringify([...favorites])); }
  catch { el('selection-status').textContent='La sauvegarde est bloquée dans ce navigateur. Télécharge ta sélection avant de quitter la page.'; }
  if(el('favorites-only').checked) render();
  updateLikes();
}
function imagePath(src) {
  if (typeof src !== 'string') throw new Error('Chemin image manquant');
  const parsed = new URL(src, location.href);
  if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) throw new Error('Format de lien refusé');
  if (parsed.origin !== location.origin) throw new Error('Les images doivent être hébergées avec la galerie');
  parsed.searchParams.set('v', '5');
  return parsed.href;
}

function setVersion(version) {
  const asset = currentPhoto[version];
  if (!asset) return;
  currentVersion = version;
  el('viewer-image').src = imagePath(asset.src);
  el('viewer-image').alt = `${currentPhoto.title} — ${versionNames[version]}`;
  el('download').href = imagePath(asset.src);
  el('download').download = asset.filename;
  el('open-image').href = imagePath(asset.src);
  el('show-original').setAttribute('aria-pressed', String(version === 'original'));
  el('show-edited').setAttribute('aria-pressed', String(version === 'edited'));
  el('show-deep').setAttribute('aria-pressed', String(version === 'deep'));
  el('show-purple').setAttribute('aria-pressed', String(version === 'purple'));
  el('show-expression').setAttribute('aria-pressed', String(version === 'expression'));
  el('share-status').textContent = '';
  updateLikes();
}

function openPhoto(photo, version) {
  currentPhoto = photo;
  el('viewer-title').textContent = photo.title;
  el('show-edited').disabled = !photo.edited;
  el('show-deep').disabled = !photo.deep;
  el('show-purple').hidden = !photo.purple;
  el('show-expression').hidden = !photo.expression;
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
    button.setAttribute('aria-label', `Agrandir ${photo.title}, ${versionNames[version]}`);
    button.addEventListener('click', () => openPhoto(photo, version));
    const img = document.createElement('img');
    img.src = imagePath(asset.src);
    img.alt = `${photo.title} — ${versionNames[version]}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    button.append(img);
    result.append(button);
    const like=document.createElement('button');
    like.className='like-button';
    like.dataset.likeKey=assetKey(photo,version);
    like.setAttribute('aria-label',`Garder ${photo.title}, ${versionNames[version]}`);
    like.setAttribute('aria-pressed',String(favorites.has(assetKey(photo,version))));
    like.textContent=favorites.has(assetKey(photo,version))?'♥':'♡';
    like.addEventListener('click',()=>toggleLike(photo,version));
    result.append(like);
  } else {
    const pending = document.createElement('div');
    pending.className = 'pending';
    const status = version === 'deep' ? photo.deepStatus : photo.retouchStatus;
    pending.textContent = status === 'unavailable' ? 'Retouche indisponible · original conservé' : 'Retouche en cours';
    result.append(pending);
  }
  const caption = document.createElement('figcaption');
  const label = document.createElement('span');
  label.textContent = `${{ original: '01', edited: '02', deep: '03', purple: '04', expression: '04' }[version]} / ${versionNames[version].toLocaleUpperCase('fr')}`;
  caption.append(label);
  if (asset) {
    const link = document.createElement('a');
    link.href = imagePath(asset.src);
    link.download = asset.filename;
    link.textContent = '↓';
    link.setAttribute('aria-label', `Télécharger ${photo.title}, ${versionNames[version]}`);
    caption.append(link);
  }
  result.append(caption);
  return result;
}

function render() {
  const query = el('search').value.trim().toLocaleLowerCase('fr');
  const visible = photos.filter(photo => `${photo.id} ${photo.title}`.toLocaleLowerCase('fr').includes(query) && (el('filter').value !== 'ready' || photo.edited) && (el('filter').value !== 'deep' || photo.deep) && (el('filter').value !== 'purple' || photo.purple) && (el('filter').value !== 'expression' || photo.expression) && (!el('favorites-only').checked || Object.keys(versionNames).some(v=>favorites.has(assetKey(photo,v)))));
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
    if(el('favorites-only').checked) {
      for(const version of Object.keys(versionNames)) if(photo[version] && favorites.has(assetKey(photo,version))) pair.append(figure(photo,version));
      pair.classList.add('selection-pair');
    } else {
      pair.append(figure(photo, 'original'), figure(photo, 'edited'), figure(photo, 'deep'));
      if (photo.purple) { pair.append(figure(photo, 'purple')); pair.classList.add('with-purple'); }
      if (photo.expression) { pair.append(figure(photo, 'expression')); pair.classList.add('with-purple'); }
    }
    card.append(top, pair);
    fragment.append(card);
  }
  el('grid').replaceChildren(fragment);
  el('no-results').hidden = !photos.length || visible.length > 0;
  el('result-count').textContent = `${visible.length} / ${photos.length}`;
  el('no-results').textContent=el('favorites-only').checked?'Aucun favori avec ces filtres. Décoche « Mes favoris » pour choisir des photos.':'Aucune photo ne correspond à cette recherche.';
  updateLikes();
}

el('favorites-only').addEventListener('change',render);
el('viewer-like').addEventListener('click',()=>toggleLike(currentPhoto,currentVersion));
window.addEventListener('storage',event=>{
  if(event.key!=='axelle-favorites-v1' && event.key!==null) return;
  favorites.clear();for(const key of AxelleSelection.load(storage,validKeys)) favorites.add(key);
  render();
});
el('download-selection').addEventListener('click',async()=>{
  const selected=selectedAssets();if(!selected.length || preparingSelection) return;
  preparingSelection=true;updateLikes();
  try {
    const files=[];
    for(const [index,item] of selected.entries()) {
      el('selection-status').textContent=`Préparation de la sélection : ${index+1} / ${selected.length}…`;
      const response=await fetch(imagePath(item.asset.src));
      if(!response.ok) throw new Error(item.photo.title);
      files.push({name:item.asset.filename,bytes:new Uint8Array(await response.arrayBuffer())});
    }
    const blob=AxelleSelection.zip(files),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='axelle-ma-selection.zip';document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    el('selection-status').textContent=`Archive prête : ${selected.length} version${selected.length>1?'s':''}. Retrouve le ZIP dans tes téléchargements.`;
  } catch { el('selection-status').textContent='Un fichier n’a pas pu être téléchargé. Tes favoris sont conservés ; réessaie.'; }
  finally { preparingSelection=false;updateLikes(); }
});
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
el('show-deep').addEventListener('click', () => setVersion('deep'));
el('show-purple').addEventListener('click', () => setVersion('purple'));
if (location.hash === '#violet') el('filter').value = 'purple';
el('show-expression').addEventListener('click', () => setVersion('expression'));
if (location.hash === '#expressions') el('filter').value = 'expression';
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
if (photos.length) {
  const deepCount = photos.filter(photo => photo.deep).length;
  const deepUnavailable = photos.filter(photo => photo.deepStatus === 'unavailable').length;
  el('total').textContent = `${photos.length} FAVORIS · ${photos.filter(photo => photo.edited).length} RETOUCHES LÉGÈRES · ${deepCount} EN PROFONDEUR`;
  el('deep-archive').hidden = deepCount === 0;
  el('deep-archive').textContent = `↓ Les ${deepCount} retouches en profondeur · ZIP`;
  el('processing-note').textContent = `${deepCount} retouches en profondeur disponibles.${deepUnavailable ? ` ${deepUnavailable} retouches en profondeur n’ont pas pu être générées.` : ''} Les 74 originaux et les 65 retouches légères sont conservés.`;
}
render();
