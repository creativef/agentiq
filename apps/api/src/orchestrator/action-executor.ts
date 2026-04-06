// ============================================================
// CEO Action Executor — Execute decisions from the CEO brain
// ============================================================

import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { agents, tasks, events, projects, skills, agentSkills } from "../db/schema";
import { logAgentActivity } from "../utils/agentLogger";
import type { CEOContext, CEOAction } from "./types";
import { executeCEOTool } from "./ceo-tools";

export async function executeAction(
  action: CEOAction,
  context: CEOContext,
): Promise<{ success: boolean; detail: string }> {
  try {
    switch (action.type) {
      case "assign_task": {
        const { taskId, agentId, agentName, matchPercentage } = action.payload;
        await db
          .update(tasks)
          .set({ agentId, status: "in_progress", execStatus: "ready", approvalStatus: "approved" })
          .where(sql`${tasks.id} = ${taskId}`);

        await logAgentActivity(
          agentId,
          taskId,
          "action",
          `CEO assigned task. Skill match: ${matchPercentage.toFixed(0)}%. Reason: ${action.reason}`,
        );

        // Auto-execute immediately
        try {
          const { executeTaskById } = await import("../task-execution");
          await executeTaskById(taskId);
        } catch (e: any) {
          await db.update(tasks).set({ execStatus: "failed", status: "blocked", result: `Auto-execute failed: ${e.message}` })
            .where(sql`${tasks.id} = ${taskId}`);
        }

        return { success: true, detail: `Assigned task ${taskId.slice(0,8)}... to ${agentName}` };
      }

      case "create_agent": {
        const role = (action.payload.suggestedRole || "Agent").toString();
        const roleKey = role.toUpperCase();
        const name = action.payload.name || role;

        const projectRow = await db.select({ id: projects.id })
          .from(projects)
          .where(sql`${projects.companyId} = ${context.companyId}`)
          .limit(1);
        const projectId = projectRow[0]?.id || null;

        const ceo = await db.select({ id: agents.id })
          .from(agents)
          .where(sql`${agents.companyId} = ${context.companyId} AND ${agents.role} = 'CEO'`)
          .limit(1);
        const founders = await db.select({ id: agents.id })
          .from(agents)
          .where(sql`${agents.companyId} = ${context.companyId} AND ${agents.role} = 'FOUNDER'`);

        const isCEO = roleKey.includes("CEO");
        const reportsTo = !isCEO ? (ceo[0]?.id || null) : null;
        const altReportsTo = isCEO && founders.length > 0 ? founders.map(f => f.id) : null;

        const created = await db.insert(agents).values({
          companyId: context.companyId,
          projectId,
          name,
          role,
          status: "idle",
          reportsTo,
          altReportsTo,
        }).returning();

        const roleSkills: Record<string, string[]> = {
          CEO: ["Strategic Planning", "Project Management"],
          CTO: ["Code Generation", "Research & Analysis"],
          CFO: ["Research & Analysis"],
          CMO: ["Content Writing", "Research & Analysis"],
          MANAGER: ["Project Management"],
        };
        const fromRole = roleSkills[roleKey] || ["Research & Analysis"];
        const fromPayload = Array.isArray(action.payload.requiredSkills) ? action.payload.requiredSkills : [];
        const skillNames = Array.from(new Set([...fromRole, ...fromPayload]));

        if (skillNames.length > 0) {
          const skillRows = await db.select({ id: skills.id, name: skills.name })
            .from(skills)
            .where(sql`${skills.name} IN ${skillNames}`);

          const skillIds = skillRows.map(s => s.id);
          if (skillIds.length > 0) {
            const existing = await db.select({ skillId: agentSkills.skillId })
              .from(agentSkills)
              .where(sql`${agentSkills.agentId} = ${created[0].id} AND ${agentSkills.skillId} IN ${skillIds}`);

            const existingIds = new Set(existing.map(e => e.skillId));
            const toInsert = skillIds.filter(id => !existingIds.has(id)).map(skillId => ({
              agentId: created[0].id,
              skillId,
            }));

            if (toInsert.length > 0) await db.insert(agentSkills).values(toInsert);
          }
        }

        await logAgentActivity("SYSTEM", null, "success", `Created agent ${created[0].name} (${role})`);
        return { success: true, detail: `Created agent ${created[0].name} (${role})` };
      }

      case "assign_bundle_to_agent": {
        const agentId = action.payload.agentId;
        const agentRow = await db.select({ id: agents.id, role: agents.role, name: agents.name })
          .from(agents)
          .where(sql`${agents.id} = ${agentId}`)
          .limit(1);
        if (agentRow.length === 0) return { success: false, detail: "Agent not found" };

        const roleKey = (action.payload.role || agentRow[0].role || "AGENT").toString().toUpperCase();
        const roleSkills: Record<string, string[]> = {
          CEO: ["Strategic Planning", "Project Management"],
          CTO: ["Code Generation", "Research & Analysis"],
          CFO: ["Research & Analysis"],
          CMO: ["Content Writing", "Research & Analysis"],
          MANAGER: ["Project Management"],
          AGENT: ["Research & Analysis"],
        };
        const skillNames = roleSkills[roleKey] || ["Research & Analysis"];

        const skillRows = await db.select({ id: skills.id, name: skills.name })
          .from(skills)
          .where(sql`${skills.name} IN ${skillNames}`);

        const skillIds = skillRows.map(s => s.id);
        if (skillIds.length > 0) {
          const existing = await db.select({ skillId: agentSkills.skillId })
            .from(agentSkills)
            .where(sql`${agentSkills.agentId} = ${agentId} AND ${agentSkills.skillId} IN ${skillIds}`);
          const existingIds = new Set(existing.map(e => e.skillId));
          const toInsert = skillIds.filter(id => !existingIds.has(id)).map(skillId => ({ agentId, skillId }));
          if (toInsert.length > 0) await db.insert(agentSkills).values(toInsert);
        }

        await logAgentActivity(agentId, null, "info", `Assigned default skill bundle for ${roleKey}`);
        return { success: true, detail: `Assigned default bundle to ${agentRow[0].name}` };
      }

      case "retry_task": {
        const { taskId } = action.payload;
        await db
          .update(tasks)
          .set({ status: "in_progress", execStatus: "ready" })
          .where(sql`${tasks.id} = ${taskId}`);

        await logAgentActivity(action.payload.agentId || "SYSTEM", taskId, "action", `Retried by CEO: ${action.reason}`);

        // Auto-execute immediately
        try {
          const { executeTaskById } = await import("../task-execution");
          await executeTaskById(taskId);
        } catch (e: any) {
          await db.update(tasks).set({ execStatus: "failed", status: "blocked", result: `Auto-execute failed: ${e.message}` })
            .where(sql`${tasks.id} = ${taskId}`);
        }

        return { success: true, detail: `Retrying task ${taskId.slice(0,8)}...` };
      }

      case "reassign_task": {
        const { taskId } = action.payload;
        await db
          .update(tasks)
          .set({ agentId: null, status: "ready", execStatus: "scheduled" })
          .where(sql`${tasks.id} = ${taskId}`);

        return { success: true, detail: `Requeued task ${taskId.slice(0,8)}... for re-routing` };
      }

      case "escalate_to_founders": {
        await db.insert(events).values({
          companyId: context.companyId,
          type: "escalation",
          actor: "CEO",
          description: action.payload.reason || "Task escalation",
        }).catch((e) => console.error("Failed to write escalation event:", e));
        return { success: true, detail: `Escalated to founders` };
      }

      case "create_report": {
        await db
          .insert(events)
          .values({
            companyId: context.companyId,
            type: "ceo_report",
            actor: "CEO",
            description: action.payload.assessment,
            meta: JSON.stringify(action.payload.metrics),
          })
          .catch((e) => console.error("Failed to write CEO report event:", e));

        return { success: true, detail: `CEO report stored for founders` };
      }

      case "ceo_tool": {
        const toolAction = action.payload;
        const result = await executeCEOTool(context.companyId, toolAction);
        
        // Log the tool execution for visibility
        if (result.success) {
          console.log(`[CEO Tool] ${toolAction.tool}:`, JSON.stringify(result.result));
          return { success: true, detail: `Tool ${toolAction.tool} executed: ${JSON.stringify(result.result)}` };
        } else {
          console.error(`[CEO Tool] ${toolAction.tool} failed:`, result.error);
          return { success: false, detail: `Tool ${toolAction.tool} failed: ${result.error}` };
        }
      }

      default:
        return { success: false, detail: `Unknown action type: ${(action as any).type}` };
    }
  } catch (err: any) {
    console.error(`Action execution failed (${action.type}):`, err);
    return { success: false, detail: `Error: ${err.message || err}` };
  }
}
