import { z } from "zod";

export const saveSignupSchema = z.object({ welcome: z.string().trim().min(1, "Write a headline").max(200) });
