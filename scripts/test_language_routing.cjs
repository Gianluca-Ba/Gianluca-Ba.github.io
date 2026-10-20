// Exercise browser routing without depending on a live geolocation service.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const source = readFileSync(resolve(__dirname, '../language.js'), 'utf8');

async function simulate(options = {}) {
  const href = options.href || 'https://portfolio.test/index.html';
  const url = new URL(href);
  const destinations = [];
  const timers = new Map();
  const storage = new Map(options.saved ? [['portfolio.language', options.saved]] : []);
  const links = ['it', 'en', 'ja'].map(language => ({
    href: new URL(`../${language}/experience.html`, href).href,
    dataset: { language },
    handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; }
  }));
  let calls = 0;
  let request;
  const context = {
    document: {
      body: { dataset: options.picker ? { languagePicker: 'true' } : options.localized ? {} : { languageEntry: options.entry || 'index.html' } },
      documentElement: { lang: options.lang || 'en' },
      querySelectorAll: () => links
    },
    window: { location: { href, search: url.search, hash: url.hash, replace: target => destinations.push(target) } },
    navigator: { languages: options.browser || ['en-US'] },
    localStorage: {
      getItem(key) { if (options.storageBlocked) throw Error('Blocked'); return storage.get(key); },
      setItem(key, value) { if (options.storageBlocked) throw Error('Blocked'); storage.set(key, value); }
    },
    URL, URLSearchParams, AbortController,
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, init) => {
      calls++;
      request = { url, init };
      if (options.pending) return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(Error('Aborted')));
      });
      if (options.error) throw Error('Network unavailable');
      return { ok: options.httpOk !== false, json: async () => options.data || { success: true, country_code: options.country || 'JP' } };
    }
  };
  runInNewContext(source, context);
  if (options.click) links.find(link => link.dataset.language === options.click).handlers.click({ preventDefault() {} });
  if (options.timeout) for (const callback of [...timers.values()]) callback();
  await new Promise(resolve => setImmediate(resolve));
  return { destinations, calls, links, storage, request };
}

for (const [country, language] of [['IT', 'it'], ['SM', 'it'], ['VA', 'it'], ['JP', 'ja'], ['US', 'en'], ['FR', 'en']]) {
  test(`Country ${country} selects ${language}`, async () => {
    const result = await simulate({ country, browser: ['ja-JP'] });
    assert.deepEqual(result.destinations, [`https://portfolio.test/${language}/index.html`]);
    assert.equal(result.request.init.credentials, 'omit');
    assert.equal(result.request.init.referrerPolicy, 'no-referrer');
  });
}
test('Manual preference takes priority over country and browser', async () => {
  const result = await simulate({ saved: 'it', country: 'JP' });
  assert.equal(result.calls, 0);
  assert.deepEqual(result.destinations, ['https://portfolio.test/it/index.html']);
});
test('Invalid saved preference is ignored', async () => {
  assert.deepEqual((await simulate({ saved: 'bad', country: 'IT' })).destinations, ['https://portfolio.test/it/index.html']);
});
test('Explicit language URL does not redirect or perform a lookup', async () => {
  const result = await simulate({ localized: true, saved: 'ja', href: 'https://portfolio.test/it/experience.html?from=cv#section1', lang: 'it' });
  assert.equal(result.calls, 0);
  assert.deepEqual(result.destinations, []);
  assert.equal(result.links[2].href, 'https://portfolio.test/ja/experience.html?from=cv#section1');
});
test('Selector page stays open even with a saved preference', async () => {
  const result = await simulate({ picker: true, saved: 'it', href: 'https://portfolio.test/languages.html' });
  assert.equal(result.calls, 0);
  assert.deepEqual(result.destinations, []);
});
test('Old choice URLs open the secondary selector without country detection', async () => {
  const result = await simulate({ entry: 'cv.html', href: 'https://portfolio.test/cv.html?choose=1#section1' });
  assert.equal(result.calls, 0);
  assert.deepEqual(result.destinations, ['https://portfolio.test/languages.html?page=cv.html#section1']);
});
test('Secondary selector keeps the originating section and allows English selection', async () => {
  const result = await simulate({ picker: true, href: 'https://portfolio.test/languages.html?page=cv.html#section1', click: 'en' });
  assert.equal(result.links[1].href, 'https://portfolio.test/en/cv.html#section1');
  assert.equal(result.calls, 0);
  assert.deepEqual(result.destinations, []);
});
test('Secondary selector rejects unknown sections', async () => {
  const result = await simulate({ picker: true, href: 'https://portfolio.test/languages.html?page=https://other.test/' });
  assert.equal(result.links[0].href, 'https://portfolio.test/it/index.html');
});
test('Legacy section entry preserves section, query and anchor', async () => {
  const result = await simulate({ entry: 'cv.html', country: 'IT', href: 'https://portfolio.test/cv.html?source=profile#section1' });
  assert.deepEqual(result.destinations, ['https://portfolio.test/it/cv.html?source=profile#section1']);
});
test('Country service failure, error payload and rate limiting fall back to browser language', async () => {
  for (const options of [{ error: true }, { data: { success: false } }, { data: { success: true, country_code: '' } }, { httpOk: false }]) {
    const result = await simulate({ ...options, browser: ['it-IT', 'en-US'] });
    assert.deepEqual(result.destinations, ['https://portfolio.test/it/index.html']);
  }
});
test('Unsupported browser languages fall back to English', async () => {
  assert.deepEqual((await simulate({ error: true, browser: ['fr-FR'] })).destinations, ['https://portfolio.test/en/index.html']);
});
test('A slow lookup times out and falls back to the browser', async () => {
  const result = await simulate({ pending: true, timeout: true, browser: ['ja-JP'] });
  assert.deepEqual(result.destinations, ['https://portfolio.test/ja/index.html']);
});
test('Storage restrictions do not break detection or language links', async () => {
  const result = await simulate({ storageBlocked: true, country: 'JP' });
  assert.deepEqual(result.destinations, ['https://portfolio.test/ja/index.html']);
});
test('A manual click wins over an in-flight country lookup', async () => {
  const result = await simulate({ click: 'it', country: 'JP' });
  assert.deepEqual(result.destinations, []);
  assert.equal(result.storage.get('portfolio.language'), 'it');
});
