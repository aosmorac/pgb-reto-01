import {
  ChevronRight,
  FileSearch,
  Files,
  LayoutDashboard,
  Menu,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { EvidenceDrawer } from '@/components/evidence-drawer';
import { StatusBadge } from '@/components/status-badge';
import { extractDocument, loadQuoteRequests } from '@/lib/document-extractor';
import { reconcileCase } from '@/lib/reconcile';
import type { VerificationCase, VerificationStatus } from '@/types';

type Filter = 'all' | VerificationStatus;
type View = 'verification' | 'documents';

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'verified', label: 'Verificados' },
  { key: 'conflict', label: 'Contradicciones' },
  { key: 'unverified', label: 'No verificables' },
];

export default function App() {
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [selected, setSelected] = useState<VerificationCase | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeView, setActiveView] = useState<View>('verification');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const requests = await loadQuoteRequests();
        const extractions = await Promise.all(
          requests.map((request) => extractDocument(request.case_id)),
        );
        if (!active) return;
        setCases(
          requests.map((request, index) => reconcileCase(request, extractions[index])),
        );
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Ocurrió un error inesperado.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const visibleCases = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return cases.filter((item) => {
      const matchesFilter = filter === 'all' || item.status === filter;
      const matchesQuery =
        !normalizedQuery ||
        [item.caseId, item.requestedName, item.carrier].some((value) =>
          value.toLocaleLowerCase('es').includes(normalizedQuery),
        );
      return matchesFilter && matchesQuery;
    });
  }, [cases, filter, query]);

  const counts = useMemo(
    () => ({
      total: cases.length,
      verified: cases.filter((item) => item.status === 'verified').length,
      conflict: cases.filter((item) => item.status === 'conflict').length,
      unverified: cases.filter((item) => item.status === 'unverified').length,
    }),
    [cases],
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? ' sidebar--open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck aria-hidden="true" size={21} /></div>
          <div><strong>PBG</strong><span>Verify</span></div>
        </div>

        <nav aria-label="Navegación principal">
          <span className="nav-label">Workspace</span>
          <button
            className={`nav-item${activeView === 'verification' ? ' nav-item--active' : ''}`}
            onClick={() => {
              setActiveView('verification');
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <LayoutDashboard aria-hidden="true" size={19} />
            Verificación
          </button>
          <button
            className={`nav-item${activeView === 'documents' ? ' nav-item--active' : ''}`}
            onClick={() => {
              setActiveView('documents');
              setFilter('all');
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <Files aria-hidden="true" size={19} />
            Documentos
            <span className="nav-count">{cases.length}</span>
          </button>
        </nav>

        <div className="sidebar-policy">
          <ShieldCheck aria-hidden="true" size={18} />
          <div>
            <strong>Regla de confianza</strong>
            <span>Dinero y cobertura provienen del documento del carrier.</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button
            aria-label="Abrir navegación"
            className="icon-button mobile-menu"
            onClick={() => setMobileNavOpen((open) => !open)}
            type="button"
          >
            <Menu aria-hidden="true" size={20} />
          </button>
          <div className="topbar-search">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="Buscar expedientes"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={activeView === 'verification' ? 'Buscar por caso, cliente o carrier' : 'Buscar documentos'}
              type="search"
              value={query}
            />
            <kbd>⌘ K</kbd>
          </div>
        </header>

        {activeView === 'verification' ? <main id="verification">
          <div className="page-heading">
            <div>
              <div className="breadcrumb">Operaciones <span>/</span> Verificación documental</div>
              <h1>Verdad del documento del carrier</h1>
              <p>Extracción trazable y reconciliación de solicitudes de cotización.</p>
            </div>
            <div className="live-indicator"><span /> Motor de reglas activo</div>
          </div>

          <section className="metrics" aria-label="Resumen de verificaciones">
            <MetricCard label="Expedientes" value={counts.total} tone="neutral" />
            <MetricCard label="Verificados" value={counts.verified} tone="success" />
            <MetricCard label="Contradicciones" value={counts.conflict} tone="warning" />
            <MetricCard label="Fuente no válida" value={counts.unverified} tone="danger" />
          </section>

          <section className="cases-card">
            <header className="cases-card__header">
              <div>
                <h2>Expedientes analizados</h2>
                <p>Selecciona un caso para inspeccionar el valor y su evidencia.</p>
              </div>
              <div className="filter-tabs" aria-label="Filtrar expedientes">
                {filters.map((item) => (
                  <button
                    aria-pressed={filter === item.key}
                    className={filter === item.key ? 'active' : ''}
                    key={item.key}
                    onClick={() => setFilter(item.key)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </header>

            {loading && <LoadingState />}
            {error && <ErrorState message={error} />}
            {!loading && !error && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Caso</th>
                      <th>Cliente</th>
                      <th>Carrier</th>
                      <th>Cobertura del carrier</th>
                      <th>Premium del carrier</th>
                      <th>Estado</th>
                      <th><span className="sr-only">Ver detalle</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCases.map((item) => {
                      const coverage = item.fields.find((field) => field.key === 'coverage');
                      const premium = item.fields.find((field) => field.key === 'premium');
                      return (
                        <tr key={item.caseId} onClick={() => setSelected(item)}>
                          <td><span className="case-id">{item.caseId}</span></td>
                          <td><strong>{item.requestedName}</strong></td>
                          <td>{item.carrier}</td>
                          <td>
                            <ValueCell status={coverage?.status} value={coverage?.observed ?? '—'} />
                          </td>
                          <td>
                            <ValueCell status={premium?.status} value={premium?.observed ?? '—'} />
                          </td>
                          <td><StatusBadge status={item.status} label={item.statusLabel} /></td>
                          <td>
                            <button
                              aria-label={`Ver evidencia del caso ${item.caseId}`}
                              className="row-action"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelected(item);
                              }}
                              type="button"
                            >
                              <ChevronRight aria-hidden="true" size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visibleCases.length === 0 && (
                  <div className="empty-state">No hay expedientes que coincidan con el filtro.</div>
                )}
              </div>
            )}

            <footer className="cases-card__footer">
              <span>{visibleCases.length} de {cases.length} expedientes</span>
              <span>Última ejecución: ahora</span>
            </footer>
          </section>

          <section className="methodology" id="methodology">
            <ShieldCheck aria-hidden="true" size={21} />
            <div>
              <strong>Decisiones auditables, no probabilísticas</strong>
              <p>PDF.js extrae candidatos; el motor de reglas determina validez, coincidencias y bloqueos.</p>
            </div>
          </section>
        </main> : <DocumentsView cases={visibleCases} total={cases.length} loading={loading} error={error} />}
      </div>

      <EvidenceDrawer onClose={() => setSelected(null)} verification={selected} />
    </div>
  );
}

function DocumentsView({
  cases,
  total,
  loading,
  error,
}: {
  cases: VerificationCase[];
  total: number;
  loading: boolean;
  error: string | null;
}) {
  return (
    <main id="documents">
      <div className="page-heading">
        <div>
          <div className="breadcrumb">Operaciones <span>/</span> Documentos</div>
          <h1>Documentos del carrier</h1>
          <p>Archivos disponibles para extracción y validación.</p>
        </div>
      </div>

      <section className="storage-callout" aria-label="Ubicación requerida para documentos">
        <div className="storage-callout__icon"><Files aria-hidden="true" size={21} /></div>
        <div>
          <span className="eyebrow">Directorio de entrada</span>
          <h2>¿Dónde deben almacenarse?</h2>
          <p>
            Guarda cada PDF dentro de <code>base/documents/</code> y usa el identificador del caso como
            nombre, por ejemplo <code>C007.pdf</code>. La solicitud correspondiente debe existir en
            <code>base/quote_requests.json</code> con el mismo <code>case_id</code>.
          </p>
        </div>
      </section>

      <section className="documents-card">
        <header className="documents-card__header">
          <div>
            <h2>Archivos detectados</h2>
            <p>{total} documentos disponibles en el directorio de entrada.</p>
          </div>
          <code>base/documents/</code>
        </header>

        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (
          <div className="document-list">
            {cases.map((item) => (
              <article className="document-row" key={item.caseId}>
                <div className="document-row__icon"><FileSearch aria-hidden="true" size={20} /></div>
                <div className="document-row__identity">
                  <strong>{item.caseId}.pdf</strong>
                  <span>{item.requestedName}</span>
                </div>
                <div className="document-row__meta">
                  <span>Carrier</span>
                  <strong>{item.carrier}</strong>
                </div>
                <div className="document-row__meta">
                  <span>Ubicación</span>
                  <code>base/documents/{item.caseId}.pdf</code>
                </div>
                <StatusBadge status={item.sourceValid ? 'verified' : 'unverified'} label={item.sourceValid ? 'Ilustración válida' : 'Fuente no válida'} />
                <a aria-label={`Abrir ${item.caseId}.pdf`} href={item.documentUrl} rel="noreferrer" target="_blank">
                  Abrir
                </a>
              </article>
            ))}
            {cases.length === 0 && <div className="empty-state">No se encontraron documentos.</div>}
          </div>
        )}
      </section>
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon--${tone}`}><span /></div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </article>
  );
}

function ValueCell({ status, value }: { status?: VerificationStatus; value: string }) {
  return (
    <div className="value-cell">
      <span>{value}</span>
      {status === 'conflict' && <span className="value-flag">Revisar</span>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <div><strong>Extrayendo documentos</strong><span>Analizando 6 archivos PDF…</span></div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <div className="error-state"><strong>No fue posible completar la extracción.</strong><span>{message}</span></div>;
}
