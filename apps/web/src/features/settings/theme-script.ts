import { THEME_STORAGE_KEY } from './settings-storage'

export const THEME_INITIALIZATION_SCRIPT = `(() => {
  try {
    const stored = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    const preference = stored === 'light' || stored === 'dark' ? stored : 'system';
    const theme = preference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preference;
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
})();`
