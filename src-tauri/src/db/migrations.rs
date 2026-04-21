use rusqlite::{Connection, Result};
use std::path::Path;

const MIGRATIONS_DIR: &str = "migrations";

/// Run all pending migrations on the database connection
pub fn run_migrations(conn: &Connection, app_data_dir: &Path) -> Result<()> {
    // Create migrations table if not exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT DEFAULT (datetime('now'))
        )",
        [],
    )?;

    // Get current version
    let current_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    log::info!("Current DB schema version: {}", current_version);

    // Read migration files
    let migrations_path = app_data_dir.join(MIGRATIONS_DIR);
    let mut versions: Vec<i32> = Vec::new();

    if migrations_path.exists() {
        if let Ok(entries) = std::fs::read_dir(&migrations_path) {
            for entry in entries.flatten() {
                let filename = entry.file_name();
                if let Some(name) = filename.to_str() {
                    if name.ends_with(".sql") {
                        // Extract version from filename like "001_initial.sql"
                        if let Some(version) = extract_version(name) {
                            versions.push(version);
                        }
                    }
                }
            }
        }
    }

    versions.sort();

    // Apply pending migrations
    for version in versions {
        if version > current_version {
            let sql_file = migrations_path.join(format!("{:03}_initial.sql", version));
            if sql_file.exists() {
                log::info!("Applying migration version {}...", version);
                let sql = std::fs::read_to_string(&sql_file)?;
                conn.execute_batch(&sql)?;
                log::info!("Migration version {} applied successfully", version);
            }
        }
    }

    Ok(())
}

fn extract_version(filename: &str) -> Option<i32> {
    filename
        .split('_')
        .next()
        .and_then(|s| s.parse().ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_run_migrations_creates_tables() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Create mock migrations dir
        let migrations_dir = dir.path().join("migrations");
        fs::create_dir_all(&migrations_dir).unwrap();

        // Write a test migration
        fs::write(
            migrations_dir.join("001_initial.sql"),
            "CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY);",
        )
        .unwrap();

        run_migrations(&conn, dir.path()).unwrap();

        // Verify table was created
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM test_table", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_extract_version() {
        assert_eq!(extract_version("001_initial.sql"), Some(1));
        assert_eq!(extract_version("002_add_field.sql"), Some(2));
        assert_eq!(extract_version("abc.sql"), None);
    }
}