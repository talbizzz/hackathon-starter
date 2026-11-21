import { CoreActionButton } from "@/components/core-action-button";
import { siteConfig } from "@/lib/site-config";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <p className="text-lg font-medium">{siteConfig.dashboard.emptyTitle}</p>
        <p className="mt-1 text-neutral-500">{siteConfig.dashboard.emptyBody}</p>
        <CoreActionButton />
      </div>
    </div>
  );
}
