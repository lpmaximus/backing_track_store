import StageContent from "./StageContent";

/**
 * Modo palco (Fase S3 / ADR-BTS-005, §6) — execução contínua do setlist.
 *
 * Sem SiteHeader/SiteFooter de propósito: é uma tela cheia, sem distração,
 * pensada para ficar aberta num celular em cima da caixa de som durante o
 * ensaio ou o show. A navegação de volta é o botão "✕ Sair" dentro do
 * StageContent, não a barra de navegação do site.
 */
export default async function StagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StageContent setlistId={id} />;
}
