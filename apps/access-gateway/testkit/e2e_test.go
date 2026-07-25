//go:build testkit
// +build testkit

package testkit

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/IuriKlima/wefitnew/apps/access-gateway/internal/accessdecision"
	"github.com/IuriKlima/wefitnew/apps/access-gateway/internal/storage/sqlite"
	"github.com/IuriKlima/wefitnew/apps/access-gateway/internal/storage/sqlite/migrations"
	"github.com/IuriKlima/wefitnew/apps/access-gateway/internal/transport/cloud"
)

func TestE2ERealComponents(t *testing.T) {
	// 1. Setup Real File-based SQLite
	tmpDir, err := os.MkdirTemp("", "edge-agent-e2e")
	if err != nil { t.Fatalf("failed to create temp dir: %v", err) }
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "e2e.db")
	db, err := sqlite.InitDB(dbPath)
	if err != nil { t.Fatalf("InitDB failed: %v", err) }
	defer db.Close()
	
	// Run schema
	if _, err := db.Exec(migrations.InitialSchema); err != nil {
		t.Fatalf("Schema migration failed: %v", err)
	}

	// 2. Setup Real HTTP Test Server (Mock Cloud)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/edge/sync/snapshot" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"snapshotId": "snap1", "version": 2}`))
		}
	}))
	defer ts.Close()

	cloudClient := cloud.NewHTTPCloudClient(ts.URL)
	snap, err := cloudClient.FetchSnapshot(context.Background(), "agent-123")
	if err != nil || len(snap) == 0 {
		t.Fatalf("HTTP Cloud mock failed: %v", err)
	}

	// 3. Setup TCP socket Mock Turnstile
	ln, err := net.Listen("tcp", "127.0.0.1:0") // Random port
	if err != nil { t.Fatalf("TCP listen failed: %v", err) }
	defer ln.Close()
	
	go func() {
		conn, err := ln.Accept()
		if err == nil {
			conn.Write([]byte("MOCK_TURNSTILE_READY\n"))
			conn.Close()
		}
	}()
	
	// Validate dial
	conn, err := net.DialTimeout("tcp", ln.Addr().String(), 2*time.Second)
	if err != nil {
		t.Fatalf("TCP dial failed: %v", err)
	}
	conn.Close()

	// 4. Test DB Atomic Writes via Engine
	engine := accessdecision.NewEngine(db)
	decision, err := engine.Evaluate("valid-cred", "mock-device", "agent-123", time.Now())
	
	if err != nil {
		t.Fatalf("Engine Evaluate failed: %v", err)
	}
	if decision != "ALLOW" {
		t.Errorf("Expected ALLOW, got %s", decision)
	}
}
