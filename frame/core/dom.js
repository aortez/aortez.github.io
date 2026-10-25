export const elements = Object.fromEntries([
  'connection', 'connect-form', 'address', 'connect', 'connection-status', 'frame-name',
  'frame-detail', 'gallery', 'gallery-empty', 'refresh-gallery', 'pick-photo', 'photo',
  'editor', 'preview', 'preview-empty', 'preview-status', 'dimensions', 'fit', 'saturation',
  'send', 'activity', 'activity-title', 'activity-detail', 'retry-status', 'install', 'draft-name',
  'forget', 'setup-link', 'choose-tab', 'gallery-tab', 'gallery-panel', 'editor-panel',
].map(id => [id, document.getElementById(id)]));
