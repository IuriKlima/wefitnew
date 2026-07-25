# CRM de alunos V1

## Escopo funcional

O CRM permite pesquisar, listar, paginar, cadastrar, consultar e editar alunos; gerenciar vínculos
com unidades; inativar ou reativar; e consultar um histórico auditável. `Student` é uma entidade de
domínio separada de `User`, portanto o cadastro não cria login.

O modelo `Student`/`StudentUnit` já existia no schema aprovado pelo ADR-011. Esta entrega não exigiu
migration nova.

## Dados armazenados

- nome, obrigatório e limitado a 160 caracteres;
- nome social, e-mail e telefone opcionais;
- data de nascimento opcional, válida e nunca futura;
- observação operacional opcional, limitada a 500 caracteres;
- status `ACTIVE` ou `INACTIVE`;
- vínculos com unidades da mesma organização.

Strings são aparadas, e-mail é normalizado e campos opcionais vazios viram `null`. CPF, documentos,
biometria, prontuário, credenciais, dados médicos e outros dados sensíveis ficam fora do escopo.

## Permissões e escopo

- leituras exigem `student:read` e respeitam o contexto organizacional ou de unidade;
- mutações exigem `student:manage` em escopo organizacional;
- mutações também respeitam o entitlement `students.manage` quando existe assinatura efetiva;
- o backend valida ciclo `ACTIVE`, membership, permissão, entitlement, tenant e unidade;
- o frontend apenas reflete a decisão de contexto e não é autoridade de autorização.

## Endpoints

Todos os caminhos abaixo têm o prefixo `/organizations/:organizationId/students`.

| Método  | Caminho                  | Permissão                       | Finalidade                                |
| ------- | ------------------------ | ------------------------------- | ----------------------------------------- |
| `POST`  | `/`                      | `student:manage` organizacional | cadastrar aluno e vínculos iniciais       |
| `GET`   | `/`                      | `student:read`                  | listar com filtros, ordenação e paginação |
| `GET`   | `/summary`               | `student:read`                  | obter métricas reais do dashboard         |
| `GET`   | `/:studentId`            | `student:read`                  | consultar detalhe no escopo efetivo       |
| `GET`   | `/:studentId/history`    | `student:read`                  | consultar histórico sanitizado            |
| `PATCH` | `/:studentId`            | `student:manage` organizacional | editar somente dados globais              |
| `PUT`   | `/:studentId/units`      | `student:manage` organizacional | substituir vínculos ativos                |
| `POST`  | `/:studentId/inactivate` | `student:manage` organizacional | inativar de forma idempotente             |
| `POST`  | `/:studentId/reactivate` | `student:manage` organizacional | reativar de forma idempotente             |

Não existe endpoint de exclusão ou arquivamento no painel.

## Lista, filtros e ordenação

`GET /` aceita:

- `page`: de 1 a 1000, padrão 1;
- `pageSize`: de 1 a 100, padrão 20;
- `search`: até 120 caracteres, aplicada a nome, nome social, e-mail e telefone;
- `status`: `ACTIVE` ou `INACTIVE`;
- `unitId`: UUID de uma unidade acessível;
- `sortBy`: `name`, `status`, `createdAt` ou `updatedAt`;
- `sortDirection`: `asc` ou `desc`.

A resposta contém `data` e metadados `page`, `pageSize`, `total` e `totalPages`. A ordenação usa
critérios estáveis adicionais para evitar registros repetidos entre páginas.

## Vínculos por tipo de organização

- `PERSONAL`: o aluno deve permanecer exatamente na unidade principal;
- `GYM`: o aluno deve permanecer em exatamente uma unidade;
- `NETWORK`: o aluno deve permanecer em uma ou mais unidades.

Todos os IDs são deduplicados e validados contra a organização antes da mutação. A troca registra
individualmente vínculos adicionados e removidos.

## Ciclo de vida

Inativar e reativar são ações dedicadas, confirmadas na interface e idempotentes. Inativação não
remove o aluno nem seus vínculos e o registro continua disponível pelo filtro de inativos. Não há
exclusão física.

Módulos futuros que executem operações exclusivas de alunos ativos devem verificar o status no
próprio caso de uso; como esses módulos não integram este sprint, o CRM V1 não tenta impor regras
fora de seu domínio.

## Auditoria

As ações persistidas são:

- `student.created`;
- `student.updated`;
- `student.inactivated`;
- `student.reactivated`;
- `student.unit_linked`;
- `student.unit_unlinked`.

O histórico expõe somente ação, horário e metadados seguros: nomes de campos alterados, IDs de
unidade e transição de status. Valores de nome, contato, observação e payloads completos não são
copiados para auditoria ou histórico.

## Interface

- lista com busca, status, unidade, ordenação, tamanho de página e limpeza de filtros;
- estados de carregamento, erro, vazio e paginação;
- formulário compartilhado entre cadastro e edição;
- detalhe com abas Resumo, Unidades e Histórico;
- confirmação para inativar/reativar;
- tabela com rolagem interna no mobile, sem overflow horizontal no documento.

## Limitações conhecidas

- não há importação em massa, deduplicação assistida ou merge de cadastros;
- não há portal/login de aluno;
- não há arquivamento ou exclusão;
- não há ficha médica, avaliação, treino, contrato, cobrança ou presença;
- a prova final com Supabase, runtime RLS e Redis gerenciado ainda deve ocorrer em staging antes do
  beta externo.
