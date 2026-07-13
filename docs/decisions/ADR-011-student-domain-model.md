# ADR-011: Modelo de dominio de alunos

## Status

Aceita.

## Contexto

A Fase 1A inicia a primeira vertical funcional de gestao de alunos. O modelo anterior deixava pendente se aluno seria uma extensao direta de `User` ou uma pessoa de dominio separada.

Alunos podem existir antes de terem acesso ao portal ou aplicativo. Redes tambem precisam permitir que um aluno tenha vinculos com uma ou mais unidades ao longo do tempo.

## Decisao

Criar `Student` como entidade de dominio separada de `User`.

Regras do modelo:

- `Student` pertence a uma `Organization`.
- `Student.userId` e opcional para acesso futuro ao portal/app.
- vinculos com unidades ficam em `StudentUnit`;
- `StudentUnit` pertence a `Organization` e referencia `Student` e `Unit` por foreign keys compostas;
- dados sensiveis ficam fora desta etapa.

### Escopo efetivo de permissao

O escopo efetivo e definido pelo backend conforme a natureza da operacao, e nao pela simples
presenca de `x-unit-id`:

- leituras podem ser contextuais; com `unitId`, o aluno precisa possuir `StudentUnit` ativo para
  a unidade e somente esse vinculo e retornado;
- criacao de `Student`, alteracao dos dados globais, alteracao de status, substituicao de vinculos
  e arquivamento sao operacoes organizacionais e exigem grant cujo `MembershipRole.unitId` seja
  nulo;
- um grant restrito a unidade nao se torna global quando a requisicao envia `x-unit-id` e nao
  autoriza criacao de novas unidades, mesmo contendo `unit:manage`;
- enquanto nao houver casos de uso locais explicitos para `StudentUnit`, grants restritos a
  unidade podem consultar alunos do seu escopo, mas nao alterar o `Student` nem seus vinculos;
- uma futura administracao local de vinculos deve possuir endpoints e regras proprias de
  `StudentUnit`; `unitIds` em `PATCH Student` sempre representa substituicao organizacional real e
  nunca sucesso sem mutacao.

### Ciclo de vida

- inativar e alterar `Student.status` para `INACTIVE` por `PATCH`; `deletedAt` e os vinculos
  permanecem inalterados, e o aluno continua pesquisavel pelo filtro `INACTIVE`;
- arquivar e o soft delete explicito do `Student`; exige escopo organizacional, preenche
  `Student.deletedAt`, encerra os `StudentUnit` ativos e remove o cadastro das consultas normais;
- a interface deve nomear essas acoes separadamente e exigir confirmacao textual para arquivar.

O MVP armazena apenas:

- nome;
- nome social opcional;
- e-mail opcional;
- telefone opcional;
- data de nascimento opcional;
- observacao operacional curta;
- status `ACTIVE` ou `INACTIVE`;
- soft delete.

Nao armazenar nesta etapa:

- biometria;
- prontuario medico;
- CPF;
- documentos pessoais;
- dados sensiveis sem decisao legal/produto especifica.

## Alternativas consideradas

- Usar `User` diretamente como aluno.
- Criar `Student` sem relacao futura com `User`.
- Vincular aluno diretamente a uma unica `Unit`.

## Consequencias positivas

- Permite cadastro operacional sem login.
- Preserva caminho para portal/app com `userId` opcional.
- Suporta Redes com multiplas unidades via `StudentUnit`.
- Evita antecipar dados sensiveis ou identidade final de aluno.

## Riscos e mitigacoes

- Risco: duplicidade futura entre `Student` e `User`.
  Mitigacao: vinculo opcional por `userId` e unicidade ativa por organizacao.
- Risco: consultas esquecidas sem `organizationId`.
  Mitigacao: constraints compostas, RBAC e testes de isolamento.
- Risco: necessidade futura de dados regulados.
  Mitigacao: nova ADR antes de incluir CPF, biometria, prontuario ou dados sensiveis.
