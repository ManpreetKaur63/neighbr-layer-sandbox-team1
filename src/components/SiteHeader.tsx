import Link from 'next/link';
import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        Neighbr
      </Link>
      <nav aria-label="Primary">
        <Link href="/map">Map</Link>
        <Link href="/pulse">Pulse</Link>
        <Link href="/businesses">Businesses</Link>
        <Link href="/marketplace">Marketplace</Link>
        <Link href="/messages">Messages</Link>
        <Link href="/bia">BIA</Link>
        <Link href="/business">Business</Link>
        <Link href="/institution">Institution</Link>
        <Link href="/organization">Organization</Link>
        <Link href="/government">Government</Link>
        <Link href="/signin">Sign in</Link>
        <Link href="/profile">Profile</Link>
        <Link href="/status">Build status</Link>
      </nav>
    </header>
  );
}
