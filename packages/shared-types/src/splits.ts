export interface SplitRule {
  id: string;
  farmerId: string;
  workingPct: number;
  billsPct: number;
  nextSeasonPct: number;
  active: boolean;
  updatedAt: string;
}

export interface SplitSuggestion {
  workingPct: number;
  billsPct: number;
  nextSeasonPct: number;
  reason: string;
}

export type UpdateSplitRuleRequest = {
  workingPct: number;
  billsPct: number;
  nextSeasonPct: number;
};
