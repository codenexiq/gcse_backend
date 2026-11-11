import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Lets a controller be an async function: any error it throws goes to the error handler. */
export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

/** The numeric id in a URL such as /students/:id (404 when it is not a positive whole number). */
export function idParam(value: string | string[] | undefined): number {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}
