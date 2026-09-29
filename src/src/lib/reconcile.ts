import type {
  DocumentExtraction,
  Evidence,
  FieldVerification,
  QuoteRequest,
  VerificationCase,
  VerificationStatus,
} from '@/types';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatPremium(amount: number, cadence: string): string {
  const cadenceLabel = cadence === 'MONTHLY' ? 'mensual' : cadence === 'ANNUAL' ? 'anual' : 'sin periodicidad';
  return `${money.format(amount)} ${cadenceLabel}`;
}

function invalidField(
  key: FieldVerification['key'],
  label: string,
  requested: string,
  observed: string,
  reason: string,
  evidence: Evidence | null,
): FieldVerification {
  return { key, label, requested, observed, status: 'unverified', reason, evidence };
}

function overallStatus(fields: FieldVerification[], sourceValid: boolean): VerificationStatus {
  if (!sourceValid) return 'unverified';
  return fields.some((field) => field.status === 'conflict') ? 'conflict' : 'verified';
}

export function reconcileCase(
  request: QuoteRequest,
  document: DocumentExtraction,
): VerificationCase {
  const documentName = document.applicant ?? 'No extraído';
  const documentCarrier = document.carrier ?? 'No extraído';
  const documentCoverage = document.coverage === null ? 'No extraída' : money.format(document.coverage);
  const documentPremium = document.primaryPremium
    ? formatPremium(document.primaryPremium.amount, document.primaryPremium.cadence)
    : 'No extraído';

  if (!document.sourceValid) {
    const reason = 'La fuente no es un documento emitido por el carrier; sus datos no pueden verificarse.';
    const fields: FieldVerification[] = [
      invalidField('applicant', 'Cliente', request.requested_name, documentName, reason, document.evidence.applicant),
      invalidField('carrier', 'Carrier', 'No incluido en la solicitud', documentCarrier, reason, document.evidence.carrier),
      invalidField(
        'coverage',
        'Cobertura',
        money.format(request.requested_coverage),
        documentCoverage,
        reason,
        document.evidence.coverage,
      ),
      invalidField(
        'premium',
        'Premium',
        `${money.format(request.ui_premium)} mostrado en UI`,
        documentPremium,
        reason,
        document.primaryPremium?.evidence ?? null,
      ),
    ];

    return {
      caseId: request.case_id,
      requestedName: request.requested_name,
      carrier: documentCarrier,
      status: 'unverified',
      statusLabel: 'Fuente no válida',
      sourceValid: false,
      sourceReason: document.sourceReason,
      fields,
      notes: ['La coincidencia visual de valores no sustituye un documento oficial del carrier.'],
      documentUrl: `/documents/${request.case_id}.pdf`,
    };
  }

  const nameMatches =
    document.applicant !== null &&
    normalizeName(document.applicant) === normalizeName(request.requested_name);
  const applicantGeneric = ['client', 'cliente', 'applicant'].includes(
    normalizeName(document.applicant ?? ''),
  );
  const coverageMatches = document.coverage === request.requested_coverage;
  const premiumMatches = document.primaryPremium?.amount === request.ui_premium;

  const fields: FieldVerification[] = [
    {
      key: 'applicant',
      label: 'Cliente',
      requested: request.requested_name,
      observed: documentName,
      status: nameMatches ? 'verified' : 'conflict',
      reason: nameMatches
        ? 'El nombre coincide con el documento del carrier.'
        : applicantGeneric
          ? 'El documento usa un nombre genérico y no permite vincularlo con la solicitud.'
          : 'El nombre no coincide con la solicitud.',
      evidence: document.evidence.applicant,
    },
    {
      key: 'carrier',
      label: 'Carrier',
      requested: 'No incluido en la solicitud',
      observed: documentCarrier,
      status: document.carrier ? 'verified' : 'unverified',
      reason: document.carrier
        ? 'Valor extraído directamente del documento válido.'
        : 'No se encontró un carrier en el documento.',
      evidence: document.evidence.carrier,
    },
    {
      key: 'coverage',
      label: 'Cobertura',
      requested: money.format(request.requested_coverage),
      observed: documentCoverage,
      status: coverageMatches ? 'verified' : 'conflict',
      reason: coverageMatches
        ? 'La cobertura solicitada coincide con el Face Amount del carrier.'
        : 'La cobertura solicitada contradice el Face Amount del carrier. El caso queda bloqueado.',
      evidence: document.evidence.coverage,
    },
    {
      key: 'premium',
      label: 'Premium',
      requested: `${money.format(request.ui_premium)} mostrado en UI`,
      observed: documentPremium,
      status: premiumMatches ? 'verified' : 'conflict',
      reason: premiumMatches
        ? 'El importe coincide; la periodicidad proviene exclusivamente del documento.'
        : 'El importe mostrado en UI no coincide con el premium del documento del carrier.',
      evidence: document.primaryPremium?.evidence ?? null,
    },
  ];

  const status = overallStatus(fields, document.sourceValid);
  const notes = document.additionalPremiums
    .filter((premium) => premium.label === 'optional-rider')
    .map(
      (premium) =>
        `Rider opcional detectado: ${formatPremium(premium.amount, premium.cadence)}. No se mezcló con el premium base.`,
    );

  return {
    caseId: request.case_id,
    requestedName: request.requested_name,
    carrier: documentCarrier,
    status,
    statusLabel: status === 'verified' ? 'Verificado' : 'Contradicción',
    sourceValid: true,
    sourceReason: document.sourceReason,
    fields,
    notes,
    documentUrl: `/documents/${request.case_id}.pdf`,
  };
}

