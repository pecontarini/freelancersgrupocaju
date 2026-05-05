import { Store, Briefcase, Users, Plug, Building2, Award, Settings2 } from "lucide-react";
import { ConfigSection } from "@/components/ConfigSection";
import { ClearEntriesModal } from "@/components/ClearEntriesModal";
import { BudgetConfigSection as OperationalBudgetSection } from "@/components/OperationalBudgetConfigSection";
import { BonusConfigSection } from "@/components/BonusConfigSection";
import { CargosConfigSection } from "@/components/CargosConfigSection";
import { MetaSheetsLinker } from "@/components/sheets/MetaSheetsLinker";
import { UnitPartnershipsSection } from "@/components/UnitPartnershipsSection";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  useConfigLojas,
  useConfigFuncoes,
  useConfigGerencias,
} from "@/hooks/useConfigOptions";

interface ConfigGroupProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function ConfigGroup({ icon, title, children }: ConfigGroupProps) {
  return (
    <section className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export function ConfigurationsTab() {
  const lojas = useConfigLojas();
  const funcoes = useConfigFuncoes();
  const gerencias = useConfigGerencias();
  const { isAdmin, isOperator } = useUserProfile();

  const showOperacao = isAdmin || isOperator;
  const showCargosBonus = isAdmin;
  const showIntegracoes = isAdmin;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
          <p className="text-muted-foreground">
            Gerencie as opções disponíveis nos formulários de lançamento.
          </p>
        </div>
        {isAdmin && <ClearEntriesModal />}
      </div>

      {/* GRUPO 1 — INTEGRAÇÕES */}
      {showIntegracoes && (
        <ConfigGroup
          icon={<Plug className="h-4 w-4 text-primary" />}
          title="Integrações"
        >
          <MetaSheetsLinker />
        </ConfigGroup>
      )}

      {/* GRUPO 2 — OPERAÇÃO & FINANCEIRO */}
      {showOperacao && (
        <ConfigGroup
          icon={<Building2 className="h-4 w-4 text-primary" />}
          title="Operação & Financeiro"
        >
          <UnitPartnershipsSection />
          <OperationalBudgetSection />
        </ConfigGroup>
      )}

      {/* GRUPO 3 — CARGOS & BÔNUS */}
      {showCargosBonus && (
        <ConfigGroup
          icon={<Award className="h-4 w-4 text-primary" />}
          title="Cargos & Bônus"
        >
          <CargosConfigSection />
          <BonusConfigSection />
        </ConfigGroup>
      )}

      {/* GRUPO 4 — CADASTROS BÁSICOS */}
      <ConfigGroup
        icon={<Settings2 className="h-4 w-4 text-primary" />}
        title="Cadastros Básicos"
      >
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
      </ConfigGroup>
    </div>
  );
}
