# Correção definitiva — recompra, vendidos hoje e estoque físico

Marco confirmado em 18/08/2026:
- 13 potes disponíveis no início do dia.
- 8 potes vendidos no dia.
- 5 potes disponíveis após essas vendas.

## Problema anterior
O painel calculava "vendidos hoje" pela `saleDate` original. Assim, quando um cliente que já tinha comprado voltava e a venda antiga era editada (por exemplo, 3 -> 5), os +2 potes saíam da venda histórica, mas não eram reconhecidos corretamente como uma movimentação do dia atual no painel.

## Nova regra
O app passa a manter dois contadores operacionais persistentes e independentes do histórico antigo:
1. `readyStockCurrent`: quantos potes existem fisicamente para venda agora.
2. `readyStockSoldTodayQuantity`: quantos potes foram vendidos no dia atual.

Cada evento movimenta os dois de forma atômica no mesmo estado:
- Nova venda de 2: estoque -2, vendidos hoje +2.
- Editar venda de 3 para 5: estoque -2, vendidos hoje +2.
- Editar venda de 5 para 4: estoque +1, vendidos hoje -1.
- Nova produção de 33: estoque +33, vendidos hoje não muda.

A data original da venda não é alterada.

## Marco único
A primeira execução desta versão grava, uma única vez:
- `readyStockCurrent = 5`
- `readyStockSoldTodayDate = 2026-08-18`
- `readyStockSoldTodayQuantity = 8`
- `readyStockLedgerVersion = 2026-08-18-v2`

Isso NÃO altera, apaga ou recria vendas, clientes, pagamentos, receitas ou lotes existentes.

## Compatibilidade
Os lotes antigos continuam preservados para histórico e custo, mas não podem bloquear uma recompra quando o contador físico confirma que existem potes disponíveis.
