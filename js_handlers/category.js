const { ipcMain, dialog, BrowserWindow } = require('electron');
const sql = require('mssql');
const { getPool } = require('../database');

const ID_PATTERN = /^\d{1,18}$/; // bigint IDs arrive from mssql as strings
const MAX_NAME_LENGTH = 200; // matches nvarchar(200)

function assertId(value) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new Error('Invalid id');
}

function cleanFields(rawName, percentage) {
  if (typeof rawName !== 'string' || typeof percentage !== 'number') {
    throw new Error('Invalid category data');
  }
  const name = rawName.trim();
  if (name.length > MAX_NAME_LENGTH) throw new Error('Category name too long');
  if (name.length === 0) return { reason: 'empty' };
  const valid =
    Number.isFinite(percentage) &&
    percentage >= 0 &&
    percentage <= 100 &&
    Math.round(percentage * 100) / 100 === percentage; // at most 2 decimals
  if (!valid) return { reason: 'bad_percentage' };
  return { name, percentage };
}

function toResult(row) {
  switch (row.status) {
    case 'ok':
      return { saved: true, id: row.id === undefined ? undefined : String(row.id) };
    case 'over':
      return { saved: false, reason: 'over', remaining: Number((100 - row.used).toFixed(2)) };
    default:
      return { saved: false, reason: row.status }; 
  }
}

function registerCategoryHandlers() {
  ipcMain.handle('categories:getByClass', async (_event, classId) => {
    assertId(classId);
    const { recordset } = await getPool()
      .request()
      .input('classId', sql.BigInt, classId)
      .query(
        `SELECT CategoryID, Category_Name, Percentage
         FROM dbo.Grade_Categories
         WHERE ClassID = @classId
         ORDER BY Category_Name`
      );
    return recordset.map((r) => ({
      id: String(r.CategoryID),
      name: r.Category_Name,
      percentage: Number(r.Percentage),
    }));
  });

  ipcMain.handle('categories:create', async (_event, classId, rawName, rawPercentage) => {
    assertId(classId);
    const fields = cleanFields(rawName, rawPercentage);
    if (fields.reason) return { saved: false, reason: fields.reason };

    try {
      const { recordset } = await getPool()
        .request()
        .input('classId', sql.BigInt, classId)
        .input('name', sql.NVarChar(MAX_NAME_LENGTH), fields.name)
        .input('pct', sql.Decimal(5, 2), fields.percentage)
        .query(
          `SET XACT_ABORT ON;
           BEGIN TRAN;
           DECLARE @used decimal(7,2);
           IF NOT EXISTS (SELECT 1 FROM dbo.Class WITH (UPDLOCK, HOLDLOCK) WHERE ClassID = @classId)
           BEGIN
             SELECT 'no_class' AS status;
           END
           ELSE IF EXISTS (SELECT 1 FROM dbo.Grade_Categories
                           WHERE ClassID = @classId AND Category_Name = @name)
           BEGIN
             SELECT 'duplicate' AS status;
           END
           ELSE
           BEGIN
             SET @used = (SELECT COALESCE(SUM(Percentage), 0)
                          FROM dbo.Grade_Categories WHERE ClassID = @classId);
             IF @used + @pct > 100
               SELECT 'over' AS status, @used AS used;
             ELSE
             BEGIN
               INSERT INTO dbo.Grade_Categories (Category_Name, Percentage, ClassID)
               VALUES (@name, @pct, @classId);
               SELECT 'ok' AS status, CAST(SCOPE_IDENTITY() AS bigint) AS id;
             END
           END
           COMMIT;`
        );
      return toResult(recordset[0]);
    } catch (err) {
      console.error('Create category failed:', err);
      throw new Error('Could not save the category.');
    }
  });

  ipcMain.handle('categories:update', async (_event, categoryId, rawName, rawPercentage) => {
    assertId(categoryId);
    const fields = cleanFields(rawName, rawPercentage);
    if (fields.reason) return { saved: false, reason: fields.reason };

    try {
      const { recordset } = await getPool()
        .request()
        .input('id', sql.BigInt, categoryId)
        .input('name', sql.NVarChar(MAX_NAME_LENGTH), fields.name)
        .input('pct', sql.Decimal(5, 2), fields.percentage)
        .query(
          `SET XACT_ABORT ON;
           DECLARE @classId bigint = (SELECT ClassID FROM dbo.Grade_Categories WHERE CategoryID = @id);
           DECLARE @used decimal(7,2);
           IF @classId IS NULL
           BEGIN
             SELECT 'not_found' AS status;
           END
           ELSE
           BEGIN
             BEGIN TRAN;
             SELECT @classId = ClassID FROM dbo.Class WITH (UPDLOCK, HOLDLOCK) WHERE ClassID = @classId;
             IF EXISTS (SELECT 1 FROM dbo.Grade_Categories
                        WHERE ClassID = @classId AND Category_Name = @name AND CategoryID <> @id)
             BEGIN
               SELECT 'duplicate' AS status;
             END
             ELSE
             BEGIN
               SET @used = (SELECT COALESCE(SUM(Percentage), 0)
                            FROM dbo.Grade_Categories
                            WHERE ClassID = @classId AND CategoryID <> @id);
               IF @used + @pct > 100
                 SELECT 'over' AS status, @used AS used;
               ELSE
               BEGIN
                 UPDATE dbo.Grade_Categories
                 SET Category_Name = @name, Percentage = @pct
                 WHERE CategoryID = @id;
                 SELECT 'ok' AS status;
               END
             END
             COMMIT;
           END`
        );
      return toResult(recordset[0]);
    } catch (err) {
      console.error('Update category failed:', err);
      throw new Error('Could not save the category.');
    }
  });

  ipcMain.handle('categories:delete', async (event, categoryId) => {
    assertId(categoryId);

    const pool = getPool();
    const found = await pool
      .request()
      .input('id', sql.BigInt, categoryId)
      .query('SELECT Category_Name FROM dbo.Grade_Categories WHERE CategoryID = @id');
    if (found.recordset.length === 0) return { deleted: false };

    const win = BrowserWindow.fromWebContents(event.sender);
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Yes, delete', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Delete category',
      message: `Delete "${found.recordset[0].Category_Name}"?`,
      detail: 'This permanently deletes the category and all of its grades.',
    });
    if (response !== 0) return { deleted: false };

    try {
      await pool
        .request()
        .input('id', sql.BigInt, categoryId)
        .query('DELETE FROM dbo.Grade_Categories WHERE CategoryID = @id'); // cascades to grades
      return { deleted: true };
    } catch (err) {
      console.error('Delete category failed:', err);
      throw new Error('Could not delete the category.');
    }
  });
}

module.exports = { registerCategoryHandlers };