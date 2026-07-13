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

## Auditoria

Auditoria registra eventos de negocio. Metadados devem ser pequenos, sem segredo, e passam por sanitizacao de chaves sensiveis como `authorization`, `cookie`, `password`, `token` e `secret`.
