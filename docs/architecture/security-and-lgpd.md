# Seguranca e LGPD

## Principios

- Minimizacao de dados.
- Isolamento por tenant.
- Auditoria de operacoes sensiveis.
- Logs sem dados sensiveis.
- Segredos fora do repositorio.
- Autorizacao validada no backend.

## Dados pessoais

Dados de alunos, usuarios e colaboradores devem ter finalidade clara. Campos sensiveis devem ser evitados ate que haja necessidade comprovada.

O onboarding coleta somente identificacao do negocio, endereco da unidade e contato do responsavel. O payload nao aceita senhas, tokens, documentos pessoais ou dados biometricos. CNPJ e exigido somente para academia e rede; operacao do tipo Personal pode omiti-lo.

## Biometria

Nao armazenar dados biometricos centralmente sem decisao formal. Se houver necessidade futura, a decisao deve considerar base legal, criptografia, retencao, revogacao, consentimento quando aplicavel e impacto operacional.

## Seguranca tecnica inicial

- Helmet.
- CORS por ambiente, sem wildcard com credentials.
- Rate limiting basico.
- Tratamento global de excecoes.
- Correlation ID por requisicao.
- Validacao centralizada de configuracao.
- Adapter temporario de auth bloqueado em producao.
- Sanitizacao de metadados de auditoria.
- Cadastro com resposta generica contra enumeracao de contas e senha forte no cliente.
- Feature flag de self-service fechada por padrao e bloqueada em producao.
- Limite por ator para inicio e conclusao do onboarding, alem do rate limit global da API.
- Concorrencia otimista para impedir sobrescrita silenciosa entre abas ou sessoes.

## Auditoria

Auditoria registra eventos de negocio. Metadados devem ser pequenos, sem segredo, e passam por sanitizacao de chaves sensiveis como `authorization`, `cookie`, `password`, `token` e `secret`.

O onboarding audita bootstrap, salvamento de etapa, cancelamento e conclusao. Metadados registram somente etapa, tipo de organizacao, codigo de configuracao e versao; endereco, telefone, e-mail e o payload completo nao devem ser copiados para logs.
