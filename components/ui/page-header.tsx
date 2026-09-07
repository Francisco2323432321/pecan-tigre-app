export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c84f80]" />
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#a94570]">{eyebrow}</p>
          </div>
        )}
        <h1 className="text-[26px] font-black leading-[1.08] tracking-[-0.045em] text-[#39262f] sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-[13px] font-medium leading-6 text-[#7a606c] sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
