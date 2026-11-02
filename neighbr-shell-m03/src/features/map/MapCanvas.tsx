'use client';

import { useEffect, useRef, useState } from 'react';
import type { MapPort, MapPortFactory, MapView } from '@/map/map-port';
import styles from './map.module.css';

interface Props {
  factory: MapPortFactory;
  initialView: MapView;
  onReady: (port: MapPort) => void;
  onSelect: (id: string) => void;
}

/** Owns the map lifecycle. If the map cannot start (for example without WebGL) the list still works. */
export function MapCanvas({ factory, initialView, onReady, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const onReadyRef = useRef(onReady);
  const onSelectRef = useRef(onSelect);
  const viewRef = useRef(initialView);

  // Keep the latest callbacks without re-creating the map. Declared before the mount effect so it runs first.
  useEffect(() => {
    onReadyRef.current = onReady;
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const port = factory();
    const off = port.onSelect((id) => onSelectRef.current(id));
    port
      .mount(container, viewRef.current)
      .then(() => {
        if (!cancelled) onReadyRef.current(port);
      })
      .catch((err: unknown) => {
        if (!cancelled) setProblem(err instanceof Error ? err.message : 'The map could not start.');
      });
    return () => {
      cancelled = true;
      off();
      port.destroy();
    };
  }, [factory]);

  return (
    <div className={styles.mapWrap}>
      <div
        ref={containerRef}
        className={styles.map}
        role="region"
        aria-label="Interactive map. The results list is a text alternative."
      />
      {problem && (
        <div className={styles.mapProblem} role="status">
          <strong>The map isn&apos;t available here.</strong>
          <span>{problem} You can still browse everything in the results list.</span>
        </div>
      )}
    </div>
  );
}
