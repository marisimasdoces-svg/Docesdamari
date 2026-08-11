# Doces da Mari

PWA de gestão para produção, depósito, livro de receitas, vendas, clientes, cobranças por WhatsApp e caixa.

## O que esta versão corrige

- sincronização em tempo real entre celular e computador pelo mesmo Firebase;
- proteção contra um aparelho antigo apagar ou ressuscitar dados do outro;
- exclusões sincronizadas de vendas, pagamentos, itens do depósito e repartições;
- cache do PWA somente na versão publicada, sem prender uma versão antiga no editor;
- referência válida do documento legado do Firestore;
- novo layout claro, colorido e responsivo com cards funcionais flutuantes;
- logo oficial em todas as telas e nos ícones de iPhone/Android;
- gráfico real no Caixa;
- PIX e favorecida corretos nas mensagens do WhatsApp;
- fuso horário de São Paulo;
- Depósito conectado ao Livro de Receitas e baixa automática ao confirmar produção;
- contas do mês anterior para aproximar gastos de gás, luz e água.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

O projeto Firebase original foi mantido: `docesdamari-e34b7`.

