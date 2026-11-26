# Fonts for the public site

Self-hosted so the build never depends on fetching from Google Fonts (a Vercel
build failed when Google returned a URL format Next.js could not process).

- `archivo-latin-variable.woff2`: Archivo, Latin subset, variable weight (100 to 900) and width (62% to 125%).
- `ibm-plex-sans-latin-variable.woff2`: IBM Plex Sans, Latin subset, variable weight (100 to 700).

Both come from Google Fonts and are licensed under the SIL Open Font License 1.1.
They are loaded in `app/(site)/layout.tsx`.
