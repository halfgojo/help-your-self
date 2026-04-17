import React, { useState } from 'react';

const DEFAULT_EXAMPLES = [
  { icon: '🫁', text: 'Latest treatment for lung cancer' },
  { icon: '🩺', text: 'Clinical trials for diabetes' },
  { icon: '🧬', text: 'Top researchers in Alzheimer\'s disease' },
  { icon: '❤️', text: 'Recent studies on heart disease' },
];

function getDynamicFormExamples(disease) {
  if (!disease || disease.trim().length === 0) return DEFAULT_EXAMPLES;
  const d = disease.toLowerCase().trim();
  return [
    { icon: '💊', text: `Latest treatment for ${d}` },
    { icon: '🔬', text: `Clinical trials for ${d}` },
    { icon: '📊', text: `Recent studies on ${d}` },
    { icon: '👨‍⚕️', text: `Managing symptoms of ${d}` },
  ];
}

export default function PatientContextForm({ onSubmit, onClose, initialData }) {
  const [form, setForm] = useState({
    patientName: initialData?.patientName || '',
    disease: initialData?.disease || '',
    query: initialData?.query || '',
    location: initialData?.location || '',
    indianFocus: initialData?.indianFocus || false,
  });

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleExampleClick = (text) => {
    // Auto-parse example into disease + query
    setForm((prev) => ({ ...prev, query: text, disease: prev.disease || text.split(' ').slice(-2).join(' ') }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.disease.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="context-form-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="context-form-card">
        <div className="form-header">
          <div className="form-header-icon">🏥</div>
          <div style={{ flex: 1 }}>
            <div className="form-title">Patient Research Context</div>
            <div className="form-subtitle">Set context for personalized, research-backed insights</div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                fontSize: '18px', cursor: 'pointer', padding: '4px',
                lineHeight: 1, height: '32px', width: '32px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', borderRadius: '50%'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
            >
              ×
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="input-patient-name">Patient Name</label>
            <input
              id="input-patient-name"
              className="form-input"
              type="text"
              placeholder="e.g. John Smith"
              value={form.patientName}
              onChange={handleChange('patientName')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="input-disease">
              Disease of Interest <span>*</span>
            </label>
            <input
              id="input-disease"
              className="form-input"
              type="text"
              placeholder="e.g. Parkinson's disease, lung cancer"
              value={form.disease}
              onChange={handleChange('disease')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="input-query">Additional Query / Research Topic</label>
            <input
              id="input-query"
              className="form-input"
              type="text"
              placeholder="e.g. Deep Brain Stimulation, immunotherapy"
              value={form.query}
              onChange={handleChange('query')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="input-location">Location</label>
            <input
              id="input-location"
              className="form-input"
              type="text"
              placeholder="e.g. Toronto, Canada"
              value={form.location}
              onChange={handleChange('location')}
            />
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '10px' }}>
            <input
              id="input-indian-focus"
              type="checkbox"
              checked={form.indianFocus}
              onChange={(e) => setForm(prev => ({ ...prev, indianFocus: e.target.checked }))}
              style={{ marginTop: '4px', cursor: 'pointer' }}
            />
            <div>
              <label htmlFor="input-indian-focus" style={{ fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                Require Indian Context (Exclusive)
              </label>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Restricts the LLM and research databases to specifically source Indian data and advice.
              </div>
            </div>
          </div>

          {/* Quick example chips */}
          <div style={{ marginBottom: '4px' }}>
            <div className="form-label">Quick Examples</div>
            <div className="quick-examples-scroll" style={{ 
              display: 'flex', gap: '8px', flexWrap: 'nowrap', marginTop: '6px',
              overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch', minHeight: '44px'
            }}>
              {getDynamicFormExamples(form.disease).map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  id={`example-btn-${i}`}
                  onClick={() => handleExampleClick(ex.text)}
                  style={{
                    padding: '8px 14px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-full)',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-accent)';
                    e.currentTarget.style.color = 'var(--accent-cyan)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  {ex.icon} {ex.text}
                </button>
              ))}
            </div>
          </div>

          <div className="form-actions">
            {onClose && (
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              type="submit"
              id="btn-start-research"
              className="btn-primary"
              disabled={!form.disease.trim()}
            >
              🚀 Start Research
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
