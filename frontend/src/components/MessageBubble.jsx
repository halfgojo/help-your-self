import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import SourceCard from './SourceCard';
import TrialCard from './TrialCard';

function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function UserBubble({ content, timestamp }) {
  return (
    <div className="message-wrapper user">
      <div className="message-bubble user">{content}</div>
      <div className="message-time">{formatTime(timestamp)}</div>
    </div>
  );
}

// ─── Deep Dive tab — built entirely from the publication & trial data ───────
function DeepDiveTab({ publications, trials, disease, query, weather }) {
  const topPubs = publications.slice(0, 8);
  const recruitingTrials = trials.filter(t =>
    (t.status || '').toUpperCase().includes('RECRUITING') &&
    !(t.status || '').toUpperCase().includes('NOT YET')
  );
  const completedTrials = trials.filter(t =>
    (t.status || '').toUpperCase() === 'COMPLETED'
  );

  // Extract key years range from publications
  const years = topPubs
    .map(p => parseInt(p.year))
    .filter(y => !isNaN(y))
    .sort((a, b) => a - b);
  const yearRange = years.length > 1
    ? `${years[0]}–${years[years.length - 1]}`
    : years[0] || 'Various';

  // Unique sources
  const sources = [...new Set(topPubs.map(p => p.source))];

  return (
    <div className="deep-dive-tab">

      {/* Overview Stats */}
      <div className="deep-dive-stats-row">
        <div className="deep-dive-stat">
          <div className="deep-dive-stat-value">{publications.length}</div>
          <div className="deep-dive-stat-label">Publications Found</div>
        </div>
        <div className="deep-dive-stat">
          <div className="deep-dive-stat-value">{trials.length}</div>
          <div className="deep-dive-stat-label">Clinical Trials</div>
        </div>
        <div className="deep-dive-stat">
          <div className="deep-dive-stat-value">{recruitingTrials.length}</div>
          <div className="deep-dive-stat-label">Actively Recruiting</div>
        </div>
        <div className="deep-dive-stat">
          <div className="deep-dive-stat-value">{yearRange}</div>
          <div className="deep-dive-stat-label">Research Years</div>
        </div>
      </div>

      {/* Data Sources Used */}
      <div className="deep-dive-section">
        <div className="deep-dive-section-title">Data Sources</div>
        <div className="deep-dive-chips">
          {['PubMed', 'OpenAlex', 'ClinicalTrials.gov'].map(src => (
            <span key={src} className="deep-dive-chip">{src}</span>
          ))}
        </div>
      </div>

      {/* Local Climate Watch */}
      {weather && (
        <div className="deep-dive-section">
          <div className="deep-dive-section-title">Local Climate Watch</div>
          <div className="deep-dive-weather-card">
            <div className="weather-location">{weather.location}</div>
            <div className="weather-details">
              <span>{weather.temperature}°C</span>
              <span className="dot-divider">·</span>
              <span>{weather.humidity}% Humidity</span>
              <span className="dot-divider">·</span>
              <span>{weather.condition}</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Authors */}
      {(() => {
        const authorMap = {};
        topPubs.forEach(p => {
          (p.authors || []).forEach(a => {
            if (a) authorMap[a] = (authorMap[a] || 0) + 1;
          });
        });
        const sortedAuthors = Object.entries(authorMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6);
        return sortedAuthors.length > 0 ? (
          <div className="deep-dive-section">
            <div className="deep-dive-section-title">Key Researchers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {sortedAuthors.map(([name, count]) => (
                <div key={name} className="deep-dive-author-chip">
                  <span>{name}</span>
                  {count > 1 && <span className="author-count">{count} papers</span>}
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Key Abstracts / Findings */}
      {topPubs.length > 0 && (
        <div className="deep-dive-section">
          <div className="deep-dive-section-title">Key Findings from Research</div>
          <div className="deep-dive-findings">
            {topPubs.slice(0, 5).map((p, i) => (
              <div key={i} className="deep-dive-finding-item">
                <div className="deep-dive-finding-header">
                  <span className="finding-index">PUB{i + 1}</span>
                  <span className="finding-source-badge">{p.source}</span>
                  <span className="finding-year">{p.year}</span>
                </div>
                <div className="deep-dive-finding-title">{p.title}</div>
                {p.abstract && (
                  <div className="deep-dive-finding-abstract">
                    {p.abstract.substring(0, 350)}{p.abstract.length > 350 ? '…' : ''}
                  </div>
                )}
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-card-link"
                    style={{ marginTop: '6px' }}
                  >
                    Read paper ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What Measures to Take */}
      <div className="deep-dive-section">
        <div className="deep-dive-section-title">Measures & Next Steps</div>
        <div className="deep-dive-measures">
          <div className="measure-item">
            <div className="measure-content">
              <div className="measure-title">Consult a Specialist</div>
              <div className="measure-desc">
                Discuss the latest findings for <strong>{disease}</strong> with a qualified specialist. Bring the publications from this session to your appointment.
              </div>
            </div>
          </div>

          {recruitingTrials.length > 0 && (
            <div className="measure-item">
              <div className="measure-content">
                <div className="measure-title">Explore Clinical Trials ({recruitingTrials.length} Recruiting)</div>
                <div className="measure-desc">
                  {recruitingTrials.slice(0, 2).map((t, i) => (
                    <div key={i} style={{ marginBottom: '4px' }}>
                      <strong>{t.title}</strong>
                      {t.locations && t.locations[0] !== 'Location not specified' &&
                        ` — ${t.locations[0]}`}
                    </div>
                  ))}
                  <a
                    href={`https://clinicaltrials.gov/search?cond=${encodeURIComponent(disease)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-card-link"
                  >
                    Search all trials ↗
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="measure-item">
            <div className="measure-content">
              <div className="measure-title">Review Full Publications</div>
              <div className="measure-desc">
                {publications.length} peer-reviewed papers were retrieved. Use the <strong>Publications</strong> tab to read full abstracts and open papers directly.
              </div>
            </div>
          </div>

          <div className="measure-item">
            <div className="measure-content">
              <div className="measure-title">Ask Follow-Up Questions</div>
              <div className="measure-desc">
                This session remembers your full context. Ask follow-ups like <em>"What are the side effects?"</em> or <em>"Are there non-invasive options?"</em>
              </div>
            </div>
          </div>

          <div className="measure-item measure-warning">
            <div className="measure-content">
              <div className="measure-title">Medical Disclaimer</div>
              <div className="measure-desc">
                This information is research-sourced and AI-assisted. It is not a substitute for professional medical advice, diagnosis, or treatment.
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Main AI Response Card ────────────────────────────────────────────────────
function AIResponseCard({ content, data, isStreaming }) {
  const [activeTab, setActiveTab] = useState('insights');
  const { publications = [], clinicalTrials = [], stats, disease, query, weather } = data || {};

  const tabs = [
    { id: 'insights', label: 'AI Analysis' },
    { id: 'publications', label: 'Publications', count: publications.length },
    { id: 'trials', label: 'Clinical Trials', count: clinicalTrials.length },
    { id: 'deepdive', label: 'Deep Dive' },
  ];

  return (
    <div className="message-wrapper assistant">
      <div className="message-bubble assistant-outer">
        <div className="ai-response-card">
          {/* Header */}
          <div className="ai-response-header">
            <div className="ai-badge">
              <div className="ai-badge-dot" />
              HelpYourself AI · llama3.2
            </div>
            <div className="stats-pills">
              {stats && (
                <>
                  <div className="stat-pill">
                    <strong>{stats.totalPublicationsRetrieved}</strong> retrieved
                  </div>
                  <div className="stat-pill">
                    <strong>{stats.publicationsShown}</strong> publications
                  </div>
                  <div className="stat-pill">
                    <strong>{stats.trialsShown}</strong> trials
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="tab-count">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Bodies */}
          <div className="ai-response-body">
            {activeTab === 'insights' && (
              <div className={`markdown-content ${isStreaming ? 'streaming-cursor' : ''}`}>
                {content
                  ? <ReactMarkdown>{content}</ReactMarkdown>
                  : (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                      Analysing research and generating personalised insights…
                    </div>
                  )
                }
              </div>
            )}

            {activeTab === 'publications' && (
              <>
                {publications.length > 0 ? (
                  <div className="sources-grid">
                    {publications.map((pub, i) => (
                      <SourceCard key={i} pub={pub} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div>No publications found for this query.</div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'trials' && (
              <>
                {clinicalTrials.length > 0 ? (
                  <div className="trials-grid">
                    {clinicalTrials.map((trial, i) => (
                      <TrialCard key={i} trial={trial} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div>No clinical trials found for this query.</div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'deepdive' && (
              <DeepDiveTab
                publications={publications}
                trials={clinicalTrials}
                disease={disease || ''}
                query={query || ''}
                weather={weather}
              />
            )}
          </div>
        </div>
      </div>
      <div className="message-time">{formatTime()}</div>
    </div>
  );
}

// ─── Default export ───────────────────────────────────────────────────────────
export default function MessageBubble({ message, isStreaming }) {
  if (message.role === 'user') {
    return <UserBubble content={message.content} timestamp={message.timestamp} />;
  }

  if (message.role === 'assistant' && message.data) {
    return (
      <AIResponseCard
        content={message.content}
        data={message.data}
        isStreaming={isStreaming}
      />
    );
  }

  return (
    <div className="message-wrapper assistant">
      <div className={`assistant-text-only ${isStreaming ? 'streaming-cursor' : ''}`}>
        <div className="markdown-content">
          <ReactMarkdown>{message.content || 'Thinking…'}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
