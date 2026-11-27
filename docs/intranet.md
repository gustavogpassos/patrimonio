# Intranet

Desenho fechado em 27 de novembro de 2026. O repositório atual passa a ser a intranet. O nome no GitHub muda depois. Até lá, a URL continua `github.com/gustavogpassos/patrimonio`.

## O que é

Uma instituição, na rede interna. Quatro sistemas na primeira entrega, cada um no seu processo, com um login só:

- Authentik: contas, grupos, senha e biblioteca de aplicações.
- Patrimônio: o sistema que já existe, em `apps/patrimonio`.
- Wiki.js: imagem oficial, sem fork.
- Chamados: sistema novo, fila curta, repositório deste mesmo monorepo em `apps/chamados`.

Contratos entram depois, no prefixo `/contratos`. Não fazem parte desta entrega.

## Árvore do repositório

```
install.sh                      wrapper da URL histórica; executa apps/patrimonio/install.sh
apps/patrimonio/                sistema de patrimônio (Bun, React, prefixo /patrimonio)
apps/chamados/                  sistema de chamados (ainda não existe)
deploy/compose.yml              Compose da intranet
deploy/nginx/intranet.conf
deploy/setup.sh
deploy/update.sh
deploy/.env.example
deploy/authentik/blueprints/
docs/intranet.md                este desenho
docs/superpowers/plans/2026-11-27-intranet.md
```

Segredos, IP, `.env` e bancos não entram no Git. O `.gitignore` da raiz já ignora `.env`, `.env.*` (exceto `.env.example`), `data` e `*.db`.

## Acesso

HTTP na rede interna. Sem DNS no servidor. Sem TLS nesta entrega. A senha circula em claro nessa rede.

O nginx é a única porta publicada. O Postgres não tem porta no host. Os containers se falam pela rede `intranet` do Compose.

| URL | Sistema |
| --- | --- |
| `http://IP/` | redireciona para `/authentik/` |
| `http://IP/authentik/` | login e biblioteca |
| `http://IP/patrimonio/` | patrimônio |
| `http://IP/chamados/` | chamados |
| `http://IP:8081/` | wiki |

O nginx encaminha o prefixo inteiro, sem cortá-lo. Quem monta link, rota e cookie é o sistema.

- Patrimônio: `basename` `/patrimonio` no React Router, `base` `/patrimonio/` no Vite, API em `/patrimonio/api`.
- Chamados: o mesmo, com `/chamados`.
- Authentik: `AUTHENTIK_WEB__PATH=/authentik/`. A base URL é só esquema e host, `http://IP`. Imagem no mínimo `2025.12`, porque essa linha tem vários pais por grupo e o cookie de sessão em `Path=/authentik/`.
- Wiki.js não aceita pasta. Fica na porta `8081`, na raiz desse host.

Cookies dos nossos sistemas: `httpOnly`, `SameSite=Lax`, sem `Domain`, `Path` igual ao prefixo, valor cifrado, validade de 15 minutos. Nomes: `patrimonio_session` e `chamados_session`. Um cookie com `Path=/patrimonio` não segue para `/chamados` nem para a porta da wiki.

O cookie da wiki usa `Path=/`. O navegador o envia também para as outras portas desse IP. Isso fica aceito.

## Identidade

Contas nascem no Authentik. Não há servidor de e-mail. Quem esquece a senha recebe outra definida pelo administrador.

Toda senha definida pelo administrador grava o atributo `reset_password: true`. O fluxo `default-authentication-flow` ganha, nesta ordem, depois da senha atual:

1. Prompt stage com os campos `default-password-change-field-password` e `default-password-change-field-password-repeat`, ligado à expression policy `reset_password_check` (ordem 25).
2. User write stage ligado à expression policy `reset_password_update` (ordem 26), que grava a senha nova e zera o atributo.

A senha temporária não abre patrimônio, wiki nem chamados.

O cadastro pede setor e papel na wiki. Isso coloca a pessoa em grupos. A tela não pede permissão avulsa. Sem grupo, a biblioteca abre vazia.

O token OpenID Connect lista os grupos efetivos, inclusive os pais. O mapeamento `intranet-groups` devolve `user.all_groups()`, não só o grupo direto. O padrão do Authentik manda só o grupo direto e quebraria o setor.

Hierarquia, do filho para os pais:

| Grupo | Pais |
| --- | --- |
| `wiki-almoxarifado-editar` | `wiki-almoxarifado` |
| `wiki-financeiro-editar` | `wiki-financeiro` |
| `wiki-ti-editar` | `wiki-ti` |
| `wiki-geral-editar` | `wiki` |
| `setor-almoxarifado` | `wiki`, `wiki-almoxarifado`, `chamados` |
| `setor-almoxarifado-editores` | `wiki-almoxarifado-editar` |
| `setor-financeiro` | `wiki`, `wiki-financeiro`, `chamados` |
| `setor-financeiro-editores` | `wiki-financeiro-editar` |
| `setor-ti` | `wiki`, `wiki-ti`, `wiki-almoxarifado`, `wiki-financeiro`, `patrimonio`, `chamados`, `chamados-atender` |
| `setor-ti-editores` | `wiki-ti-editar`, `wiki-geral-editar` |

