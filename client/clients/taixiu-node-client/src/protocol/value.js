const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

function normalizeLong(value) {
  if (typeof value !== "bigint") {
    return value;
  }
  if (value <= MAX_SAFE_BIGINT && value >= MIN_SAFE_BIGINT) {
    return Number(value);
  }
  return value.toString();
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

module.exports = {
  normalizeLong,
  parseJsonSafe
};
