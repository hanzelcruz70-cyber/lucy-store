/* ============================================================
 * Mi Prenda · Monto con símbolo alineado
 * El "C$" se renderiza como <span> elevado y más pequeño para que
 * la barra del $ quede al mismo nivel visual que los dígitos
 * (Plus Jakarta Sans / Space Grotesk dibujan el $ por debajo del
 * baseline de los números).
 * ============================================================ */

export default function Money({ value, className = '', signo = '' }) {
  const n = Number(value) || 0;
  const texto = n.toLocaleString('es-NI', { maximumFractionDigits: 0 });
  const signoChar = signo === '+' || signo === '−' ? signo : '';
  return (
    <span className={className}>
      {signoChar}
      <span className="align-baseline text-[0.72em] font-bold tracking-tight relative -top-[0.18em]">C$</span>
      {texto}
    </span>
  );
}
