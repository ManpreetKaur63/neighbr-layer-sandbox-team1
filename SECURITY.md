# Security

This is a front-end prototype. It has no backend, no authentication and no real data.

- All people, places, businesses and activity are invented (see `/mock`). Map outlines are illustrative.
- Never commit secrets, tokens, credentials, real personal data or copied production data.
- The only network request the app makes at runtime is for OpenStreetMap raster tiles. Set `NEXT_PUBLIC_BASEMAP=none` to disable it.
- Report a problem by opening an issue in the team repository, or contact the project sponsor through the agreed channel. Do not post details of a vulnerability in public.

Known limitations are listed in `docs/RAID.md`.
