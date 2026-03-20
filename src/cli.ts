#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DataConvClient } from './DataConvClient.js';

type CliOptions = {
  baseUrl: string;
  serviceDid?: string;
  issuerDid: string;
  tenantId: string;
  jurisdiction: string;
  sector: string;
  softwareId: string;
  resourceType: string;
  file: string;
  outputJson: string;
  idToken?: string;
  vpToken?: string;
  authorizationBearer?: string;
  resolvedBaseUrl?: string;
  retryTimes?: number;
  retryDelayMs?: number;
  debug?: boolean;
};

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }
  return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function requireArg(args: string[], flag: string): string {
  const value = getArgValue(args, flag);
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing required argument ${flag}`);
  }
  return value;
}

function usage(): string {
  return [
    'Usage:',
    '  dataconv-client (--base-url <url> | --service-did <did>) --tenant-id <tenant> --software-id <software> --file <xlsx> --issuer-did <did> [options]',
    '',
    'Required:',
    '  --base-url <url>            Direct service URL',
    '  --service-did <did>         Logical service DID',
    '  --tenant-id <tenant>',
    '  --software-id <software>',
    '  --file <path>',
    '  --issuer-did <did>',
    '',
    'Optional:',
    '  --resolved-base-url <url>   Local resolution target for --service-did',
    '  --jurisdiction <code>        Default: ES',
    '  --sector <sector>            Default: onehealth-research',
    '  --resource-type <type>       Default: Composition',
    '  --output-json <path>         Default: ./artifacts/dataconv-upload-response.json',
    '  --authorization-bearer <t>   Bearer token header value',
    '  --id-token <jwt>',
    '  --vp-token <jwt>',
    '  --retry-times <n>            Default: 60',
    '  --retry-delay-ms <n>         Default: 2000',
    '  --debug                      Print resolved raw endpoint',
    '  --help'
  ].join('\n');
}

function resolveBaseUrl(
  serviceDid: string | undefined,
  explicitBaseUrl: string | undefined,
  resolvedBaseUrl: string | undefined
): string {
  const baseUrl = String(explicitBaseUrl || '').trim();
  if (baseUrl) {
    return baseUrl;
  }

  const did = String(serviceDid || '').trim();
  const directResolvedBaseUrl = String(resolvedBaseUrl || '').trim();
  if (did && directResolvedBaseUrl) {
    return directResolvedBaseUrl;
  }

  const rawMap = String(process.env.DATACONV_SERVICE_DID_MAP || '').trim();
  if (did && rawMap) {
    try {
      const parsed = JSON.parse(rawMap) as Record<string, unknown>;
      const mapped = String(parsed[did] || '').trim();
      if (mapped) {
        return mapped;
      }
    } catch {
      throw new Error('DATACONV_SERVICE_DID_MAP must be valid JSON');
    }
  }

  throw new Error('Provide --base-url, or use --service-did together with --resolved-base-url or DATACONV_SERVICE_DID_MAP');
}

function parseArgs(argv: string[]): CliOptions {
  if (hasFlag(argv, '--help')) {
    console.log(usage());
    process.exit(0);
  }

  const serviceDid = getArgValue(argv, '--service-did');
  const baseUrl = getArgValue(argv, '--base-url');
  const resolvedBaseUrl = getArgValue(argv, '--resolved-base-url');

  return {
    baseUrl: resolveBaseUrl(serviceDid, baseUrl, resolvedBaseUrl),
    serviceDid: serviceDid || undefined,
    issuerDid: requireArg(argv, '--issuer-did'),
    tenantId: requireArg(argv, '--tenant-id'),
    softwareId: requireArg(argv, '--software-id'),
    file: requireArg(argv, '--file'),
    jurisdiction: getArgValue(argv, '--jurisdiction') || 'ES',
    sector: getArgValue(argv, '--sector') || 'onehealth-research',
    resourceType: getArgValue(argv, '--resource-type') || 'Composition',
    outputJson: getArgValue(argv, '--output-json') || './artifacts/dataconv-upload-response.json',
    authorizationBearer: getArgValue(argv, '--authorization-bearer'),
    resolvedBaseUrl: resolvedBaseUrl || undefined,
    idToken: getArgValue(argv, '--id-token'),
    vpToken: getArgValue(argv, '--vp-token'),
    retryTimes: Number(getArgValue(argv, '--retry-times') || 60),
    retryDelayMs: Number(getArgValue(argv, '--retry-delay-ms') || 2000),
    debug: hasFlag(argv, '--debug')
  };
}

function toKilobytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function buildUploadUrl(options: CliOptions): string {
  return `${options.baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(options.tenantId)}/cds-${encodeURIComponent(options.jurisdiction)}/v1/${encodeURIComponent(options.sector)}/digitaltwin/${encodeURIComponent(options.softwareId)}/${encodeURIComponent(options.resourceType)}/_upload`;
}

function buildPollingUrl(options: CliOptions, thid: string): string {
  return `${options.baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(options.tenantId)}/cds-${encodeURIComponent(options.jurisdiction)}/v1/${encodeURIComponent(options.sector)}/digitaltwin/${encodeURIComponent(options.softwareId)}/${encodeURIComponent(options.resourceType)}/_upload-response?thid=${encodeURIComponent(thid)}`;
}

function buildDisplayBase(options: CliOptions): string {
  if (options.serviceDid) {
    return options.serviceDid;
  }
  return options.baseUrl;
}

function buildDisplayUploadUrl(options: CliOptions): string {
  return `${buildDisplayBase(options).replace(/\/+$/, '')}/${encodeURIComponent(options.tenantId)}/cds-${encodeURIComponent(options.jurisdiction)}/v1/${encodeURIComponent(options.sector)}/digitaltwin/${encodeURIComponent(options.softwareId)}/${encodeURIComponent(options.resourceType)}/_upload`;
}

function buildDisplayPollingUrl(options: CliOptions, thid: string): string {
  return `${buildDisplayBase(options).replace(/\/+$/, '')}/${encodeURIComponent(options.tenantId)}/cds-${encodeURIComponent(options.jurisdiction)}/v1/${encodeURIComponent(options.sector)}/digitaltwin/${encodeURIComponent(options.softwareId)}/${encodeURIComponent(options.resourceType)}/_upload-response?thid=${encodeURIComponent(thid)}`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const fileBytes = new Uint8Array(await readFile(options.file));
  const fileName = path.basename(options.file);

  const client = new DataConvClient({
    issuerDid: options.issuerDid,
    alternateName: options.tenantId,
    tenantId: options.tenantId,
    jurisdiction: options.jurisdiction,
    sector: options.sector,
    baseUrl: options.baseUrl,
    retryTimes: options.retryTimes,
    retryDelayMs: options.retryDelayMs,
    idToken: options.idToken ?? options.authorizationBearer,
    vpToken: options.vpToken
  });

  if (options.serviceDid) {
    console.log(`Service DID: ${options.serviceDid}`);
  }
  if (!options.serviceDid || options.debug) {
    console.log(`Base URL: ${options.baseUrl}`);
  }
  console.log(`Tenant ID: ${options.tenantId}`);
  console.log(`Software ID: ${options.softwareId}`);
  console.log(`Resource type: ${options.resourceType}`);
  console.log(`Excel file: ${options.file}`);
  console.log(`Excel size: ${toKilobytes(fileBytes.byteLength)}`);
  console.log(`Upload request: POST ${buildDisplayUploadUrl(options)}`);

  const uploadResult = await client.uploadWithFile({
    softwareId: options.softwareId,
    resourceType: options.resourceType,
    fileBytes,
    fileName,
    idToken: options.idToken ?? options.authorizationBearer,
    vpToken: options.vpToken
  });

  console.log(`Upload response Location: ${uploadResult.location || '(missing)'}`);
  console.log(`Upload thid: ${uploadResult.thid}`);
  console.log(`Polling request: POST ${buildDisplayPollingUrl(options, uploadResult.thid)}`);

  const response = await client.pollUploadResponse({
    softwareId: options.softwareId,
    resourceType: options.resourceType,
    thid: uploadResult.thid,
    idToken: options.idToken ?? options.authorizationBearer,
    vpToken: options.vpToken
  });

  const outputPath = path.resolve(options.outputJson);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(response, null, 2), 'utf-8');

  const diagnostic = client.getMainDiagnosticInfoByResponse(response) || '';
  console.log(`Polling response saved: ${outputPath}`);
  console.log(`Response thid: ${String(response.thid || '')}`);
  console.log(`Main diagnostic info: ${diagnostic}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
