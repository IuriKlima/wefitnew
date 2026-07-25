//go:build !windows
// +build !windows

package security

import (
	"errors"
	"os"
)

type SecretStore struct{}

func NewSecretStore() *SecretStore {
	return &SecretStore{}
}

// StoreAgentIdentity stores identity on disk for NON-WINDOWS testing ONLY
func (s *SecretStore) StoreAgentIdentity(identity string) error {
	s.preventProductionUse()
	return os.WriteFile("agent_identity_mock.txt", []byte(identity), 0600)
}

func (s *SecretStore) GetAgentIdentity() (string, error) {
	s.preventProductionUse()
	data, err := os.ReadFile("agent_identity_mock.txt")
	if err != nil {
		return "", errors.New("identity not found")
	}
	return string(data), nil
}

func (s *SecretStore) preventProductionUse() {
	if os.Getenv("WEFIT_ENV") == "production" {
		panic("CRITICAL: Insecure Mock SecretStore running in production on a non-Windows OS! DPAPI is required.")
	}
}
