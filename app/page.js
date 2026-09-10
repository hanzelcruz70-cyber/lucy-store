import Link from 'next/link';

const Icon = ({ name, size = 20 }) => {
  const paths = {
    point_of_sale: <path d="M4 4h16v4H4zM6 8v3h12V8M5 11h14v9H5zM9 15h6" />,
    videocam: <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3" />,
    inventory_2: <path d="M12 3l9 4.5v9L12 21l-9-4.5v-9zM3 7.5l9 4.5 9-4.5M12 12v9" />,
    groups: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c1-3.4 3.5-5 6.5-5s5.5 1.6 6.5 5M16 11a3 3 0 1 0 0-6M17.5 20c-.4-1.6-1-2.9-1.8-3.8M21.5 20c-.3-1.2-.8-2.2-1.4-3" />,
    store: <path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 20V9M9.5 21.5v-6h5v6" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

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
            <Icon name="store" size={36} />
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
                <Icon name={f.icon} size={20} />
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
