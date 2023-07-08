import { Request, Response, NextFunction } from "express";
import { decodeToken } from "./helper";
import { Domain } from "@brimble/models";

export const verify = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies["x-brimble-session"]; // domain id
  if (!token) {
    return res.status(401).render("password");
  }

  try {
    const decoded = decodeToken(token);
    if (!decoded) {
      return res.status(401).render("password");
    }

    const { id } = decoded as any;

    const domain = await Domain.findById(id).populate({
      path: "project",
      select: "port ip",
    });

    if (!domain) {
      return res.status(401).render("password");
    }

    req.body.domain = {
      name: domain.name,
      port: domain.project.port,
      ip: domain.project.ip,
    };

    next();
  } catch (e) {
    return res.status(401).render("password");
  }
};
