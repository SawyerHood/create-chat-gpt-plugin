import express, { Express, Request, Response } from "express";
import cors from "cors";

const app: Express = express();

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

type URLParams = null;
type RequestBody = { a: number; b: number };
type ResponseBody = { result: number };

app.post(
  "/api/add",
  async (req: Request<URLParams, ResponseBody, RequestBody>, res: Response) => {
    const { a, b } = req.body;
    const result = a + b;
    res.status(200).json({ result });
  }
);

app.listen(3000, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:3000`);
});
