import { Store, Briefcase, Users } from "lucide-react";
import { ConfigSection } from "@/components/ConfigSection";
import {
  useConfigLojas,
  useConfigSetores,
  useConfigGerencias,
} from "@/hooks/useConfigOptions";

export function ConfigurationsTab() {
  const lojas = useConfigLojas();
  const setores = useConfigSetores();
  const gerencias = useConfigGerencias();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">
          Gerencie as opções disponíveis nos formulários de lançamento.
        </p>
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
          title="Setores"
          icon={<Briefcase className="h-5 w-5 text-primary" />}
          options={setores.options}
          isLoading={setores.isLoading}
          onAdd={async (nome) => {
            await setores.addOption.mutateAsync(nome);
          }}
          onUpdate={async (id, nome) => {
            await setores.updateOption.mutateAsync({ id, nome });
          }}
          onDelete={async (id) => {
            await setores.deleteOption.mutateAsync(id);
          }}
          isAdding={setores.addOption.isPending}
          isUpdating={setores.updateOption.isPending}
          isDeleting={setores.deleteOption.isPending}
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
