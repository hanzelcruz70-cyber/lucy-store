export default function Loading() {
  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5" aria-busy="true" aria-label="Cargando…">
      {/* Tarjeta destacada */}
      <div className="h-[86px] rounded-[14px] bg-surface-container-low border border-outline animate-pulse" />
      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[86px] rounded-[14px] bg-surface-container-low border border-outline animate-pulse" />
        ))}
      </div>
      {/* Lista */}
      <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
            <div className="w-[38px] h-[38px] rounded-full bg-surface-container-high animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 rounded bg-surface-container-high animate-pulse w-2/3" />
              <div className="h-2.5 rounded bg-surface-container animate-pulse w-1/3" />
            </div>
            <div className="h-4 rounded bg-surface-container-high animate-pulse w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
