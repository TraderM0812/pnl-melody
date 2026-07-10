/*
  report-parser.js
  Parses an MT4/MT5 "Trade History Report" (.html export) entirely in the
  browser and returns an array of per-trade PnL percentages, ordered oldest
  to newest, computed as profit / balance-before-trade * 100.

  MT5 exports this file as UTF-16LE with a BOM, so we decode the raw bytes
  ourselves rather than relying on FileReader's text mode.
*/

function decodeReportBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  const hasBOM_LE = bytes[0] === 0xFF && bytes[1] === 0xFE;
  const hasBOM_BE = bytes[0] === 0xFE && bytes[1] === 0xFF;
  try {
    if (hasBOM_LE) return new TextDecoder('utf-16le').decode(buffer);
    if (hasBOM_BE) return new TextDecoder('utf-16be').decode(buffer);
    return new TextDecoder('utf-8').decode(buffer);
  } catch (e) {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function cellsOf(row) {
  return Array.from(row.querySelectorAll('td,th')).map(c => c.textContent.trim());
}

function toNumber(str) {
  if (!str) return NaN;
  return parseFloat(str.replace(/\u00A0/g, '').replace(/\s/g, ''));
}

/**
 * @param {string} html - decoded report HTML
 * @returns {{pnlPercents: number[], tradeCount: number, accountName: string}}
 */
function parseMT5Report(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('tr'));

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = cellsOf(rows[i]);
    if (cells.includes('Direction') && cells.includes('Balance') && cells[0] === 'Time') {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error('Không tìm thấy bảng "Deals" trong báo cáo. Đây có phải file ReportHistory từ MT4/MT5 không?');
  }

  const header = cellsOf(rows[headerIdx]);
  const directionIdx = header.indexOf('Direction');
  const profitIdx = header.indexOf('Profit');
  const balanceIdx = header.indexOf('Balance');

  const pnlPercents = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = cellsOf(rows[i]);
    if (cells.length <= Math.max(directionIdx, profitIdx, balanceIdx)) break;
    const direction = cells[directionIdx];
    if (direction !== 'in' && direction !== 'out' && direction !== '') break;
    if (direction === 'out') {
      const profit = toNumber(cells[profitIdx]);
      const balance = toNumber(cells[balanceIdx]);
      if (!isNaN(profit) && !isNaN(balance)) {
        const priorBalance = balance - profit;
        if (priorBalance !== 0) {
          pnlPercents.push((profit / priorBalance) * 100);
        }
      }
    }
  }

  let accountName = '';
  const nameRow = rows.find(r => cellsOf(r)[0] === 'Name:');
  if (nameRow) accountName = cellsOf(nameRow)[1] || '';

  return { pnlPercents, tradeCount: pnlPercents.length, accountName };
}
