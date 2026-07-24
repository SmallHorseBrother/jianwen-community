import fs from 'node:fs';
import path from 'node:path';

const CONTENT_FIELDS = [
  '需求名称',
  '需求描述',
  '验收标准',
  '附件',
  '原始群聊消息',
  '项目Key',
  'AI执行项目路径',
];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasContent(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function snapshotFile(snapshotDir, recordId) {
  const fileName = Buffer.from(String(recordId), 'utf8').toString('base64url');
  return path.join(snapshotDir, `${fileName}.json`);
}

function readSnapshotFile(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return value?.recordId ? value : null;
  } catch {
    return null;
  }
}

function writeSnapshotFile(filePath, snapshot) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

export function mergeRecordWithSnapshot(record, snapshot) {
  if (!snapshot) return record;
  const merged = { ...record };
  for (const field of CONTENT_FIELDS) {
    if (hasContent(merged[field])) continue;
    const fallback = snapshot.content?.[field] ?? snapshot.originalContent?.[field];
    if (hasContent(fallback)) merged[field] = clone(fallback);
  }
  return merged;
}

export function upsertTaskSnapshots(snapshotDir, records) {
  return records.map((record) => {
    const recordId = record?._recordId;
    if (!recordId) return record;

    const filePath = snapshotFile(snapshotDir, recordId);
    const previous = readSnapshotFile(filePath);
    const originalContent = { ...(previous?.originalContent || {}) };
    const content = { ...(previous?.content || {}) };

    for (const field of CONTENT_FIELDS) {
      if (!hasContent(record[field])) continue;
      if (!hasContent(originalContent[field])) originalContent[field] = clone(record[field]);
      content[field] = clone(record[field]);
    }

    const latestRecord = clone(record);
    delete latestRecord._row;
    const now = new Date().toISOString();
    const snapshot = {
      version: 1,
      recordId,
      firstSeenAt: previous?.firstSeenAt || now,
      lastSeenAt: now,
      originalContent,
      content,
      latestRecord,
    };
    writeSnapshotFile(filePath, snapshot);
    return mergeRecordWithSnapshot(record, snapshot);
  });
}

export function listTaskSnapshotRecords(snapshotDir) {
  if (!fs.existsSync(snapshotDir)) return [];
  return fs
    .readdirSync(snapshotDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readSnapshotFile(path.join(snapshotDir, name)))
    .filter(Boolean)
    .map((snapshot) => mergeRecordWithSnapshot(
      { ...snapshot.latestRecord, _recordId: snapshot.recordId },
      snapshot,
    ));
}
