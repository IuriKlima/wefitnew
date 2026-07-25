# Usuários e responsabilidades

## Modelo base

Um `User` representa uma identidade que pode acessar o sistema. A relação entre usuário e
organização ocorre por `Membership`.

Uma `Membership` pode possuir papéis e escopos:

- escopo de organização: acesso aplicável à organização inteira;
- escopo de unidade: acesso aplicável apenas a uma unidade específica.

## Papéis iniciais

Os papéis abaixo são nomes de domínio para orientar permissões. A autorização real é granular por
`Permission`; nenhuma rota ou ação de interface deve inferir autoridade pelo nome do papel.

- Proprietário: administra a organização, assinatura e permissões.
- Gestor: opera processos administrativos e acompanha indicadores.
- Recepção: atende alunos, contratos, presença e controle operacional.
- Professor: acompanha alunos, treinos, avaliações e aulas.
- Aluno: acessará portal ou aplicativo para acompanhar informações próprias.
- Profissional responsável: papel típico do plano Personal.

## Permissões do CRM de alunos

| Permissão        | Escopo efetivo         | Operações                                                                    |
| ---------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `student:read`   | organização ou unidade | listar, pesquisar, consultar resumo, detalhe e histórico no escopo concedido |
| `student:manage` | somente organização    | criar, editar dados globais, substituir vínculos e inativar/reativar         |

As mutações também exigem o entitlement `students.manage` quando há assinatura efetiva. Um grant
restrito a unidade nunca é promovido a organizacional por `unitId`, cookie, rota ou header. O
frontend usa o mesmo contexto para esconder ações indisponíveis, mas o backend é a autoridade
final.

## Alunos

ADR-011 decidiu que `Student` é uma entidade de domínio separada de `User`.

Um aluno pode existir sem login. Quando houver portal ou app, `Student.userId` poderá apontar para
a identidade correspondente. O CRM V1 não cria identidade, credencial ou acesso de aluno.
