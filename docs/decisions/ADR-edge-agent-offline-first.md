# ADR: Arquitetura Offline-First do Edge Agent

## Contexto
Internet em academias é instável. Uma catraca não pode demorar mais de 300ms para abrir, logo validar na nuvem é impensável para o caminho crítico.

## Decisão
O agente avalia a decisão estritamente no cache local via SQLite WAL (Write-Ahead Logging). O Cloud envia Snapshots atestados (assinados), contendo Configuration, Policies e Credentials. 
Eventos de Acesso serão persistidos no disco (Outbox pattern) na mesma transação de banco que a decisão (Atomicidade).

## Consequências
- Permite uptime da catraca de 100% mesmo offline.
- Sincronização assíncrona tolerante a falhas.
