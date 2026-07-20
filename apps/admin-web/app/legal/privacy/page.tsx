import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-surface">
        <span className="eyebrow">Privacidade</span>
        <h1>Politica de privacidade</h1>
        <p>
          O Wefit trata os dados necessarios para autenticar usuarios, configurar a organizacao e
          operar a plataforma. Acesso e alteracoes sensiveis sao registrados para seguranca e
          auditoria.
        </p>
        <p>
          Esta pagina e uma versao preliminar do MVP e devera ser substituida pelo texto juridico
          aprovado antes da abertura publica em producao.
        </p>
        <Link className="text-link" href="/signup">
          Voltar ao cadastro
        </Link>
      </article>
    </main>
  );
}
