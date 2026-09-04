import { redirect } from "next/navigation";
import AppNavigation from "@/components/app-navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");

  return (
    <div className="min-h-dvh w-full bg-[#fff8fb] md:flex">
      <AppNavigation name={profile.full_name || "Usuario"} role={profile.role} />
      <div className="min-w-0 flex-1 pt-14 md:pt-0">
        <div className="min-h-dvh w-full pb-[82px] md:pb-0">{children}</div>
      </div>
    </div>
  );
}
