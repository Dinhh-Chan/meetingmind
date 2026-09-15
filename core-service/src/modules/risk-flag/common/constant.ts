export enum RiskType {
    OVERLOAD = "overload",
    DEADLINE_CONFLICT = "deadline_conflict",
    OVERDUE = "overdue",
    BLOCKED_DEPENDENCY = "blocked_dependency",
}

export enum RiskSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical",
}

export enum RiskStatus {
    OPEN = "open",
    ACKNOWLEDGED = "acknowledged",
    RESOLVED = "resolved",
}
