import { Request, Response, Router } from "express";
import { createProxyServer } from "http-proxy";
import { keepInSync } from "./worker/sync";
import { verify } from "./middleware";
import { log } from "@brimble/utils";

const router = Router();
const map = createProxyServer();

map.on("error", (e) => log.error(e));

router
  .get("/", verify, async (req: Request, res: Response) => {
    const { domain } = req.body;

    map.web(req, res, { target: `http://127.0.0.1:${domain.port}` });
  })
  .post("/proxy", (req: any, res: any) => {
    const apiKey = req.headers["brimble-proxy-key"];
    if (apiKey === process.env.PROXY_AUTH_KEY) {
      console.log("Running proxy triggered by AWS");
      keepInSync({ checkLast: true });
      return res.send({ status: 200, message: "Proxy triggered" });
    }
    return res.send({ status: 401, message: "Unauthorized" });
  });

export default router;
