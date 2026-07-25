//go:build testkit
// +build testkit

package cloud

import (
	"context"
)

type MockCloudClient struct {}

func NewMockCloudClient() *MockCloudClient {
	return &MockCloudClient{}
}

func (c *MockCloudClient) FetchSnapshot(ctx context.Context, agentID string) ([]byte, error) {
	return []byte("mocked-snapshot"), nil
}

func (c *MockCloudClient) SendEvents(ctx context.Context, agentID string, events []byte) error {
	return nil
}
