import jwt from "jsonwebtoken";
export const decodeToken = (token: string) => {
  return jwt.verify(token, process.env.JWT_SECRET || "");
};
