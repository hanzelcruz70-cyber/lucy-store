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

/* Caja neta del día: bloque largo (A-F) con fondo #FBE1EF.
 * Refleja el ARQUEO real: efectivo esperado (ventas efectivo + abonos
 * efectivo − gastos + fondo inicial). Sin apartados de Live (migración 12). */
function addCajaNeta(ws, row, { esperado, fisico, fondo, abonos, gastosEfectivo, transferencias }) {
  const rows = [
    ['Fondo inicial (caja con la que abriste)', fondo, 'neutral'],
    ['Ventas en efectivo de hoy', esperado - fondo - abonos + gastosEfectivo, 'neutral'],
    ['Abonos en efectivo recibidos', abonos, 'neutral'],
    ['Gastos del día (salieron del cajón)', -gastosEfectivo, 'negative'],
  ];
  let r = row;
  rows.forEach(([label, val]) => {
    ws.mergeCells(`A${r}:C${r}`);
    ws.mergeCells(`D${r}:F${r}`);
    for (let col = 1; col <= 6; col++) {
      const cell = ws.getRow(r).getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.soft } };
      cell.border = { bottom: borderThin() };
    }
    const l = ws.getCell(`A${r}`);
    l.value = label;
    l.font = { name: 'Plus Jakarta Sans', size: 10.5, color: { argb: C.onSurface } };
    l.alignment = { vertical: 'middle', horizontal: 'left' };
    const v = ws.getCell(`D${r}`);
    v.value = Number(val) || 0;
    v.numFmt = MONEY_FMT;
    v.font = { name: 'Plus Jakarta Sans', size: 10.5, bold: true, color: { argb: C.onSurface } };
    v.alignment = { vertical: 'middle', horizontal: 'right' };
    r += 1;
  });

  // Esperado (resumen)
  ws.mergeCells(`A${r}:C${r}`);
  ws.mergeCells(`D${r}:F${r}`);
  const chipFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.chip } };
  const border = { top: borderThin(), bottom: borderThin(), left: borderThin(), right: borderThin() };
  for (let col = 1; col <= 6; col++) {
    const cell = ws.getRow(r).getCell(col);
    cell.fill = chipFill;
    cell.border = border;
  }
  const l2 = ws.getCell(`A${r}`);
  l2.value = 'EFECTIVO ESPERADO EN CAJÓN (arqueo)';
  l2.font = { name: 'Plus Jakarta Sans', size: 12, bold: true, color: { argb: C.deep } };
  l2.alignment = { vertical: 'middle', horizontal: 'left' };
  const v2 = ws.getCell(`D${r}`);
  v2.value = Number(esperado) || 0;
  v2.numFmt = MONEY_FMT;
  v2.font = { name: 'Plus Jakarta Sans', size: 14, bold: true, color: { argb: C.primary } };
  v2.alignment = { vertical: 'middle', horizontal: 'right' };
  ws.getRow(r).height = 26;
  if (fisico !== null && fisico !== undefined) {
    const r2 = r + 1;
    ws.mergeCells(`A${r2}:C${r2}`);
    ws.mergeCells(`D${r2}:F${r2}`);
    for (let col = 1; col <= 6; col++) {
      const cell = ws.getRow(r2).getCell(col);
      cell.fill = chipFill;
      cell.border = border;
    }
    const l3 = ws.getCell(`A${r2}`);
    l3.value = 'Contado físicamente';
    l3.font = { name: 'Plus Jakarta Sans', size: 10.5, bold: true, color: { argb: C.onSurface } };
    l3.alignment = { vertical: 'middle', horizontal: 'left' };
    const v3 = ws.getCell(`D${r2}`);
    v3.value = Number(fisico) || 0;
    v3.numFmt = MONEY_FMT;
    v3.font = { name: 'Plus Jakarta Sans', size: 10.5, bold: true, color: { argb: C.onSurface } };
    v3.alignment = { vertical: 'middle', horizontal: 'right' };
    if (transferencias > 0) {
      const r3 = r + 2;
      ws.mergeCells(`A${r3}:C${r3}`);
      ws.mergeCells(`D${r3}:F${r3}`);
      for (let col = 1; col <= 6; col++) {
        const cell = ws.getRow(r3).getCell(col);
        cell.fill = chipFill;
        cell.border = border;
      }
      const l4 = ws.getCell(`A${r3}`);
      l4.value = 'Transferencias (NO cuentan en el cajón)';
      l4.font = { name: 'Plus Jakarta Sans', size: 10.5, bold: true, color: { argb: C.onSurface } };
      l4.alignment = { vertical: 'middle', horizontal: 'left' };
      const v4 = ws.getCell(`D${r3}`);
      v4.value = Number(transferencias) || 0;
      v4.numFmt = MONEY_FMT;
      v4.font = { name: 'Plus Jakarta Sans', size: 10.5, bold: true, color: { argb: C.onSurface } };
      v4.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }
  return r;
}

