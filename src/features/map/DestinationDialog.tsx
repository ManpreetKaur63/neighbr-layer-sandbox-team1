'use client';

import { useEffect, useRef, useState } from 'react';
import type { City } from '@/lib/schemas';
import styles from './map.module.css';

interface Props {
  cities: City[];
  currentId: string | undefined;
  onFind: (text: string) => Promise<City | null>;
  onChoose: (city: City) => void;
  onClose: () => void;
}

export function DestinationDialog({ cities, currentId, onFind, onChoose, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = await onFind(text);
    if (found) onChoose(found);
    else
      setMessage(
        text.trim()
          ? `"${text.trim()}" isn't in the demo. Pick one of the places below. A production version would search any address.`
          : 'Type a city or pick one of the places below.',
      );
  }

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dest-title">
        <div className={styles.dialogHead}>
          <h2 id="dest-title">Where shall we go?</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p>Visit another city and you appear there as a visitor. Your profile stays the same.</p>
        <form onSubmit={submit}>
          <label htmlFor="dest-input">City</label>
          <div className={styles.destRow}>
            <input
              id="dest-input"
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setMessage(null);
              }}
              placeholder="Try Toronto or Detroit"
              autoComplete="off"
            />
            <button type="submit" className={styles.primary}>
              Go
            </button>
          </div>
        </form>
        {message && (
          <p role="status" className={styles.fine}>
            {message}
          </p>
        )}
        <ul className={styles.cityList}>
          {cities.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={c.id === currentId}
                onClick={() => onChoose(c)}
              >
                {c.name}, {c.region}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
