//go:build !windows

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
	// WARNING: This implementation is NOT for production! 
	// It's strictly for Linux CI/Testing environment where DPAPI is unavailable.
	return os.WriteFile("agent_identity_mock.txt", []byte(identity), 0600)
}

func (s *SecretStore) GetAgentIdentity() (string, error) {
	data, err := os.ReadFile("agent_identity_mock.txt")
	if err != nil {
		return "", errors.New("identity not found")
	}
	return string(data), nil
}
