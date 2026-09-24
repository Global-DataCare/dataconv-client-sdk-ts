import type {
  CreateTenantConfigEntry,
  DataConvTenantConfigCloneOptions,
  TenantAdapterConfigContent,
  TenantAdapterConfigResource,
} from './types.js';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T;
}

/**
 * Builds a new editable configuration entry from a catalog resource.
 * Server-owned identity, revision and audit fields are deliberately omitted.
 */
export function cloneTenantConfig(
  source: TenantAdapterConfigResource,
  options: DataConvTenantConfigCloneOptions
): CreateTenantConfigEntry {
  const config = cloneJson<TenantAdapterConfigContent>(source.content ?? {});
  const mappingConfig = cloneJson(config.mappingConfig ?? {});
  mappingConfig.fieldMap = Object.fromEntries(
    options.mappings.map(({ serverField, sourceField }) => [serverField, sourceField])
  );
  config.mappingConfig = mappingConfig;
  return {
    softwareId: options.softwareId.trim(),
    ...(options.softwareVersion?.trim() ? { softwareVersion: options.softwareVersion.trim() } : {}),
    ...(options.updatedBy?.trim() ? { updatedBy: options.updatedBy.trim() } : {}),
    config,
  };
}
