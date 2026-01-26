import { ConfigurationsTab } from "@/components/ConfigurationsTab";
import { UserManagement } from "@/components/UserManagement";

export function ConfiguracoesTabWrapper() {
  return (
    <div className="space-y-6 fade-in">
      <ConfigurationsTab />
      <UserManagement />
    </div>
  );
}
