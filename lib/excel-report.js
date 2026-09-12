/* Generador de reporte .xlsx con formato Mi Prenda (usado por ExportButton.js)
 * Paleta: primary #D6337F, vino #33132A, fondos #FBF4F8/#FBE1EF, bordes #F1DCE7, error #C2185B
 * Carga perezosa de exceljs para no inflar el bundle inicial.
 */

let ExcelJS = null;
async function getExcel() {
  if (!ExcelJS) {
    const mod = await import('exceljs');
    ExcelJS = mod.default || mod;
  }
  return ExcelJS;
}

const C = {
  primary: 'FFD6337F',
  deep: 'FF33132A',
  soft: 'FFFBF4F8',
  chip: 'FFFBE1EF',
  border: 'FFF1DCE7',
  error: 'FFC2185B',
  white: 'FFFFFFFF',
  onSurface: 'FF33132A',
};

const MONEY_FMT = '"C$"#,##0.00;[Red]-"C$"#,##0.00';

const COLS = ['A', 'B', 'C', 'D', 'E', 'F'];

const timeStr = (d) =>
  new Date(d).toLocaleTimeString('es-NI', { hour: 'numeric', minute: '2-digit' });

function borderThin() {
  return { style: 'thin', color: { argb: C.border } };
}

/* Encabezado rosa unificado A1:F2 */
function addHeader(ws, storeName) {
  ws.mergeCells('A1:F2');
  const cell = ws.getCell('A1');
  cell.value = `REPORTE DE VENTAS DE CAJA - ${storeName} · Mi Prenda`;
  cell.font = { name: 'Plus Jakarta Sans', size: 14, bold: true, color: { argb: C.white } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.primary } };
}

/* Fecha del corte: A3:F4 combinada, centrada */
function addFechaRow(ws, fechaCorte) {
  ws.mergeCells('A3:F4');
  const cell = ws.getCell('A3');
  cell.value = `Corte del día: ${fechaCorte}`;
  cell.font = { name: 'Plus Jakarta Sans', size: 12, bold: true, color: { argb: C.deep } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(3).height = 20;
  ws.getRow(4).height = 20;
}

/* Tarjeta KPI: bloque paralelo (filas 5-7) con fondo blanco y borde propio */
function addCard(ws, colA, colB, title, value, color) {
  const a = COLS[colA - 1];
  const b = COLS[colB - 1];

  // Fondo blanco + marco exterior fino (ANTES del merge: los estilos se conservan)
  for (let row = 5; row <= 7; row++) {
    for (let col = colA; col <= colB; col++) {
      const cell = ws.getRow(row).getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.white } };
      cell.border = {
        ...(row === 5 ? { top: borderThin() } : {}),
        ...(row === 7 ? { bottom: borderThin() } : {}),
        ...(col === colA ? { left: borderThin() } : {}),
        ...(col === colB ? { right: borderThin() } : {}),
      };
    }
  }

  // Título arriba (fila 5), monto abajo (filas 6-7, centrado vertical)
  ws.mergeCells(`${a}5:${b}5`);
  ws.mergeCells(`${a}6:${b}7`);

  const tCell = ws.getCell(`${a}5`);
  tCell.value = title;
  tCell.font = { name: 'Plus Jakarta Sans', size: 10.5, bold: true, color: { argb: C.onSurface } };
  tCell.alignment = { vertical: 'middle', horizontal: 'center' };

  const vCell = ws.getCell(`${a}6`);
  vCell.value = Number(value) || 0;
  vCell.numFmt = MONEY_FMT;
  vCell.font = { name: 'Plus Jakarta Sans', size: 14, bold: true, color: { argb: color } };
  vCell.alignment = { vertical: 'middle', horizontal: 'center' };
}

/* Caja neta del día: bloque largo (A-F) con fondo #FBE1EF */
function addCajaNeta(ws, row, cajaNeta) {
  ws.mergeCells(`A${row}:C${row}`);
  ws.mergeCells(`D${row}:F${row}`);
  const chipFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.chip } };
  const border = { top: borderThin(), bottom: borderThin(), left: borderThin(), right: borderThin() };
  for (let col = 1; col <= 6; col++) {
    const cell = ws.getRow(row).getCell(col);
    cell.fill = chipFill;
    cell.border = border;
  }
  const l = ws.getCell(`A${row}`);
  l.value = 'CAJA NETA DEL DÍA (Contado − Gastos)';
  l.font = { name: 'Plus Jakarta Sans', size: 12, bold: true, color: { argb: C.deep } };
  l.alignment = { vertical: 'middle', horizontal: 'left' };
  const v = ws.getCell(`D${row}`);
  v.value = Number(cajaNeta) || 0;
  v.numFmt = MONEY_FMT;
  v.font = { name: 'Plus Jakarta Sans', size: 14, bold: true, color: { argb: C.primary } };
  v.alignment = { vertical: 'middle', horizontal: 'right' };
  ws.getRow(row).height = 26;
}

