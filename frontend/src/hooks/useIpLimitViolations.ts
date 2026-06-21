import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HttpUtil } from '@/utils';

export interface ViolationEntry {
  count: number;
  last_ips: string[];
  last_time: number;
  active: boolean;
}

async function fetchViolations(): Promise<Record<string, ViolationEntry>> {
  const msg = await HttpUtil.get('/panel/api/clients/ipLimitViolations', undefined, { silent: true });
  if (!msg?.success || !msg.obj) return {};
  const obj = msg.obj as Record<string, ViolationEntry>;
  return typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
}

export function useIpLimitViolations() {
  const { data } = useQuery({
    queryKey: ['ipLimitViolations'],
    queryFn: fetchViolations,
    refetchInterval: 15_000,
    staleTime: 12_000,
  });

  const violations = data ?? {};

  const violationSet = useMemo(
    () => new Set<string>(Object.keys(violations).filter((e) => violations[e]?.active)),
    [violations],
  );

  const violationHistorySet = useMemo(
    () => new Set<string>(Object.keys(violations).filter((e) => (violations[e]?.count ?? 0) > 0)),
    [violations],
  );

  return { violations, violationSet, violationHistorySet };
}
