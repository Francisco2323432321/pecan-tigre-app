import { Icon, type IconName } from "./icons";

export default function EmptyState({ title, description, icon = "package", action }: { title: string; description: string; icon?: IconName; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f6] text-[#c65383]">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-bold text-[#3e2833]">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-[#80616f]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
