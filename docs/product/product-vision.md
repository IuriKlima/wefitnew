# Visão do produto

## Propósito

A plataforma será um SaaS de gestão para profissionais de educação física, academias de uma unidade e redes com múltiplas unidades. O objetivo é concentrar operação, relacionamento com alunos, prescrição de treinos, avaliações, agenda, controle de acesso e integrações em uma única base multi-tenant.

## Princípios

- Uma única plataforma atende Personal, Academia e Redes.
- O plano contratado libera funcionalidades e limites configuráveis.
- A `Organization` é o tenant principal.
- Uma organização Personal possui uma unidade lógica.
- Uma Academia possui uma unidade física.
- Uma Rede pode possuir múltiplas unidades.
- O backend é a autoridade final para autenticação, autorização e isolamento de tenant.
- Integrações externas devem ser isoladas por adapters e filas.

## Público

- Profissionais independentes que precisam organizar alunos, agenda e treinos.
- Academias com equipe operacional, professores, recepção e alunos.
- Redes que precisam de gestão centralizada, permissões por unidade e indicadores consolidados.

## Resultado esperado

O produto deve reduzir trabalho manual, melhorar visibilidade operacional e permitir evolução gradual para integrações com catracas, Wellhub, TotalPass, pagamentos e experiências mobile.
