import {elements as el} from '../core/dom.js';
import {state} from '../core/state.js';
import {getPhoto} from '../services/frame-client.js';

export function activity(title, detail = '', error = false) {
  el.activity.hidden = false;
  el.activity.dataset.error = String(error);
  el['activity-title'].textContent = title;
  el['activity-detail'].textContent = detail;
}

export function controls() {
  const working = state.busy || Boolean(state.job);
  el.connect.disabled = working;
  el.address.disabled = working;
  el.forget.disabled = working;
  el['pick-photo'].disabled = working || !state.config;
  el['refresh-gallery'].disabled = working || !state.connected;
  el.fit.disabled = working;
  el.saturation.disabled = working;
  el.send.disabled = working || state.processing || !state.prepared || !state.connected;
  el['setup-link'].hidden = working;
}

export function showView(view) {
  el['editor-panel'].hidden = view !== 'editor';
  el['gallery-panel'].hidden = view !== 'gallery';
  for (const [id, value] of [['choose-tab', 'editor'], ['gallery-tab', 'gallery']]) {
    if (value === view) el[id].setAttribute('aria-current', 'page');
    else el[id].removeAttribute('aria-current');
  }
}

export async function renderGallery(select) {
  const base = state.frame?.base;
  const generation = (state.galleryGeneration || 0) + 1;
  state.galleryGeneration = generation;
  for (const url of state.galleryUrls) URL.revokeObjectURL(url);
  state.galleryUrls = [];
  el.gallery.replaceChildren();
  el['gallery-empty'].hidden = Boolean(state.images.length);
  el['gallery-empty'].textContent = 'Your first photo belongs here. Choose one in Create.';
  // Load thumbnails in small batches so a large library does not overwhelm a Pi Zero.
  const entries = state.images.slice().reverse();
  for (let start = 0; start < entries.length; start += 4) {
    if (state.frame?.base !== base || state.galleryGeneration !== generation) return;
    await Promise.all(entries.slice(start, start + 4).map(async image => {
      const button = document.createElement('button');
      const picture = document.createElement('img');
      picture.alt = ''; picture.loading = 'lazy';
      const label = document.createElement('span'); label.textContent = image.filename;
      button.append(picture, label); button.addEventListener('click', () => select(image));
      el.gallery.append(button);
      try {
        if (!image.thumb_ready) return;
        const blob = await getPhoto(base, image.filename, true);
        if (state.frame?.base !== base || state.galleryGeneration !== generation || !button.isConnected) return;
        const url = URL.createObjectURL(blob); state.galleryUrls.push(url); picture.src = url;
      } catch { picture.alt = 'Preview unavailable'; }
    }));
  }
}
