export const state = {
  frame: null, config: null, images: [], draft: null, prepared: null,
  connected: false, galleryGeneration: 0,
  busy: false, processing: false, worker: null, generation: 0,
  previewUrl: null, galleryUrls: [], job: null, pollTimer: null,
  session: crypto.randomUUID(), installPrompt: null,
};

export function rememberFrame(frame) {
  state.frame = frame;
  try { localStorage.setItem('sparkle-frame', JSON.stringify(frame)); } catch { /* Storage can be disabled. */ }
}

export function savedFrame() {
  try { return JSON.parse(localStorage.getItem('sparkle-frame')); } catch { return null; }
}

export function rememberJob(job) {
  state.job = job;
  try {
    if (job) localStorage.setItem('sparkle-job', JSON.stringify(job));
    else localStorage.removeItem('sparkle-job');
  } catch { /* A live job can still be tracked without persistent storage. */ }
}

export function savedJob() {
  try { return JSON.parse(localStorage.getItem('sparkle-job')); } catch { return null; }
}
