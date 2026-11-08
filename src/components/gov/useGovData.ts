'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuditEntry, Communication, GovCase, Workspace } from '@/lib/schemas';
import type { Services } from '@/services/ports';

export interface GovData {
  cases: GovCase[];
  comms: Communication[];
  audit: AuditEntry[];
  loaded: boolean;
  failed: boolean;
  reload: () => Promise<void>;
}

/**
 * Loads what a governed workspace shows: the cases it handles (received by an office, or routed to a
 * department), the communications it wrote and the audit entries it can see. Every panel calls it, so a change
 * made in one tab is read fresh in the next.
 */
export function useGovData(services: Services, workspace: Workspace): GovData {
  const [cases, setCases] = useState<GovCase[]>([]);
  const [comms, setComms] = useState<Communication[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const isOffice = workspace.kind === 'office';
  const id = workspace.id;

  const reload = useCallback(async () => {
    try {
      const [c, m, a] = await Promise.all([
        services.governance.cases(isOffice ? { officeId: id } : { departmentId: id }),
        services.governance.communications(id),
        services.governance.audit(id),
      ]);
      setCases(c);
      setComms(m);
      setAudit(a);
      setFailed(false);
      setLoaded(true);
    } catch {
      setFailed(true);
    }
  }, [services, isOffice, id]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (live) await reload();
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  return { cases, comms, audit, loaded, failed, reload };
}
