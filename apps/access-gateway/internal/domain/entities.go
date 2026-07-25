package domain

import "time"

type AgentIdentity struct {
	ID             string
	OrganizationID string
	UnitID         string
}

type Device struct {
	ID   string
	Name string
}

type DeviceCapability struct {
	ID         string
	DeviceID   string
	Capability string
}

type AccessCredential struct {
	ID     string
	Active bool
}

type AccessPolicy struct {
	ID    string
	Rules string
}

type AccessSchedule struct {
	ID       string
	Schedule string
}

type AccessDecision struct {
	ID        string
	Decision  string
	Reason    string
	Timestamp time.Time
}

type AccessEvent struct {
	ID        string
	EventType string
	Timestamp time.Time
}

type ConfigurationSnapshot struct {
	ID         string
	Version    int
	IssuedAt   time.Time
	ValidUntil time.Time
	Signature  string
}

type SyncCheckpoint struct {
	ID       string
	LastSync time.Time
}

type AgentHealth struct {
	ID     string
	Status string
}

type DeviceHealth struct {
	ID       string
	DeviceID string
	Status   string
}

type LocalAuditLog struct {
	ID        string
	Action    string
	Timestamp time.Time
}
