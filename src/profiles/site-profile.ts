export interface SiteProfile {
  name: string;
  domainPattern: RegExp;
  consentSelectors: string[];
  modalCloseSelectors: string[];
  spinnerSelectors: string[];
  riskyKeywords: string[];
  preferredSelectors: string[];
}

export const GENERIC_PROFILE: SiteProfile = {
  name: 'generic',
  domainPattern: /.*/,
  consentSelectors: [
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    'button:has-text("Continue")',
    '[data-consent-accept]',
  ],
  modalCloseSelectors: [
    'button:has-text("Close")',
    'button:has-text("Skip")',
    '[aria-label="Close"]',
    '[data-modal-close]',
  ],
  spinnerSelectors: ['.spinner', '[data-loading="true"]', '[role="progressbar"]'],
  riskyKeywords: ['delete', 'pay', 'publish', 'external', 'leave site'],
  preferredSelectors: [],
};

export const FIXTURE_DASHBOARD_PROFILE: SiteProfile = {
  ...GENERIC_PROFILE,
  name: 'fixture-dashboard',
  domainPattern: /dashboard-like-page\.html/,
  preferredSelectors: ['[data-panel="primary"] button[data-role="target"]'],
};

export const FIXTURE_CONSENT_PROFILE: SiteProfile = {
  ...GENERIC_PROFILE,
  name: 'fixture-consent',
  domainPattern: /cookie-banner-page\.html|modal-newsletter-page\.html/,
  consentSelectors: [...GENERIC_PROFILE.consentSelectors, '#accept-cookies', '#accept-newsletter'],
  modalCloseSelectors: [...GENERIC_PROFILE.modalCloseSelectors, '#close-newsletter'],
};
