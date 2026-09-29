import * as pdfjsLib from 'pdfjs-dist';

import type {
  DocumentExtraction,
  Evidence,
  ExtractedPremium,
  QuoteRequest,
} from '@/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface TextItemLike {
  str: string;
  transform: number[];
}

interface PositionedText {
  page: number;
  text: string;
}

const moneyPattern = '\\$([\\d,]+(?:\\.\\d{2})?)';

function parseMoney(value: string): number {
  return Number(value.replace(/[$,]/g, ''));
}

function evidence(caseId: string, item: PositionedText | undefined): Evidence | null {
  if (!item) return null;

  return {
    document: `${caseId}.pdf`,
    page: item.page,
    quote: item.text,
  };
}

function findLine(lines: PositionedText[], pattern: RegExp): PositionedText | undefined {
  return lines.find((line) => pattern.test(line.text));
}

function valueAfterLabel(line: PositionedText | undefined, label: string): string | null {
  if (!line) return null;
  const match = line.text.match(new RegExp(`^${label}:\\s*(.+)$`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function extractPremium(
  caseId: string,
  line: PositionedText | undefined,
  label: ExtractedPremium['label'],
  prefix: string,
): ExtractedPremium | null {
  if (!line) return null;
  const match = line.text.match(
    new RegExp(`^${prefix}:\\s*${moneyPattern}(?:\\s+(MONTHLY|ANNUAL))?$`, 'i'),
  );
  const source = evidence(caseId, line);
  if (!match || !source) return null;

  return {
    label,
    amount: parseMoney(match[1]),
    cadence: (match[2]?.toUpperCase() as ExtractedPremium['cadence']) ?? 'UNKNOWN',
    evidence: source,
  };
}

function groupTextItems(items: TextItemLike[], page: number): PositionedText[] {
  const rows = new Map<number, TextItemLike[]>();

  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    const existingKey = [...rows.keys()].find((key) => Math.abs(key - y) <= 2) ?? y;
    rows.set(existingKey, [...(rows.get(existingKey) ?? []), item]);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) => ({
      page,
      text: row
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((item) => item.str.trim())
        .filter(Boolean)
        .join(' '),
    }));
}

export async function extractDocument(caseId: string): Promise<DocumentExtraction> {
  const documentUrl = `/documents/${caseId}.pdf`;
  const pdf = await pdfjsLib.getDocument(documentUrl).promise;
  const lines: PositionedText[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: TextItemLike[] = content.items.flatMap((item) => {
      if (!('str' in item) || !('transform' in item)) return [];
      return [{ str: item.str, transform: item.transform }];
    });
    lines.push(...groupTextItems(items, pageNumber));
  }

  const titleLine = lines[0];
  const applicantLine = findLine(lines, /^Applicant:/i);
  const carrierLine = findLine(lines, /^Carrier:/i);
  const coverageLine = findLine(lines, /^Face Amount:/i);
  const premiumLine = findLine(lines, /^Premium:/i);
  const basePremiumLine = findLine(lines, /^Base Premium:/i);
  const riderPremiumLine = findLine(lines, /^Premium with Optional Rider:/i);
  const warningLine = findLine(lines, /not an issued illustration document/i);
  const title = titleLine?.text ?? 'Unknown document';
  const sourceValid = /^Carrier Illustration$/i.test(title) && !warningLine;
  const coverageValue = valueAfterLabel(coverageLine, 'Face Amount');

  return {
    caseId,
    title,
    applicant: valueAfterLabel(applicantLine, 'Applicant'),
    carrier: valueAfterLabel(carrierLine, 'Carrier'),
    coverage: coverageValue ? parseMoney(coverageValue) : null,
    primaryPremium: extractPremium(caseId, premiumLine, 'premium', 'Premium'),
    additionalPremiums: [
      extractPremium(caseId, basePremiumLine, 'base', 'Base Premium'),
      extractPremium(
        caseId,
        riderPremiumLine,
        'optional-rider',
        'Premium with Optional Rider',
      ),
    ].filter((premium): premium is ExtractedPremium => premium !== null),
    sourceValid,
    sourceReason: sourceValid
      ? 'Documento identificado como Carrier Illustration.'
      : warningLine
        ? warningLine.text
        : `El tipo de documento “${title}” no es una ilustración emitida por el carrier.`,
    pages: pdf.numPages,
    rawText: lines.map((line) => line.text).join('\n'),
    evidence: {
      title: evidence(caseId, titleLine),
      applicant: evidence(caseId, applicantLine),
      carrier: evidence(caseId, carrierLine),
      coverage: evidence(caseId, coverageLine),
      sourceWarning: evidence(caseId, warningLine),
    },
  };
}

export async function loadQuoteRequests(): Promise<QuoteRequest[]> {
  const response = await fetch('/quote_requests.json');
  if (!response.ok) {
    throw new Error('No fue posible cargar las solicitudes de cotización.');
  }
  return response.json() as Promise<QuoteRequest[]>;
}
