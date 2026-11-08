/**
 * Where a demo resident can say a problem is. Real geocoding comes later; these
 * two sample places let the report form show both outcomes: inside the Olde
 * Riverside corridor (sent to the BIA) and outside it (on the map only).
 */
export interface ReportPlace {
  id: string;
  label: string;
  coordinates: [number, number];
  /** What the form tells the person before they submit. */
  hint: string;
}

export const REPORT_PLACES: ReportPlace[] = [
  {
    id: 'wyandotte-bakery',
    label: 'Wyandotte Street East, near Sample Riverside Bakery',
    coordinates: [-82.989, 42.3244],
    hint: 'Inside the Olde Riverside corridor: goes to the BIA work queue.',
  },
  {
    id: 'downtown-riverfront',
    label: 'Downtown riverfront',
    coordinates: [-83.037, 42.317],
    hint: 'Outside the corridor: stays on the map, no BIA covers it in this demo.',
  },
];
