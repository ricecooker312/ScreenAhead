/**
 * Provider directory integration points.
 *
 * The app ships with a local, admin-verified provider collection. External
 * directories can be added behind this interface. Records imported from an
 * external source must keep `verification.source` and `lastVerifiedAt`, and
 * must never be marked verified without a documented verification process.
 */
export interface ExternalProviderRecord {
  externalId: string;
  name: string;
  credentials?: string;
  specialties: string[];
  organization?: string;
  location?: { addressLine?: string; city?: string; state?: string; postalCode?: string };
  phone?: string;
  website?: string;
  npi?: string;
  source: string;
  retrievedAt: Date;
}

export interface ProviderDirectoryAdapter {
  readonly name: string;
  readonly enabled: boolean;
  search(params: { specialty?: string; postalCode?: string; state?: string; limit?: number }): Promise<ExternalProviderRecord[]>;
}

/**
 * NPPES NPI Registry (US, public). Gives names, taxonomy (specialty) and practice
 * addresses, but NOT insurance, telehealth, languages or availability.
 * Disabled until network access, terms review and taxonomy mapping are done.
 */
export class NppesAdapter implements ProviderDirectoryAdapter {
  readonly name = 'NPPES NPI Registry';
  readonly enabled = false;
  async search(): Promise<ExternalProviderRecord[]> {
    throw new Error('NPPES integration is not enabled. See docs/EXTERNAL_SERVICES.md.');
  }
}

export const externalDirectories: ProviderDirectoryAdapter[] = [new NppesAdapter()];
