export interface UpdateItem {
  title: string;
  desc: string;
  iconName: 'brain' | 'palette' | 'sliders' | 'chart' | 'sparkles' | 'grid' | 'zap';
}

export interface VersionRelease {
  version: string;
  releaseDate: string;
  title: string;
  badgeText: string;
  featuresGroupA: {
    sectionTitle: string;
    items: UpdateItem[];
  };
  featuresGroupB: {
    sectionTitle: string;
    items: UpdateItem[];
  };
}

export const LATEST_VERSION = "v1.0";

export const APP_CHANGELOG: Record<string, VersionRelease> = {
  "v1.0": {
    version: "V1.0",
    releaseDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
    title: "",
    badgeText: "",
    featuresGroupA: {
      sectionTitle: "",
      items: []
    },
    featuresGroupB: {
      sectionTitle: "",
      items: []
    }
  }
};
