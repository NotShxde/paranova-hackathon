import { useState } from 'react';

interface Parameter {
  name: string;
  type: string;
  min: number;
  max: number;
  default: number;
}

interface Props {
  parameters: Parameter[];
}

export default function TheoremEngine({ parameters }: Props) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    parameters.forEach(p => initial[p.name] = p.default);
    return initial;
  });

  const handleChange = (name: string, value: number) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const a = values['Side a'] || 1;
  const b = values['Side b'] || 1;
  const c = values['Side c'] || 1;

  const isValid = a + b > c && a + c > b && b + c > a;

  let points = "";
  if (isValid) {
    const angle = Math.acos((a*a + c*c - b*b) / (2 * a * c));
    const scale = 20; 
    
    const x1 = 0;
    const y1 = 0;
    const x2 = c * scale;
    const y2 = 0;
    const x3 = a * scale * Math.cos(angle);
    const y3 = a * scale * Math.sin(angle);
    
    const offsetX = 150 - (c * scale) / 2;
    const offsetY = 150 + (a * scale * Math.sin(angle)) / 2;

    points = `${x1+offsetX},${-y1+offsetY} ${x2+offsetX},${-y2+offsetY} ${x3+offsetX},${-y3+offsetY}`;
  }

  return (
    <div className="card">
      <h2>Visual Sandbox</h2>
      
      <div className="controls">
        {parameters.map(p => (
          <div key={p.name} className="control-group">
            <label>{p.name}</label>
            <input 
              type="range" 
              min={p.min} 
              max={p.max} 
              value={values[p.name]} 
              onChange={e => handleChange(p.name, parseFloat(e.target.value))}
            />
            <span>{values[p.name]}</span>
          </div>
        ))}
      </div>

      <div className="visualization">
        <svg className="triangle-wrapper" viewBox="0 0 300 300">
          {isValid ? (
            <polygon points={points} className="triangle-path" />
          ) : (
            <text x="150" y="150" fill="#f44336" textAnchor="middle" dominantBaseline="middle" style={{fontSize: '1.2rem'}}>
              Invalid Triangle
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
