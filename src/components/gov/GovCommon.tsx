'use client';

import { useState, type ReactNode } from 'react';
import styles from './gov.module.css';
import type { CaseStatus, PublicationState } from '@/lib/schemas';
import { CASE_STATUS_SHORT, PUBLICATION_SHORT } from '@/lib/governance';

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function fmtStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export type Tone = 'ok' | 'warn' | 'alert' | 'plain';

/** A status tag. Always carries words and a symbol, so colour is never the only cue. */
export function Tag({ children, tone = 'plain', title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span className={styles.tag} data-tone={tone} title={title}>
      {children}
    </span>
  );
}

const CASE_TONE: Record<CaseStatus, Tone> = { received: 'warn', routed: 'plain', 'in-progress': 'plain', returned: 'alert', closed: 'ok' };
const CASE_MARK: Record<CaseStatus, string> = { received: '●', routed: '→', 'in-progress': '◐', returned: '↩', closed: '✓' };

export function CaseStatusTag({ status }: { status: CaseStatus }) {
  return <Tag tone={CASE_TONE[status]}>{CASE_MARK[status]} {CASE_STATUS_SHORT[status]}</Tag>;
}

const PUB_TONE: Record<PublicationState, Tone> = { draft: 'plain', 'in-review': 'warn', returned: 'alert', published: 'ok', withdrawn: 'plain' };
const PUB_MARK: Record<PublicationState, string> = { draft: '✎', 'in-review': '⧖', returned: '↩', published: '◉', withdrawn: '⊘' };

export function PublicationTag({ state }: { state: PublicationState }) {
  return <Tag tone={PUB_TONE[state]}>{PUB_MARK[state]} {PUBLICATION_SHORT[state]}</Tag>;
}

/**
 * Runs a governed action, then re-reads the data. A refusal still re-reads, because the service wrote the
 * refused attempt to the audit record and the screen should show it.
 */
export function useAct(reload: () => Promise<void>) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<unknown>, ok: string): Promise<boolean> {
    setNotice(null);
    setError(null);
    setBusy(true);
    let success = false;
    try {
      await fn();
      setNotice(ok);
      success = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      await reload();
      setBusy(false);
    }
    return success;
  }
  const clear = () => {
    setNotice(null);
    setError(null);
  };
  return { notice, error, busy, act, clear };
}

export function Feedback({ notice, error }: { notice: string | null; error: string | null }) {
  return (
    <>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className={styles.why} data-kind="refusal">
          <strong>Refused.</strong> {error} {error.startsWith('Not allowed') ? 'This attempt was written to the audit record.' : ''}
        </p>
      )}
    </>
  );
}

export function Why({ children }: { children: ReactNode }) {
  return (
    <p className={styles.why} role="note">
      {children}
    </p>
  );
}
