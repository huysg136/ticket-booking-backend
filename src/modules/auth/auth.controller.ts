import { Request, Response } from "express";
import * as service from "./auth.service";
export async function register(req: Request, res: Response) {
  res.status(201).json({ data: await service.register(req.body.email, req.body.password) });
}
export async function login(req: Request, res: Response) {
  res.json({ data: await service.login(req.body.email, req.body.password) });
}
