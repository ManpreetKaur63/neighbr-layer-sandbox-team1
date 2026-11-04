'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { createMockServices } from '@/services/mock';
import type { CivicObject } from '@/lib/schemas';

/** Report an issue (M04). Creates a civic object via the SocialPort. */
export function ReportIssueClient() {
  const services = useMemo(() => createMockServices(), []);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [created, setCreated] = useState<CivicObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const issue = await services.social.reportIssue({ title, summary, cityId: 'windsor' });
      setCreated(issue);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not file the report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Civic</p>
        <h1>Report an issue</h1>
        <p className="lede">Tell the neighbourhood about a problem — a broken bench, a missed pickup, a dark street.</p>
        {!created ? (
          <div className="card">
            <label htmlFor="t" style={{ fontWeight: 600 }}>
              What&rsquo;s the issue?
            </label>
            <input
              id="t"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Streetlight out on Riverside"
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, marginTop: 6 }}
            />
            <label htmlFor="s" style={{ fontWeight: 600, display: 'block', marginTop: 12 }}>
              Details
            </label>
            <textarea
              id="s"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Where exactly, and what should happen?"
              rows={3}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, marginTop: 6 }}
            />
            {error && (
              <p role="alert" style={{ marginTop: 8 }}>
                {error}
              </p>
            )}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={submit} disabled={saving}>
                {saving ? 'Filing…' : 'File report'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <h3>✓ Report filed (demo)</h3>
            <p className="muted">“{created.title}” is now on the shared map as an open issue.</p>
            <div className="btn-row">
              <Link className="btn" href={`/map?sel=${created.id}`}>
                📍 View on map
              </Link>
              <Link className="btn secondary" href="/pulse">
                See the pulse
              </Link>
            </div>
          </div>
        )}
        <p className="notice">Everything here is invented demo data.</p>
      </main>
    </>
  );
}
