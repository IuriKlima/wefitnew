package synchronization

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"
)

func generateTestKeys() (*ecdsa.PrivateKey, *ecdsa.PublicKey) {
	priv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	return priv, &priv.PublicKey
}

func signPayload(priv *ecdsa.PrivateKey, payload []byte) string {
	hash := sha256.Sum256(payload)
	sig, _ := ecdsa.SignASN1(rand.Reader, priv, hash[:])
	return base64.StdEncoding.EncodeToString(sig)
}

func TestVerifySnapshot_Valid(t *testing.T) {
	priv, pub := generateTestKeys()
	now := time.Now()
	
	p := SnapshotPayload{
		SnapshotID: "s1", KeyID: "k1", Version: 2,
		IssuedAt: now.Unix() - 10, ValidUntil: now.Unix() + 3600,
		OrganizationID: "org-1", UnitID: "unit-1",
	}
	pBytes, _ := json.Marshal(p)
	sig := signPayload(priv, pBytes)
	
	_, err := VerifySnapshot(pBytes, sig, pub, 1, "org-1", "unit-1", now.Unix()-20, now)
	if err != nil { t.Fatalf("Expected valid, got: %v", err) }
}

func TestVerifySnapshot_Violations(t *testing.T) {
	priv, pub := generateTestKeys()
	now := time.Now()
	
	validP := SnapshotPayload{
		SnapshotID: "s1", KeyID: "k1", Version: 2,
		IssuedAt: now.Unix() - 10, ValidUntil: now.Unix() + 3600,
		OrganizationID: "org-1", UnitID: "unit-1",
	}
	validBytes, _ := json.Marshal(validP)
	validSig := signPayload(priv, validBytes)
	
	tests := []struct {
		name string
		mutator func(p *SnapshotPayload)
		sig string
		currVer int
		org string
		unit string
		lastSeen int64
		err string
	}{
		{"InvalidSignature", nil, "invalid-base64", 1, "org-1", "unit-1", now.Unix()-20, "invalid signature encoding"},
		{"SignatureMismatch", func(p *SnapshotPayload) { p.Data = "hacked" }, validSig, 1, "org-1", "unit-1", now.Unix()-20, "cryptographic signature mismatch"},
		{"OrgMismatch", nil, validSig, 1, "org-2", "unit-1", now.Unix()-20, "snapshot OrganizationID mismatch"},
		{"UnitMismatch", nil, validSig, 1, "org-1", "unit-2", now.Unix()-20, "snapshot UnitID mismatch"},
		{"Replay", nil, validSig, 1, "org-1", "unit-1", now.Unix()-5, "snapshot replay detected"},
		{"Downgrade", nil, validSig, 3, "org-1", "unit-1", now.Unix()-20, "snapshot downgrade detected"},
		{"Expired", nil, validSig, 1, "org-1", "unit-1", now.Unix()-20, "snapshot expired"}, // Needs time mutation handled inside test
	}
	
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			p := validP
			if tc.mutator != nil { tc.mutator(&p) }
			pBytes, _ := json.Marshal(p)
			
			// For modified payloads, signature mismatch is caught first, so we only sign mutated if we want to test other aspects
			var sigToUse = tc.sig
			if tc.mutator != nil && tc.name != "SignatureMismatch" {
				sigToUse = signPayload(priv, pBytes)
			}
			
			evalTime := now
			if tc.name == "Expired" {
				evalTime = time.Unix(validP.ValidUntil + 10, 0) // move time past expiration
			}

			_, err := VerifySnapshot(pBytes, sigToUse, pub, tc.currVer, tc.org, tc.unit, tc.lastSeen, evalTime)
			if err == nil { t.Errorf("Expected error for %s", tc.name) }
			if err != nil && err.Error() != tc.err {
				t.Errorf("Expected error %s, got %v", tc.err, err)
			}
		})
	}
}
