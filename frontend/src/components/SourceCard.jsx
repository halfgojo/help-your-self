import React, { useState } from 'react';

export default function SourceCard({ pub, index }) {
  const [expanded, setExpanded] = useState(false);
  const sourceClass = pub.source === 'PubMed' ? 'pubmed' : 'openalex';
  const relevancePercent = pub.score != null ? Math.min(100, Math.round(pub.score * 200)) : null;

  const openArticle = () => {
    if (pub.url) window.open(pub.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="source-card"
      id={`source-card-${index}`}
      onClick={openArticle}
      style={{ cursor: pub.url ? 'pointer' : 'default' }}
      title={pub.url ? 'Click to open article' : ''}
    >
      <div className="source-card-header">
        <div className="source-card-title">{pub.title}</div>
        <span className={`source-badge ${sourceClass}`}>{pub.source}</span>
      </div>

      <div className="source-card-meta">
        {pub.authors && pub.authors.length > 0 && (
          <span className="meta-authors">
            <span>Author(s): </span>
            <span>
              {pub.authors.slice(0, 2).join(', ')}
              {pub.authors.length > 2 ? ' et al.' : ''}
            </span>
          </span>
        )}
        {pub.year && pub.year !== 'N/A' && (
          <span className="meta-year">
            <span>Year: </span>
            <span>{pub.year}</span>
          </span>
        )}
        {relevancePercent != null && (
          <span className="relevance-score">
            <span className="relevance-bar">
              <span className="relevance-fill" style={{ width: `${relevancePercent}%` }} />
            </span>
            {relevancePercent}% match
          </span>
        )}
      </div>

      {pub.abstract && (
        <div className="source-card-abstract">
          {expanded
            ? pub.abstract
            : `${pub.abstract.substring(0, 300)}${pub.abstract.length > 300 ? '...' : ''}`}
          {pub.abstract.length > 300 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              style={{
                background: 'none', border: 'none', color: 'var(--accent-cyan)',
                cursor: 'pointer', fontSize: '0.72rem', paddingLeft: '4px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {pub.url && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            href={pub.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-card-link"
            id={`source-link-${index}`}
            onClick={(e) => e.stopPropagation()}
          >
            Read full article ↗
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); openArticle(); }}
            style={{
              padding: '3px 10px',
              background: 'var(--accent-cyan-dim)',
              border: '1px solid var(--border-accent)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--accent-cyan-light)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: '500',
            }}
          >
            Open ↗
          </button>
        </div>
      )}
    </div>
  );
}
