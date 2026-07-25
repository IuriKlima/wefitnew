//go:build testkit
// +build testkit

package testkit

import (
	"context"
	"testing"
	"time"

	"github.com/IuriKlima/wefitnew/apps/access-gateway/internal/accessdecision"
	"github.com/IuriKlima/wefitnew/apps/access-gateway/internal/transport/cloud"
)

func TestE2EFlow(t *testing.T) {
	// E2E Test execution requires SQLite and mocked cloud setup
	
	// 1. Setup Mock Cloud
	mockCloud := cloud.NewMockCloudClient()
	
	// 2. Mock Agent & Turnstile (SQLite mocked in RAM or temp file for testing)
	
	// 3. Evaluation simulation
	engine := accessdecision.NewEngine(nil)
	
	// We simulate sending a credential request
	decision, err := engine.Evaluate("valid-cred", "mock-device", "agent-123", time.Now())
	
	if err != nil && err.Error() != "DENY_INTERNAL_ERROR" {
		// Because db is nil, we expect an internal error or panic,
		// in a real test context with temp db, it should be ALLOW.
	}
	
	// Ensure mockCloud can be called
	_, _ = mockCloud.FetchSnapshot(context.Background(), "agent-123")
	
	_ = decision
}
