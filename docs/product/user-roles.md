# Usuarios e responsabilidades

## Modelo base

Um `User` representa uma identidade que pode acessar o sistema. A relacao entre usuario e organizacao ocorre por `Membership`.

Uma `Membership` pode possuir papeis e escopos:

- escopo de organizacao: acesso aplicavel a organizacao inteira;
- escopo de unidade: acesso aplicavel apenas a uma unidade especifica.

## Papeis iniciais

Os papeis abaixo sao nomes de dominio para orientar permissoes. A autorizacao real deve ser granular por `Permission`.

- Proprietario: administra a organizacao, assinatura e permissoes.
- Gestor: opera processos administrativos e acompanha indicadores.
- Recepcao: atende alunos, contratos, presenca e controle operacional.
- Professor: acompanha alunos, treinos, avaliacoes e aulas.
- Aluno: acessa portal ou aplicativo para acompanhar informacoes proprias.
- Profissional responsavel: papel tipico do plano Personal.

## Alunos

ADR-011 decidiu que `Student` e uma entidade de dominio separada de `User`.

Um aluno pode existir sem login. Quando houver portal ou app, `Student.userId` podera apontar para a identidade correspondente.
