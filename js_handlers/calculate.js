const { ipcMain } = require('electron');
const sql = require('mssql');
const { getPool } = require('../database');

const ID_PATTERN = /^\d{1,18}$/; // bigint IDs arrive from mssql as strings

function registerCalculateHandlers() {
  ipcMain.handle('calculate:final', async (_event, classId) => {
    if (typeof classId !== 'string' || !ID_PATTERN.test(classId)) {
      throw new Error('Invalid class id');
    }

    try {
      // One query, one consistent snapshot: category count, total weight, and weighted grade.
      // A category with no grades has no average, so it counts as 0.
      const { recordset } = await getPool()
        .request()
        .input('classId', sql.BigInt, classId)
        .query(
          `SELECT COUNT(*) AS category_count,
                  COALESCE(SUM(c.Percentage), 0) AS total_weight,
                  COALESCE(SUM(c.Percentage * COALESCE(a.avg_score, 0)), 0) / 100 AS final_grade
           FROM dbo.Grade_Categories c
           OUTER APPLY (
             SELECT CAST(AVG(g.Score) AS decimal(12, 6)) AS avg_score
             FROM dbo.Grade g
             WHERE g.CategoryID = c.CategoryID
           ) a
           WHERE c.ClassID = @classId`
        );

      const row = recordset[0];
      if (Number(row.category_count) === 0) return { calculated: false, reason: 'no_categories' };

      // Compare in whole hundredths so decimals can't cause a false mismatch
      const totalHundredths = Math.round(Number(row.total_weight) * 100);
      if (totalHundredths !== 10000) {
        return { calculated: false, reason: 'weights', total: totalHundredths / 100 };
      }

      return { calculated: true, grade: Math.round(Number(row.final_grade) * 100) / 100 };
    } catch (err) {
      console.error('Calculate failed:', err);
      throw new Error('Could not calculate the grade.');
    }
  });
}

module.exports = { registerCalculateHandlers };