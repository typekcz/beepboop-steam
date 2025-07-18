## DB upgrade

This is how you can upgrade your database. Here is shown upgrade from PostgreSQL 15 to 16, but it will work also for other versions, see [tianon/docker-postgres-upgrade](https://github.com/tianon/docker-postgres-upgrade) for details.

You may need to replace relative paths with absolute paths on Windows, e.g. `./db` with `C:\repos\beepboop-steam\db`.

### Create new database
```
docker run --rm -v ./db_new:/var/lib/postgresql/data -e POSTGRES_USER=beepboop -e POSTGRES_PASSWORD=beepboop -e POSTGRES_DB=postgres postgres:16
```

### Upgrade database
```
docker run --rm -v ./db:/var/lib/postgresql/15/data -v ./db_new:/var/lib/postgresql/16/data -e PGUSER=beepboop tianon/postgres-upgrade:15-to-16
```

### Run upgraded database
On Windows, replace `&&` with `;` in the command below.
```
docker run -d --name beepboop-db-tmp -p 5432:5432 -v ./db_new:/var/lib/postgresql/data -e POSTGRES_USER=beepboop -e POSTGRES_PASSWORD=beepboop postgres:16 && docker exec -it -u postgres beepboop-db-tmp bash && docker rm -f beepboop-db-tmp
```
This will start the upgraded database in a temporary container, allowing you to run commands inside it.

Once inside the container, you can run the following commands to finalize the upgrade:
```
/usr/lib/postgresql/16/bin/vacuumdb --all --analyze-in-stages -U beepboop
# See output from database upgrade step for recommended commands to run after upgrade.
```
Remove unneeded database and also refresh collation version if neccessary:
```
psql -U beepboop
DROP DATABASE postgres;
ALTER DATABASE beepboop REFRESH COLLATION VERSION;
```