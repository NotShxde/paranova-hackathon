import { useState } from 'react';

interface Props {
  challenge: {
    description: string;
    evaluation_rules: Record<string, string>;
  };
  theoremId: string;
}

export default function LogicConsole({ challenge, theoremId }: Props) {
  const [target, setTarget] = useState<string>('sympy');
  const [hypothesis, setHypothesis] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState<string>('');
  const [jidokaHalt, setJidokaHalt] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!hypothesis.trim()) return;
    
    setStatus('loading');
    setFeedback('');
    
    try {
      const res = await fetch('http://localhost:8000/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hypothesis,
          target,
          theorem_id: theoremId
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setStatus('success');
        setFeedback(data.message || 'Verification passed!');
      } else {
        setStatus('error');
        setFeedback(data.error_msg || 'Verification failed');
        if (data.jidoka_halt) {
          setJidokaHalt(true);
          setFeedback(data.socratic_hint);
        }
      }
    } catch (err: any) {
      setStatus('error');
      setFeedback(err.message || 'Network error checking hypothesis. Make sure backend is running.');
    }
  };

  return (
    <div className="card">
      <h2>Logic Console</h2>
      <p style={{ marginBottom: '1.5rem', color: '#ccc' }}>{challenge.description}</p>
      
      <div className="input-area">
        <select value={target} onChange={e => setTarget(e.target.value)}>
          <option value="sympy">Algebraic (SymPy) - {challenge.evaluation_rules.sympy}</option>
          <option value="lean">Formal (Lean 4) - {challenge.evaluation_rules.lean}</option>
        </select>
        
        <textarea 
          placeholder="Enter your hypothesis or proof here..."
          value={hypothesis}
          onChange={e => setHypothesis(e.target.value)}
        />
        
        <button 
          className="submit-btn" 
          onClick={handleSubmit}
          disabled={status === 'loading' || hypothesis.trim() === ''}
        >
          {status === 'loading' ? 'Evaluating...' : 'Submit Hypothesis'}
        </button>
      </div>

      {status === 'success' && (
        <div className="feedback success">
          <strong>Success:</strong> {feedback}
        </div>
      )}

      {status === 'error' && !jidokaHalt && (
        <div className="feedback error">
          <strong>Error:</strong> {feedback}
        </div>
      )}

      {jidokaHalt && (
        <div className="jidoka-overlay">
          <div className="jidoka-card">
            <h2>Jidoka Halt</h2>
            <p className="hint">{feedback}</p>
            <button onClick={() => setJidokaHalt(false)}>
              Acknowledge & Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
