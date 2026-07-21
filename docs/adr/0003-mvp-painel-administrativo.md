# ADR-0003: MVP do Painel Administrativo — Usuários, Áudio, Cifras e Consumo

**Status:** Proposto — pendente de confirmação do usuário sobre os pontos em aberto.
**Data:** 2026-07-18
**Relacionado:** [[ADR-0001]] (`0001-rbac-plano-papel-permissao.md`), [[ADR-0002]] (`0002-definicao-usuarios-funcionalidades.md`), DOC-ADM-001 (especificação ampla de painel admin, avaliada e reduzida nesta ADR)

---

## Contexto

Um documento externo (DOC-ADM-001) propôs um painel administrativo com ~25 módulos — Dashboard, Usuários, Bandas, Músicas, Catálogo, Processamento, Chat, Marketplace, Financeiro, FinOps, Analytics, CMS, Sistema, Segurança, Logs, Monitoramento, Suporte, Armazenamento, SEO, API, Backup — escopo típico de um SaaS maduro operado por equipe. O produto está pré-lançamento (`MAINTENANCE_MODE=true`), operado por um único fundador, sem marketplace, sem app mobile e sem equipe de moderação. Construir os 25 módulos agora é esforço desalinhado com o estágio atual.

Esta ADR define o MVP real do painel administrativo: o mínimo necessário para o fundador operar o sistema sozinho, cobrindo as quatro áreas que ele definiu como essenciais — **Usuários, Áudio, Cifras e Consumo (custo × receita)**.

Duas decisões recentes mudam o desenho em relação às ADRs anteriores:

1. **Reversão do cap escondido.** [[ADR-0001]]/[[ADR-0002]] prescreviam Pro (20/mês) e ProBand (40/mês) com limite técnico **não anunciado** ao usuário — vendido como "sem limite prático". Decisão do usuário em 2026-07-18: "não vamos esconder nenhum dado do usuário, ele deve saber o que está comprando". Os limites agora são públicos, e o próprio usuário vê seu contador de uso na conta dele — o admin não precisa de lógica especial de ocultação.
2. **Custo de separação desatualizado.** O pipeline mudou para o modelo de 6 stems (`htdemucs_6s`, guitarra separada), com custo real medido ~3,5x maior que o número antigo (~R$0,15/música, modelo de 4 stems). Ver `project_backingtrack_stems_pipeline` (memory de 2026-07-18): estimativa atual ~R$0,40/música, a confirmar contra o billing real do Replicate.

## Decisão — Escopo do MVP

Quatro módulos. **Sem RBAC de equipe interna** (perfis Moderador/Financeiro/Suporte/Marketing/Editor da seção 15 do DOC-ADM-001) — overhead sem benefício enquanto houver um único operador. **Sem** impersonate, 2FA, SEO, API pública, backup automático ou monitoramento de infra — fora de escopo até haver equipe ou volume que justifique.

### 1. Usuários

| Campo/Ação | MVP | Fora do MVP |
|---|---|---|
| Listar | foto, nome, email, plano, papel(éis)/banda, status, uso do mês (X/Y separações — agora público, ver contexto), data de cadastro, último acesso | segmentação avançada, exportação CSV |
| Bloquear | suspende login/uso, mantém dados e histórico | — |
| Banir | bloqueio permanente + motivo registrado | — |
| Excluir | soft delete imediato; hard delete (LGPD) fica como ponto em aberto abaixo | exclusão em massa |
| Notificar | envio manual pontual (email/notificação interna) para 1 usuário | campanhas segmentadas, push |
| Cobrar | ação manual: reenviar cobrança Asaas, gerar link de pagamento avulso, alterar plano manualmente (ex. cortesia) | conciliação financeira automática |
| Resetar senha | sim | — |
| Ver pagamentos | sim, espelha Asaas | — |
| Ver uploads/uso | sim | — |
| Login como usuário (impersonate) | **fora do MVP** | reavaliar na Fase 2 se volume de suporte justificar |

### 2. Áudio (catálogo compartilhado — uploads dos usuários + backing tracks do fundador)

| Ação | MVP |
|---|---|
| Criar | upload direto pelo admin (fluxo atual via iReal Pro + presigned URL pro R2, já existe) |
| Bloquear | oculta do catálogo sem apagar (moderação/denúncia/disputa) |
| Excluir | remove do R2 e do banco — usar quando o takedown é definitivo |
| Modificar | metadados (título, autor, tom, BPM, gênero, tags), reprocessar separação, trocar arquivo original |
| Campos da lista | título, autor/uploader, data, status (pendente/aprovado/bloqueado), stems disponíveis, plays/downloads, denúncias |

Fora do MVP: destaque editorial, coleções/playlists oficiais, fila de aprovação como tela separada (usar filtro de status na mesma listagem).

### 3. Cifras

