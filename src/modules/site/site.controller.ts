import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Site from "./site.model.js";
import type { EnquiryInput } from "./site.schemas.js";

// Public reads: the website's content. No login needed.
export async function getPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Number(req.query.limit);
    res.json(await Site.listPosts(Number.isInteger(limit) && limit > 0 && limit <= 50 ? limit : undefined));
  } catch (err) {
    next(err);
  }
}

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Site.listProducts());
  } catch (err) {
    next(err);
  }
}

export async function getTeam(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Site.listTeam());
  } catch (err) {
    next(err);
  }
}

export async function getReviews(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Site.listReviews());
  } catch (err) {
    next(err);
  }
}

/** Saves a contact-form message for the admins. */
export async function sendEnquiry(req: Request, res: Response, next: NextFunction) {
  try {
    await Site.createEnquiry(req.body as EnquiryInput);
    res.status(201).json({ sent: true });
  } catch (err) {
    next(err);
  }
}

// Admin inbox.
const idOf = (value: string | string[] | undefined) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Enquiry not found");
  return id;
};

export async function getEnquiries(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Site.listEnquiries());
  } catch (err) {
    next(err);
  }
}

export async function updateEnquiry(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await Site.setEnquiryStatus(idOf(req.params.id), (req.body as { status: string }).status))) throw new AppError(404, "Enquiry not found");
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteEnquiry(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await Site.removeEnquiry(idOf(req.params.id)))) throw new AppError(404, "Enquiry not found");
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}
