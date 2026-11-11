import { z } from "zod";

const topic = z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1, "A topic needs a name").max(160) });
const strand = z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1, "A strand needs a name").max(120), topics: z.array(topic).max(100) });

/** The whole pathway at once: the order of the strands and topics is the order they are sent in. */
export const saveTopicsSchema = z.object({ strands: z.array(strand).max(60) });
export type SaveTopicsInput = z.infer<typeof saveTopicsSchema>;
