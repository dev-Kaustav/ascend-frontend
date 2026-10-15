# Bundled fonts

These unmodified Latin WOFF2 files come from Google Fonts. `app/layout.js` loads them with
`next/font/local` so builds do not need to fetch fonts from Google. The existing font families,
400/600 weights, CSS variables and swap behavior are preserved.

Sora and IBM Plex Sans use the same variable font file for both declared weights. IBM Plex Mono
uses separate regular and semibold files. The four files total approximately 99 KiB.

Sources and licenses:

- [Sora](https://github.com/google/fonts/tree/main/ofl/sora), Google Fonts web font version 17; `sora-OFL.txt`.
- [IBM Plex Sans](https://github.com/google/fonts/tree/main/ofl/ibmplexsans), web font version 23; `ibm-plex-sans-OFL.txt`.
- [IBM Plex Mono](https://github.com/google/fonts/tree/main/ofl/ibmplexmono), web font version 20; `ibm-plex-mono-OFL.txt`.
