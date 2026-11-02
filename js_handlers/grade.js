const { ipcMain, dialog, BrowserWindow } = require('electron');
const sql = require('mssql');
const { getPool } = require('../database');

const ID_PATTERN = /^\d{1,18}$/; // bigint IDs arrive from mssql as strings
const MAX_NAME_LENGTH = 200; // matches nvarchar(200)

function assertId(value) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new Error('Invalid id');
}

// Throws on tampered input; returns { reason } for ordinary user mistakes
function cleanFields(rawName, score) {
  if (typeof rawName !== 'string' || typeof score !== 'number') {
    throw new Error('Invalid grade data');
  }
  const name = rawName.trim();
  if (name.length > MAX_NAME_LENGTH) throw new Error('Assignment name too long');
  if (name.length === 0) return { reason: 'empty' };
  const valid =
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 200 &&
    Math.round(score * 100) / 100 === score; // at most 2 decimals
  if (!valid) return { reason: 'bad_score' };
  return { name, score };
}

function registerGradeHandlers() {
  ipcMain.handle('grades:getByClass', async (_event, classId) => {
    assertId(classId);
    const { recordset } = await getPool()
      .request()
      .input('classId', sql.BigInt, classId)
      .query(
        `SELECT g.GradeID, g.Assignment_Name, g.Score, c.CategoryID, c.Category_Name
         FROM dbo.Grade g
         JOIN dbo.Grade_Categories c ON c.CategoryID = g.CategoryID
         WHERE c.ClassID = @classId
         ORDER BY g.GradeID`
      );
    return recordset.map((r) => ({
      id: String(r.GradeID),
      name: r.Assignment_Name,
      score: Number(r.Score),
      categoryId: String(r.CategoryID),
      categoryName: r.Category_Name,
    }));
  });

  ipcMain.handle('grades:create', async (_event, categoryId, rawName, rawScore) => {
    assertId(categoryId);
    const fields = cleanFields(rawName, rawScore);
    if (fields.reason) return { saved: false, reason: fields.reason };

    try {
      // Only inserts if the category still exists
      const { recordset } = await getPool()
        .request()
        .input('categoryId', sql.BigInt, categoryId)
        .input('name', sql.NVarChar(MAX_NAME_LENGTH), fields.name)
        .input('score', sql.Decimal(5, 2), fields.score)
        .query(
          `INSERT INTO dbo.Grade (Assignment_Name, Score, CategoryID)
           OUTPUT INSERTED.GradeID
           SELECT @name, @score, @categoryId
           WHERE EXISTS (SELECT 1 FROM dbo.Grade_Categories WHERE CategoryID = @categoryId)`
        );
      if (recordset.length === 0) return { saved: false, reason: 'no_category' };
      return { saved: true, id: String(recordset[0].GradeID) };
    } catch (err) {
      console.error('Create grade failed:', err);
      throw new Error('Could not save the grade.');
    }
  });

  ipcMain.handle('grades:update', async (_event, gradeId, categoryId, rawName, rawScore) => {
    assertId(gradeId);
    assertId(categoryId);
    const fields = cleanFields(rawName, rawScore);
    if (fields.reason) return { saved: false, reason: fields.reason };

    try {
      // The new category must belong to the same class as the grade's current category
      const { recordset } = await getPool()
        .request()
        .input('id', sql.BigInt, gradeId)
        .input('categoryId', sql.BigInt, categoryId)
        .input('name', sql.NVarChar(MAX_NAME_LENGTH), fields.name)
        .input('score', sql.Decimal(5, 2), fields.score)
        .query(
          `UPDATE g
           SET g.Assignment_Name = @name, g.Score = @score, g.CategoryID = @categoryId
           OUTPUT INSERTED.GradeID
           FROM dbo.Grade g
           JOIN dbo.Grade_Categories oldc ON oldc.CategoryID = g.CategoryID
           JOIN dbo.Grade_Categories newc ON newc.CategoryID = @categoryId
                                         AND newc.ClassID = oldc.ClassID
           WHERE g.GradeID = @id`
        );
      if (recordset.length === 0) return { saved: false, reason: 'not_found' };
      return { saved: true };
    } catch (err) {
      console.error('Update grade failed:', err);
      throw new Error('Could not save the grade.');
    }
  });

  ipcMain.handle('grades:delete', async (event, gradeId) => {
    assertId(gradeId);

    const pool = getPool();
    const found = await pool
      .request()
      .input('id', sql.BigInt, gradeId)
      .query('SELECT Assignment_Name FROM dbo.Grade WHERE GradeID = @id');
    if (found.recordset.length === 0) return { deleted: false };

    const win = BrowserWindow.fromWebContents(event.sender);
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Yes, delete', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Delete grade',
      message: `Delete "${found.recordset[0].Assignment_Name}"?`,
      detail: 'This permanently deletes the grade.',
    });
    if (response !== 0) return { deleted: false };

    try {
      await pool
        .request()
        .input('id', sql.BigInt, gradeId)
        .query('DELETE FROM dbo.Grade WHERE GradeID = @id');
      return { deleted: true };
    } catch (err) {
      console.error('Delete grade failed:', err);
      throw new Error('Could not delete the grade.');
    }
  });
}

module.exports = { registerGradeHandlers };