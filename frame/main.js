import './style.css';
import {elements as el} from './core/dom.js';
import {state, rememberFrame, savedFrame, rememberJob, savedJob} from './core/state.js';
import {normalizeAddress, request, validateConfig, sendPhoto, getPhoto} from './services/frame-client.js';
import {saveDraft, readDraft} from './services/drafts.js';
import {activity, controls, showView, renderGallery} from './ui/render.js';

async function refreshGallery() {
  const images = await request(state.frame.base, '/api/images');
  if (!Array.isArray(images)) throw new Error('The frame returned an invalid gallery.');
  state.images = images;
  renderGallery(selectPhoto);
}

async function connectFrame() {
  if (state.busy || state.job) return;
  state.busy = true; controls();
  el['connection-status'].textContent = 'Finding your frame… Allow local-network access if prompted.';
  try {
    const base = normalizeAddress(el.address.value);
    const config = validateConfig(await request(base, '/api/display-config'));
    const images = await request(base, '/api/images');
    if (!Array.isArray(images)) throw new Error('The frame returned an invalid gallery.');
    rememberFrame({base, name: new URL(base).hostname.replace(/\.local$/, ''), config});
    state.config = config; state.images = images; state.connected = true;
    el['frame-name'].textContent = state.frame.name;
    el['frame-detail'].textContent = `Connected · ${config.width} × ${config.height}`;
    el['connection-status'].textContent = 'Connected directly over your local WiFi.';
    el.connection.classList.add('connected'); el.connection.open = false; el.forget.hidden = false;
    el.dimensions.textContent = `${config.width} × ${config.height}`;
    renderGallery(selectPhoto);
    if (state.draft) prepare();
    const previous = savedJob();
    if (previous?.base === base) { rememberJob(previous); pollJob(); }
  } catch (error) {
    state.connected = false;
    el['connection-status'].textContent = error.message;
    el['frame-detail'].textContent = 'Not connected';
    el.connection.classList.remove('connected'); el.connection.open = true;
  } finally { state.busy = false; controls(); }
}

async function useDraft(draft) {
  state.draft = draft;
  el['draft-name'].textContent = draft.name;
  el.fit.value = draft.fit; el.saturation.value = String(draft.saturation);
  el.editor.hidden = false; showView('editor'); prepare();
  try { await saveDraft(draft); }
  catch { activity('Draft is open', 'This browser could not save the draft. Keep the app open until you send it.'); }
}

async function selectPhoto(image) {
  if (state.busy || state.job) return;
  state.busy = true; controls();
  try {
    const blob = await getPhoto(state.frame.base, image.filename);
    await useDraft({blob, sourceFrame: state.frame.base, sourceFilename: image.filename, name: image.filename, fit: image.fit_mode || 'contain', saturation: image.saturation ?? 0.5});
  } catch (error) { activity('Could not open photo', error.message, true); }
  finally { state.busy = false; controls(); }
}

function prepare() {
  if (!state.draft || !state.config) return;
  state.worker?.terminate();
  const generation = ++state.generation;
  state.prepared = null; state.processing = true; controls();
  el['preview-status'].textContent = 'Making your color preview…';
  const worker = new Worker('/frame/photo-worker.js'); state.worker = worker;
  const failed = message => {
    if (generation !== state.generation) return;
    state.processing = false; state.prepared = null;
    el['preview-status'].textContent = message; controls(); worker.terminate();
  };
  worker.onerror = () => failed('Could not process this photo. Try a JPEG, PNG, or WebP image.');
  worker.onmessage = ({data}) => {
    if (generation !== state.generation) return;
    if (data.error) { failed(data.error); return; }
    state.prepared = data; state.processing = false;
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = URL.createObjectURL(data.dithered);
    el.preview.src = state.previewUrl; el.preview.hidden = false; el['preview-empty'].hidden = true;
    el.preview.width = data.width; el.preview.height = data.height;
    el.dimensions.textContent = `${data.width} × ${data.height}`;
    el['preview-status'].textContent = 'Ready. The screen’s ink colors may look softer than this preview.';
    controls(); worker.terminate();
  };
  worker.postMessage({...state.draft, config: state.config});
}

