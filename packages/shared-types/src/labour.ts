// Enums as string unions (matching Prisma enums)
export type LiberationSource = 'MIDDLEMAN_DISCOUNT_AVOIDED' | 'CASH_ON_DAY_PREMIUM_CAPTURED';
export type JobStatus = 'OPEN' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
export type GigStatus =
  | 'ACCEPTED'
  | 'FARMER_CONFIRMED_DONE'
  | 'LABOURER_CONFIRMED_DONE'
  | 'BOTH_CONFIRMED'
  | 'PAID'
  | 'CLOSED'
  | 'CANCELLED';
export type WageTransferStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

// Labourer profile (response shapes)
export interface LabourerProfile {
  id: string;
  userId: string;
  fullName: string;
  region: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  skills: string[];
  spokenLanguages: string[];
  reputationTier: number;
  totalGigsCompleted: number;
  totalEarnedKobo: string; // BigInt serialized as string
  profileEmbedding: string | null; // JSON string of float array
  createdAt: string;
  updatedAt: string;
}

export interface LabourerDashboard {
  labourer: {
    name: string;
    region: string;
    skills: string[];
    reputationTier: number;
    totalGigsCompleted: number;
  };
  savingsAccount: {
    id: string;
    balanceKobo: string;
    squadAccountNumber: string;
  };
  upcomingGigs: Gig[];
  completedGigsCount: number;
  totalEarnedKobo: string;
  nearbyJobs: Job[];
  recentTransactions: any[]; // keep loose for now
}

// Job
export interface Job {
  id: string;
  farmerId: string;
  title: string;
  description: string | null;
  skillsRequired: string[];
  expectedDate: string;
  durationDays: number;
  payAmountKobo: string;
  workersNeeded: number;
  status: JobStatus;
  sourceForecastEventId: string | null;
  descriptionEmbedding: string | null;
  demandConfidence: number | null;
  demandConsistency: number | null;
  createdAt: string;
  updatedAt: string;
}

// Gig
export interface Gig {
  id: string;
  jobId: string;
  labourerId: string;
  agreedAmountKobo: string;
  status: GigStatus;
  acceptedAt: string;
  farmerConfirmedAt: string | null;
  labourerConfirmedAt: string | null;
  paidAt: string | null;
  cancelReason: string | null;
  wageTransferId: string | null;
  rating?: Rating;
}

export interface Rating {
  id: string;
  gigId: string;
  farmerScoreOfLabourer: number | null;
  farmerComment: string | null;
  labourerScoreOfFarmer: number | null;
  labourerComment: string | null;
  createdAt: string;
}

export interface WageTransfer {
  id: string;
  gigId: string;
  fromVirtualAccountId: string;
  toVirtualAccountId: string;
  amountKobo: string;
  squadTransferRef: string | null;
  status: WageTransferStatus;
  errorMessage: string | null;
  createdAt: string;
  succeededAt: string | null;
}

// Match result (from AI)
export interface MatchResult {
  jobId: string;
  labourerId?: string; // for labourer-side result, this may be omitted if list of jobs
  matchScore: number;
  scoreBreakdown: {
    semantic: number;
    demandConfidence: number;
    distance: number;
    reputation: number;
    languageOverlap: number;
  };
  distanceKm: number;
  demandConfidence: number;
  demandConsistency: number;
  // Additional fields from the job/labourer
  title?: string;
  description?: string;
  payAmountKobo?: string;
  expectedDate?: string;
  durationDays?: number;
  skillsRequired?: string[];
  farmerId?: string;
  fullName?: string;
  region?: string;
  skills?: string[];
  reputationTier?: number;
  totalGigsCompleted?: number;
}

// Liberation breakdown response
export interface LiberationBreakdown {
  total: string;
  byMiddlemanDiscount: string;
  byCashOnDayPremium: string;
}

export interface LiberationTotalResponse {
  week: LiberationBreakdown;
  month: LiberationBreakdown;
  allTime: LiberationBreakdown;
}
