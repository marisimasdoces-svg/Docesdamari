# Correção - edição de vendas e estoque de potes

Problema corrigido: quando uma venda antiga era editada (ex.: José passou de 3 para 5 potes), a quantidade disponível de potes não diminuía.

Causa: o estoque atual usa um marco físico manual (13 potes em 18/08/2026). Vendas anteriores a esse marco já estavam embutidas nesse saldo. Ao editar uma venda anterior ao marco, a data original da venda continuava antiga e o cálculo do estoque ignorava o acréscimo feito hoje.

Correção: vendas antigas agora armazenam somente o ajuste feito depois do marco. Ex.: 3 -> 5 registra +2; depois 5 -> 4 registra -1, ficando ajuste acumulado +1. O estoque atual desconta apenas essa diferença, sem recontar a venda histórica inteira e sem alterar/apagar os registros existentes.
