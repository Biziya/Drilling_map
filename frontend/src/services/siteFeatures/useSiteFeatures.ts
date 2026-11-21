import { useEffect, useState } from 'react';
import { loadSiteFeatures } from './siteFeatures';
import type { SiteFeature } from './siteFeatures';

const NONE: readonly SiteFeature[] = [];

/** The site features from public/site_features/site_features.yaml; empty until loaded or on failure. */
export function useSiteFeatures(): readonly SiteFeature[] {
  const [features, setFeatures] = useState<readonly SiteFeature[]>(NONE);

  useEffect(() => {
    let isCurrent = true;
    void loadSiteFeatures().then((loaded) => {
      if (isCurrent && loaded.length) setFeatures(loaded);
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  return features;
}
