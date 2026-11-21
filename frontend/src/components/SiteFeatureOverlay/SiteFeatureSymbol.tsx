/**
 * The Layers-panel symbol for the site-features layer: a dashed footprint
 * with a pin, so it stands for every feature in the YAML, not one of them.
 */
function SiteFeatureSymbol({ size = 15 }: { size?: number }) {
  return (
    <svg className="site-feature-symbol" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="none" stroke="#1e3a5f" strokeWidth="1.4" strokeDasharray="3 2" />
      <circle cx="8" cy="8" r="3.4" fill="#f39c12" stroke="#1e3a5f" strokeWidth="1.2" />
    </svg>
  );
}

export default SiteFeatureSymbol;
