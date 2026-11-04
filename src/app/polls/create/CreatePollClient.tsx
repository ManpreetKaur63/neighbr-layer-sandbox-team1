'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StateBoundary } from '@/components/StateBoundary';
import { createMockServices } from '@/services/mock';
import type { CivicObject } from '@/lib/schemas';

/** Poll authoring (M04). Creates a resident-restricted poll via the SocialPort. */
export function CreatePollClient() {
  const services = useMemo(() => createMockServices(), []);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [created, setCreated] = useState<CivicObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setOption(i: number, value: string) {
    setOptions((os) => os.map((o, j) => (j === i ? value : o)));
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const poll = await services.social.createPoll({ question, options, cityId: 'windsor' });
      setCreated(poll);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the poll.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Civic</p>
        <h1>Create a poll</h1>
        <p className="lede">Ask Windsor residents a question. Demo polls are resident-restricted.</p>
        <StateBoundary state={created ? 'success' : 'success'}>
          {!created ? (
            <div className="card">
              <label htmlFor="q" style={{ fontWeight: 600 }}>
                Question
              </label>
              <input
                id="q"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Which hours suit a Saturday market?"
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, marginTop: 6 }}
              />
              <div style={{ fontWeight: 600, marginTop: 12 }}>Options (at least two)</div>
              {options.map((o, i) => (
                <input
                  key={i}
                  value={o}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  aria-label={`Option ${i + 1}`}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, marginTop: 6 }}
                />
              ))}
              {options.length < 4 && (
                <button type="button" className="pill" style={{ marginTop: 8 }} onClick={() => setOptions((os) => [...os, ''])}>
                  + Add option
                </button>
              )}
              {error && (
                <p role="alert" style={{ marginTop: 8 }}>
                  {error}
                </p>
              )}
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn" onClick={submit} disabled={saving}>
                  {saving ? 'Creating…' : 'Create poll'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <h3>✓ Poll created (demo)</h3>
              <p className="muted">“{created.title}” is now open for resident votes.</p>
              <div className="btn-row">
                <Link className="btn" href="/polls">
                  View polls
                </Link>
                <Link className="btn secondary" href={`/map?sel=${created.id}`}>
                  📍 View on map
                </Link>
              </div>
            </div>
          )}
        </StateBoundary>
        <p className="notice">Everything here is invented demo data.</p>
      </main>
    </>
  );
}
