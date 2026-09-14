import { AppShell } from "@/components/AppShell";
import { NewFieldForm } from "@/components/NewFieldForm";

export default function NewFieldPage() {
  return (
    <AppShell
      title="Novo talhão"
      subtitle="Cadastre uma nova área para acompanhamento durante a safra."
    >
      <NewFieldForm />
    </AppShell>
  );
}