async function pollJob() {
  clearTimeout(state.pollTimer);
  const job = state.job;
  if (!job) return;
  el['retry-status'].hidden = true;
  try {
    const current = await request(job.base, `/api/flash/status/${job.id}`);
    if (state.job !== job) return;
    if (current.filename !== job.filename || (job.createdAt && job.createdAt !== current.created_at)) {
      throw new Error('The frame restarted. Check the screen before sending this photo again.');
    }
    job.createdAt = current.created_at; rememberJob(job);
    if (current.status === 'Completed') {
      activity('Your new view is ready.', 'The frame has finished refreshing.');
      rememberJob(null); controls(); refreshGallery().catch(() => {}); return;
    }
    if (current.status === 'Failed') {
      const timeout = /Wait:.*Timed out/.test(current.error_message || '');
      activity('The display could not refresh.', timeout ? 'The panel did not respond. Check its connection before trying again.' : 'The frame reported a display error. Check the device before trying again.', true);
      rememberJob(null); controls(); return;
    }
    activity(current.status === 'Queued' ? 'Waiting for your frame…' : 'Refreshing your frame…', 'The screen may flash several times. Keep the frame powered on.');
    state.pollTimer = setTimeout(pollJob, 2000);
  } catch (error) {
    activity('Refresh status unavailable', `${error.message} The job may still be running.`, true);
    el['retry-status'].hidden = false;
    // A lost response must never cause an automatic second flash.
    if (error.status === 404 || error.message.includes('restarted')) rememberJob(null);
    controls();
  }
}

el['connect-form'].addEventListener('submit', event => {event.preventDefault(); connectFrame();});
el['pick-photo'].addEventListener('click', () => el.photo.click());
el.photo.addEventListener('change', async () => {
  const file = el.photo.files[0]; el.photo.value = '';
  if (!file || state.busy || state.job) return;
  if (file.size > 20 * 1024 * 1024) {activity('Photo is too large', 'Choose a photo under 20 MB.', true);return;}
  await useDraft({blob: file, name: file.name, fit: 'contain', saturation: 0.5});
});
for (const id of ['fit', 'saturation']) el[id].addEventListener('change', () => {
  if (!state.draft) return;
  useDraft({...state.draft, fit: el.fit.value, saturation: Number(el.saturation.value)});
});
el.send.addEventListener('click', async () => {
  if (state.busy || state.job || !state.prepared || !state.connected) return;
  state.busy = true; controls();
  try {
    const job = await sendPhoto({base: state.frame.base, draft: state.draft, prepared: state.prepared,
      session: state.session, onProgress: message => activity(message, 'Your photo stays on your local network.')});
    rememberJob(job); pollJob();
    state.draft = {...state.draft, sourceFrame: job.base, sourceFilename: job.filename};
    saveDraft(state.draft).catch(() => {});
  } catch (error) {activity('Could not finish sending', `${error.message} Check the frame before retrying if the connection was interrupted.`, true);}
  finally {state.busy = false; controls();}
});
el['retry-status'].addEventListener('click', () => state.job ? pollJob() : connectFrame());
el['refresh-gallery'].addEventListener('click', () => refreshGallery().catch(error => activity('Could not load photos', error.message, true)));
el['choose-tab'].addEventListener('click', () => showView('editor'));
el['gallery-tab'].addEventListener('click', () => showView('gallery'));
el.forget.addEventListener('click', () => {
  if (state.busy || state.job) return;
  try { localStorage.removeItem('sparkle-frame'); } catch { /* Storage can be disabled. */ }
  state.frame = null; state.config = null; state.connected = false;
  state.images = []; state.worker?.terminate(); ++state.generation; state.processing = false; state.prepared = null;
  el.connection.open = true; el.connection.classList.remove('connected'); el.forget.hidden = true;
  el['frame-name'].textContent = 'Your frame'; el['frame-detail'].textContent = 'Connect once. Keep it close.';
  el['connection-status'].textContent = 'Frame forgotten. Your draft is still on this phone.';
  renderGallery(selectPhoto); controls();
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); state.installPrompt = event; el.install.hidden = false;
});
el.install.addEventListener('click', async () => {
  if (!state.installPrompt) return;
  await state.installPrompt.prompt(); state.installPrompt = null; el.install.hidden = true;
});
window.addEventListener('appinstalled', () => {el.install.hidden = true;});

async function start() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/frame/sw.js', {scope: '/frame/'}).catch(() => {});
  }
  const handoff = new URLSearchParams(location.hash.slice(1)).get('device');
  const remembered = savedFrame();
  if (handoff) {
    try {el.address.value = normalizeAddress(handoff);} catch (error) {el['connection-status'].textContent = error.message;}
    history.replaceState(null, '', location.pathname);
  } else if (remembered?.base) {
    try {
      el.address.value = normalizeAddress(remembered.base);
      if (remembered.config) state.config = validateConfig(remembered.config);
    } catch { /* Ignore malformed old settings. */ }
  }
  try {const draft = await readDraft(); if (draft?.blob) await useDraft(draft);} catch { /* Storage is optional. */ }
  controls();
  if (!handoff && remembered?.base) connectFrame();
}
start();
