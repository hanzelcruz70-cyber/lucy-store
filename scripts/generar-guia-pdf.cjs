/* Genera GUIA-USUARIO.pdf sin dependencias externas (PDF a mano, WinAnsi/Helvetica) */
/* v1.2 - Guia completa con contabilidad, ventas, live, gastos e inicio + fix de numeracion de objetos PDF */
const fs = require('fs');
const path = require('path');

const W = 612, H = 792, M = 50;
const INK = '0.20 0.075 0.165';
const SUB = '0.576 0.439 0.498';
const PINK = '0.839 0.20 0.498';
const PINK_SOFT = '0.984 0.882 0.937';

let pages = [];
let page = [];
let y = H - M;
let isCover = true;

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function enc(s) {
  return s
    .replace(/\u2022/g, '\u0095')
    .replace(/\u2013/g, '\u0096')
    .replace(/\u2014/g, '\u0097');
}
function wpx(str, size, bold) {
  return str.length * size * (bold ? 0.60 : 0.53);
}
function wrap(text, size, bold, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (wpx(test, size, bold) > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function op(str, size, font, color, x, yy) {
  const t = esc(enc(str));
  const fname = font === 2 ? 'F2' : 'F1';
  return 'BT /' + fname + ' ' + size + ' Tf ' + color + ' rg ' + x + ' ' + yy + ' Td (' + t + ') Tj ET';
}
function need(h) {
  if (y - h < 70) endPage();
}
function endPage() {
  if (!isCover) {
    page.push(op('PacaPOS - Guía de usuario', 8.5, 1, SUB, M, 30));
    const pn = 'Página ' + (pages.length + 1);
    page.push(op(pn, 8.5, 1, SUB, W - M - wpx(pn, 8.5, false), 30));
  }
  pages.push(page);
  page = [];
  y = H - M;
  isCover = false;
}

function h1(t) {
  need(56);
  y -= 6;
  page.push(op(t, 15, 2, PINK, M, y));
  y -= 5;
  page.push(PINK + ' RG 0.9 w ' + M + ' ' + y + ' m ' + (W - M) + ' ' + y + ' l S');
  y -= 13;
}
function para(t, size, color, x, bold) {
  size = size || 10.5;
  color = color || INK;
  x = x || M;
  const lines = wrap(t, size, bold || false, W - x - M);
  for (const ln of lines) {
    need(size * 1.6);
    page.push(op(ln, size, bold ? 2 : 1, color, x, y));
    y -= size * 1.5;
  }
}
function bullet(t, size, color) {
  size = size || 10.5;
  color = color || INK;
  const first = '\u2022 ' + t;
  const lines = wrap(first, size, false, W - M - 34);
  lines.forEach((ln, i) => {
    need(size * 1.6);
    if (i === 0) {
      page.push(op(ln, size, 1, color, M + 6, y));
    } else {
      page.push(op(ln, size, 1, color, M + 20, y));
    }
    y -= size * 1.5;
  });
}
function sub(t) {
  need(40);
  y -= 4;
  page.push(op(t, 11.5, 2, INK, M, y));
  y -= 3;
  page.push(SUB + ' RG 0.5 w ' + M + ' ' + y + ' m ' + (M + 26) + ' ' + y + ' l S');
  y -= 10;
}
function ex(t) {
  const lines = wrap(t, 10.5, false, W - M - 16 - M);
  for (const ln of lines) {
    need(16.8);
    page.push(op(ln, 10.5, 1, SUB, M + 16, y));
    y -= 15.75;
  }
}
function tip(t) {
  para(t, 10.5, PINK);
  y -= 3;
}
function gap(px) {
  y -= px || 8;
}

/* ============ CONTENIDO DE LA GUIA (v1.2 - completa) ============ */
const G = [];
function H1(t){ G.push(['h1', t]); }
function S(t){ G.push(['sub', t]); }
function P(t){ G.push(['p', t]); }
function B(t){ G.push(['b', t]); }
function TIP(t){ G.push(['tip', t]); }
function EX(t){ G.push(['ex', t]); }

/* ---- 1 ---- */
H1('1. Qué es PacaPOS');
P('PacaPOS es el sistema de punto de venta de tu tienda de ropa. Registra ventas al contado y al fiado, lives de TikTok, inventario de pacas, gastos del negocio y la cobranza de tus clientes. Todo en córdobas (C$), desde computadora o celular, y se instala en el teléfono como una app más.');
TIP('Regla de oro: anota cada venta, abono y gasto EN EL MOMENTO en que ocurre. La app hace todas las cuentas por ti, pero solo con lo que le dices.');

/* ---- 2 ---- */
H1('2. Antes de empezar: la cuenta y los roles');
B('Necesitas: conexión a internet, un navegador (Chrome o Edge recomendado) y una cuenta. No hay registro público.');
B('El ADMINISTRADOR del sistema es quien crea las tiendas y entrega los correos y contraseñas. No vende; solo administra cuentas.');
B('El DUEÑO DE TIENDA entra con su correo y contraseña y usa la app con los datos de SU tienda: caja, fiados, lotes, clientes y gastos.');
B('Cada tienda ve únicamente sus propios datos: ninguna otra tienda puede verlos ni modificarlos.');
B('La dirección de la app te la indica el administrador. Ejemplo: http://192.168.1.15:3001');

/* ---- 3 ---- */
H1('3. Iniciar sesión');
B('Paso 1: abre la dirección de la app. Verás la pantalla con el logo PacaPOS y el botón "Entrar a mi tienda".');
B('Paso 2: escribe tu correo y tu contraseña.');
B('Paso 3: presiona "Entrar a mi tienda". Al entrar aterrizas en Inicio, el resumen del día.');
B('Si los datos están mal verás en rojo: "Correo o contraseña incorrectos. Verifica tus datos." Quedas en la misma pantalla para reintentar.');
B('Si no hay conexión: "No se pudo conectar al servidor. Revisa tu internet e intenta de nuevo."');

/* ---- 4 ---- */
H1('4. Panel del administrador');
B('Entra a la dirección de la app seguida de /admin. Ejemplo: http://192.168.1.15:3001/admin');
B('Escribe la contraseña de administrador y presiona "Entrar al panel".');
B('Crear una tienda: llena los 4 campos: nombre del dueño, nombre del negocio, correo del cliente y contraseña (mínimo 8 caracteres).');
B('El botón "Generar" inventa una contraseña segura de 12 caracteres. Cópiala antes de guardar.');
B('Presiona "Crear tienda y cuenta". La tienda queda listada abajo con su dueño, correo y fecha.');
B('El nombre del negocio es EXACTAMENTE el que el cliente verá en su barra superior al entrar.');
B('Eliminar una tienda: botón de basura. Pide confirmación y borra TODOS sus datos (ventas, clientes, deudas). No se puede deshacer.');
TIP('Entrega las contraseñas por mensaje privado, nunca en grupos. Si un cliente olvida la suya, no hay recuperación: crea la cuenta de nuevo.');

/* ---- 5 ---- */
H1('5. Navegación');
B('Celular: toca el botón de menú (arriba a la izquierda) para abrir el menú lateral. Ciérralo con la X o tocando fuera.');
B('Computadora: el menú queda fijo a la izquierda de la pantalla.');
B('Secciones: Inicio (resumen del día), Vender (mostrador), Live TikTok (apartados en vivo), Caja (balance y cierre), Inventario (pacas y productos), Clientes (fiados y cobros) y Más (gastos, estadísticas y reporte).');
B('La barra superior muestra el nombre de tu tienda y tu usuario.');
B('El botón de salida cierra la sesión y regresa al login. Tus datos quedan guardados en la nube.');

/* ---- 6: CONTABILIDAD ---- */
H1('6. Cómo funciona la contabilidad');
P('Esta es la sección más importante de la guía: explica cómo la app cuenta tu dinero. Léela una vez con calma y después consulta las fórmulas cuando tengas dudas.');

S('6.1 Los tres tipos de dinero');
B('COBRADO: dinero que ya entró. Son las ventas pagadas al momento (efectivo o transferencia) y los abonos que te pagan.');
B('FIADO (por cobrar): mercancía entregada a cuenta. NO es dinero en tu caja: lo será cuando el cliente abone.');
B('GASTO: dinero que salió del negocio (bolsas, renta, proveedor).');
B('La caja neta del día = cobrado menos gastos. El fiado no entra ni sale: es una promesa de pago.');

S('6.2 Los cuatro números de la Caja del día (Inicio)');
B('Contado: ventas de HOY cobradas al momento, en efectivo o transferencia. Venta fiada no incluye.');
B('Fiado: ventas de HOY que quedaron a cuenta de un cliente.');
B('Abonos: TODO pago registrado hoy. Ojo: además de los abonos de deudas, este contador suma los cobros de ventas al contado hechas en Vender y Live, porque también se registran como pagos.');
B('Gastos: suma de los gastos anotados hoy.');
B('Prendas: piezas vendidas hoy (arriba del bloque).');

S('6.3 Ejemplo completo de un día');
P('Día de ejemplo en la tienda, con su folio de Inicio:');
EX('#001 10:15am - Venta en mostrador: 2 Blusas, C$250 en efectivo.');
EX('#002 11:30am - Live: Vestido #43 apartado para @maria, C$150. A las 12:00pm María lo paga por transferencia.');
EX('#003 1:00pm - Live: Vestido #44 apartado para Doña Lupita, C$120. Se marca como Fiado.');
EX('#004 3:00pm - Doña Lupita abona C$100 en efectivo.');
EX('#005 5:00pm - Gasto: bolsas para empaque, C$50, categoría operativo.');
P('Con eso, la Caja del día muestra:');
EX('Contado: C$400 (250 de la venta en efectivo + 150 del cobro por transferencia).');
EX('Fiado: C$120 (el vestido #44 que quedó a cuenta).');
EX('Abonos: C$500 (el abono de C$100 de Lupita + el cobro de C$250 + el cobro de C$150).');
EX('Gastos: C$50. Prendas: 4 (2 blusas + 2 vestidos).');
EX('Ventas totales del día: C$520 (400 contado + 120 fiado). Margen neto: C$350 (400 cobrado - 50 de gastos).');

S('6.4 Cómo se pagan las deudas (una por una, de la más vieja a la más nueva)');
P('Cada fiado es una deuda aparte. Cuando el cliente abona, el dinero se descuenta en orden: primero la deuda más antigua, luego la siguiente.');
EX('Ejemplo: Doña Lupita debe un fiado del lunes de C$120 y otro del martes de C$80 (deuda total C$200). Abona C$150: se salda el fiado del lunes completo (C$120) y del martes quedan C$30. Deuda total: C$30.');
EX('Si abona más de lo que debe, el saldo simplemente queda en C$0; no hay cambio.');
TIP('Un abono NUNCA borra el historial: la deuda queda marcada como saldada y el abono queda en los movimientos del cliente.');

S('6.5 Fiado en calle y Recuperado (Clientes)');
B('Fiado en calle: total que te deben todos tus clientes ahora mismo (solo deudas pendientes).');
B('Recuperado: total que te han pagado de fiados en la historia (lo prestado menos lo que falta).');
EX('En el ejemplo: Fiado en calle C$20 (los C$120 de Lupita menos su abono de C$100). Recuperado: C$100.');

S('6.6 El efectivo esperado en el cajón (cierre de caja)');
P('Al hacer el cierre, la app calcula cuánto efectivo DEBERÍA haber en el cajón:');
EX('Efectivo esperado = ventas de hoy cobradas en EFECTIVO - gastos del día.');
EX('En el ejemplo: C$250 - C$50 = C$200 esperados.');
B('IMPORTANTE: los abonos que te paguen en efectivo también quedan en el cajón, pero hoy el cálculo del esperado no los suma. En el ejemplo, el abono de Lupita (C$100 en efectivo) hará que el físico sea C$300: esperados C$200 + abono C$100.');
B('Por eso, si recibiste abonos en efectivo, es NORMAL que el conteo físico sobrepase lo esperado exactamente por ese monto. Verifícalo y cierra con la diferencia anotada.');
B('Las transferencias tampoco están en el cajón (están en el banco): el esperado solo usa efectivo.');

S('6.7 Qué guarda el corte de caja');
B('Cada noche, el corte guarda: ventas al contado del día (efectivo + transferencia), cuánto de eso fue en efectivo, los gastos, y en las notas el conteo físico, la diferencia y las transferencias.');
B('Es tu respaldo: si alguien pregunta cómo cerró la caja, ahí está todo.');

S('6.8 La contabilidad del inventario');
B('Costo por pieza de una paca = costo total entre total de prendas. Se calcula solo en el formulario.');
B('Invertido (resumen del inventario) = la parte del costo de tus pacas proporcional a lo que ya vendiste. Ejemplo: paca de 100 prendas con costo C$6,000 con 40 vendidas: invertiste C$2,400.');
B('Ganancia estimada = prendas que quedan x (precio promedio de venta - costo por pieza). Ejemplo: quedan 60 prendas, costo C$60 c/u, venta promedio C$150: ganancia estimada C$5,400 si vendes todo.');
EX('Ejemplo de paca: 100 prendas, costo total C$6,000, venta promedio C$150. Costo por pieza: C$60. Ganancia por pieza: C$90.');

/* ---- 7 ---- */
H1('7. Inicio: el apartado del día');
P('Es la primera pantalla al entrar y tu tablero de mando: de un vistazo sabes cómo va el día.');
B('Caja del día: los cuatro números de la sección 6.2 (Contado, Fiado, Abonos, Gastos) más el total de prendas.');
B('Movimientos de hoy: la línea de tiempo completa del día. Cada movimiento tiene su folio único (#001, #002...) en orden cronológico, para buscarlo después.');
B('Cada movimiento muestra su tipo con icono: venta o fiado (flecha de entrada), abono (flecha con check) o gasto (flecha de salida), su hora y su canal (mostrador o Live).');
B('El buscador de arriba filtra por folio, cliente o concepto. Ejemplo: escribe #003 o "Lupita".');
B('Con más de 5 movimientos la lista se hace desplazable: sigue bajando para verlos todos.');
B('Clientes que deben: los clientes con saldo pendiente y cuánto debes cobrarles. Toca uno para abrir su ventana de abono.');
B('Si nadie debe nada: "Nadie te debe nada. ¡Cobranza perfecta!"');

S('7.1 Cobrar un abono desde Inicio');
B('Paso 1: toca la tarjeta del cliente que debe.');
B('Paso 2: escribe el monto del abono, o usa +C$100 y +C$200 (suman) o "Todo" (pone el saldo completo).');
B('Paso 3: elige el método: Efectivo o Transferencia.');
B('Paso 4: presiona ABONAR. Verás "Abono de C$X confirmado. Nuevo saldo: C$X" y el saldo se actualiza al instante.');
B('Si el saldo queda en C$0, el cliente sale de la lista de deudores. El abono se descuenta de su deuda más antigua (sección 6.4).');

/* ---- 8 ---- */
H1('8. Vender: venta al contado');
P('Para vender en el mostrador. Se venden los productos que hayas agregado en Inventario (sección 14).');
B('Paso 1: busca el producto por nombre en el buscador. Cada tarjeta muestra el producto y su precio.');
B('Paso 2: toca una tarjeta para agregar 1 pieza al carrito. Tócala otra vez para sumar otra.');
B('Paso 3: en "Venta en curso" (el panel que aparece abajo) ajusta con los botones menos y más, o presiona "Vaciar" para empezar de nuevo.');
B('Paso 4: deja marcado "Al contado" y presiona el botón rosa "Cobrar C$XXX" con el total.');
B('Qué hace la app sola: la venta queda con folio en los movimientos, el pago entra a la caja del día, las piezas se descuentan de la paca asignada al producto (si tiene) y el contador de vendidos sube para las estadísticas.');
TIP('El descuento de piezas de la paca solo ocurre si el producto tiene una paca asignada (sección 14).');

/* ---- 9 ---- */
H1('9. Vender: venta a fiado');
B('Paso 1: arma el carrito igual que en la venta al contado.');
B('Paso 2: marca "Fiado". Aparece un campo: escribe el nombre del cliente. Si no existe se crea solo; si ya existe, la deuda se suma a su cuenta.');
B('Paso 3: presiona "Fiar C$XXX". Verás "Fiado de C$X registrado".');
B('Resultado: la deuda queda pendiente, el cliente aparece en "Clientes que deben" (Inicio) y en la sección Clientes con su estado, y las piezas se descuentan de la paca igual que al contado.');
TIP('El fiado no aparece como dinero en caja hasta que el cliente abone. Ese mismo día verás el fiado en la cifra "Fiado" de Inicio.');

/* ---- 10 ---- */
H1('10. Live TikTok: apartados al vuelo');
P('Para vender durante un live: anotas cada prenda apartada en segundos, sin detenerte.');
B('Contadores de arriba (se actualizan solos): "Apartadas hoy" (piezas del live de hoy) y "Monto en live" (dinero total del live de hoy, sin importar si ya cobraste o fiaste).');
B('Paso 1: en "Apartado ultrarrápido" escribe el @usuario o nombre (ej. Doña Lupita), la prenda (ej. #43 Vestido liso) y el precio. Botones de precios rápidos: 100, 120, 150, 180, 250 y 300.');
B('Paso 2: presiona "Apartar prenda al vuelo". Aparece en "Apartados en curso" con el estado PENDIENTE y los contadores suben.');
B('Paso 3: al momento o al final del live, resuelve cada pendiente con sus dos botones:');

S('10.1 El botón "Cobrar" (el cliente ya pagó)');
B('Marca la venta como Cobrado y registra el pago: el dinero entra a la caja del día (efectivo).');
B('En el ejemplo de la sección 6.3: el vestido de @maria de C$150 se apartó pendiente y al presionar Cobrar quedó Cobrado.');

S('10.2 El botón "Fiado" (se lo lleva a cuenta)');
B('Busca el cliente por el nombre; si no existe lo crea solo y queda marcado con la etiqueta TikTok.');
B('Registra la deuda a su nombre (con la prenda como descripción) y actualiza su saldo.');
B('La venta pasa a estado FIADO y el cliente aparece en Clientes y en "Clientes que deben".');
B('Una misma venta no se puede fiar dos veces: la app avisa "Esta venta ya está en cuenta".');

S('10.3 Los tres estados de un apartado');
B('PENDIENTE (etiqueta clara): aún no resuelto. Es el único con botones.');
B('COBRADO (etiqueta con check): pagado al instante.');
B('FIADO (etiqueta oscura): pasó a la cuenta del cliente.');
TIP('Antes de terminar el live, resuelve TODOS los pendientes: los que quedan sin resolver siguen apareciendo en la lista hasta que los marques.');

/* ---- 11 ---- */
H1('11. Caja: el balance en vivo');
P('El estado del dinero del día, para revisarlo antes del cierre.');
B('Ventas totales de hoy y prendas vendidas (etiqueta del encabezado).');
B('Cobrado: efectivo más transferencias cobrados hoy. En el ejemplo: C$400.');
B('Fiado: lo vendido a crédito hoy, marcado "Por cobrar". En el ejemplo: C$120.');
B('Margen neto en caja: cobrado menos gastos (C$350 en el ejemplo), con la barra que muestra qué porcentaje de lo vendido ya está cobrado (77% en el ejemplo).');
B('Movimientos del corte: todas las ventas y gastos del día en lista, con su detalle (cliente o concepto, canal, método).');
B('Arriba está el botón "Realizar cierre de caja", que se explica en la siguiente sección.');

/* ---- 12 ---- */
H1('12. Cierre de caja con conteo de billetes');
P('Se hace UNA vez al día, al terminar la jornada. Es el arqueo: comparar lo que dice el sistema contra el dinero físico.');
B('Paso 1: presiona "Realizar cierre de caja". La app muestra lo esperado: ventas al contado, cuánto fue por transferencia, gastos y el EFECTIVO ESPERADO en el cajón (sección 6.6).');
B('Paso 2: cuenta tus billetes y monedas por denominación (C$1000, 500, 200, 100, 50, 20, 10, 5 y 1) y anota cuántos de cada uno. Cada fila suma sola y ves el total físico.');
B('Paso 3: revisa la verificación: "¡Cuadra perfecto!" si coincide, o "Sobra" o "Falta" con la diferencia exacta.');
B('Paso 4: presiona "Cerrar caja del día". El corte queda guardado con todo el detalle.');
B('Si hay diferencia puedes cerrar igual: la diferencia queda anotada en el corte para revisarla después.');
B('Hecho el cierre, el botón cambia a "Corte ya realizado hoy" y se bloquea hasta el día siguiente.');
EX('Ejemplo: esperados C$200. Cuentas 1 billete de C$200 y 2 de C$100: físico C$400... espera: la diferencia de C$200 corresponde a los abonos en efectivo del día (sección 6.6). Revisa, entiende la diferencia y cierra con ella anotada.');
TIP('Cuenta el dinero en un momento tranquilo y dos veces: los errores de conteo son la causa más común de diferencias.');

/* ---- 13 ---- */
H1('13. Inventario: las pacas');
S('13.1 Registrar una paca nueva');
B('En Inventario presiona "Entró nueva paca / lote" (ingreso express, sin tallas).');
B('Llena: nombre o categoría (ej. Paca Blusas Casuales Mixtas), total de prendas, costo total de la paca (lo que pagaste) y precio promedio de venta por pieza.');
B('El costo por pieza se calcula solo mientras escribes (costo total entre prendas).');
B('Presiona "Dar Entrada al Lote": la paca queda activa con su código (Paca #1, Paca #2...).');
S('13.2 Leer el panel de pacas');
B('Resumen de arriba: Prendas (stock total), Invertido (dinero inmovilizado, sección 6.8) y Ganancia estimada.');
B('Cada paca muestra: código, % vendido con barra de progreso, "Quedan X de Y", costo por prenda, venta promedio y ganancia por pieza.');
B('ALERTA: una paca con menos del 20% vendida después de más de una semana se resalta en rojo: es tu señal para rematarla o bajarle el precio.');
TIP('Registra la paca apenas llegue a la tienda, así el inventario siempre refleja la realidad.');

/* ---- 14 ---- */
H1('14. Inventario: los productos');
P('Los productos son tu catálogo de venta: los que agregues aquí son los que aparecen en Vender.');
B('"Agregar producto": nombre, precio de venta y (opcional) la paca a la que pertenece. El código (P-001, P-002...) se asigna solo.');
B('Asignar la paca hace que las piezas se descuenten solas al vender ese producto en Vender.');
B('Cada producto muestra cuántas unidades lleva vendidas.');
B('Eliminar: botón de basura, pide confirmación. El producto desaparece de Vender.');
B('Si no tienes productos aún, Vender te lo avisa: agrégalos primero aquí.');

/* ---- 15 ---- */
H1('15. Clientes: la lista');
B('Arriba: "Fiado en calle" (total por cobrar y cuántos clientes deben) y "Recuperado" (abonos recibidos en total). Ver sección 6.5.');
B('"Agregar cliente": nombre (obligatorio), teléfono y usuario de TikTok (opcionales).');
B('Filtros: Todos, Con deuda y Al corriente, cada uno con su conteo.');
B('Buscador: por nombre, apodo o celular.');
B('Los clientes del live se crean solos al fiarles y quedan con la etiqueta TikTok.');
S('15.1 El estado de cada cliente (según su último fiado)');
B('Al corriente: sin deuda.');
B('Debe: su fiado más reciente tiene menos de 3 días.');
B('Pendiente: 3 días o más desde su último fiado.');
B('Moroso: 7 días o más.');
B('30-60 días y 60+ días: cuando el último fiado tiene un mes o más. Prioriza cobrar a estos primero.');

/* ---- 16 ---- */
H1('16. Clientes: la hoja de cliente');
B('Toca cualquier cliente para abrir su hoja: estado, saldo pendiente, abono rápido, movimientos y acciones.');
B('Anotar abono: igual que en Inicio (monto, +C$100, +C$200, "Todo", método, ABONAR). El saldo baja al instante.');
B('Movimientos: cada FIADO suma a su deuda y cada ABONO la resta, con su fecha. Es el historial completo y en orden.');
B('"Dar nuevo fiado": registra un monto directo a su cuenta, para cuando el cliente se lleva mercancía sin pasar por Vender o el Live. Muestra el saldo que quedará.');
EX('Ejemplo: Lupita debe C$20 y le das un fiado directo de C$80: queda debiendo C$100.');
B('"Eliminar cliente": borra también su deuda y su historial. Pide confirmación; no se puede deshacer.');
TIP('El fiado directo no aparece en las cifras de ventas del día (no es una venta): se refleja en la hoja del cliente y en "Fiado en calle".');

/* ---- 17 ---- */
H1('17. Más: los gastos');
B('Pestaña Gastos: registra cada gasto con concepto, monto y categoría: operativo (bolsas, transporte), proveedor (mercaduría), renta u otro.');
B('La lista muestra cada gasto con categoría y fecha.');
B('Los gastos restan automáticamente del margen neto de Caja, del efectivo esperado en el cierre y aparecen en el reporte.');
TIP('Anota los gastos el mismo día en que ocurren: el cierre de la noche los descuenta esa misma tarde.');

/* ---- 18 ---- */
H1('18. Más: las estadísticas');
B('Pestaña Estadísticas: se calculan solas con tus ventas (Vender, Live y mostrador). No hay que alimentarlas a mano.');
B('"Más vendidos - invierte en esto": tu top 8 de productos con barras y el ingreso que deja cada uno.');
B('"Menos vendidos - remata o no recompres": lo que no se mueve. Bájale el precio o no vuelvas a comprarlo.');
B('Cómo lo calcula: lee la descripción de cada venta. "2x Blusa" cuenta 2 Blusas; una venta de una sola prenda con nombre (ej. "Vestido #43") cuenta 1 de ese nombre. Los apartados del Live aparecen aquí solos.');
B('Si aún no hay ventas con productos, verás un aviso.');

/* ---- 19 ---- */
H1('19. Exportar el reporte');
B('En Más, botón "Exportar reporte": descarga un archivo que se abre en Excel, con el resumen (ventas al contado, fiado, gastos y caja neta), el detalle de cada venta (fecha, cliente, canal, método, productos, total) y el detalle de gastos.');
B('El archivo se llama "reporte-pacapos" más la fecha. Se puede compartir por WhatsApp o correo.');
B('El mismo aviso aparece arriba en Caja, pero la descarga se hace desde Más.');
TIP('Expórtalo justo después del cierre para que coincida con el corte del día.');

/* ---- 20 ---- */
H1('20. Instalar la app en el celular (PWA)');
B('Android: menú de Chrome, "Agregar a pantalla de inicio". Si dentro de PacaPOS ves el botón "Instalar App", úsalo: es lo mismo con un toque.');
B('iPhone: botón Compartir, luego "Añadir a pantalla de inicio".');
B('Instalada, abre a pantalla completa con su propio ícono.');
B('Sin internet verás la página "Sin conexión"; al volver la señal, la app se recarga sola.');

/* ---- 21 ---- */
H1('21. Problemas comunes');
S('21.1 Para entrar');
B('"Correo o contraseña incorrectos" - revisa el correo (sin espacios) y la contraseña, o pide ayuda al administrador.');
B('"No se pudo conectar al servidor" - revisa tu internet y reintenta.');
B('"Cuenta sin tienda" - tu cuenta quedó mal creada. Contacta al administrador.');
S('21.2 Del día a día');
B('Los números no se ven actualizados - recarga la página.');
B('"Corte ya realizado hoy" - ya cerraste caja hoy; el botón se desbloquea mañana.');
B('Un botón no responde - espera dos segundos (está guardando) y reintenta; si sigue, recarga.');
B('"Esta venta ya está en cuenta" - esa venta del live ya está fiada; revisa la lista de apartados.');
S('21.3 Por qué puede no cuadrar mi caja');
B('Recibiste abonos en EFECTIVO: el esperado no los suma (sección 6.6). La diferencia debe ser exactamente ese monto.');
B('Un gasto salió de tu bolsillo y no lo registraste: anótalo en Más, Gastos.');
B('Pagaste algo con dinero de la caja sin anotarlo como gasto.');
B('Contaste mal los billetes: vuelve a contar, sobre todo las monedas.');
B('Una transferencia la contaste como efectivo físico: las transferencias están en el banco, no en el cajón.');
B('Una venta fiada la diste por cobrada: revisa la lista de Clientes que deben.');

/* ---- 22 ---- */
H1('22. Rutina recomendada del día');
B('Apertura: entra a tu cuenta y revisa Inicio. Los saldos pendientes de ayer siguen ahí.');
B('Durante el día: vende en Vender (mostrador) o aparta en el Live. Anota los gastos cuando ocurran.');
B('Cuando un fiado paga: toca su tarjeta (Inicio o Clientes) y registra el abono al instante.');
B('Fin del día: revisa Caja, cuenta el dinero físico, haz el cierre de caja y exporta el reporte.');
TIP('Diez minutos de cierre al día te ahorran horas de cuentas a fin de mes.');

/* ============ RENDER ============ */

// Portada
page.push(PINK + ' rg 0 ' + (H - 250) + ' ' + W + ' 250 re f');
page.push(op('PacaPOS', 44, 2, '1 1 1', M, H - 115));
page.push(op('Guía de usuario', 21, 2, '1 1 1', M, H - 152));
page.push(op('Sistema de venta para tiendas de ropa', 11, 1, PINK_SOFT, M, H - 178));
page.push(op('Versión 1.2 - Septiembre 2026 - Nicaragua - Moneda: córdobas (C$)', 9.5, 1, PINK_SOFT, M, H - 198));
y = H - 285;
para('Bienvenido a PacaPOS. Esta guía explica, paso a paso y sin tecnicismos, cómo usar la aplicación completa: iniciar sesión, vender al contado y al fiado, hacer lives de TikTok, controlar pacas y productos, cobrar a clientes, registrar gastos y cerrar la caja con conteo de billetes.', 11, INK);
gap(6);
para('Incluye una sección dedicada a cómo funciona la contabilidad: qué significa cada número, cómo se calcula y un ejemplo completo de un día de tienda que se usa en todo el documento.', 11, SUB);
gap(4);
para('Importante: la contraseña de tu cuenta te la entrega el administrador del sistema. Nunca la compartas.', 10.5, PINK);
y -= 16;
para('Contenido: 1 Qué es - 2 Cuenta y roles - 3 Iniciar sesión - 4 Panel admin - 5 Navegación - 6 Contabilidad - 7 Inicio - 8 Vender contado - 9 Vender fiado - 10 Live TikTok - 11 Caja - 12 Cierre de caja - 13 Pacas - 14 Productos - 15 Lista de clientes - 16 Hoja de cliente - 17 Gastos - 18 Estadísticas - 19 Reporte - 20 Instalar en celular - 21 Problemas comunes - 22 Rutina del día', 9.5, SUB);
endPage();

for (const [t, s] of G) {
  if (t === 'h1') { h1(s); }
  else if (t === 'sub') { sub(s); }
  else if (t === 'p') { para(s, 10.5, INK); gap(3); }
  else if (t === 'tip') { tip(s); }
  else if (t === 'ex') { ex(s); }
  else { bullet(s, 10.5); y -= 1; }
}

if (page.length) endPage();

/* ============ ENSAMBLADO DEL PDF (numeración secuencial correcta) ============ */
/* obj 1 = catálogo, obj 2 = páginas, obj 3-4 = fuentes,
   objs 5..(4+N) = páginas, objs (5+N)..(4+2N) = flujos de contenido */
const nPages = pages.length;
const objs = [];
objs.push('<< /Type /Catalog /Pages 2 0 R >>'); // obj 1
const kids = [];
for (let i = 0; i < nPages; i++) kids.push((5 + i) + ' 0 R');
objs.push('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + nPages + ' >>'); // obj 2
objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); // obj 3
objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'); // obj 4
const firstContentObj = 5 + nPages;
for (let i = 0; i < nPages; i++) {
  objs.push(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (firstContentObj + i) + ' 0 R >>'
  );
}
for (let i = 0; i < nPages; i++) {
  const content = pages[i].join('\n');
  const buf = Buffer.from(content, 'latin1');
  objs.push('<< /Length ' + buf.length + ' >>\nstream\n' + content + '\nendstream');
}

let out = '%PDF-1.4\n';
const offsets = [];
let bytePos = Buffer.byteLength(out, 'latin1');
for (let i = 0; i < objs.length; i++) {
  offsets.push(bytePos);
  const body = (i + 1) + ' 0 obj\n' + objs[i] + '\nendobj\n';
  out += body;
  bytePos += Buffer.byteLength(body, 'latin1');
}
const xrefPos = bytePos;
let xref = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
for (const off of offsets) {
  xref += String(off).padStart(10, '0') + ' 00000 n \n';
}
out += xref;
out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF';

const pdfBuf = Buffer.from(out, 'latin1');
const outPath = path.join(__dirname, '..', 'GUIA-USUARIO.pdf');
fs.writeFileSync(outPath, pdfBuf);
console.log('Guia v1.2 generada: ' + outPath + ' (' + pdfBuf.length + ' bytes, ' + nPages + ' paginas)');
