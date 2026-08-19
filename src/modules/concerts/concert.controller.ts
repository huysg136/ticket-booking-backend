import { Request, Response } from "express";

import { getConcertById, getPublishedConcerts } from "./concert.service";
import { notFound } from "../../utils/errors";

export async function getConcerts(_req: Request, res: Response) {
  const concerts = await getPublishedConcerts();

  return res.status(200).json({
    data: concerts,
  });
}

export async function getConcert(req: Request, res: Response) {
  const { id } = req.params;

  const concert = await getConcertById(String(id));
  if (!concert) throw notFound("Concert not found");

  return res.status(200).json({
    data: concert,
  });
}
