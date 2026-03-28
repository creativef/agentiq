import { z } from "zod";

export const roleSchema = z.enum(["OWNER", "CEO", "AGENT"]);
