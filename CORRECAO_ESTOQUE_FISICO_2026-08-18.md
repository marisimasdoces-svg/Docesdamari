# Correção do estoque físico de potes — 18/08/2026

## Problema identificado
As versões anteriores tentavam reconstruir a quantidade disponível combinando um marco de estoque, datas, lotes e vendas históricas. Como o histórico foi criado em versões diferentes do PWA, essa reconstrução podia contar ou ignorar movimentações antigas de forma incorreta.

## Novo critério
- Saldo físico confirmado no marco desta versão: **5 potes**.
- O histórico anterior permanece intacto, mas não recalcula mais o estoque atual.
- Fonte única: `financial-settings.readyStockCurrent`.
- Nova produção: soma ao saldo.
- Nova venda: subtrai do saldo.
- Editar venda 3 → 5: subtrai somente 2.
- Editar venda 5 → 4: devolve 1.
- Excluir venda nova: devolve a quantidade ao saldo.
- Venda retroativa não movimenta o estoque físico atual.

Nenhuma venda, cliente, produção ou registro histórico é apagado ou recriado.

## Proteção para vendas antigas editadas
Cada venda passa a guardar `readyStockMovementQuantity`, que representa apenas o quanto aquela venda movimentou o contador físico desta nova fase. Assim, uma venda antiga de 3 potes editada hoje para 5 registra movimento de +2, e futuras edições trabalham sobre essa diferença sem recontar os 3 potes históricos.
