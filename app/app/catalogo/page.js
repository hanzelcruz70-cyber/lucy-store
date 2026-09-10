export const dynamic = 'force-dynamic';

export default function CatalogoPage() {
  return (
    <div className="flex flex-col w-full px-gutter-mobile space-y-space-md">
      <div className="bg-primary-fixed/40 rounded-xl p-space-md text-center space-y-1 mt-space-xs">
        <span className="material-symbols-outlined text-[40px] text-primary">storefront</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Catálogo Web</h1>
        <p className="font-body-md text-body-md text-on-primary-fixed-variant">
          Tu tienda online pública con link para compartir viene en la siguiente actualización.
        </p>
      </div>
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-xs">
        <p className="font-body-md text-body-md text-on-surface">
          <strong>Lo que ya tienes funcionando:</strong> caja, lives de TikTok, lotes y fiados con tus
          datos guardados en la nube y aislados por tienda.
        </p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Instala la app en tu celular con el botón "Instalar App" para usarla como aplicación nativa.
        </p>
      </div>
    </div>
  );
}
