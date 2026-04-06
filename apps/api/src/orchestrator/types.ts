// ============================================================
// CEO Orchestrator Types
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
  taskId: string;
  title: string;
  status: string;
  retryCount: number;
  lastError: string | null;
}

export interface CompanyBrief {
  vision: string;
  marketContext: string | null;
  constraints: string | null;
  priorities: string | null;
}

export interface CompanyInfo {
  id: string;
  name: string;
  goal: string;
}

export interface CEOContext {
  companyId: string;
  company: CompanyInfo;
  companyName: string;
  companyGoal: string;
  brief: CompanyBrief | null;
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
  | "send_notification"
  | "ceo_tool"; // NEW: Structured CEO tool execution

export interface CEOAction {
  type: ActionTypeName;
  payload: Record<string, any>;
  reason: string;
  confidence: "high" | "medium" | "low";
}

// NEW: Structured CEO Action for tool-based execution
export interface CEOToolAction {
  tool: string;  // "create_task", "update_scratchpad", "stop_task", "follow_up", "report", "set_goal"
  [key: string]: any;
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
