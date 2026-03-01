import type { RiskLevel } from '../../../main/scanners/types';

const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  green: { label: 'Safe', className: 'risk-indicator--green' },
  yellow: { label: 'Caution', className: 'risk-indicator--yellow' },
  red: { label: 'Danger', className: 'risk-indicator--red' },
};

interface RiskIndicatorProps {
  risk: RiskLevel;
  count?: number;
}

export function RiskIndicator({ risk, count }: RiskIndicatorProps) {
  const config = RISK_CONFIG[risk];

  return (
    <span className={`risk-indicator ${config.className}`}>
      <span className="risk-indicator-dot" />
      {count !== undefined ? `${count} ${config.label}` : config.label}
    </span>
  );
}
