import { z } from "zod";

export const YEAR_GROUPS = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"] as const;
export const SUBJECTS = ["Maths", "Physics", "Chemistry", "Biology", "Science (KS3)", "More than one"] as const;

/** The "Book a free consultation" form. */
export const enquirySchema = z.object({
  parentName: z.string().trim().min(1, "Add the parent’s name.").max(100, "The name is at most 100 characters"),
  studentName: z.string().trim().min(1, "Add the student’s name.").max(100, "The name is at most 100 characters"),
  email: z.string().trim().toLowerCase().pipe(z.email("Add a valid email so we can reply.").max(254)),
  phone: z.string().trim().max(40, "The number is at most 40 characters").default(""),
  yearGroup: z.enum(YEAR_GROUPS, { error: "Choose a year group" }),
  subject: z.enum(SUBJECTS, { error: "Choose a subject" }),
  message: z.string().trim().max(2000, "The message is at most 2000 characters").default(""),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

export const enquiryStatusSchema = z.object({ status: z.enum(["new", "contacted", "closed"]) });
