use std::{env, fs, path::PathBuf};

#[derive(Clone)]
pub struct Database {
    pub db: sqlx::SqlitePool,
}

impl Database {
    pub async fn try_new(db_path: PathBuf, reset: bool) -> anyhow::Result<Self> {
        let parent_dir = db_path.parent().unwrap();
        std::fs::create_dir_all(parent_dir)?;

        if reset {
            println!("--- DELETING DATABASE ---");
            fs::remove_file(&db_path).ok();
            fs::remove_file(parent_dir.join("db.sqlite-shm")).ok();
            fs::remove_file(parent_dir.join("db.sqlite-wal")).ok();
        }

        env::set_var("DATABASE_URL", format!("sqlite://{}", db_path.display()));

        println!(
            "--- DATABASE_URL ---\n{}",
            env::var("DATABASE_URL").unwrap()
        );

        let connect_options = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

        let pool = sqlx::SqlitePool::connect_with(connect_options).await?;

        sqlx::migrate!("./migrations").run(&pool).await?;

        Ok(Self { db: pool })
    }
}
