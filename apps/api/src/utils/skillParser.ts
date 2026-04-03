
/**
 * Parse a skills.md or .md file into skill definitions.
 * 
 * Format expected:
 * ```markdown
 * # Skill Name
 * - category: development
 * - icon: 💻
 * 
 * You are a skilled developer. Write clean code...
 * 
 * # Another Skill
 * - category: design
 * 
 * You are a designer...
 * ```
 * 
 * Rules:
 * - Each skill starts with a heading (## Skill Name or # Skill Name)
 * - Optional metadata lines start with "- key: value"
 * - Everything else until the next heading is the instructions
 */

export interface ParsedSkill {
  name: string;
  category: string;
  icon?: string;
  description?: string;
  instructions: string;
}

export function parseSkillsMarkdown(markdown: string): ParsedSkill[] {
  const skills: ParsedSkill[] = [];
  
  // Split by markdown headings (## or #)
  const sections = markdown.split(/^(?:##|#)\s+(.+)$/gm);
  
  // sections[0] is empty (before first heading)
  // sections[1] is first heading name, sections[2] is its content, etc.
  for (let i = 1; i < sections.length; i += 2) {
    const name = sections[i].trim();
    let rawContent = (sections[i + 1] || "").trim();
    
    if (!name || !rawContent) continue;
    
    const skill: ParsedSkill = {
      name,
      category: "general",
      icon: undefined,
      description: undefined,
      instructions: "",
    };
    
    // Extract metadata lines: "- key: value"
    const lines = rawContent.split("\n");
    const contentLines: string[] = [];
    let firstContentLine = false;
    
    for (const line of lines) {
      const match = line.match(/^-\s+(\w+):\s+(.+)$/);
      if (match && !firstContentLine) {
        const [, key, value] = match;
        if (key === "category") skill.category = value.trim();
        else if (key === "icon") skill.icon = value.trim();
        else if (key === "description") skill.description = value.trim();
        else contentLines.push(line);
      } else {
        if (line.trim()) firstContentLine = true;
        contentLines.push(line);
      }
    }
    
    // Join remaining content as instructions, skip leading/trailing empty lines
    skill.instructions = contentLines.join("\n").trim();
    
    // If no instructions found, use the description
    if (!skill.instructions && skill.description) {
      skill.instructions = skill.description;
    }
    
    // Default icon if not specified
    if (!skill.icon) {
      const iconMap: Record<string, string> = {
        development: "💻",
        design: "🎨",
        analysis: "🔍",
        content: "📝",
        leadership: "📊",
        operations: "📋",
        quality: "🧪",
        general: "📌",
      };
      skill.icon = iconMap[skill.category] || "📌";
    }
    
    skills.push(skill);
  }
  
  return skills;
}
