import Link from 'next/link';

const features = [
  { icon: 'point_of_sale', title: 'Caja y Corte', desc: 'Registra ventas en segundos. Arqueo diario contando billetes.' },
  { icon: 'videocam', title: 'Lives de TikTok', desc: 'Aparta prendas en vivo al vuelo y pásalas a fiado o cobro.' },
  { icon: 'inventory_2', title: 'Inventario', desc: 'Pacas y productos: costo por pieza, margen y rotación.' },
  { icon: 'groups', title: 'Fiados y Clientes', desc: 'Cuentas por cobrar, abonos rápidos y estados de morosidad.' },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-14 max-w-md mx-auto bg-surface">
      <div className="w-full space-y-4">
        <div className="text-center space-y-2.5">
          <div className="w-[72px] h-[72px] rounded-[18px] bg-primary text-on-primary flex items-center justify-center mx-auto">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M12 2l9 5v10l-9 5-9-5V7z" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">PacaPOS</h1>
          <p className="text-[13.5px] text-on-surface-variant leading-relaxed">
            Punto de venta para tiendas de ropa americana. Caja, fiados, lotes y Lives.
          </p>
        </div>

        <div className="space-y-2">
          {features.map((f) => (
            <div key={f.title} className="bg-surface-container-lowest border border-outline rounded-[14px] p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[20px]">{f.icon}</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-[13.5px] font-bold text-on-surface">{f.title}</h2>
                <p className="text-[12px] text-on-surface-variant leading-snug">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/login"
          className="w-full py-3.5 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center justify-center gap-2 active:bg-primary-deep transition-colors"
        >
          Entrar a mi tienda
        </Link>

        <p className="text-center text-[11.5px] text-on-surface-variant">
          Instalable en tu celular · Funciona offline · Datos aislados por tienda
        </p>
      </div>
    </div>
  );
}
