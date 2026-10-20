/* Static GitHub Pages routing. Explicit locale URLs never redirect. */
(() => {
  'use strict';
  const languages = ['it', 'en', 'ja'];
  const preferenceKey = 'portfolio.language';
  const entry = document.body.dataset.languageEntry;
  const picker = document.body.dataset.languagePicker === 'true';
  const sections = ['index.html', 'experience.html', 'about-me.html', 'education-and-certifications.html', 'cv.html'];
  const params = new URLSearchParams(window.location.search);
  const current = document.documentElement.lang;
  let manuallySelected = false;

  const readPreference = () => {
    try {
      const value = localStorage.getItem(preferenceKey);
      return languages.includes(value) ? value : null;
    } catch (_) { return null; }
  };
  const savePreference = (value) => {
    try { localStorage.setItem(preferenceKey, value); } catch (_) { /* Optional. */ }
  };

  document.querySelectorAll('a[data-language]').forEach((link) => {
    if (picker) {
      const requested = params.get('page');
      const page = sections.includes(requested) ? requested : 'index.html';
      const target = new URL(`${link.dataset.language}/${page}`, window.location.href);
      const remaining = new URLSearchParams(params);
      remaining.delete('page');
      remaining.delete('choose');
      target.search = remaining.toString();
      target.hash = window.location.hash;
      link.href = target.href;
    } else if (!entry) {
      const target = new URL(link.href);
      target.search = window.location.search;
      target.hash = window.location.hash;
      link.href = target.href;
    }
    link.addEventListener('click', (event) => {
      manuallySelected = true;
      savePreference(link.dataset.language);
      if (!entry && !picker && link.dataset.language === current && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
      }
    });
    link.addEventListener('auxclick', () => {
      manuallySelected = true;
      savePreference(link.dataset.language);
    });
  });

  // Only neutral entry points detect geography. Shared /it/ or /ja/ URLs win.
  if (!entry) return;
  // Bookmarked selector URLs now open the secondary language page.
  if (params.get('choose') === '1') {
    const target = new URL('languages.html', window.location.href);
    params.delete('choose');
    params.set('page', entry);
    target.search = params.toString();
    target.hash = window.location.hash;
    window.location.replace(target.href);
    return;
  }

  const browserLanguage = () => {
    const preferences = navigator.languages && navigator.languages.length
      ? navigator.languages : [navigator.language || 'en'];
    for (const value of preferences) {
      const base = value.toLowerCase().split(/[-_]/)[0];
      if (languages.includes(base)) return base;
    }
    return 'en';
  };

  const route = (language) => {
    if (manuallySelected) return;
    const target = new URL(`${language}/${entry}`, window.location.href);
    const params = new URLSearchParams(window.location.search);
    params.delete('choose');
    target.search = params.toString();
    target.hash = window.location.hash;
    window.location.replace(target.href);
  };

  const saved = readPreference();
  if (saved) { route(saved); return; }

  const detect = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    try {
      const response = await fetch('https://ipwho.is/?fields=success,country_code', {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
      if (!response.ok) throw new Error('Country lookup unavailable');
      const data = await response.json();
      if (data.success !== true || !/^[A-Z]{2}$/.test(data.country_code)) {
        throw new Error('Invalid country lookup');
      }
      return ['IT', 'SM', 'VA'].includes(data.country_code) ? 'it'
        : data.country_code === 'JP' ? 'ja' : 'en';
    } catch (_) {
      return browserLanguage();
    } finally {
      clearTimeout(timeout);
    }
  };
  detect().then(route);
})();
