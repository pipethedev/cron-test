import { Router } from "express";
import { createProxyServer } from "http-proxy";
import { keepInSync } from "./worker/sync";
import { verify } from "./middleware";
import { container } from "tsyringe";
import LoginService from "./service/login.service";
import { getDNS } from "./service/dns.service";

const router = Router();
const map = createProxyServer();

const loginService = container.resolve(LoginService);

map.on("error", (e) => console.error(e));

router
  .get("/", verify, async (req, res) => {
    const { domain } = req.body;

    map.web(req, res, { target: `http://${domain.ip}:${domain.port}` });
  })
  .post("/authorize-login", async (req, res) => {
    await loginService
      .execute(req.body)
      .catch((error) => {
        return res
          .status(401)
          .render("password", { error: error.response.data.message });
      })
      .then(({ data }) => {
        res.cookie("x-brimble-session", data?.token, { httpOnly: true });
        res.redirect(req.headers.referer as string);
      });
  })
  .post("/keep-alive", (req, res) => {
    const apiKey = req.headers["brimble-proxy-key"];
    if (apiKey === process.env.PROXY_AUTH_KEY) {
      console.log("Running proxy triggered by DO");
      keepInSync({ lastChecked: true });
      return res.json({ status: 200, message: "Proxy triggered" });
    }
    return res.status(401).json({ status: 401, message: "Unauthorized" });
  })
  .get("/dns", async (req, res) => {
    const dns = await getDNS(req.query.domain as string);

    return res.json({ data: JSON.parse(dns || "{}") });
  })
  .all("*", verify, async (req, res) => {
    const { domain } = req.body;

    map.web(req, res, { target: `http://${domain.ip}:${domain.port}` });
  });

export default router;
