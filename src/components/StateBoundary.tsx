import type { ReactNode } from 'react';
import styles from './StateBoundary.module.css';

export type ViewState = 'loading' | 'empty' | 'error' | 'restricted' | 'success';

interface Props {
  state: ViewState;
  children?: ReactNode;
  loadingLabel?: string;
  emptyTitle?: string;
  emptyHelp?: string;
  emptyAction?: { label: string; onClick: () => void };
  errorTitle?: string;
  errorHelp?: string;
  onRetry?: () => void;
  restrictedTitle?: string;
  restrictedHelp?: string;
}

/**
 * Every route and panel covers the same five states. Using one component keeps the wording,
 * roles and layout consistent, and makes each state easy to test.
 */
export function StateBoundary({
  state,
  children,
  loadingLabel = 'Loading…',
  emptyTitle = 'Nothing here yet',
  emptyHelp,
  emptyAction,
  errorTitle = 'Something went wrong',
  errorHelp,
  onRetry,
  restrictedTitle = "You can't see this",
  restrictedHelp = 'Sign in with an account that has access, or go back.',
}: Props) {
  if (state === 'success') return <>{children}</>;

  if (state === 'loading') {
    return (
      <div className={styles.box} role="status" aria-busy="true">
        <span className={styles.spinner} aria-hidden="true" />
        <p>{loadingLabel}</p>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className={styles.box} role="alert" data-state="error">
        <h3>{errorTitle}</h3>
        {errorHelp && <p>{errorHelp}</p>}
        {onRetry && (
          <button type="button" className={styles.button} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  if (state === 'restricted') {
    return (
      <div className={styles.box} role="status" data-state="restricted">
        <h3>{restrictedTitle}</h3>
        <p>{restrictedHelp}</p>
      </div>
    );
  }
  return (
    <div className={styles.box} role="status" data-state="empty">
      <h3>{emptyTitle}</h3>
      {emptyHelp && <p>{emptyHelp}</p>}
      {emptyAction && (
        <button type="button" className={styles.button} onClick={emptyAction.onClick}>
          {emptyAction.label}
        </button>
      )}
    </div>
  );
}
