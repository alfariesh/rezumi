# Production database on the VPS

Production PostgreSQL moved from Neon to a Tencent Cloud Lighthouse VPS on 2026-11-15 (no data was carried over; the app
had no users yet). Neon was left in place and can be deleted once the VPS has run cleanly for a while.

## Layout

| Piece             | Value                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| Server            | Lighthouse `lhins-c762px0u`, region `ap-jakarta`, Ubuntu 26.04, 2 vCPU, 2 GB RAM, 40 GB disk, `43.157.211.152`      |
| PostgreSQL        | 18, cluster `18/main`, database `rezumi`, owner/login role `rezumi`; listens on `127.0.0.1`/`::1` only              |
| Settings          | `/etc/postgresql/18/main/conf.d/rezumi.conf` (memory sized for 2 GB), `tls.conf` (private CA in `tls/`)             |
| Hyperdrive        | `vitaekit` (`f2e0cd8d0b084ed5bdbfb8a1de8a80dc`), caching off, origin = Workers VPC service                          |
| Workers VPC       | service `rezumi-db` (`01a1dc88-f77d-7d80-baf0-96a2f83c1f2d`), tcp 5432 → `127.0.0.1`, cert verification disabled    |
| Cloudflare Tunnel | `rezumi-db` (`0d09cbf6-83e8-49a5-ab42-f03a8a880c94`), `cloudflared` systemd service on the VPS                      |
| Backups           | `rezumi-db-backup.timer` daily ~19:00 UTC → `/var/backups/rezumi-db` (14 days) and R2 `rezumi-db-backups` (30 days) |

Certificate verification is disabled on the VPC service because Workers VPC does not accept a private CA yet and the
only hop it covers is loopback on the VPS; the Hyperdrive → `cloudflared` leg runs inside the encrypted tunnel. Nothing
but SSH is reachable from the internet; `fail2ban` guards SSH, and `/etc/ssh/sshd_config.d/01-rezumi-hardening.conf`
allows keys only (root: `prohibit-password`). OrcaTerm in the Lighthouse console still works because it logs in through
Tencent's `tat_agent`, not SSH.

## Migrations

The deploy workflow opens an SSH tunnel as `dbtunnel` (key may only forward to `127.0.0.1:5432`, no shell) and runs
`pnpm --filter @rezumi/db db:migrate` against `127.0.0.1:15432` with `sslmode=disable` (SSH already encrypts it).
Secrets: `DATABASE_URL`, `DB_SSH_HOST`, `DB_SSH_KEY`, `DB_SSH_KNOWN_HOSTS`.

From a trusted machine with the admin key, in a checkout of `origin/main` (production runs `main`; migrating from an
older feature branch leaves tables missing):

```sh
ssh -f -N -o ExitOnForwardFailure=yes -L 15432:127.0.0.1:5432 rezumi-db
DATABASE_URL='postgresql://rezumi:<password>@127.0.0.1:15432/rezumi?sslmode=disable' pnpm --filter @rezumi/db db:migrate
```

## R2 offsite copy

The backup script uploads only when `/etc/rezumi-backup/r2.env` (mode 600) exists, holding `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` for an R2 API token limited to Object Read & Write on bucket
`rezumi-db-backups`. Run `systemctl start rezumi-db-backup.service` and read `journalctl -u rezumi-db-backup` to check.
The token (`rezumi-db-backup (VPS)`, created 2026-11-15) only works from the VPS IP. Uploads use `curl --aws-sigv4`;
Ubuntu 26.04's rclone 1.60 reports `NotImplemented` against R2 even when the upload lands, so it is not used.

## Restore

```sh
sudo -u postgres pg_restore --clean --if-exists -d rezumi /var/backups/rezumi-db/<file>.dump
```

Restore into a scratch database first (`createdb rezumi_restore`) when checking a backup.

## Health

- `https://rezumi.app/api/health` reports `database.status`.
- On the VPS: `systemctl status postgresql@18-main cloudflared`, `journalctl -u cloudflared`.
