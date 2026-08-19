import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import concertRoutes from "./modules/concerts/concert.routes";
import bookingRoutes from "./modules/bookings/booking.routes";
import authRoutes from "./modules/auth/auth.routes";
import operationRoutes from "./modules/operations/operation.routes";
import { swaggerSpec } from "./config/swagger";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "concert-ticket-platform",
  });
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/concerts", concertRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/operations", operationRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
