## Setup

1. Run the Posgres container: `docker compose up -d`
2. Copy the backup to the container: `docker cp <backup_path> <container_name>:<path_inside_container>`
  - example: `docker cp backups/chinook.sql backup-restore-db-1:/home/backup.sql`
3. Get into the container: `docker exec -it <container_name> sh`
  - example: `docker exec -it backup-restore-db-1 sh`
4. Run backup: `psql -U <user> < /home/backup.sql`
  - example: `psql -U postgres < /home/backup.sql`