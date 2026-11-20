export type AppPortalMode = 'web' | 'partner';

export const PRIMARY_WEB_DOMAINS = ['zuggy.in', 'zuggi.in'];
export const PARTNER_APP_DOMAINS = ['partner.zuggy.in', 'partner.zuggi.in'];

export function isPartnerHostname(hostname: string): boolean {
  const host = (hostname || '').toLowerCase();
  return (
    PARTNER_APP_DOMAINS.includes(host) ||
    host.startsWith('partner.') ||
    host.startsWith('driver.')
  );
}

export function detectPortalMode(): AppPortalMode {
  if (typeof window === 'undefined') return 'web';
  const hostname = window.location.hostname || '';
  const pathname = window.location.pathname || '/';
  const params = new URLSearchParams(window.location.search || '');
  if (
    isPartnerHostname(hostname) ||
    pathname.startsWith('/partner') ||
    params.get('app') === 'partner'
  ) {
    return 'partner';
  }
  return 'web';
}

export function isPartnerRole(role?: string | null): boolean {
  return (
    role === 'driver' ||
    role === 'vehicle_owner' ||
    role === 'fleet_partner' ||
    role === 'transporter'
  );
}

export function navigateToPortal(mode: AppPortalMode): void {
  if (typeof window === 'undefined') return;
  const hostname = (window.location.hostname || '').toLowerCase();
  const matchedRoot = PRIMARY_WEB_DOMAINS.find(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  );

  if (matchedRoot) {
    if (mode === 'web' && isPartnerHostname(hostname)) {
      window.location.assign(`https://${matchedRoot}/`);
      return;
    }
    if (mode === 'partner' && !isPartnerHostname(hostname)) {
      window.location.assign('/partner');
      return;
    }
  }

  const targetPath = mode === 'partner' ? '/partner' : '/';
  window.location.assign(targetPath);
}
