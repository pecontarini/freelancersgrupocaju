import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, Edit2, Trash2, Store, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { supabase } from "@/integrations/supabase/client";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { AppRole } from "@/types/freelancer";

interface UserWithProfile {
  id: string;
  email: string;
  profile: {
    id: string;
    full_name: string | null;
    unidade_id: string | null;
  } | null;
  roles: AppRole[];
  unidade_name: string | null;
}

export function UserManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("gerente_unidade");
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");

  const queryClient = useQueryClient();
  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();

  // Fetch all users with their profiles and roles
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");

      if (profilesError) throw profilesError;

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Get all lojas for name lookup
      const { data: lojasData } = await supabase
        .from("config_lojas")
        .select("id, nome");

      const lojasMap = new Map(lojasData?.map((l) => [l.id, l.nome]) || []);

      // Combine data
      const usersWithData: UserWithProfile[] = profiles.map((profile) => {
        const userRoles = roles
          .filter((r) => r.user_id === profile.user_id)
          .map((r) => r.role as AppRole);

        return {
          id: profile.user_id,
          email: profile.full_name || "Email não disponível",
          profile: {
            id: profile.id,
            full_name: profile.full_name,
            unidade_id: profile.unidade_id,
          },
          roles: userRoles,
          unidade_name: profile.unidade_id ? lojasMap.get(profile.unidade_id) || null : null,
        };
      });

      return usersWithData;
    },
  });

  // Update user role
  const updateUserRole = useMutation({
    mutationFn: async ({
      userId,
      role,
      unidadeId,
    }: {
      userId: string;
      role: AppRole;
      unidadeId: string | null;
    }) => {
      // First, remove existing roles
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Add new role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: role,
      });

      if (roleError) throw roleError;

      // Update profile with unidade_id if gerente_unidade
      if (role === "gerente_unidade" && unidadeId) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ unidade_id: unidadeId })
          .eq("user_id", userId);

        if (profileError) throw profileError;
      } else if (role === "admin") {
        // Admins don't need unidade_id
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ unidade_id: null })
          .eq("user_id", userId);

        if (profileError) throw profileError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuário atualizado com sucesso!");
      setIsDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error) => {
      console.error("Error updating user:", error);
      toast.error("Erro ao atualizar usuário.");
    },
  });

  const handleEditUser = (user: UserWithProfile) => {
    setEditingUser(user);
    setSelectedRole(user.roles[0] || "gerente_unidade");
    setSelectedUnidadeId(user.profile?.unidade_id || "");
    setIsDialogOpen(true);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;

    if (selectedRole === "gerente_unidade" && !selectedUnidadeId) {
      toast.error("Selecione uma unidade para o gerente.");
      return;
    }

    updateUserRole.mutate({
      userId: editingUser.id,
      role: selectedRole,
      unidadeId: selectedRole === "gerente_unidade" ? selectedUnidadeId : null,
    });
  };

  const getRoleBadge = (roles: AppRole[]) => {
    if (roles.includes("admin")) {
      return (
        <Badge className="bg-primary">
          <Shield className="mr-1 h-3 w-3" />
          Admin
        </Badge>
      );
    }
    if (roles.includes("gerente_unidade")) {
      return (
        <Badge variant="secondary">
          <Store className="mr-1 h-3 w-3" />
          Gerente
        </Badge>
      );
    }
    return <Badge variant="outline">Sem Role</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Gestão de Usuários
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários e suas permissões. Novos usuários são criados automaticamente
            ao fazer o primeiro login.
          </p>

          {users.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.profile?.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.roles)}</TableCell>
                      <TableCell>
                        {user.unidade_name ? (
                          <Badge variant="outline">{user.unidade_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Edit User Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Permissões</DialogTitle>
              <DialogDescription>
                Configure a permissão e unidade do usuário.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input
                  value={editingUser?.profile?.full_name || editingUser?.email || ""}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label>Permissão</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value: AppRole) => setSelectedRole(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin (Acesso Total)
                      </span>
                    </SelectItem>
                    <SelectItem value="gerente_unidade">
                      <span className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        Gerente de Unidade
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === "gerente_unidade" && (
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select
                    value={selectedUnidadeId}
                    onValueChange={setSelectedUnidadeId}
                    disabled={isLoadingLojas}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {lojas.map((loja) => (
                        <SelectItem key={loja.id} value={loja.id}>
                          {loja.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveUser}
                disabled={updateUserRole.isPending}
              >
                {updateUserRole.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
