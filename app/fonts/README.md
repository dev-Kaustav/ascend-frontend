# Bundled fonts

These unmodified Latin WOFF2 files come from Google Fonts. `app/layout.js` loads them with
`next/font/local` so builds do not need to fetch fonts from Google. The existing font families,
400/600 weights, CSS variables and swap behavior are preserved.

Sora and IBM Plex Sans use the same variable font file for both declared weights. IBM Plex Mono
uses separate regular and semibold files. The four files total approximately 99 KiB.

Geist is the staff workspace's face, loaded in `app/app/layout.js`. `geist-latin.woff2` is the Google Fonts
variable font (weights 100-900) subset with fontTools to the Google "latin" range plus U+20B9 (₹), which
Google's own latin subset leaves out; about 33 KiB.

Sources and licenses:

- [Sora](https://github.com/google/fonts/tree/main/ofl/sora), Google Fonts web font version 17; `sora-OFL.txt`.
- [IBM Plex Sans](https://github.com/google/fonts/tree/main/ofl/ibmplexsans), web font version 23; `ibm-plex-sans-OFL.txt`.
- [IBM Plex Mono](https://github.com/google/fonts/tree/main/ofl/ibmplexmono), web font version 20; `ibm-plex-mono-OFL.txt`.
- [Geist](https://github.com/google/fonts/tree/main/ofl/geist), variable `Geist[wght].ttf`; `geist-OFL.txt`.
