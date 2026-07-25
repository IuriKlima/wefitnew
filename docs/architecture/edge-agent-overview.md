# Wefit Edge Agent - Visão Geral

O Edge Agent atua como proxy offline inteligente para o Wefit Cloud. 
- Escuta TCP para hardware.
- Realiza check offline e loga no SQLite local.
- Sincroniza (Outbox) com a nuvem assincronamente (MockCloudClient p/ Testes, HTTPCloudClient p/ Prod).
