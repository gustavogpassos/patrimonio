# Patrimônio

Controle de equipamentos de informática: setores, categorias, movimentações e manutenções.

Um processo Bun serve a interface e a API. O banco fica no arquivo `data/patrimonio.db`.

Cada instalação tem o próprio banco, no computador em que o sistema roda. O repositório público não contém dados de ninguém.

## Instalação

Num Linux sem Bun, Git ou as demais dependências:

```bash
curl -fsSL https://raw.githubusercontent.com/gustavogpassos/patrimonio/main/install.sh | sudo bash
```

O script instala o que faltar, clona o repositório em `/opt/patrimonio`, gera a interface e sobe um serviço na porta `8787`. Na primeira execução, se `data/patrimonio.db` não existir, o sistema cria esse arquivo com as categorias iniciais e sem equipamentos.

Sem `sudo`, a instalação fica em `~/patrimonio` e o serviço acompanha a sessão do usuário. Outro diretório: `PATRIMONIO_DIR=/caminho curl ... | bash`.

Abra `http://<ip-deste-computador>:8787` em qualquer máquina da rede. Para mudar a porta, edite `patrimonio.env` na pasta da instalação e rode `./install.sh` de novo.

## Atualização

Depois que uma versão nova estiver no GitHub, no diretório da instalação:

```bash
sudo ./install.sh
```

O mesmo comando baixa o código publicado, preserva `data/patrimonio.db` e aplica só as migrações que essa instalação ainda não rodou. Em seguida o serviço reinicia. Uma cópia do banco de antes da atualização fica em `data/backups/`, com as cinco mais recentes.

Quem instalou sem `sudo` atualiza com `./install.sh`, sem `sudo`.

Uma mudança de banco entra como um arquivo novo em `src/db/migrations/`, registrado em `src/db/migrate.ts`. Migração já aplicada não é editada nem executada de novo.

O código deste sistema fica em `apps/patrimonio` dentro do repositório. A instalação avulsa continua pelo `install.sh` da raiz, que executa o script desta pasta. O banco da instalação fica em `apps/patrimonio/data/patrimonio.db` dentro do clone.

## Desenvolvimento

Requisito: [Bun](https://bun.sh) 1.1+. Na pasta `apps/patrimonio`:

```bash
bun install
bun run dev
```

- Interface: http://127.0.0.1:5173 (Vite, com proxy de `/api`)
- API: http://127.0.0.1:8787

## Dados

- Banco: `data/patrimonio.db` (criado na primeira execução)
- Backup e restauração: botões no rodapé da barra lateral

## Testes

```bash
bun test
```
