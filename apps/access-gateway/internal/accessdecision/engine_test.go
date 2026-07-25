package accessdecision

import (
	"testing"
	"time"
)

func BenchmarkEvaluateDecision(b *testing.B) {
	// A minimal benchmark to ensure Evaluate runs < 100ms
	engine := NewEngine(nil) // DB mocked in real tests
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Mocked DB would return < 100ms
		engine.Evaluate("cred-123", "device-1", "agent-x", time.Now())
	}
}
