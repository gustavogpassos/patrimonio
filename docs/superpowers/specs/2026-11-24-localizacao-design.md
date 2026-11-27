# Localização no cadastro do equipamento

## Intent

Quem cadastra um equipamento precisa dizer em que ponto do setor ele está. O mesmo lugar (setor + localização) deve continuar fazendo sentido quando o sistema passar a controlar móveis e outros bens.

## Goals

- O campo livre ao lado do setor aparece como **Localização** no cadastro, na edição, na transferência, no detalhe e na coluna da exportação CSV.
- A localização continua opcional, com no máximo 120 caracteres.
- Mudar setor ou localização continua sendo uma transferência, com data e motivo. O histórico mostra o texto junto do setor de origem e de destino.

## Non-goals

- Cadastro de salas.
- Trocar o modelo de equipamento por um bem genérico nesta mudança.
- Liberar a edição direta de setor e localização no formulário de edição.

## Anti-goals

- Obrigar uma sala cadastrada antes de registrar o bem.
- Dois nomes para o mesmo texto na interface (Complemento e Localização).

## Constraints

- O texto já existe no banco (`complemento_local`, `complemento_origem`, `complemento_destino`) e na API. Instalações já têm dados nesse formato.
- Na edição, setor e localização ficam travados. A alteração passa por Transferir.

## Approaches

1. **Texto livre com o rótulo Localização.** Reaproveita o campo atual. Achar tudo numa sala depende de o texto ser escrito do mesmo jeito. Escolhido: o pedido é um campo, e as salas ainda não são uma lista controlada pelo sistema.
2. **Salas cadastradas dentro de cada setor.** A consulta por sala fica confiável, e o cadastro do bem passa a depender de uma sala existente. Descartado nesta mudança.

## Decisões

- Rótulo na interface: Localização. Vale para o formulário de cadastro, o formulário de edição (somente leitura), o diálogo de transferência, o detalhe e o cabeçalho do CSV (`localização`).
- A mensagem de transferência sem mudança passa a falar em localização: "Setor e localização de destino são iguais aos atuais."
- Chamada de implementação: colunas, campos da API e nomes no código permanecem `complemento*`. Renomear o banco não muda o que a pessoa vê e exigiria migração nas instalações já em uso.

## Fora desta decisão

- Quando existir um móvel para cadastrar, setor e localização são o lugar desse bem também. Categoria, número de série e manutenção continuam do equipamento.
