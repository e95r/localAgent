import { FIXTURE_CONSENT_PROFILE, FIXTURE_DASHBOARD_PROFILE, GENERIC_PROFILE, type SiteProfile } from './site-profile.js';

export class SiteProfileRegistry {
  private readonly profiles: SiteProfile[];

  constructor(extraProfiles: SiteProfile[] = []) {
    this.profiles = [FIXTURE_DASHBOARD_PROFILE, FIXTURE_CONSENT_PROFILE, ...extraProfiles];
  }

  resolve(url: string, requested?: string): SiteProfile {
    if (requested) {
      if (requested === 'generic') return GENERIC_PROFILE;
      const byName = this.profiles.find((p) => p.name === requested);
      if (byName) return byName;
    }

    return this.profiles.find((profile) => profile.domainPattern.test(url)) ?? GENERIC_PROFILE;
  }
}
