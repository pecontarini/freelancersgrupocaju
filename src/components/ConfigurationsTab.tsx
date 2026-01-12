import { Store, Briefcase, Users } from "lucide-react";
import { ConfigSection } from "@/components/ConfigSection";
import { ClearEntriesModal } from "@/components/ClearEntriesModal";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  useConfigLojas,
  useConfigFuncoes,
  useConfigGerencias,
} from "@/hooks/useConfigOptions";

export function ConfigurationsTab() {
  const lojas = useConfigLojas();
  const funcoes = useConfigFuncoes();
  const gerencias = useConfigGerencias();
  const { isAdmin } = useUserProfile();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
          <p className="text-muted-foreground">
            Gerencie as opções disponíveis nos formulários de lançamento.
          </p>
        </div>
        {isAdmin && <ClearEntriesModal />}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ConfigSection
          title="Lojas"
          icon={<Store className="h-5 w-5 text-primary" />}
          options={lojas.options}
          isLoading={lojas.isLoading}
          onAdd={async (nome) => {
            await lojas.addOption.mutateAsync(nome);
          }}
          onUpdate={async (id, nome) => {
            await lojas.updateOption.mutateAsync({ id, nome });
          }}
          onDelete={async (id) => {
            await lojas.deleteOption.mutateAsync(id);
          }}
          isAdding={lojas.addOption.isPending}
          isUpdating={lojas.updateOption.isPending}
          isDeleting={lojas.deleteOption.isPending}
        />

        <ConfigSection
          title="Funções"
          icon={<Briefcase className="h-5 w-5 text-primary" />}
          options={funcoes.options}
          isLoading={funcoes.isLoading}
          onAdd={async (nome) => {
            await funcoes.addOption.mutateAsync(nome);
          }}
          onUpdate={async (id, nome) => {
            await funcoes.updateOption.mutateAsync({ id, nome });
          }}
          onDelete={async (id) => {
            await funcoes.deleteOption.mutateAsync(id);
          }}
          isAdding={funcoes.addOption.isPending}
          isUpdating={funcoes.updateOption.isPending}
          isDeleting={funcoes.deleteOption.isPending}
        />

        <ConfigSection
          title="Gerências"
          icon={<Users className="h-5 w-5 text-primary" />}
          options={gerencias.options}
          isLoading={gerencias.isLoading}
          onAdd={async (nome) => {
            await gerencias.addOption.mutateAsync(nome);
          }}
          onUpdate={async (id, nome) => {
            await gerencias.updateOption.mutateAsync({ id, nome });
          }}
          onDelete={async (id) => {
            await gerencias.deleteOption.mutateAsync(id);
          }}
          isAdding={gerencias.addOption.isPending}
          isUpdating={gerencias.updateOption.isPending}
          isDeleting={gerencias.deleteOption.isPending}
        />
      </div>
    </div>
  );
}
