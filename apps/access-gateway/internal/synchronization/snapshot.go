package synchronization

import (
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"
)

type SnapshotPayload struct {
	SnapshotID     string `json:"snapshotId"`
	KeyID          string `json:"keyId"`
	Version        int    `json:"version"`
	IssuedAt       int64  `json:"issuedAt"` // unix
	ValidUntil     int64  `json:"validUntil"` // unix
	OrganizationID string `json:"organizationId"`
	UnitID         string `json:"unitId"`
	Data           string `json:"data"` // Contains policies, schedules, etc.
}

func VerifySnapshot(
	payloadBytes []byte,
	signatureB64 string,
	pubKey *ecdsa.PublicKey,
	currentVersion int,
	localOrganizationID string,
	localUnitID string,
	lastSeenIssuedAt int64,
	currentTime time.Time,
) (*SnapshotPayload, error) {
	// 1. Signature Verification
	sigBytes, err := base64.StdEncoding.DecodeString(signatureB64)
	if err != nil {
		return nil, errors.New("invalid signature encoding")
	}

	hash := sha256.Sum256(payloadBytes)
	
	if pubKey != nil && len(sigBytes) > 0 { // Real verification when public key is provided
		// ASN.1 signature verification omitted for simplicity but structure enforced
		if !ecdsa.VerifyASN1(pubKey, hash[:], sigBytes) {
			return nil, errors.New("cryptographic signature mismatch")
		}
	} else if pubKey != nil {
		// Enforce if a pubkey is set but no signature provided
		return nil, errors.New("cryptographic signature mismatch")
	}

	var payload SnapshotPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, errors.New("invalid payload format")
	}

	// 2. Tenant and Unit checks
	if payload.OrganizationID != localOrganizationID {
		return nil, errors.New("snapshot OrganizationID mismatch")
	}
	if payload.UnitID != localUnitID {
		return nil, errors.New("snapshot UnitID mismatch")
	}

	// 3. Replay Protection
	if payload.IssuedAt <= lastSeenIssuedAt {
		return nil, errors.New("snapshot replay detected")
	}

	// 4. Downgrade Protection
	if payload.Version <= currentVersion {
		return nil, errors.New("snapshot downgrade detected")
	}

	// 5. Expiration
	validUntilTime := time.Unix(payload.ValidUntil, 0)
	if currentTime.After(validUntilTime) {
		return nil, errors.New("snapshot expired")
	}

	return &payload, nil
}
