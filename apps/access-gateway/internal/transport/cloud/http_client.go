package cloud

import (
	"context"
	"errors"
	"net/http"
	"time"
)

type HTTPCloudClient struct {
	httpClient *http.Client
	baseURL    string
}

func NewHTTPCloudClient(baseURL string) *HTTPCloudClient {
	return &HTTPCloudClient{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		baseURL:    baseURL,
	}
}

func (c *HTTPCloudClient) FetchSnapshot(ctx context.Context, agentID string) ([]byte, error) {
	// Must enforce HTTPS in production
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/edge/sync/snapshot", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Agent-ID", agentID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to fetch snapshot")
	}
	return []byte("mock-payload-temporarily"), nil
}

func (c *HTTPCloudClient) SendEvents(ctx context.Context, agentID string, events []byte) error {
	return nil
}
