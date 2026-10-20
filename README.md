# Gianluca Barsaglini — multilingual portfolio

The five current portfolio sections have matching static versions in `it/`, `en/`
and `ja/`. All internal section links remain in the current language, including
when JavaScript is unavailable. The fixed top-right language links open the same
section in another language and preserve query parameters and anchors.

## Language entry and geography

- `/` and the original unprefixed section URLs serve portfolio content directly
  and select the saved manual preference first. There is no language-choice screen
  on the automatic entry path. Without JavaScript the English portfolio remains
  readable, with working language links. With no preference, they request only `success,country_code` from
  `https://ipwho.is/` over HTTPS, without credentials or a referrer.
- IT, SM, VA → Italian; JP → Japanese; every other country → English.
- After 1.8 seconds or a failed/invalid response, the first supported browser
  language is used, then English. No GPS permission is requested.
- Explicit `/it/`, `/en/`, `/ja/` URLs are authoritative: no location lookup and no
  forced language change. A manual click always wins over a pending lookup.
- `/languages.html` is the secondary language-choice page, available through
  the `⋯` control. It never detects geography or automatically redirects, and
  `?page=cv.html` (or another supported section) preserves the originating section.
  Old `?choose=1` bookmarks redirect to this page without country detection.
- Only an explicit language choice is stored in `localStorage`; blocked storage
  does not prevent navigation. IPWho.is receives the visitor's IP for country
  detection. The secondary language page explains this in all three languages. The service's
  free CORS quota is shared by domain; fallback handles rate limiting or downtime.
  See [provider documentation](https://ipwhois.io/documentation).

The existing PDF is in English and is labeled accordingly in every language.
External credential pages retain their original URLs and languages. The older
`project-manager.html` and `software-developer.html` archives are unchanged and
are not linked from the current portfolio.

## Update content

1. Edit the English HTML in `content/templates/`.
2. Add the corresponding Italian and Japanese text to `content/translations.json`.
   Each key is normalized English text; values are `[Italian, Japanese]`.
3. Run `python3 scripts/build_languages.py` and commit the generated HTML too.

The build fails on missing visible translations. University/provider names and
credential terminology are preserved where appropriate. Shared visual styles are
in `style.css`; the language controls and Japanese font adjustments are in
`language.css`.

## Validation and preview

```sh
python3 scripts/build_languages.py
python3 scripts/test_languages.py
node --test scripts/test_language_routing.cjs
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/` for automatic home entry, `/languages.html`
for the secondary selector, or `/it/`, `/en/`, `/ja/` for direct localized pages. GitHub Pages serves the committed HTML without a
build dependency or server component.
