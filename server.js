import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Kafka } from "kafkajs";
import path from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 3000;
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "dbserver1.message_db.users";

const app = express();
const server = http.createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(path.join(__dirname, "public")));

const io = new Server(server, {
  cors: { origin: FRONTEND_URL }
});

io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
});

const kafka = new Kafka({
  clientId: "users-app",
  brokers: KAFKA_BROKERS
});

const consumer = kafka.consumer({ groupId: "users-group" });

async function startConsumer() {
  try {
    await consumer.connect();
    console.log("[KAFKA] Conectado");

    await consumer.subscribe({
      topic: KAFKA_TOPIC,
      fromBeginning: true
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          if (data.payload) {
            io.emit("user-change", data.payload);
            console.log(`[EVENT] ${data.payload.op}`);
          }
        } catch (e) {
          console.error("[ERROR] Parse:", e.message);
        }
      }
    });
  } catch (e) {
    console.error("[ERROR] Kafka:", e.message);
    setTimeout(startConsumer, 5000);
  }
}

app.get("/health", (req, res) => res.json({ ok: true }));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[START] Puerto ${PORT}`);
});

startConsumer();

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});