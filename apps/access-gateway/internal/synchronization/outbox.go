package synchronization

type OutboxState string

const (
	StatePending      OutboxState = "PENDING"
	StateInFlight     OutboxState = "IN_FLIGHT"
	StateAcknowledged OutboxState = "ACKNOWLEDGED"
	StateDeadLetter   OutboxState = "DEAD_LETTER"
	StatePurged       OutboxState = "PURGED"
)

// State machine for Outbox processing
func TransitionState(currentState OutboxState, targetState OutboxState) bool {
	switch currentState {
	case StatePending:
		return targetState == StateInFlight
	case StateInFlight:
		return targetState == StateAcknowledged || targetState == StatePending || targetState == StateDeadLetter
	case StateAcknowledged:
		return targetState == StatePurged
	case StateDeadLetter:
		return targetState == StatePurged
	default:
		return false
	}
}
