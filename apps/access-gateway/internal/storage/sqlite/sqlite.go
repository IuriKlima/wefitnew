package sqlite

import (
	"database/sql"
	"fmt"
	_ "modernc.org/sqlite"
)

func InitDB(dsn string) (*sql.DB, error) {
	// PRAGMAs: foreign_keys, journal_mode WAL, busy_timeout
	db, err := sql.Open("sqlite", dsn+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	
	// Limiting write concurrency to handle SQLITE_BUSY efficiently
	db.SetMaxOpenConns(1)
	
	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}
