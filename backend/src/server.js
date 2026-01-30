import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import path from "path";
import passport from "./lib/passport.js";

import { connectDB } from "./lib/db.js";
import { streamClient } from "./lib/stream.js";
import { syncStreamUsers } from "./lib/scripts/syncStreamUsers.js";
import authRoutes from "./routes/auth.route.js";
import chatRoutes from "./routes/chat.route.js";
import userRoutes from "./routes/user.route.js";

import http from "http";
import { Server } from "socket.io";
import rateLimit from "express-rate-limit";
// ... imports

const app = express();
const httpServer = http.createServer(app); // Create HTTP server
const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

// ------------------ SOCKET.IO SETUP ------------------
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:80", "http://localhost:5173", "http://localhost"],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on("draw", (data) => {
    // 🛡️ Malware Prevention: Magic Byte Validation
    if (data.tool === 'image' && data.src) {
      try {
        // 1. Strip Metadata Prefix (data:image/png;base64,)
        const base64Data = data.src.split(',')[1];
        if (!base64Data) return;

        // 2. Convert to Buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // 3. Inspect Magic Bytes
        const header = buffer.subarray(0, 4).toString('hex').toUpperCase();

        const MAGIC_BYTES = {
          JPG: 'FFD8FF',
          PNG: '89504E47',
          GIF: '47494638',
          WEBP: '52494646' // RIFF...
        };

        const isImage =
          header.startsWith(MAGIC_BYTES.JPG) ||
          header.startsWith(MAGIC_BYTES.PNG) ||
          header.startsWith(MAGIC_BYTES.GIF) ||
          header.startsWith('524946'); // WEBP prefix

        // 4. Block Executables (MZ = 4D5A, ELF = 7F454C46)
        const isMalware = header.startsWith('4D5A') || header.startsWith('7F454C46');

        if (isMalware || !isImage) {
          console.warn(`🚨 BLOCKED SUSPICIOUS UPLOAD: Header [${header}] from ${socket.id}`);
          socket.emit('error', { message: "Security Alert: File rejected. Invalid image format or potential malware detected." });
          return; // STOP propagation
        }

      } catch (err) {
        console.error("Validation Error:", err);
        return;
      }
    }

    socket.to(data.roomId).emit("draw", data);
  });

  socket.on("whiteboard-update", (data) => {
    // Broadcast snapshot to others in room
    socket.to(data.roomId).emit("whiteboard-update", data);
  });

  socket.on("cursor-move", (data) => {
    // Ephemeral cursor updates for laser pointer
    socket.to(data.roomId).emit("cursor-move", data);
  });

  socket.on("clear-canvas", (roomId) => {
    socket.to(roomId).emit("clear-canvas");
  });

  // 🔐 ECDH Security Handshake Relay
  socket.on("handshake-signal", (data) => {
    console.log(`🔐 key-exchange: ${data.senderId} -> ${data.roomId} (${data.type})`);
    // Broadcast to others in the room (excluding sender)
    socket.to(data.roomId).emit("handshake-signal", data);
  });

  // 👻 Disappearing Messages Toggle
  socket.on("toggle-disappearing", async (data) => {
    // data: { roomId, enabled, duration }
    console.log("👻 Toggle disappearing:", data);

    try {
      if (!data.roomId) {
        console.error("❌ Missing roomId in toggle-disappearing");
        return;
      }

      // 1. Update Stream Chat Channel
      const channel = streamClient.channel('messaging', data.roomId);
      await channel.updatePartial({
        set: {
          disappearingSettings: {
            enabled: data.enabled,
            duration: data.duration
          }
        }
      });
      console.log(`✅ Stream Chat channel ${data.roomId} updated with disappearing settings`);

      // 2. Broadcast to Socket.io clients (for real-time banner updates if needed)
      // Note: Stream Chat client might also receive 'channel.updated' event
      io.to(data.roomId).emit("disappearing-updated", {
        enabled: data.enabled,
        duration: data.duration
      });

    } catch (err) {
      console.error("❌ Failed to update disappearing settings:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ... session & passport logic ...
// (Retain existing middleware)

// ------------------ SESSION & PASSPORT ------------------
app.use(
  session({
    secret: process.env.JWT_SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ------------------ SECURITY (Helmet) ------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          "wss:",
          "ws:", // Allow WS
          "https:",
          "http://localhost:*",
          "http://stellar-backend:5001",
          "stun:",
          "turn:",
          "https://*.stream-io-api.com",
          "https://*.getstream.io",
          "https://accounts.google.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://flagcdn.com",
          "https://avatar.iran.liara.run",
          "https://*.googleusercontent.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'self'", "https://accounts.google.com"],
      },
    },
  })
);

// ------------------ CORS (FIXED FOR DOCKER) ------------------
app.use(
  cors({
    origin: [
      "http://localhost",
      "http://localhost:80",
      "http://localhost:5173", // Vite dev server
      "http://stellar-frontend",
      "http://stellar-frontend:80",
    ],
    credentials: true,
  })
);

// ------------------ PARSERS ------------------
app.use(express.json());
app.use(cookieParser());

// ------------------ RATE LIMITING (Network Hardening) ------------------

// 1. Auth Limiter: Protect Login/Reset Password from Brute Force
// Limit: 5 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 5 requests per windowMs (relaxed to 15 for dev)
  message: { error: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. API Limiter: Protect General API from DoS/Scanning
// Limit: 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply Limiters
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// ------------------ ROUTES ------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

// ------------------ SERVER STARTUP ------------------
const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected");

    if (process.env.NODE_ENV !== "production") {
      // Sync logic if needed
    }

    // Change app.listen to httpServer.listen
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Server startup failed:", err.message);
    process.exit(1);
  }
};

startServer();
