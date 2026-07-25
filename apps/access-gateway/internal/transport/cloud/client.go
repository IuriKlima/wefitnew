package cloud

import "context"

type CloudClient interface {
	FetchSnapshot(ctx context.Context, agentID string) ([]byte, error)
	SendEvents(ctx context.Context, agentID string, events []byte) error
}
