import { z } from "zod";

export const sendReportSchema = z.object({ text: z.string().trim().min(1, "Write the report first.").max(4000) });
