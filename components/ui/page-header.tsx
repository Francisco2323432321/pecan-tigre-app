import BackButton from "@/components/ui/back-button";

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
    <div className="mb-6 flex flex-col gap-4 xl:mb-7 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <BackButton />
        {eyebrow && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#eadff0] bg-white/80 px-3 py-1.5 shadow-[0_8px_18px_rgba(38,23,46,.03)]">
            <span className="h-2 w-2 rounded-full bg-[linear-gradient(135deg,#6d5cff_0%,#ca4d87_100%)]" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8f6193]">{eyebrow}</p>
          </div>
        )}
        <h1 className="text-[30px] font-black leading-[1.02] tracking-[-0.06em] text-[#261d31] sm:text-[38px] xl:text-[44px]">{title}</h1>
        {description && <p className="mt-3 max-w-4xl text-[14px] leading-6 text-[#6b6076] sm:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
