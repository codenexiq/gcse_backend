import { z } from "zod";

export const sendSchema = z.object({
  studentId: z.number().int().positive(),
  subject: z.string().trim().min(1).max(100),
  month: z.string().trim().min(1).max(30),
  // The report as the Monthly Report Builder wrote it. Only its size is checked here.
  data: z.record(z.string(), z.unknown()).refine((d) => JSON.stringify(d).length <= 60_000, "Report is too large"),
});
export type SendInput = z.infer<typeof sendSchema>;
