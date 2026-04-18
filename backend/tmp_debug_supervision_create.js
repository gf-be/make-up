const pool = require('./config/database');
const {
  parseFlightInspectionText,
  replaceFlightInspectionDetails
} = require('./utils/flightInspectionAttachmentParser');
const {
  syncCompaniesFromFlightInspectionDetails
} = require('./utils/companySamplingSync');
const {
  replaceUnqualifiedProductsFromFlightInspectionDetails
} = require('./utils/unqualifiedProducts');

async function main() {
  let connection;

  try {
    const row = parseFlightInspectionText('validation content only');
    const rawRows = row ? [{ ...row, sequence_no: 1 }] : [];
    const detailRows = rawRows.filter((item) => String(item?.company_name || '').trim()).map((item, index) => ({
      ...item,
      sequence_no: index + 1
    }));

    const payload = {
      title: 'tmp validation',
      company_name: null,
      production_license_no: null,
      company_address: null,
      supervision_date: '2026-04-17',
      publish_date: '2026-04-17',
      supervision_unit: null,
      inspection_basis: null,
      defects_and_problems: null,
      handling_measures: null,
      attachment_path: null,
      attachment_name: null,
      region: null,
      level: 'national',
      supervision_type: 'flight',
      product_type: 'cosmetics',
      announcement_type: 'flight_inspection',
      source_detail_url: null,
      source_page: null,
      source_json_file: null,
      content: 'validation content only',
      rectification_deadline: null,
      status: 'ongoing',
      source: 'debug'
    };

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const sql = `
      INSERT INTO supervisions (
        title, company_name, production_license_no, company_address,
        supervision_date, publish_date, supervision_unit, inspection_basis,
        defects_and_problems, handling_measures, attachment_path, attachment_name,
        region, level, supervision_type, product_type, announcement_type,
        source_detail_url, source_page, source_json_file,
        content, rectification_deadline, status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.query(sql, [
      payload.title,
      payload.company_name,
      payload.production_license_no,
      payload.company_address,
      payload.supervision_date,
      payload.publish_date,
      payload.supervision_unit,
      payload.inspection_basis,
      payload.defects_and_problems,
      payload.handling_measures,
      payload.attachment_path,
      payload.attachment_name,
      payload.region,
      payload.level,
      payload.supervision_type,
      payload.product_type,
      payload.announcement_type,
      payload.source_detail_url,
      payload.source_page,
      payload.source_json_file,
      payload.content,
      payload.rectification_deadline,
      payload.status,
      payload.source
    ]);

    console.log('insert ok', result.insertId);
    await replaceFlightInspectionDetails(connection, result.insertId, detailRows);
    console.log('details ok', detailRows.length);
    const companyResult = await syncCompaniesFromFlightInspectionDetails(connection, result.insertId);
    console.log('companies ok', JSON.stringify(companyResult));
    const unqualifiedResult = await replaceUnqualifiedProductsFromFlightInspectionDetails(connection, result.insertId);
    console.log('unqualified ok', JSON.stringify(unqualifiedResult));

    await connection.rollback();
    console.log('rollback ok');
  } catch (error) {
    console.error('SCRIPT_ERROR', error);
    if (connection) {
      await connection.rollback();
    }
    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

main();
