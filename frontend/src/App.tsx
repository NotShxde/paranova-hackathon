import { useState, useEffect } from 'react'
import TheoremEngine from './components/TheoremEngine'
import LogicConsole from './components/LogicConsole'
import './index.css'

interface Manifest {
  theorem_id: string;
  title: string;
  origin_story: string;
  visual_parameters: any[];
  insight_challenge: {
    description: string;
    evaluation_rules: Record<string, string>;
  }
}

function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    // For MVP, we simulate fetching the manifest
    // In production, this would be `fetch('/api/manifests/triangle_inequality')`
    setManifest({
      theorem_id: "triangle_inequality",
      title: "Triangle Inequality",
      origin_story: "Euclid proved in Elements (Book 1, Proposition 20) that in any triangle, the sum of the lengths of any two sides must be strictly greater than the length of the remaining side.",
      visual_parameters: [
        { name: "Side a", type: "slider", min: 1, max: 10, default: 3 },
        { name: "Side b", type: "slider", min: 1, max: 10, default: 4 },
        { name: "Side c", type: "slider", min: 1, max: 10, default: 5 }
      ],
      insight_challenge: {
        description: "Formulate a mathematical or formal statement that proves side c is always less than a + b.",
        evaluation_rules: {
          sympy: "Provide an algebraic inequality involving a, b, c.",
          lean: "Provide a Lean 4 statement to prove the condition."
        }
      }
    });
  }, []);

  if (!manifest) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container">
      <header className="header">
        <h1>{manifest.title}</h1>
        <p>{manifest.origin_story}</p>
      </header>

      <TheoremEngine parameters={manifest.visual_parameters} />
      
      <LogicConsole 
        challenge={manifest.insight_challenge} 
        theoremId={manifest.theorem_id} 
      />
    </div>
  )
}

export default App
