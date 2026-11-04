import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <h1>Your neighbourhood, on one map.</h1>
        <p>
          Find places, join conversations and take part in local decisions in the same place. Switch city and you
          appear there as a visitor, with your profile unchanged.
        </p>
        <div className="btn-row">
          <Link className="btn" href="/map">
            Explore the map
          </Link>
          <Link className="btn secondary" href="/signin">
            Sign in
          </Link>
          <Link className="btn secondary" href="/signup">
            Create an account
          </Link>
        </div>
        <p className="notice">
          This is a demonstration shell. Every place, business, issue and poll is invented, and map outlines are
          illustrative, not official.
        </p>
      </main>
    </>
  );
}
