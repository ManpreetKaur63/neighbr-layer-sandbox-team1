'use client';

import Link from 'next/link';
import { LENS_META } from '@/lib/kinds';
import type { City, Lens } from '@/lib/schemas';
import type { VisitContext } from '@/lib/visit';
import styles from './map.module.css';

interface Props {
  city: City | undefined;
  visit: VisitContext | null;
  lens: Lens;
  searchText: string;
  onSearchText: (value: string) => void;
  onLens: (lens: Lens) => void;
  onOpenDestination: () => void;
}

export function TopBar({ city, visit, lens, searchText, onSearchText, onLens, onOpenDestination }: Props) {
  return (
    <header className={styles.top}>
      <Link href="/" className={styles.brand} aria-label="Neighbr home">
        Neighbr
      </Link>

      <form role="search" className={styles.search} onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="map-search" className={styles.srOnly}>
          Search places and activity in {city?.name ?? 'this city'}
        </label>
        <input
          id="map-search"
          type="search"
          value={searchText}
          placeholder={`Search ${city?.name ?? 'the map'}: bakery, roadworks, vacancy`}
          onChange={(e) => onSearchText(e.target.value)}
          autoComplete="off"
        />
      </form>

      <button type="button" className={styles.cityButton} onClick={onOpenDestination} aria-haspopup="dialog">
        <span className={styles.cityName}>{city ? `${city.name}, ${city.region}` : 'Choose a place'}</span>
        <span aria-hidden="true">▾</span>
        <span className={styles.srOnly}>Change place</span>
      </button>

      {visit && (
        <p className={styles.context} data-mode={visit.mode} aria-live="polite">
          <span className={styles.contextDot} aria-hidden="true" />
          {visit.label}
        </p>
      )}

      <div className={styles.lens} role="radiogroup" aria-label="What to show on the map">
        {(Object.keys(LENS_META) as Lens[]).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={lens === value}
            title={LENS_META[value].hint}
            onClick={() => onLens(value)}
          >
            {LENS_META[value].label}
          </button>
        ))}
      </div>
    </header>
  );
}
