import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import authRoutes from "./routes/auth.routes";
import { prisma } from "./lib/prisma";
import batchRoutes from "./routes/batch.routes";
import certificateRoutes from "./routes/certificate.routes";




const app = express();
app.use(express.json());
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ?? "*",
  },
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
  })
);

app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/batches", batchRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
);

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const port = Number(process.env.PORT ?? 3001);

async function startServer() {
  await prisma.$connect();

  httpServer.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
}

async function shutdown() {
  await io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer().catch(async (error) => {
  console.error("Failed to start API server:", error);
  await prisma.$disconnect();
  process.exit(1);
});
