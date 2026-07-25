import { Skeleton } from "@gym-platform/ui";

export default function Loading() {
  return (
    <main className="content" aria-busy="true">
      <Skeleton lines={4} label="Carregando painel" />
      <Skeleton lines={6} label="Carregando indicadores" />
    </main>
  );
}
