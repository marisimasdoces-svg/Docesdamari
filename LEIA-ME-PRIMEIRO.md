# Atualização segura — Doces da Mari

## Antes de publicar

1. Abra o site antigo.
2. Toque no círculo do usuário, no alto da tela.
3. Entre em **Dados e backup**.
4. Toque em **Baixar backup** e guarde o arquivo JSON.

O novo código usa o mesmo Firebase do site atual. Portanto, vendas, clientes, receitas e pagamentos já existentes devem aparecer automaticamente. O backup é uma proteção adicional.

## Depois de publicar

1. Abra primeiro o endereço publicado no navegador do computador.
2. Aguarde o indicador mostrar **Sincronizado**.
3. Abra o mesmo endereço no Safari/Chrome do celular e aguarde **Sincronizado**.
4. No computador, cadastre uma venda de teste.
5. Confirme se ela aparece no celular sem atualizar manualmente.
6. Corrija ou exclua a venda de teste e confirme a alteração no computador.

## PWA já instalado no celular

A versão nova atualiza o cache automaticamente. Se o ícone antigo continuar na tela inicial depois da publicação, abra o link uma vez no navegador, feche o PWA e abra novamente. Só remova e adicione o ícone de novo se ele ainda não mudar.

## Se aparecer “Erro” ou “Offline”

- confira a internet;
- toque no indicador de sincronização;
- não restaure nem apague a base;
- faça uma captura da mensagem e verifique as regras do Firestore do projeto `docesdamari-e34b7`.

