# CardCapture — legal pages

The hosted pages CardCapture links to from inside the app. Apple's Guideline 3.1.2 requires that
any screen offering a subscription links to both a Privacy Policy and Terms of Use, and that
those links are reachable — a reviewer opens them by hand.

- `privacy/index.html` — the privacy policy. Must stay in step with `CardCapture/PrivacyInfo.xcprivacy`
  and with `LegalLinks.privacyPolicy` in the app.
- Terms of Use points at Apple's Standard EULA and is not hosted here.

Static HTML, no build step. Served by GitHub Pages from the repository root.

The marketing site lives in the app repository under `website/` and is **not** published here —
it still carries the app's former name and needs that rename before it goes anywhere public.
