import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article className="legal-surface">
        <span className="eyebrow">Wefit</span>
        <h1>Termos de uso</h1>
        <p>
          Esta versao preliminar descreve o uso autorizado do Wefit durante o MVP. O responsavel
          pela organizacao deve fornecer dados verdadeiros, proteger suas credenciais e limitar
          acessos conforme a funcao de cada pessoa.
        </p>
        <p>
          Funcionalidades, disponibilidade e condicoes comerciais dependem de instrumento contratual
          proprio. Nenhuma selecao feita no onboarding realiza cobranca.
        </p>
        <Link className="text-link" href="/signup">
          Voltar ao cadastro
        </Link>
      </article>
    </main>
  );
}
