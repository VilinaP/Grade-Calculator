const sql = require('mssql');

// don't push on github, database connection
const config = {
  server: 'localhost',
  port: 1433,
  database: 'Grade_Calculator',
  user: 'sa',
  password: process.env.DB_PASSWORD || 'YourPassword',
  options: { encrypt: true, trustServerCertificate: true },
};

let pool;

async function connect() {
  pool = await sql.connect(config);
}

function getPool() {
  if (!pool) throw new Error('Database not connected');
  return pool;
}

module.exports = { connect, getPool };