/* Título de sección */
function addSectionTitle(ws, row, text, color) {
  ws.mergeCells(`A${row}:F${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = text;
  cell.font = { name: 'Plus Jakarta Sans', size: 12, bold: true, color: { argb: color } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 20;
}

/* Encabezado de tabla (vino oscuro, texto blanco) */
function addTableHeader(ws, row, cols) {
  cols.forEach((t, i) => {
    const cell = ws.getRow(row).getCell(i + 1);
    cell.value = t;
    cell.font = { name: 'Plus Jakarta Sans', size: 10.5, bold: true, color: { argb: C.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.deep } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: borderThin() };
  });
  ws.getRow(row).height = 22;
}

/* Zebra striping + alineaciones por tipo de dato */
function addDataRow(ws, row, values, aligns, zebra) {
  values.forEach((v, i) => {
    const cell = ws.getRow(row).getCell(i + 1);
    cell.value = v;
    cell.font = { name: 'Plus Jakarta Sans', size: 10.5, color: { argb: C.onSurface } };
    const al = aligns[i] || 'left';
    cell.alignment = { vertical: 'middle', horizontal: al };
    if (zebra) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.soft } };
    }
    if (al === 'money') {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = MONEY_FMT;
    }
    cell.border = { bottom: borderThin() };
  });
}

/* Tabla de ventas (contado o fiado). Devuelve la última fila usada. */
function addSalesTable(ws, headerRow, sales, withMethod) {
  addTableHeader(ws, headerRow, ['Fecha', 'Hora', 'Cliente', 'Canal', 'Productos', 'Total']);
  const aligns = ['center', 'center', 'left', 'left', 'left', 'money'];
  let r = headerRow;
  sales.forEach((s, idx) => {
    r += 1;
    const canal = s.channel === 'tiktok_live' ? 'Live TikTok' : 'Mostrador';
    addDataRow(
      ws,
      r,
      [
        new Date(s.created_at).toLocaleDateString('es-NI'),
        timeStr(s.created_at),
        s.client_name || 'Mostrador',
        withMethod
          ? `${canal} · ${s.payment_method === 'transferencia' ? 'Transferencia' : 'Efectivo'}`
          : canal,
        s.notes || s.items_count + ' prendas',
        Number(s.total),
      ],
      aligns,
      idx % 2 === 1
    );
  });
  if (sales.length === 0) {
    r += 1;
    addDataRow(ws, r, ['—', '—', 'Sin registros', '—', '—', 0], aligns, false);
  }
  return r;
}

/* Tabla de gastos. Devuelve la última fila usada. */
function addExpensesTable(ws, headerRow, expenses) {
  addTableHeader(ws, headerRow, ['Fecha', 'Hora', 'Concepto', 'Categoría', '', 'Monto']);
  const aligns = ['center', 'center', 'left', 'center', 'left', 'money'];
  let r = headerRow;
  expenses.forEach((e, idx) => {
    r += 1;
    addDataRow(
      ws,
      r,
      [
        new Date(e.created_at).toLocaleDateString('es-NI'),
        timeStr(e.created_at),
        e.concept,
        (e.category || '').charAt(0).toUpperCase() + (e.category || '').slice(1),
        '',
        -Number(e.amount),
      ],
      aligns,
      idx % 2 === 1
    );
  });
  if (expenses.length === 0) {
    r += 1;
    addDataRow(ws, r, ['—', '—', 'Sin gastos hoy', '—', '', 0], aligns, false);
  }
  return r;
}

export async function buildReportWorkbook({ storeName, fechaCorte, contado, fiado, gastos, cajaNeta, sales, expenses }) {
  const Excel = await getExcel();
  const wb = new Excel.Workbook();
  wb.creator = 'Mi Prenda';
  const ws = wb.addWorksheet('Reporte Caja', {
    views: [{ showGridLines: false, zoomScale: 120, zoomScaleNormal: 120 }],
  });

  // Anchos de columna: A-F ocupan casi todo el ancho horizontal estándar
  ws.columns = [
    { width: 18 }, // A Fecha
    { width: 16 }, // B Hora
    { width: 24 }, // C Cliente/Concepto
    { width: 24 }, // D Canal (con método en contado)
    { width: 26 }, // E Productos
    { width: 18 }, // F Total
  ];

  // Ocultar columnas G en adelante: la hoja termina limpio en F,
  // sin espacio en blanco a la derecha (ExcelJS requiere width definido
  // para que la columna exista en el XML y el hidden persista)
  for (let col = 7; col <= 120; col++) {
    ws.getColumn(col).width = 8.43;
    ws.getColumn(col).hidden = true;
  }

  /* ===== A. ENCABEZADO (filas 1-2) ===== */
  addHeader(ws, storeName);

  /* ===== Fecha del corte centrada (A3:F4) ===== */
  addFechaRow(ws, fechaCorte);

  /* ===== B. TARJETAS EN PARALELO (filas 5-7) ===== */
  addCard(ws, 1, 2, 'Ventas al Contado', contado, C.primary);
  addCard(ws, 3, 4, 'Ventas al Fiado', fiado, C.deep);
  addCard(ws, 5, 6, 'Gastos del Día', -gastos, C.error);

  /* ===== CAJA NETA (fila 9) ===== */
  addCajaNeta(ws, 9, cajaNeta);

  /* ===== C. TABLAS (contado / fiado / gastos) ===== */
  const contadoSales = sales.filter((s) => s.payment_method !== 'fiado');
  const fiadoSales = sales.filter((s) => s.payment_method === 'fiado');

  let r = 11;
  addSectionTitle(ws, r, 'VENTAS AL CONTADO', C.primary);
  r = addSalesTable(ws, r + 1, contadoSales, true);

  r += 2;
  addSectionTitle(ws, r, 'VENTAS AL FIADO', C.deep);
  r = addSalesTable(ws, r + 1, fiadoSales, false);

  r += 2;
  addSectionTitle(ws, r, 'GASTOS DEL DÍA', C.error);
  r = addExpensesTable(ws, r + 1, expenses);

  return wb;
}

export async function workbookToBlob(wb) {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
