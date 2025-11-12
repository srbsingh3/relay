import keytar from 'keytar';

import type { RegistryEnvironmentMap, RegistryFile, RegistryServerRecord } from '../registry/schema';

export const KEYCHAIN_SERVICE_NAME = 'com.relay.app';
export const KEYCHAIN_ACCOUNT_PREFIX = 'token:';
export const KEYCHAIN_VALUE_PREFIX = 'keychain:';

const VALUE_PREFIX_LENGTH = KEYCHAIN_VALUE_PREFIX.length;

export interface KeytarBinding {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

export type AliasReferenceCounts = Map<string, number>;

const normalizeAlias = (alias: string): string => alias.trim();

const normalizeSecret = (secret: string): string => secret.trim();

const createAccountName = (alias: string) => `${KEYCHAIN_ACCOUNT_PREFIX}${alias}`;

const isKeychainReference = (value: string): boolean =>
  value.slice(0, VALUE_PREFIX_LENGTH).toLowerCase() === KEYCHAIN_VALUE_PREFIX;

export const extractAliasFromValue = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length <= VALUE_PREFIX_LENGTH) {
    return null;
  }

  if (!isKeychainReference(trimmed)) {
    return null;
  }

  const alias = trimmed.slice(VALUE_PREFIX_LENGTH).trim();
  return alias.length > 0 ? alias : null;
};

const collectServerAliases = (server: RegistryServerRecord): string[] => {
  const env: RegistryEnvironmentMap = server.env ?? {};
  return Object.values(env)
    .map((value) => extractAliasFromValue(value))
    .filter((alias): alias is string => Boolean(alias));
};

export const collectAliasReferences = (registry: RegistryFile): AliasReferenceCounts => {
  const counts: AliasReferenceCounts = new Map();

  registry.servers.forEach((server) => {
    collectServerAliases(server).forEach((alias) => {
      const normalized = normalizeAlias(alias);
      if (!normalized) {
        return;
      }

      const current = counts.get(normalized) ?? 0;
      counts.set(normalized, current + 1);
    });
  });

  return counts;
};

export class KeychainError extends Error {}

export class KeychainService {
  private aliasReferences: AliasReferenceCounts = new Map();

  constructor(private readonly binding: KeytarBinding = keytar) {}

  private requireAlias(rawAlias: string): string {
    const alias = normalizeAlias(rawAlias);
    if (!alias) {
      throw new KeychainError('Keychain alias is required.');
    }

    return alias;
  }

  private requireSecret(rawSecret: string): string {
    const secret = normalizeSecret(rawSecret);
    if (!secret) {
      throw new KeychainError('Secret value is required.');
    }

    return secret;
  }

  private accountForAlias(alias: string) {
    return createAccountName(alias);
  }

  syncAliasReferences(registry: RegistryFile) {
    this.aliasReferences = collectAliasReferences(registry);
  }

  setAliasReferenceCount(alias: string, count: number) {
    const normalized = normalizeAlias(alias);
    if (!normalized) {
      return;
    }

    if (count <= 0) {
      this.aliasReferences.delete(normalized);
      return;
    }

    this.aliasReferences.set(normalized, count);
  }

  getAliasReferenceCount(alias: string): number {
    const normalized = normalizeAlias(alias);
    if (!normalized) {
      return 0;
    }

    return this.aliasReferences.get(normalized) ?? 0;
  }

  async setSecret(alias: string, secret: string): Promise<void> {
    const normalizedAlias = this.requireAlias(alias);
    const normalizedSecret = this.requireSecret(secret);
    const account = this.accountForAlias(normalizedAlias);

    await this.binding.setPassword(KEYCHAIN_SERVICE_NAME, account, normalizedSecret);
  }

  async getSecret(alias: string): Promise<string | null> {
    const normalizedAlias = normalizeAlias(alias);
    if (!normalizedAlias) {
      return null;
    }

    const account = this.accountForAlias(normalizedAlias);
    return this.binding.getPassword(KEYCHAIN_SERVICE_NAME, account);
  }

  async hasSecret(alias: string): Promise<boolean> {
    const normalizedAlias = normalizeAlias(alias);
    if (!normalizedAlias) {
      return false;
    }

    const account = this.accountForAlias(normalizedAlias);
    const value = await this.binding.getPassword(KEYCHAIN_SERVICE_NAME, account);
    return value !== null;
  }

  async deleteSecret(alias: string): Promise<boolean> {
    const normalizedAlias = normalizeAlias(alias);
    if (!normalizedAlias) {
      return false;
    }

    if (this.getAliasReferenceCount(normalizedAlias) > 0) {
      return false;
    }

    const account = this.accountForAlias(normalizedAlias);
    return this.binding.deletePassword(KEYCHAIN_SERVICE_NAME, account);
  }
}

const defaultService = new KeychainService();

export const getKeychainService = () => defaultService;
