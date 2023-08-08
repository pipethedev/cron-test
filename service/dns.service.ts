import { lookup, resolveCname } from "dns";

export const getDNS = (domain: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const dns = { ip: "", cname: [] as string[] };

    lookup(domain, (err, address) => {
      if (!err) {
        dns.ip = address;
      }
      resolveCname(domain, (err, records) => {
        if (!err) {
          dns.cname = records;
        }

        resolve(JSON.stringify(dns));
      });
    });
  });
};
