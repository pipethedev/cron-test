import { Router } from "express";
import { keepInSync } from "./worker/sync";

const router = Router();

router.post("/keep-alive", (req, res) => {
  const apiKey = req.headers["brimble-proxy-key"];
  if (apiKey === process.env.PROXY_AUTH_KEY) {
    console.log("Running proxy triggered by DO");
    keepInSync({ lastChecked: true });
    return res.json({ status: 200, message: "Proxy triggered" });
  }
  return res.status(401).json({ status: 401, message: "Unauthorized" });
});

export default router;
