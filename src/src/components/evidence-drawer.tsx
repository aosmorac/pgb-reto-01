import { ExternalLink, FileCheck2, FileText, X } from 'lucide-react';
import { useEffect } from 'react';

import { StatusBadge } from '@/components/status-badge';
import type { VerificationCase } from '@/types';

interface EvidenceDrawerProps {
  verification: VerificationCase | null;
  onClose: () => void;
}

export function EvidenceDrawer({ verification, onClose }: EvidenceDrawerProps) {
  useEffect(() => {
    if (!verification) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('drawer-open');

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('drawer-open');
    };
  }, [onClose, verification]);

  if (!verification) return null;

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
      <aside
        aria-label={`Evidencia del caso ${verification.caseId}`}
        aria-modal="true"
        className="evidence-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="drawer-header">
          <div>
            <div className="eyebrow">Expediente {verification.caseId}</div>
            <h2>{verification.requestedName}</h2>
          </div>
          <button aria-label="Cerrar detalle" className="icon-button" onClick={onClose} type="button">
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div className="drawer-content">
          <div className="drawer-summary">
            <StatusBadge status={verification.status} label={verification.statusLabel} />
            <p>{verification.sourceReason}</p>
          </div>

          {!verification.sourceValid && (
            <div className="refusal-panel">
              <ShieldXIcon />
              <div>
                <strong>Verificación rechazada</strong>
                <p>
                  No presentamos estos datos como verificados porque la fuente no es una ilustración
                  emitida por el carrier.
                </p>
              </div>
            </div>
          )}

          {verification.status === 'conflict' && (
            <div className="refusal-panel refusal-panel--warning">
              <ShieldXIcon />
              <div>
                <strong>Resumen verificado bloqueado</strong>
                <p>
                  Existe al menos una contradicción material. Revisa la evidencia antes de continuar.
                </p>
              </div>
            </div>
          )}

          <section aria-labelledby="field-review-title">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Trazabilidad</div>
                <h3 id="field-review-title">Revisión por campo</h3>
              </div>
              <FileCheck2 aria-hidden="true" size={20} />
            </div>

            <div className="field-list">
              {verification.fields.map((field) => (
                <article className="field-card" key={field.key}>
                  <div className="field-card__header">
                    <h4>{field.label}</h4>
                    <StatusBadge compact status={field.status} />
                  </div>
                  <div className="comparison-grid">
                    <div>
                      <span>Solicitud / UI</span>
                      <strong>{field.requested}</strong>
                    </div>
                    <div>
                      <span>Documento del carrier</span>
                      <strong>{field.observed}</strong>
                    </div>
                  </div>
                  <p className="field-reason">{field.reason}</p>
                  {field.evidence && (
                    <blockquote>
                      <FileText aria-hidden="true" size={16} />
                      <div>
                        <strong>“{field.evidence.quote}”</strong>
                        <span>
                          {field.evidence.document} · página {field.evidence.page}
                        </span>
                      </div>
                    </blockquote>
                  )}
                </article>
              ))}
            </div>
          </section>

          {verification.notes.length > 0 && (
            <section className="notes-panel" aria-label="Notas de extracción">
              <strong>Notas de extracción</strong>
              {verification.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </section>
          )}

          <section aria-labelledby="source-document-title">
            <div className="section-heading section-heading--document">
              <div>
                <div className="eyebrow">Fuente primaria</div>
                <h3 id="source-document-title">Documento original</h3>
              </div>
              <a href={verification.documentUrl} rel="noreferrer" target="_blank">
                Abrir PDF <ExternalLink aria-hidden="true" size={15} />
              </a>
            </div>
            <iframe
              className="document-frame"
              src={`${verification.documentUrl}#page=1&view=FitH`}
              title={`Documento del carrier para ${verification.caseId}`}
            />
          </section>
        </div>
      </aside>
    </div>
  );
}

function ShieldXIcon() {
  return <FileText aria-hidden="true" size={21} />;
}

