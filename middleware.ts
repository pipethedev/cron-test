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
    return res.status(401).sendFile("password.html", { root: "public" });
  }

  try {
    const decoded = decodeToken(token);
    if (!decoded) {
      return res.status(401).sendFile("password.html", { root: "public" });
    }

    const { id } = decoded as any;

    const domain = await Domain.findById(id).populate({
      path: "project",
      select: "port",
    });

    if (!domain) {
      return res.status(401).sendFile("password.html", { root: "public" });
    }

    req.body.domain = { name: domain.name, port: domain.project.port };

    next();
  } catch (e) {
    return res.status(401).sendFile("password.html", { root: "public" });
  }
};
