import { Request, Response } from "express";
import * as service from "./booking.service";
export async function create(req: Request, res: Response) {
  const result = await service.createBooking({
    userId: req.user!.id,
    idempotencyKey: req.headers["idempotency-key"] as string,
    ...req.body,
  });
  res
    .status(result.created ? 201 : 200)
    .json({ data: result.booking, meta: { idempotentReplay: !result.created } });
}
export async function mine(req: Request, res: Response) {
  res.json({ data: await service.getMyBookings(req.user!.id) });
}
export async function get(req: Request, res: Response) {
  res.json({ data: await service.getOwnBooking(String(req.params.id), req.user!.id) });
}