/* Banda "GANANCIA DEL DÍA" (migración 12): vendido (solo mercadería) −
 * costo de prendas guardado en sales.total_cost por registrar_venta.
 * NO es estimación: el costo sale del lote y la rebaja ya viene restada. */
function addGanancia(ws, row, { vendido, costo }) {
  const ganancia = Number(vendido) - Number(costo);
  const chipFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.chip } };
  const border = { top: borderThin(), bottom: borderThin(), left: borderThin(), right: borderThin() };

  ws.mergeCells(`A${row}:C${row}`);
  ws.mergeCells(`D${row}:F${row}`);
  for (let col = 1; col <= 6; col++) {
    const cell = ws.getRow(row).getCell(col);
    cell.fill = chipFill;
    cell.border = border;
  }
  const l = ws.getCell(`A${row}`);
  l.value = 'GANANCIA DEL DÍA';
  l.font = { name: 'Plus Jakarta Sans', size: 12, bold: true, color: { argb: C.deep } };
  l.alignment = { vertical: 'middle', horizontal: 'left' };
  const v = ws.getCell(`D${row}`);
  v.value = ganancia;
  v.numFmt = MONEY_FMT;
  v.font = { name: 'Plus Jakarta Sans', size: 14, bold: true, color: { argb: ganancia >= 0 ? C.primary : C.error } };
  v.alignment = { vertical: 'middle', horizontal: 'right' };
  ws.getRow(row).height = 24;
  return row;
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

/* Tabla de ventas (contado o crédito). Devuelve la última fila usada. */
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

/* Tabla de abonos y cobros de apartados. Devuelve la última fila usada. */
function addPaymentsTable(ws, headerRow, payments) {
  if (!payments || payments.length === 0) return headerRow - 1;
  addTableHeader(ws, headerRow, ['Hora', 'Tipo', 'Método', '', '', 'Monto']);
  const aligns = ['center', 'left', 'left', 'left', 'left', 'money'];
  let r = headerRow;
  payments.forEach((p, idx) => {
    r += 1;
    addDataRow(
      ws,
      r,
      [
        timeStr(p.created_at),
        p.sale_id ? 'Cobro de venta' : 'Abono de deuda',
        p.method === 'transferencia' ? 'Transferencia' : 'Efectivo',
        '',
        '',
        Number(p.amount),
      ],
      aligns,
      idx % 2 === 1
    );
  });
  return r;
}

export async function buildReportWorkbook({
  storeName,
  fechaCorte,
  contado,
  fiado,
  gastos,
  esperado,
  fisico,
  fondo,
  abonosEfectivo,
  transferencias,
  sales,
  expenses,
  payments,
}) {
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
  addCard(ws, 3, 4, 'Crédito nuevo del día', fiado, C.deep);
  addCard(ws, 5, 6, 'Gastos del Día', -gastos, C.error);

  /* ===== GANANCIA DEL DÍA (filas 9-10): solo mercadería (migración 12) ===== */
  const merch = sales.filter((s) => s.items_count > 0);
  const vendidoMerch = merch.reduce((a, s) => a + Number(s.total), 0);
  const costoPrendas = merch.reduce((a, s) => a + Number(s.total_cost || 0), 0);
  const rGan = addGanancia(ws, 9, { vendido: vendidoMerch, costo: costoPrendas });

  /* ===== ARQUEO (desde fila 12): desglose que cuadra con el cierre ===== */
  const arqueo = {
    esperado,
    fisico,
    fondo,
    abonos: abonosEfectivo,
    gastosEfectivo: gastos,
    transferencias,
  };
  let r = addCajaNeta(ws, rGan + 2, arqueo);

  /* ===== C. TABLAS (contado / abonos / crédito / gastos) ===== */
  const contadoSales = sales.filter((s) => s.payment_method !== 'fiado');
  const fiadoSales = sales.filter((s) => s.payment_method === 'fiado');

  r += 2;
  addSectionTitle(ws, r, 'VENTAS AL CONTADO', C.primary);
  r = addSalesTable(ws, r + 1, contadoSales, true);

  if (payments && payments.length > 0) {
    r += 2;
    addSectionTitle(ws, r, 'ABONOS Y APARTADOS COBRADOS', C.deep);
    r = addPaymentsTable(ws, r + 1, payments);
  }

  r += 2;
  addSectionTitle(ws, r, 'VENTAS AL CRÉDITO', C.deep);
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
