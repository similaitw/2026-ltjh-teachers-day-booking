(() => {
  const STORAGE_KEY = 'ltjh-booking-skin';
  const DEFAULT_SKIN = 'wood';
  const SKINS = {
    wood: { color: '#8f6b55', label: '暖木奶茶' },
    sage: { color: '#5f7d68', label: '清新鼠尾草' },
    navy: { color: '#334a62', label: '深藍質感' }
  };

  function readStoredSkin() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return SKINS[value] ? value : DEFAULT_SKIN;
    } catch {
      return DEFAULT_SKIN;
    }
  }

  function syncControls(skin) {
    document.querySelectorAll('[data-skin-choice]').forEach(button => {
      const active = button.dataset.skinChoice === skin;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.title = active ? `目前主題：${SKINS[skin].label}` : `切換成${SKINS[button.dataset.skinChoice]?.label || '其他'}主題`;
    });
  }

  function syncThemeColor(skin) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', SKINS[skin].color);
  }

  function applySkin(skin, persist = true) {
    const next = SKINS[skin] ? skin : DEFAULT_SKIN;
    document.documentElement.dataset.skin = next;
    syncThemeColor(next);
    syncControls(next);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    }
  }

  const initialSkin = readStoredSkin();
  document.documentElement.dataset.skin = initialSkin;

  function bind() {
    applySkin(initialSkin, false);
    document.querySelectorAll('[data-skin-choice]').forEach(button => {
      button.addEventListener('click', () => applySkin(button.dataset.skinChoice));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }

  window.LTJHSkin = { apply: applySkin, current: () => document.documentElement.dataset.skin || DEFAULT_SKIN };
})();