Leitor entra só em `setor-*`. Editor entra em `setor-*` e em `setor-*-editores`. Quem edita também lê, porque o grupo de edição é filho do de leitura.

Efeito prático:

- Todo setor lê `geral/...` na wiki e abre chamados.
- Cada setor lê a própria pasta. O editor dessa pasta edita só ela.
- Editores de `ti` editam `ti/...` e `geral/...`.
- `setor-ti` lê as outras pastas, abre o patrimônio e atende chamados.
- Almoxarifado não vê `financeiro/...` e não abre o patrimônio.

Grupo, pai e membro mudam no Authentik, sem publicar código. Inclusão num grupo que já existe vale no cookie seguinte (até 15 minutos) nos nossos sistemas, e no login seguinte na wiki. Grupo novo só libera conteúdo quando a regra correspondente existe. Na wiki, isso é uma regra de caminho com o mesmo nome. Um grupo extra, fora do par setor e editor, continua podendo ser criado pelo mesmo caminho.

Sair de um sistema apaga só o cookie dele e mantém a sessão do Authentik. Abrir de novo qualquer caminho, no endereço direto, refaz o login sem pedir senha se essa sessão existir, e devolve a pessoa ao mesmo caminho. A senha só aparece quando a sessão do Authentik acabou. Encerrar a sessão inteira é no Authentik.

## Wiki

Imagem oficial do Wiki.js, banco `wiki` no Postgres interno, login OpenID Connect.

Grupos criados uma vez na wiki, com os mesmos nomes do Authentik. Mapeamento de grupos ligado, claim `groups`, e remoção dos grupos que o token deixou de trazer.

Regras de página, caminho sem barra no começo:

| Grupo | Caminho | Permissão |
| --- | --- | --- |
| `wiki` | `geral` | ler |
| `wiki-geral-editar` | `geral` | editar |
| `wiki-almoxarifado` | `almoxarifado` | ler |
| `wiki-almoxarifado-editar` | `almoxarifado` | editar |
| `wiki-financeiro` | `financeiro` | ler |
| `wiki-financeiro-editar` | `financeiro` | editar |
| `wiki-ti` | `ti` | ler |
| `wiki-ti-editar` | `ti` | editar |

Uma página nova entra na pasta do setor. Um setor novo é um grupo novo no Authentik e uma regra nova na wiki.

## Patrimônio

Continua o domínio atual: setores, categorias, equipamentos, movimentações e manutenções. A interface segue em português.

Dois modos de banco:

- Sem `DATABASE_URL`: SQLite em `data/patrimonio.db`, que é o que o `install.sh` avulso sobe.
- Com `DATABASE_URL`: Postgres, database `patrimonio`, que é o modo da intranet.

Quem tem o grupo efetivo `patrimonio` usa o que o sistema já faz hoje. Não há tabela local de papéis.

Importação, uma vez, do SQLite para o Postgres:

1. O schema do Postgres vem das migrações.
2. O comando lê o `patrimonio.db` indicado.
3. Recusa se o Postgres já tiver equipamento.
4. Copia categorias, setores, equipamentos, movimentações e manutenções com os mesmos ids.
5. As contagens dos dois lados precisam bater.
6. O SQLite não é apagado.
7. Antes, uma cópia do arquivo, no mesmo hábito das cinco cópias do `install.sh`.
8. Instalação sem arquivo sobe vazia, só com as categorias iniciais.

## Chamados

Sistema novo em `apps/chamados`, Bun e React, database `chamados`.

Lista e quadro. Cada chamado tem título, descrição, estado (`aberto`, `em_andamento`, `resolvido`, `cancelado`), prioridade, responsável, autor e comentários.

- Grupo `chamados`: abre chamado e acompanha os próprios.
- Grupo `chamados-atender`: vê a fila e muda estado e responsável.

Fora desta entrega: e-mail, cliente externo, SLA e base de conhecimento. A base de conhecimento é a wiki.

## Operação

Um Docker Compose na máquina da intranet. Imagens com tag fixa no repositório, nunca `latest`.

`deploy/setup.sh` pergunta o IP da rede e a senha de administrador do Authentik. Usuário e senha de cada database, e o `AUTHENTIK_SECRET_KEY`, são gerados e gravados em `deploy/.env`, modo `600`. O endereço do banco, dentro da rede, é o hostname `postgres`. O script grava nos clientes OIDC os endereços:

- `http://IP/patrimonio/api/auth/callback`
- `http://IP:8081/` mais o caminho de callback que o Wiki.js exibir
- `http://IP/chamados/api/auth/callback`

`deploy/update.sh` faz `git pull` na raiz, `pg_dump` de cada database (ficam as cinco cópias mais recentes em `deploy/backups/`), sobe de novo e aplica as migrações pendentes. O `.env` e o volume do Postgres permanecem. Se a migração falha, o script para e indica o dump. Não restaura sozinho.

Ordem de subida: Compose, Postgres, nginx e Authentik; patrimônio com login; wiki; chamados.

Quando o repositório for renomeado, atualizar `REPO_URL` nos dois `install.sh` e a URL do `curl` no README de `apps/patrimonio`.

## Fora desta entrega

DNS na rede, TLS, e-mail, portal próprio, fork do Peppermint, cópia dos dumps para outra máquina, e contratos.
