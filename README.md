# Assets

IT equipment tracking: sectors, categories, transfers, and maintenance.

One Bun process serves the interface and the API. The database is the file `data/patrimonio.db`.

Each install has its own database, on the computer where the system runs. The public repository contains nobody's data.

## Install

On a Linux machine without Bun, Git, or the other dependencies:

```bash
curl -fsSL https://raw.githubusercontent.com/gustavogpassos/patrimonio/main/install.sh | sudo bash
```

The script installs whatever is missing, clones the repository into `/opt/patrimonio`, builds the interface, and starts a service on port `8787`. On the first run, if `data/patrimonio.db` does not exist, the system creates that file with the initial categories and no equipment.

Without `sudo`, the install lives in `~/patrimonio` and the service follows the user session. Another directory: `PATRIMONIO_DIR=/path curl ... | bash`.

Open `http://<this-computer-ip>:8787` from any machine on the network. To change the port, edit `patrimonio.env` in the install directory and run `./install.sh` again.

## Update

After a new version is on GitHub, from the install directory:

```bash
sudo ./install.sh
```

The same command downloads the published code, keeps `data/patrimonio.db`, and applies only the migrations this install has not run yet. Then the service restarts. A copy of the database from before the update is stored in `data/backups/`, keeping the five most recent.

An install made without `sudo` is updated with `./install.sh`, without `sudo`.

A database change arrives as a new file in `src/db/migrations/`, registered in `src/db/migrate.ts`. A migration that already ran is not edited and is not executed again.

## Development

Requirement: [Bun](https://bun.sh) 1.1+.

```bash
bun install
bun run dev
```

- Interface: http://127.0.0.1:5173 (Vite, with a proxy for `/api`)
- API: http://127.0.0.1:8787

## Data

- Database: `data/patrimonio.db` (created on the first run)
- Backup and restore: buttons at the bottom of the sidebar

## Tests

```bash
bun test
```
