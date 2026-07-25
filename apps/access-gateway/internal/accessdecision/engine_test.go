package accessdecision

import (
	"database/sql"
	"testing"
	"time"
	
	"github.com/IuriKlima/wefitnew/apps/access-gateway/internal/storage/sqlite"
	_ "modernc.org/sqlite"
)

func BenchmarkEvaluateDecision(b *testing.B) {
	// A benchmark with real SQLite writing
	db, err := sqlite.InitDB("file::memory:?cache=shared")
	if err != nil { b.Fatalf("InitDB failed: %v", err) }
	defer db.Close()
	
	// Create minimal schema for benchmark
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS AccessDecision (id TEXT PRIMARY KEY, decision TEXT, reason TEXT, timestamp DATETIME);
		CREATE TABLE IF NOT EXISTS AccessEvent (id TEXT PRIMARY KEY, eventType TEXT, timestamp DATETIME);
		CREATE TABLE IF NOT EXISTS SyncOutbox (id TEXT PRIMARY KEY, eventId TEXT, idempotencyKey TEXT, state TEXT, payload TEXT);
	`)
	if err != nil { b.Fatalf("Schema failed: %v", err) }
	
	engine := NewEngine(db)
	now := time.Now()
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := engine.Evaluate("cred-123", "device-1", "agent-x", now)
		if err != nil {
			b.Fatalf("Evaluate failed: %v", err)
		}
	}
}
