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
  const id = workspace.id;

  const reload = useCallback(async () => {
    try {
      // A governed workspace both receives cases (office side) and works them (department side), so load
      // both and dedupe. The port sorts each list; the merged list is re-sorted newest first.
      const loadCases = async (): Promise<GovCase[]> => {
        const [asOffice, asDept] = await Promise.all([
          services.governance.cases({ officeId: id }),
          services.governance.cases({ departmentId: id }),
        ]);
        const seen = new Set<string>();
        return [...asOffice, ...asDept]
          .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      };
      const [c, m, a] = await Promise.all([
        loadCases(),
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
  }, [services, id]);

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
