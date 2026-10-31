// Tells TypeScript that req.user exists (set by the authenticate middleware).
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; fullName: string; email: string; role: "student" | "tutor" | "admin" };
    }
  }
}

export {};
