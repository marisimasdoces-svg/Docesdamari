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

## Rodada 2 — correções após teste real

### Estoque de doces prontos corrigido por vendas reais
- A tela inicial não confia mais cegamente no `totalSold` legado dos lotes.
- O saldo disponível é reconciliado a partir das vendas reais já registradas, preservando todos os registros existentes.
- Vendas antigas sem alocação confiável são abatidas dos lotes compatíveis em ordem de produção (FIFO).
- Vendas retroativas sem vínculo com lote não consomem o estoque atual.

### Repetir receita como Livro de Receitas
- `Produzir novamente` abre a receita já cadastrada completa.
- Alterar apenas a quantidade de potes NÃO muda automaticamente os ingredientes.
- O usuário pode:
  - manter exatamente a receita original;
  - ajustar manualmente qualquer ingrediente;
  - usar o botão `Ajustar proporcionalmente aos potes` quando desejar.
- Não é necessário criar ingrediente novo nem nova receita para produzir novamente.

### PIX geral para pagamento na hora
- Removido o QR Code individual de cada linha de cliente.
- Criado botão único `PIX para pagar na hora` na tela de Vendas.
- O QR é geral, sem valor fixado; o cliente lê e informa o valor no aplicativo do banco.

### Data real de cada compra
- Toda nova compra/reposição agora solicita `Data da compra`.
- O mês da compra é derivado dessa data, não do mês que estiver aberto na interface.
- `Compras do mês` soma apenas compras cuja data pertence ao mês selecionado.
- `Compras no ano` soma todas as compras datadas naquele ano.

### Preservação de dados
- Nenhuma venda, cliente, receita, compra ou pagamento antigo é apagado.
- Não existe rotina de reset ou reimportação destrutiva.

## Rodada 2 — correções após teste real
- Estoque pronto reconciliado pelas vendas reais já registradas, sem apagar vendas.
- Repetir receita mantém a receita original; quantidade de potes não altera ingredientes automaticamente.
- Botões permitem restaurar receita original ou ajustar proporcionalmente aos potes.
- PIX passou a ser geral para pagamento na hora, sem QR individual por cliente e sem valor fixo.
- Toda compra/reposição solicita a data real da compra; mensal e anual usam essa data.
- Nenhum dado antigo é resetado, reimportado ou excluído.
