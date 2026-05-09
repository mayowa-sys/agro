import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SplitRule {
  id: string;
  workingCapitalPct: number;
  billsPct: number;
  nextSeasonPct: number;
  updatedAt: string;
}

export interface SplitSuggestion {
  workingCapitalPct: number;
  billsPct: number;
  nextSeasonPct: number;
  explanation: string;
}

export function useSplitRule() {
  return useQuery<SplitRule>({
    queryKey: ['split-rule'],
    queryFn: () =>
        api.get('/split-rules/me').then((r) => {
          const d = r.data;
          return {
            id: d.id,
            workingCapitalPct: d.workingPct ?? d.workingCapitalPct ?? 60,
            billsPct: d.billsPct ?? 25,
            nextSeasonPct: d.nextSeasonPct ?? 15,
            updatedAt: d.updatedAt,
          };
        }),
  });
}
export function useSplitSuggestion() {
  return useQuery<SplitSuggestion>({
    queryKey: ['split-suggestion'],
    queryFn: () =>
        api.post('/split-rules/me/suggest').then((r) => {
          const s = r.data.suggestion ?? r.data;
          return {
            workingCapitalPct: s.workingPct ?? s.workingCapitalPct,
            billsPct: s.billsPct,
            nextSeasonPct: s.nextSeasonPct,
            explanation:
                s.explanation ??
                `Based on your forecast, allocating ${s.workingPct ?? s.workingCapitalPct}% to working capital reduces your predicted cash gap to ${s.expectedGapDays ?? 0} days.`,
          };
        }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveSplitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      workingCapitalPct: number;
      billsPct: number;
      nextSeasonPct: number;
    }) =>
        api
            .put('/split-rules/me', {
              workingPct: payload.workingCapitalPct,
              billsPct: payload.billsPct,
              nextSeasonPct: payload.nextSeasonPct,
            })
            .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['split-rule'] }),
  });
}

// ─── Linked-slider state ──────────────────────────────────────────────────────
// Always sums to 100. When one moves by Δ, distribute −Δ proportionally
// across the other two. If one other is at 0, send all of −Δ to the remaining one.

export type BucketKey = 'workingCapital' | 'bills' | 'nextSeason';

export interface Sliders {
  workingCapital: number;
  bills: number;
  nextSeason: number;
}

const KEYS: BucketKey[] = ['workingCapital', 'bills', 'nextSeason'];

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function useLinkedSliders(initial: Sliders) {
  const [sliders, setSliders] = useState<Sliders>(initial);

  const reset = useCallback((next: Sliders) => setSliders(next), []);

  const move = useCallback((key: BucketKey, newVal: number) => {
    setSliders((prev) => {
      const clamped = clamp(newVal);
      const delta = clamped - prev[key];
      if (delta === 0) return prev;

      const others = KEYS.filter((k) => k !== key);
      const totalOthers = others.reduce((s, k) => s + prev[k], 0);

      let next = { ...prev, [key]: clamped };

      if (totalOthers === 0) {
        next[others[0]] = clamp(prev[others[0]] - delta);
        next[others[1]] = clamp(100 - clamped - next[others[0]]);
      } else {
        let remainder = -delta;
        others.forEach((k, i) => {
          if (i === others.length - 1) {
            next[k] = clamp(prev[k] + remainder);
          } else {
            const share = Math.round((prev[k] / totalOthers) * -delta);
            next[k] = clamp(prev[k] + share);
            remainder -= share;
          }
        });
      }

      // Force sum to exactly 100 (absorb rounding drift in last other)
      const sum = KEYS.reduce((s, k) => s + next[k], 0);
      if (sum !== 100) {
        const last = others[others.length - 1];
        next[last] = clamp(next[last] + (100 - sum));
      }

      return next;
    });
  }, []);

  return { sliders, move, reset };
}
