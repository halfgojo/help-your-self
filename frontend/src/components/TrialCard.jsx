import React, { useState } from 'react';

function getStatusClass(status) {
  const s = (status || '').toUpperCase();
  if (s.includes('RECRUITING') && !s.includes('NOT')) return 'RECRUITING';
  if (s.includes('COMPLETED')) return 'COMPLETED';
  if (s.includes('ACTIVE')) return 'ACTIVE';
  if (s.includes('NOT_YET') || s.includes('NOT YET')) return 'NOT_RECRUITING';
  return 'UNKNOWN';
}

export default function TrialCard({ trial, index }) {
  const [expanded, setExpanded] = useState(false);
  const statusClass = getStatusClass(trial.status);
  const statusLabel = trial.status || 'Unknown';
  const hasContact = trial.contact && (trial.contact.name || trial.contact.email || trial.contact.phone);

  return (
    <div className="trial-card" id={`trial-card-${index}`}>
      <div className="trial-card-header">
        <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="trial-card-title">{trial.title}</div>

      <div className="trial-card-meta">
        {trial.phase && trial.phase !== 'N/A' && (
          <span className="trial-meta-item">{trial.phase}</span>
        )}
        {trial.startDate && trial.startDate !== 'N/A' && (
          <span className="trial-meta-item">{trial.startDate}</span>
        )}
        {trial.completionDate && trial.completionDate !== 'N/A' && (
          <span className="trial-meta-item">{trial.completionDate}</span>
        )}
        {trial.nctId && (
          <span className="trial-meta-item trial-nct">{trial.nctId}</span>
        )}
      </div>

      {trial.summary && (
        <div className="trial-card-summary">
          {expanded
            ? trial.summary
            : `${trial.summary.substring(0, 280)}${trial.summary.length > 280 ? '...' : ''}`}
          {trial.summary.length > 280 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-cyan)',
                cursor: 'pointer',
                fontSize: '0.72rem',
                paddingLeft: '4px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {trial.locations && trial.locations.length > 0 && trial.locations[0] !== 'Location not specified' && (
        <div className="trial-locations">
          <span>{trial.locations.slice(0, 2).join(' · ')}</span>
        </div>
      )}

      {hasContact && (
        <div className="trial-contact">
          <div className="trial-contact-title">Contact</div>
          {trial.contact.name && <span>{trial.contact.name}</span>}
          {trial.contact.email && (
            <span>
              <a
                href={`mailto:${trial.contact.email}`}
                style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}
              >
                {trial.contact.email}
              </a>
            </span>
          )}
          {trial.contact.phone && <span>{trial.contact.phone}</span>}
        </div>
      )}

      <a
        href={trial.url}
        target="_blank"
        rel="noopener noreferrer"
        className="trial-card-link"
        id={`trial-link-${index}`}
      >
        View on ClinicalTrials.gov ↗
      </a>
    </div>
  );
}
