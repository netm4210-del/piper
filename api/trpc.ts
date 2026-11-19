import { app } from "./_app.js";

export default function handler(req: Parameters<typeof app>[0], res: Parameters<typeof app>[1]) {
  const query = (req as typeof req & { query?: Record<string, string | string[] | undefined> }).query ?? {};
  const procedure = query.path;
  const path = Array.isArray(procedure) ? procedure.join("/") : procedure;
  if (path) {
    req.url = `/api/trpc/${path}`;
  }
  return app(req, res);
}
