export type VerificationStatus = 'verified' | 'conflict' | 'unverified';

export interface QuoteRequest {
  case_id: string;
  requested_name: string;
  requested_coverage: number;
  ui_premium: number;
}

export interface Evidence {
  document: string;
  page: number;
  quote: string;
}

export interface ExtractedPremium {
  label: 'premium' | 'base' | 'optional-rider';
  amount: number;
  cadence: 'MONTHLY' | 'ANNUAL' | 'UNKNOWN';
  evidence: Evidence;
}

export interface DocumentExtraction {
  caseId: string;
  title: string;
  applicant: string | null;
  carrier: string | null;
  coverage: number | null;
  primaryPremium: ExtractedPremium | null;
  additionalPremiums: ExtractedPremium[];
  sourceValid: boolean;
  sourceReason: string;
  pages: number;
  rawText: string;
  evidence: {
    title: Evidence | null;
    applicant: Evidence | null;
    carrier: Evidence | null;
    coverage: Evidence | null;
    sourceWarning: Evidence | null;
  };
}

export interface FieldVerification {
  key: 'applicant' | 'carrier' | 'coverage' | 'premium';
  label: string;
  requested: string;
  observed: string;
  status: VerificationStatus;
  reason: string;
  evidence: Evidence | null;
}

export interface VerificationCase {
  caseId: string;
  requestedName: string;
  carrier: string;
  status: VerificationStatus;
  statusLabel: string;
  sourceValid: boolean;
  sourceReason: string;
  fields: FieldVerification[];
  notes: string[];
  documentUrl: string;
}

