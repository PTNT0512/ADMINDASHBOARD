require('dotenv').config();
const mongoose = require('mongoose');
const { normalizeMojibakeText } = require('../src/utils/telegram-bot-normalizer.js');

const args = process.argv.slice(2);
const shouldWrite = args.includes('--write');
const collectionArg = args.find((arg) => arg.startsWith('--collections='));
const includeCollections = collectionArg
  ? new Set(collectionArg.split('=')[1].split(',').map((item) => item.trim()).filter(Boolean))
  : null;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lasvegas';

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const normalizeDeep = (value) => {
  if (typeof value === 'string') return normalizeMojibakeText(value);
  if (Array.isArray(value)) return value.map(normalizeDeep);
  if (value instanceof Date) return value;
  if (!isPlainObject(value)) return value;

  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    normalized[key] = normalizeDeep(item);
  }
  return normalized;
};

const main = async () => {
  await mongoose.connect(mongoUri);
  console.log(`[encoding-db] Connected to ${mongoUri}`);

  const collections = await mongoose.connection.db.listCollections().toArray();
  const targets = collections
    .map((item) => item.name)
    .filter((name) => !name.startsWith('system.'))
    .filter((name) => !includeCollections || includeCollections.has(name));

  let totalDocs = 0;
  let changedDocs = 0;
  let writtenDocs = 0;

  for (const name of targets) {
    const collection = mongoose.connection.db.collection(name);
    const cursor = collection.find({});
    let collectionTotal = 0;
    let collectionChanged = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      totalDocs += 1;
      collectionTotal += 1;

      const normalized = normalizeDeep(doc);
      if (JSON.stringify(normalized) === JSON.stringify(doc)) continue;

      changedDocs += 1;
      collectionChanged += 1;

      if (shouldWrite) {
        await collection.replaceOne({ _id: doc._id }, normalized);
        writtenDocs += 1;
      }
    }

    console.log(`[encoding-db] ${name}: scanned=${collectionTotal}, changed=${collectionChanged}, mode=${shouldWrite ? 'write' : 'dry-run'}`);
  }

  console.log(`[encoding-db] done scanned=${totalDocs}, changed=${changedDocs}, written=${writtenDocs}, mode=${shouldWrite ? 'write' : 'dry-run'}`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('[encoding-db] failed:', error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
