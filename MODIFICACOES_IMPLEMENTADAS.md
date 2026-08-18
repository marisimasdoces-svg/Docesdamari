# Doces da Mari — alterações implementadas

Esta versão foi construída de forma aditiva e compatível com os dados já existentes no Firebase. Não há rotina de reset, importação destrutiva ou substituição em massa dos registros atuais.

## Depósito
- Reposição de produto existente sem duplicar cadastro.
- Nova compra soma quantidade disponível e mantém o histórico financeiro da aquisição.
- Custo médio móvel passa a considerar o estoque ainda disponível + o valor da nova compra.
- Produção continua baixando automaticamente os insumos.

## Estoque de doces prontos
- A tela inicial mostra o total realmente disponível para venda, sem zerar na virada do dia.
- Vendas consomem o estoque permanente de lotes produzidos.
- Novas vendas podem consumir mais de um lote do mesmo doce, mantendo o custo correto.
- Edição de venda aplica apenas a diferença de quantidade.
- Redução ou exclusão de venda devolve as unidades aos lotes correspondentes.
- Vendas antigas continuam compatíveis pelo campo batchId já existente.

## Caixa
- Tela principal simplificada para Vendas, Lucro dos doces, Compras e Recebido.
- Custo dos potes vendidos é usado para calcular lucro sem gerar uma segunda saída financeira.
- Compras continuam sendo registradas como saída financeira uma única vez.
- Detalhes matemáticos ficam recolhidos em “Ver detalhes”.
- Inclusão de marco financeiro: saldo atual da conta dos doces passa a ser a referência do lucro acumulado, e novas movimentações são aplicadas a partir do momento do marco.
- Inclusão de histórico mensal anterior ao aplicativo; se já houver vendas reais registradas em um mês, o histórico consolidado não é somado novamente.

## PIX
- Dados do PIX configuráveis na tela Caixa.
- Botão de QR Code PIX nas vendas nominais.
- QR Code com valor exato da venda e opção PIX Copia e Cola.
- Confirmação do pagamento continua manual, preservando o fluxo atual.

## Compatibilidade
- IDs de vendas, clientes, receitas, estoque e lotes existentes são preservados.
- Nenhuma coleção existente foi substituída.
- As configurações financeiras novas reutilizam a coleção `utilitySettings`, evitando exigir migração de regras do Firebase para uma coleção nova.
