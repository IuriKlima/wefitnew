# Instrucoes permanentes para agentes

## Idioma e estilo

- Documentacao e comunicacao do projeto devem usar portugues do Brasil.
- Codigo, nomes de classes, funcoes, variaveis, arquivos tecnicos e identificadores devem usar ingles.
- Use nomes claros e consistentes com o dominio.
- Evite abstracoes genericas sem uso real e interfaces vazias apenas para simular arquitetura.

## Arquitetura

- Este produto e uma unica plataforma SaaS multi-tenant em monolito modular.
- Nao criar microsservicos sem decisao arquitetural aprovada e documentada por ADR.
- Nenhuma regra de negocio deve ficar dentro de controllers.
- Controllers apenas recebem requisicoes, validam dados e encaminham para application services ou use cases.
- Regras de negocio ficam em services, use cases e objetos de dominio.
- Modulos nao devem acessar diretamente tabelas internas de outros modulos; use contratos de aplicacao quando necessario.
- Toda tabela de negocio deve respeitar o tenant principal, `organizationId`, quando aplicavel.
- Dados por unidade devem conter `unitId` quando a regra depender de uma unidade fisica ou logica.
- Toda operacao sensivel deve ser auditavel.
- Migrations nunca devem ser alteradas depois de aplicadas. Crie uma nova migration para mudancas posteriores.

## Seguranca e dados

- Nenhuma credencial real pode ser versionada.
- Use `.env.example` para documentar variaveis de ambiente.
- O backend e a autoridade final de autorizacao; regras nao podem depender apenas do frontend.
- Evite logs com dados sensiveis, tokens, senhas, documentos ou payloads completos.
- Dados biometricos nao devem ser armazenados centralmente sem necessidade comprovada e decisao documentada.

## Qualidade

- Codigo novo deve incluir testes proporcionais ao risco e ao comportamento alterado.
- Nao esconder erros de TypeScript.
- Nao usar `any` sem justificativa explicita.
- Antes de concluir uma tarefa, execute lint, typecheck e testes relevantes.
- Preserve alteracoes existentes do usuario.
- Nao execute comandos destrutivos, como reset, limpeza recursiva ou checkout forcado, sem pedido claro do usuario.
- Decisoes arquiteturais relevantes devem ser registradas em `docs/decisions` como ADR.

## Comandos do projeto

- Instalacao: `pnpm install`
- Desenvolvimento: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Testes unitarios: `pnpm test:unit`
- Testes de integracao: `pnpm test:integration`
- Testes padrao: `pnpm test`
- Gerar Prisma Client: `pnpm db:generate`
- Formatar schema Prisma: `pnpm db:format`
- Validar schema Prisma: `pnpm db:validate`
- Aplicar migrations em desenvolvimento: `pnpm db:migrate`
- Aplicar migrations em ambiente controlado: `pnpm db:deploy`
- Aplicar migrations no banco de teste: `pnpm db:test:deploy`
- Abrir Prisma Studio: `pnpm db:studio`
- Subir infraestrutura local: `pnpm docker:up`
- Derrubar infraestrutura local: `pnpm docker:down`
- Ver logs da infraestrutura: `pnpm docker:logs`

No Windows PowerShell, se a politica de execucao bloquear `pnpm`, use `pnpm.cmd`.

## Guardrails atuais

- O namespace tecnico do monorepo e `@gym-platform/*`.
- O adapter `temporary-header` e permitido apenas fora de producao.
- Testes de integracao devem usar banco separado com nome terminando em `_test`.
- Reset de banco de teste exige `ALLOW_TEST_DATABASE_RESET=true`.
- O modulo de alunos segue o modelo aprovado no ADR-011.
