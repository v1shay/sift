'use client';

import { Activity, GitPullRequest, Network, ShieldCheck, Sparkles, Star, Users, X } from 'lucide-react';

type HeightScaleDriver = 'stars' | 'activity' | 'contributors';
type ClusterMode = 'stack' | 'stars' | 'trending' | 'response';

type ViewEncodingPanelProps = {
  open: boolean;
  heightScaleDriver: HeightScaleDriver;
  clusterMode: ClusterMode;
  onHeightScaleChange: (value: HeightScaleDriver) => void;
  onClusterModeChange: (value: ClusterMode) => void;
  onClose: () => void;
};

const heightOptions: Array<{ value: HeightScaleDriver; label: string; detail: string; icon: typeof Star }> = [
  { value: 'stars', label: 'Stars', detail: 'Height maps to repo popularity and landmark scale.', icon: Star },
  { value: 'activity', label: 'Activity', detail: 'Height maps to commits, open PRs, and open issues.', icon: Activity },
  { value: 'contributors', label: 'Contributors', detail: 'Height maps to contributor community size.', icon: Users },
];

const clusterOptions: Array<{ value: ClusterMode; label: string; detail: string; icon: typeof Network }> = [
  { value: 'stack', label: 'Stack', detail: 'Districts stay organized by ecosystem and topic.', icon: Network },
  { value: 'stars', label: 'Stars', detail: 'High-star landmarks rise first while smaller repos remain discoverable.', icon: Star },
  { value: 'trending', label: 'Trending', detail: 'Recent activity, open work, and momentum lead each district.', icon: Sparkles },
  { value: 'response', label: 'Response', detail: 'Responsive, safer contribution paths get visual priority.', icon: ShieldCheck },
];

const legends = [
  { label: 'Height', detail: 'Selected scale driver controls building height.', icon: Star },
  { label: 'Glow', detail: 'Brighter accents mark stronger activity and trend signals.', icon: Sparkles },
  { label: 'Safety', detail: 'Safety score and badges show contribution readiness.', icon: ShieldCheck },
  { label: 'Routes', detail: 'Roads and flow marks show PR and open-work relationships.', icon: GitPullRequest },
  { label: 'Clusters', detail: 'Cluster mode controls which repos surface first in each district.', icon: Network },
];

export function ViewEncodingPanel({
  open,
  heightScaleDriver,
  clusterMode,
  onHeightScaleChange,
  onClusterModeChange,
  onClose,
}: ViewEncodingPanelProps) {
  if (!open) return null;

  return (
    <section className="view-encoding-panel" aria-label="View encoding controls">
      <header className="view-encoding-head">
        <div>
          <span>View Encoding</span>
          <strong>Height maps to {labelFor(heightScaleDriver, heightOptions)} · clustered by {labelFor(clusterMode, clusterOptions)}</strong>
        </div>
        <button type="button" aria-label="Close view encoding" onClick={onClose}>
          <X size={15} strokeWidth={1.8} />
        </button>
      </header>

      <div className="encoding-option-grid" aria-label="Height scale">
        {heightOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              className={heightScaleDriver === option.value ? 'is-active' : ''}
              type="button"
              aria-pressed={heightScaleDriver === option.value}
              onClick={() => onHeightScaleChange(option.value)}
            >
              <Icon size={14} strokeWidth={1.8} />
              <span>{option.label}</span>
              <small>{option.detail}</small>
            </button>
          );
        })}
      </div>

      <div className="encoding-option-grid" aria-label="Cluster mode">
        {clusterOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              className={clusterMode === option.value ? 'is-active' : ''}
              type="button"
              aria-pressed={clusterMode === option.value}
              onClick={() => onClusterModeChange(option.value)}
            >
              <Icon size={14} strokeWidth={1.8} />
              <span>{option.label}</span>
              <small>{option.detail}</small>
            </button>
          );
        })}
      </div>

      <div className="encoding-legend">
        {legends.map((legend) => {
          const Icon = legend.icon;
          return (
            <div key={legend.label}>
              <Icon size={13} strokeWidth={1.8} />
              <span>{legend.label}</span>
              <small>{legend.detail}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function labelFor<TValue extends string>(value: TValue, options: Array<{ value: TValue; label: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}
