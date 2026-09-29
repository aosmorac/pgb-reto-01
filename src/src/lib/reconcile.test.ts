import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reconcileCase } from '@/lib/reconcile';
import type { DocumentExtraction, Evidence, QuoteRequest } from '@/types';

function source(caseId: string, quote: string): Evidence {
  return { document: `${caseId}.pdf`, page: 1, quote };
}

function request(
  caseId: string,
  requestedName: string,
  requestedCoverage: number,
  uiPremium: number,
): QuoteRequest {
  return {
    case_id: caseId,
    requested_name: requestedName,
    requested_coverage: requestedCoverage,
    ui_premium: uiPremium,
  };
}

function document(
  caseId: string,
  applicant: string,
  carrier: string,
  coverage: number,
  premium: number,
  cadence: 'MONTHLY' | 'ANNUAL' = 'MONTHLY',
  valid = true,
): DocumentExtraction {
  return {
    caseId,
    title: valid ? 'Carrier Illustration' : 'Portal Print View',
    applicant,
    carrier,
    coverage,
    primaryPremium: {
      label: 'premium',
      amount: premium,
      cadence,
      evidence: source(caseId, `Premium: $${premium.toFixed(2)} ${cadence}`),
    },
    additionalPremiums: [],
    sourceValid: valid,
    sourceReason: valid
      ? 'Documento identificado como Carrier Illustration.'
      : 'This page is a portal preview and is NOT an issued illustration document.',
    pages: 1,
    rawText: '',
    evidence: {
      title: source(caseId, valid ? 'Carrier Illustration' : 'Portal Print View'),
      applicant: source(caseId, `Applicant: ${applicant}`),
      carrier: source(caseId, `Carrier: ${carrier}`),
      coverage: source(caseId, `Face Amount: $${coverage.toFixed(2)}`),
      sourceWarning: valid ? null : source(caseId, 'NOT an issued illustration document.'),
    },
  };
}

describe('reconcileCase', () => {
  it('C001 bloquea la cobertura contradictoria', () => {
    const result = reconcileCase(
      request('C001', 'Ana Rivera', 450_000, 62),
      document('C001', 'Ana Rivera', 'Northstar Life', 50, 62),
    );

    assert.equal(result.status, 'conflict');
    assert.equal(result.fields.find((field) => field.key === 'coverage')?.status, 'conflict');
  });

  it('C002 queda completamente verificado', () => {
    const result = reconcileCase(
      request('C002', 'Marco Diaz', 250_000, 47.5),
      document('C002', 'Marco Diaz', 'Heritage Mutual', 250_000, 47.5),
    );

    assert.equal(result.status, 'verified');
    assert.equal(result.fields.every((field) => field.status === 'verified'), true);
  });

  it('C003 conserva el premium anual y no acepta un cliente genérico', () => {
    const result = reconcileCase(
      request('C003', 'Juan Perez', 100_000, 60),
      document('C003', 'Client', 'Summit Assurance', 100_000, 720, 'ANNUAL'),
    );

    assert.equal(result.status, 'conflict');
    assert.equal(result.fields.find((field) => field.key === 'applicant')?.status, 'conflict');
    assert.match(result.fields.find((field) => field.key === 'premium')?.observed ?? '', /anual/);
  });

  it('C004 queda completamente verificado', () => {
    const result = reconcileCase(
      request('C004', 'Sara Lopez', 500_000, 89),
      document('C004', 'Sara Lopez', 'Northstar Life', 500_000, 89),
    );

    assert.equal(result.status, 'verified');
  });

  it('C005 mantiene el rider opcional separado del premium base', () => {
    const extraction = document('C005', 'David Cruz', 'Heritage Mutual', 200_000, 58);
    extraction.additionalPremiums = [
      {
        label: 'base',
        amount: 58,
        cadence: 'MONTHLY',
        evidence: source('C005', 'Base Premium: $58.00 MONTHLY'),
      },
      {
        label: 'optional-rider',
        amount: 73,
        cadence: 'MONTHLY',
        evidence: source('C005', 'Premium with Optional Rider: $73.00 MONTHLY'),
      },
    ];
    const result = reconcileCase(request('C005', 'David Cruz', 200_000, 58), extraction);

    assert.equal(result.status, 'verified');
    assert.match(result.notes[0], /\$73\.00/);
  });

  it('C006 rechaza una vista de portal aunque los valores coincidan', () => {
    const result = reconcileCase(
      request('C006', 'Elena Torres', 300_000, 66),
      document('C006', 'Elena Torres', 'Summit Assurance', 300_000, 66, 'MONTHLY', false),
    );

    assert.equal(result.status, 'unverified');
    assert.equal(result.fields.every((field) => field.status === 'unverified'), true);
  });
});
