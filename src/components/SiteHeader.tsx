'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './SiteHeader.module.css';

const LINKS: { href: string; label: string }[] = [
  { href: '/map', label: 'Map' },
  { href: '/pulse', label: 'Pulse' },
  { href: '/businesses', label: 'Businesses' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/messages', label: 'Messages' },
  { href: '/bia', label: 'BIA' },
  { href: '/business', label: 'Business' },
  { href: '/institution', label: 'Institution' },
  { href: '/organization', label: 'Organization' },
  { href: '/representative', label: 'Public office' },
  { href: '/signin', label: 'Sign in' },
  { href: '/profile', label: 'Profile' },
  { href: '/status', label: 'Build status' },
];

/**
 * Site header. On a wide screen the links sit in the bar and wrap; on a phone they fold into a Menu button
 * (a disclosure, so it works with a keyboard and a screen reader) that closes when you pick a link.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [pathname, setPathname] = useState('');

  // Each page renders its own header, so reading the location once on mount is enough to mark the current link.
  useEffect(() => {
    const t = setTimeout(() => setPathname(window.location.pathname), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        Neighbr
      </Link>
      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls="primary-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Close menu' : 'Menu'}
      </button>
      <nav id="primary-nav" aria-label="Primary" className={styles.nav} data-open={open ? 'true' : 'false'}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined} onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
