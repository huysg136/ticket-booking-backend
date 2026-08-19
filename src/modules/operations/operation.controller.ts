import { Request, Response } from "express";
import * as service from "./operation.service";
export async function list(req: Request, res: Response) {
  res.json(
    await service.listBookings(
      req.query.page as unknown as number,
      req.query.limit as unknown as number,
      req.query.status as never,
      req.query.suspicious as string | undefined,
    ),
  );
}
export async function get(req: Request, res: Response) {
  res.json({ data: await service.getBooking(String(req.params.id)) });
}
export async function status(req: Request, res: Response) {
  res.json({ data: await service.changeStatus(String(req.params.id), req.body.status) });
}
export async function concert(req: Request, res: Response) {
  res.status(201).json({ data: await service.createConcert(req.body) });
}
export async function publish(req: Request, res: Response) {
  res.json({ data: await service.publishConcert(String(req.params.id)) });
}
export async function availability(req: Request, res: Response) {
  res.json({ data: await service.availability(String(req.params.id)) });
}
export async function voucher(req: Request, res: Response) {
  res.status(201).json({ data: await service.createVoucher(req.body) });
}
export async function vouchers(_req: Request, res: Response) {
  res.json({ data: await service.listVouchers() });
}