| Ação | MVP |
|---|---|
| Criar | cadastro manual com seções + timecodes (fluxo já existe) |
| Bloquear | oculta cifra em disputa/erro reportado sem apagar |
| Excluir | remove definitivamente |
| Modificar | editar texto/acordes/timecodes; aprovar ou rejeitar correção sugerida pela comunidade (fila simples: pendente/aprovada/rejeitada) |

A correção pela comunidade já é parte do diferencial do produto (ver `project_backingtrack_pivot`) — o admin precisa só de uma tela para aprovar/rejeitar, não de um módulo de moderação completo.

### 4. Consumo (dashboard de custo × receita do mês)

Versão mínima do FinOps discutido anteriormente — números agregados do mês, sem os 20+ submódulos do DOC-ADM-001 (sem comparador de provedores, sem alertas inteligentes, sem custo por música/usuário individual — isso fica para Fase 2/3).

| Métrica | Fonte |
|---|---|
| Separações realizadas no mês × custo médio real | Replicate (usar ~R$0,40/música, 6 stems, não o R$0,15 antigo) |
| Storage (R2) | estimativa fixa baixa (R2 sem taxa de egress) |
| Banco (Neon) + hospedagem (Vercel) | custo fixo do plano atual |
| Receita do mês (MRR) | Asaas — soma de assinaturas ativas |
| Inadimplência/recusados | Asaas |
| Margem simples | Receita − Custo |

Um número por linha, atualizado mensalmente — não precisa ser em tempo real nem por transação individual no MVP.

## Minhas contribuições

1. **Cortar RBAC de equipe interna do MVP.** A seção 15 do DOC-ADM-001 (perfis Moderador/Financeiro/Suporte/Marketing/Editor) supõe uma equipe que não existe hoje. Com um único operador, qualquer ACL interna é overhead sem benefício — revisar quando houver a primeira contratação.

2. **Não criar "fila de aprovação" como tela própria.** Tanto para Áudio quanto para Cifras, um filtro de status (pendente/aprovado/bloqueado) na mesma listagem cobre o caso de uso sem duplicar tela e lógica. O documento original trata moderação como área separada — desnecessário nesse volume.

3. **Consumo como 6 números por mês, não um módulo FinOps completo.** O documento original propõe ~20 sub-painéis (Replicate, Music.ai, R2, Neon, Vercel, Asaas, centro de custos, custo por música, custo por usuário, projeções, alertas, comparador de provedores, saúde das integrações). Para decidir se o mês fechou no azul, seis números bastam — expandir quando o volume justificar o esforço de instrumentação.

4. **Atualizar o custo de separação usado em qualquer cálculo.** R$0,15/música é o número do modelo de 4 stems, obsoleto desde a troca para `htdemucs_6s`. Usar ~R$0,40/música até confirmar contra o billing real do Replicate.

5. **Impersonate (login como usuário) fica fora do MVP.** É ferramenta de suporte — só compensa quando o volume de tickets justificar, e tem implicações de segurança/auditoria que merecem ADR própria antes de implementar.

## Pontos em aberto (decidir com o usuário)

- Confirmar se "Cobrar" no MVP deve incluir cobrança manual avulsa (ex.: cortesia paga fora do ciclo) ou só reenvio/link de cobrança existente via Asaas.
- Confirmar se hard delete (LGPD) precisa de fluxo formal (ex.: retenção de 30 dias antes de apagar definitivo) ou se soft delete + exclusão manual sob pedido já resolve no MVP.
- Confirmar granularidade do dashboard de Consumo: mensal fechado (D+1 do fim do mês) é suficiente, ou precisa de acumulado do mês corrente em tempo real desde já?
- Confirmar se a fila de aprovação de correção de cifra (comunidade) já entra neste MVP ou fica para depois — o pivô já vende "cifra validada pela comunidade" como diferencial, então pode ser dependência de lançamento, não só do admin.

## Consequências

**Positivas:** escopo cabe no esforço de um único desenvolvedor-fundador; cobre as quatro áreas que o usuário definiu como necessárias sem herdar a complexidade dos outros 21 módulos do documento original; o dashboard de Consumo simples já responde à pergunta que mais importa agora ("o mês fechou no azul?"); a reversão do cap escondido ([[ADR-0002]]) simplifica a tela de usuário — não precisa mais de dois números (real vs. anunciado).

**Negativas / riscos a monitorar:** sem impersonate, qualquer suporte a um usuário com problema exige olhar os dados indiretamente, o que pode ficar lento se o volume de tickets crescer antes do previsto; sem RBAC de equipe, o painel pressupõe um único operador de confiança total — não escala para uma segunda pessoa sem revisão; consumo mensal fechado (não em tempo real) significa que um pico de custo (ex.: abuso de separação) só aparece no relatório depois do fato, não como alerta imediato — aceitável no volume atual, mas é a primeira lacuna a fechar se o produto crescer.
