// MapLibre GL v6 runs its tile processing in a web worker file. Bundlers differ in how they resolve it,
// so we serve it as a plain static file and tell the library where it is (see src/map/maplibre-adapter.ts).
import { copyFileSync, mkdirSync } from 'node:fs';

const from = new URL('../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url);
const dir = new URL('../public/maplibre/', import.meta.url);
mkdirSync(dir, { recursive: true });
copyFileSync(from, new URL('maplibre-gl-worker.mjs', dir));
console.log('Copied the MapLibre worker to public/maplibre/');
