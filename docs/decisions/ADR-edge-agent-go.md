# ADR: Uso de Go para o Wefit Edge Agent

## Contexto
O Edge Agent rodará localmente nas academias sob Windows (maioria esmagadora). Precisa ser instalado como serviço, iniciar junto com a máquina, interagir por TCP com catracas, e sincronizar eventos em backoff via HTTP usando SQLite.

## Decisão
Usaremos a linguagem **Go**.

## Consequências
- Binário estático nativo para Windows amd64.
- Uso de `golang.org/x/sys/windows/svc` direto sem wrappers de terceiros.
- Concorrência nativa (goroutines) excelente para manter sockets TCP e HTTP sync loop separadamente.
- Baixo consumo de memória (crucial para máquinas de recepção).
