# Threat Model
- Alteração do SQLite -> Mitigado por Assinatura de Snapshot.
- Replay de Snapshot -> Mitigado por validUntil e anti-downgrade.
- Acesso indevido ao Panel -> Mitigado por bind 127.0.0.1 e proteção CSRF.
