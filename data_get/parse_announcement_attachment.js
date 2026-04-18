const path = require('path');
const { parseAnnouncementAttachment } = require('../backend/utils/announcementAttachmentParser');
const { parseFlightInspectionAttachment } = require('../backend/utils/flightInspectionAttachmentParser');

function chooseBetterResult(primaryResult = {}, fallbackResult = {}) {
  const primaryCount = Number(primaryResult?.parsedCount || 0);
  const fallbackCount = Number(fallbackResult?.parsedCount || 0);

  if (fallbackCount > primaryCount) {
    return fallbackResult;
  }

  if (primaryCount > 0) {
    return primaryResult;
  }

  if (!primaryResult?.supported && fallbackResult?.supported) {
    return fallbackResult;
  }

  return primaryResult;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('请传入附件文件路径');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  const samplingResult = await parseAnnouncementAttachment(absolutePath);
  let result = samplingResult;

  if (Number(samplingResult?.parsedCount || 0) <= 0) {
    const flightResult = await parseFlightInspectionAttachment(absolutePath);
    result = chooseBetterResult(samplingResult, flightResult);
  }

  process.stdout.write(JSON.stringify({
    file_path: absolutePath,
    supported: result.supported,
    attachment_type: result.attachment_type,
    parsedCount: result.parsedCount,
    counterfeitCount: result.counterfeitCount || 0,
    message: result.message,
    rows: result.rows,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
