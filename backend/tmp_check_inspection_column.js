const pool = require('./config/database');

(async () => {
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM inspection_details LIKE 'inspection_standard'");
    console.log(JSON.stringify(rows[0] || null));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
