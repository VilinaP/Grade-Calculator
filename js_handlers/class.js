const { ipcMain, dialog, BrowserWindow } = require('electron');
const sql = require('mssql');
const { getPool } = require('../database');

const ID_PATTERN = /^\d{1,18}$/; // bigint IDs arrive from mssql as strings
const MAX_NAME_LENGTH = 200; // matches nvarchar(200) in the Class table

function registerClassHandlers() {
  ipcMain.handle('classes:getAll', async () => {
    const { recordset } = await getPool()
      .request()
      .query('SELECT ClassID, Class_Name FROM dbo.Class ORDER BY Class_Name');
    return recordset.map((r) => ({ id: String(r.ClassID), name: r.Class_Name }));
  });

  ipcMain.handle('classes:create', async (_event, rawName) => {
    if (typeof rawName !== 'string') throw new Error('Invalid class name');
    const name = rawName.trim();
    if (name.length === 0) return { created: false, reason: 'empty' };
    if (name.length > MAX_NAME_LENGTH) throw new Error('Class name too long');

    try {
      // One statement: only inserts if no class with this name exists yet
      const { recordset } = await getPool()
        .request()
        .input('name', sql.NVarChar(MAX_NAME_LENGTH), name)
        .query(
          `INSERT INTO dbo.Class (Class_Name)
           OUTPUT INSERTED.ClassID
           SELECT @name
           WHERE NOT EXISTS (SELECT 1 FROM dbo.Class WHERE Class_Name = @name)`
        );
      if (recordset.length === 0) return { created: false, reason: 'duplicate' };
      return { created: true, id: String(recordset[0].ClassID) };
    } catch (err) {
      console.error('Create class failed:', err);
      throw new Error('Could not create the class.');
    }
  });

  ipcMain.handle('classes:delete', async (event, classId) => {
    if (typeof classId !== 'string' || !ID_PATTERN.test(classId)) {
      throw new Error('Invalid class id');
    }

    const pool = getPool();
    const found = await pool
      .request()
      .input('id', sql.BigInt, classId)
      .query('SELECT Class_Name FROM dbo.Class WHERE ClassID = @id');
    if (found.recordset.length === 0) return { deleted: false };

    const win = BrowserWindow.fromWebContents(event.sender);
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Yes, delete', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Delete class',
      message: `Delete "${found.recordset[0].Class_Name}"?`,
      detail: 'This permanently deletes the class, all of its grade categories, and all of its grades.',
    });
    if (response !== 0) return { deleted: false };

    try {
      await pool
        .request()
        .input('id', sql.BigInt, classId)
        .query('DELETE FROM dbo.Class WHERE ClassID = @id'); // cascades to categories and grades
      return { deleted: true };
    } catch (err) {
      console.error('Delete class failed:', err);
      throw new Error('Could not delete the class.');
    }
  });
}

module.exports = { registerClassHandlers };