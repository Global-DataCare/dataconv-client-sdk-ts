#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_DIR}"

if [[ -f ".env.local" ]]; then
  set -a
  source .env.local
  set +a
elif [[ -f ".env.example" ]]; then
  set -a
  source .env.example
  set +a
fi

export DATACONV_DATASPACE_NAME="${DATACONV_DATASPACE_NAME:-GLOBAL-DATACARE}"
export DATACONV_EXCHANGE_SCOPE="${DATACONV_EXCHANGE_SCOPE:-excel/_upload Subject/_search ChargeItem/_search DocumentReference/_search}"
export DATACONV_PUBLICACION_INPUT_XLSX="${DATACONV_PUBLICACION_INPUT_XLSX:-${DATACONV_DEMO_INPUT_XLSX:-../examples/no-embedded/Qvet-api-config.xlsx}}"
export DATACONV_PUBLICACION_MAPPING_JSON="${DATACONV_PUBLICACION_MAPPING_JSON:-}"
export DATACONV_PUBLICACION_HEADER_ROW_INDEX="${DATACONV_PUBLICACION_HEADER_ROW_INDEX:-1}"
export DATACONV_PROMOTION_MODE="${DATACONV_PROMOTION_MODE:-patch}"
# softwareId controla cómo se procesa el xlsx:
#   api-config  → el xlsx lleva filas API-CONFIG embebidas que definen el fieldMap (recomendado)
#   qvet        → usa el preset qvet-v1.json del servidor (personal_id=CHIP)
# Normalmente se hereda de DATACONV_DATASPACE_PROFILES o de ~/.dataconv/state.json

if [[ -z "${DATACONV_ID_TOKEN:-}" ]]; then
  DATACONV_ID_TOKEN="$(node -e 'const h=Buffer.from(JSON.stringify({alg:"none",typ:"JWT"})).toString("base64url");const p=Buffer.from(JSON.stringify({email:"admin@example.com"})).toString("base64url");console.log(`${h}.${p}.`);')"
  export DATACONV_ID_TOKEN
fi

OUT_DIR="./artifacts/evidencia-publicacion"
mkdir -p "${OUT_DIR}"

if [[ ! -f "dist/cli.js" ]]; then
  npm run build
fi

if [[ ! -f "${DATACONV_PUBLICACION_INPUT_XLSX}" ]]; then
  echo "ERROR: No se encontró el archivo de entrada: ${DATACONV_PUBLICACION_INPUT_XLSX}"
  echo "  Define DATACONV_PUBLICACION_INPUT_XLSX o DATACONV_DEMO_INPUT_XLSX apuntando a un .xlsx válido."
  exit 1
fi

echo "[1/7] Login"
node dist/cli.js login --id-token "${DATACONV_ID_TOKEN}"

echo "[2/7] Exchange (scopes por acción)"
node dist/cli.js exchange --scope "${DATACONV_EXCHANGE_SCOPE}"

UPLOAD_ARGS=("${DATACONV_PUBLICACION_INPUT_XLSX}" "--output-json" "${OUT_DIR}/upload-response.json")
if [[ -n "${DATACONV_PUBLICACION_MAPPING_JSON}" ]]; then
  if [[ ! -f "${DATACONV_PUBLICACION_MAPPING_JSON}" ]]; then
    echo "ERROR: DATACONV_PUBLICACION_MAPPING_JSON apunta a un archivo inexistente: ${DATACONV_PUBLICACION_MAPPING_JSON}"
    exit 1
  fi
  UPLOAD_ARGS+=("--mapping-json" "${DATACONV_PUBLICACION_MAPPING_JSON}" "--header-row-index" "${DATACONV_PUBLICACION_HEADER_ROW_INDEX}")
fi

echo "[3/7] Publicación / actualización de dataset (upload + polling)"
node dist/cli.js upload "${UPLOAD_ARGS[@]}"

UPLOAD_THID="$(node -e "try{const r=require('./${OUT_DIR}/upload-response.json');console.log(r.thid||'')}catch{console.log('')}")"
if [[ -z "${UPLOAD_THID}" ]]; then
  echo "WARN: No se pudo extraer thid del upload-response; omitiendo paso de promoción (patch/batch)."
else
  case "${DATACONV_PROMOTION_MODE}" in
    patch)
      echo "[4/7] Patch de confirmación de dataset (thid=${UPLOAD_THID})"
      node dist/cli.js patch --thid "${UPLOAD_THID}" --output-json "${OUT_DIR}/patch-response.json"
      ;;
    batch)
      echo "[4/7] Batch de confirmación de dataset (thid=${UPLOAD_THID})"
      node dist/cli.js batch --thid "${UPLOAD_THID}" --output-json "${OUT_DIR}/batch-response.json"
      ;;
    *)
      echo "ERROR: DATACONV_PROMOTION_MODE inválido: ${DATACONV_PROMOTION_MODE}. Usa patch o batch."
      exit 1
      ;;
  esac
fi

echo "[5/7] Search Subject"
node dist/cli.js search --resource-type Subject --output-json "${OUT_DIR}/search-subject.json"

echo "[6/7] Search DocumentReference"
node dist/cli.js search --resource-type DocumentReference --output-json "${OUT_DIR}/search-documentreference.json"

echo "[7/7] Extraer metadatos DCAT-AP publicados (si existen en respuestas)"
node - <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const outDir = path.resolve('artifacts/evidencia-publicacion');
const sources = [
  path.join(outDir, 'upload-response.json'),
  path.join(outDir, 'search-subject.json'),
  path.join(outDir, 'search-documentreference.json')
];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function visit(node, found) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item, found);
    return;
  }

  const ctx = node['@context'];
  const type = node['@type'];
  const isDcat =
    (typeof ctx === 'string' && ctx.includes('w3.org/ns/dcat')) ||
    (Array.isArray(ctx) && ctx.some((item) => typeof item === 'string' && item.includes('w3.org/ns/dcat'))) ||
    (typeof type === 'string' && type.toLowerCase().includes('dcat:'));

  if (isDcat) {
    found.push(node);
  }

  for (const value of Object.values(node)) {
    visit(value, found);
  }
}

const found = [];
for (const filePath of sources) {
  const data = readJson(filePath);
  if (data) visit(data, found);
}

const target = path.join(outDir, 'dcat-ap-datasets-publicados.json');
const payload = {
  generatedAt: new Date().toISOString(),
  totalDatasets: found.length,
  datasets: found
};
fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
console.log(`DCAT extract generado: ${target} (datasets=${found.length})`);
NODE

echo "Evidencias generadas en ${OUT_DIR}"
