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
  await pool.request().query(`
    IF OBJECT_ID('notes') IS NULL
    CREATE TABLE notes (
      id   INT IDENTITY(1,1) PRIMARY KEY,
      text NVARCHAR(500) NOT NULL
    )`);
}

async function listNotes() {
  const { recordset } = await pool.request().query('SELECT * FROM notes');
  return recordset;
}

async function addNote(text) {
  await pool
    .request()
    .input('text', sql.NVarChar(500), text)
    .query('INSERT INTO notes (text) VALUES (@text)');
}

module.exports = { connect, listNotes, addNote };