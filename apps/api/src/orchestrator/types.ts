// ============================================================
// CEO Orchestro types
// ============================================================

export interface AgentCapability {
  id: string;
  name: string;
  role: string;
  status: string;
  skills: string[];
  activeTaskCount: number;
  failedTaskCount: number;
}

export interface TaskRequirement {
  taskId: string;
  title: string;
  description: string;
  inferredSkills: string[];
  priority: string;
  isUrgent: boolean;
}

export interface InProgressTask {
  id: string;
  title: string;
  agentId: string | null;
  status: string;
  execStatus: string;
}

export interface BlockedTask {
  id: string;
  title: string;
  status: string;
}

export interface CEOContext {
  companyId: string;
  companyName: string;
  companyGoal: string;
  agents: AgentCapability[];
  pendingTasks: TaskRequirement[];
  inProgressTasks: InProgressTask[];
  blockedTasks: BlockedTask[];
  budgetRemaining: number;
  lastReportAt: string | null;
}

export type ActionTypeName =
  | "assign_task"
  | "create_agent"
  | "add_skill_to_agent"
  | "assign_bundle_to_agent"
  | "retry_task"
  | "reassign_task"
  | "mark_task_failed"
  | "mark_task_completed"
  | "escalate_to_founders"
  | "create_report"
  | "approve_subtask"
  | "send_notification";

export interface CEOAction {
  type: ActionTypeName;
  payload: Record<string, any>;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface AgentMatch {
  agent: AgentCapability;
  score: number;
  matchingSkills: string[];
  missingSkills: string[];
  matchPercentage: number;
  overloaded: boolean;
  hasFailedRecently: boolean;
}
