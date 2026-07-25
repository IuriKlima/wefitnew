package migrations

const InitialSchema = `
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);

CREATE TABLE IF NOT EXISTS AgentIdentity (id TEXT PRIMARY KEY, organizationId TEXT, unitId TEXT);
CREATE TABLE IF NOT EXISTS EnrollmentState (id TEXT PRIMARY KEY, status TEXT);
CREATE TABLE IF NOT EXISTS Device (id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS DeviceCapability (id TEXT PRIMARY KEY, deviceId TEXT, capability TEXT, FOREIGN KEY(deviceId) REFERENCES Device(id));
CREATE TABLE IF NOT EXISTS AccessCredential (id TEXT PRIMARY KEY, active BOOLEAN);
CREATE TABLE IF NOT EXISTS AccessPolicy (id TEXT PRIMARY KEY, rules TEXT);
CREATE TABLE IF NOT EXISTS AccessSchedule (id TEXT PRIMARY KEY, schedule TEXT);
CREATE TABLE IF NOT EXISTS AccessDecision (id TEXT PRIMARY KEY, decision TEXT, reason TEXT, timestamp DATETIME);
CREATE TABLE IF NOT EXISTS AccessEvent (id TEXT PRIMARY KEY, eventType TEXT, timestamp DATETIME);
CREATE TABLE IF NOT EXISTS SyncOutbox (id TEXT PRIMARY KEY, eventId TEXT, idempotencyKey TEXT, state TEXT, payload TEXT);
CREATE TABLE IF NOT EXISTS ConfigurationSnapshot (id TEXT PRIMARY KEY, version INTEGER, issuedAt DATETIME, validUntil DATETIME, signature TEXT);
CREATE TABLE IF NOT EXISTS SyncCheckpoint (id TEXT PRIMARY KEY, lastSync DATETIME);
CREATE TABLE IF NOT EXISTS AgentHealth (id TEXT PRIMARY KEY, status TEXT);
CREATE TABLE IF NOT EXISTS DeviceHealth (id TEXT PRIMARY KEY, deviceId TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS LocalAuditLog (id TEXT PRIMARY KEY, action TEXT, timestamp DATETIME);

INSERT OR IGNORE INTO schema_migrations (version) VALUES (1);
`
