# Supply chain

## Politica inicial

- Usar `pnpm-lock.yaml` como fonte de verdade de dependencias.
- CI deve usar `pnpm install --frozen-lockfile`.
- Dependencias novas devem ter motivo claro e escopo limitado.
- Evitar upgrades amplos sem tarefa especifica.
- Nao executar scripts de terceiros fora do fluxo padrao de instalacao sem revisao.
- Credenciais e tokens nunca devem entrar em `.env.example`, docs ou testes.

## Frontend e lint

O projeto usa ESLint flat config com o plugin oficial do Next para `apps/admin-web`. Isso evita o aviso de plugin nao detectado e mantem as regras do Next isoladas ao app web.

## Prisma

Depois de mudancas no schema:

```bash
pnpm db:format
pnpm db:validate
pnpm db:generate
```

Migrations aplicadas nao devem ser reescritas.

## Build scripts bloqueados

`pnpm install` pode reportar build script ignorado para `unrs-resolver`, dependencia transitiva de `eslint-config-next`. A fundacao mantem esse script bloqueado explicitamente porque lint, typecheck e build funcionam sem executar o build nativo.

Nao aprove build scripts de terceiros sem revisar origem, necessidade e impacto.
