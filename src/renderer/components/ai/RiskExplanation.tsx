import type { RiskLevel } from '../../../main/scanners/types';

const RISK_LABELS: Record<RiskLevel, string> = {
  green: 'Safe',
  yellow: 'Caution',
  red: 'Risky',
};

interface RiskExplanationProps {
  category: string;
  action: string;
  reasoning: string;
  risk: RiskLevel;
}

export function RiskExplanation({ category, action, reasoning, risk }: RiskExplanationProps) {
  return (
    <div className={`risk-explanation risk-explanation--${risk}`}>
      <div className="risk-explanation-header">
        <span className={`risk-explanation-badge risk-explanation-badge--${risk}`}>
          {RISK_LABELS[risk]}
        </span>
        <span className="risk-explanation-category">{category}</span>
      </div>
      <p className="risk-explanation-action">{action}</p>
      <p className="risk-explanation-reasoning">{reasoning}</p>
    </div>
  );
}
