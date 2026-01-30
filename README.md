# Stellar: Secure Collaborative Language Learning Platform

## Project Overview

Stellar is an advanced, real-time communication platform designed specifically for synchronous language learning and collaboration. It integrates persistent messaging, high-fidelity video conferencing, and a synchronized interactive whiteboard into a single, cohesive interface.

The project prioritizes security, scalability, and developer ergonomics, leveraging a modern stack to solve the latency and fragmentation issues often found in educational technologies.

## Problem Statement

Traditional language learning tools often suffer from fragmentation, forcing users to switch between disparate applications for video calls, messaging, and visual aids. This context switching disrupts the cognitive flow required for immersion. Furthermore, many educational platforms neglect rigorous security standards, leaving user data and session integrity vulnerable to common network attacks.

Stellar addresses these challenges by centrally orchestrating all communication modalities—audio, video, text, and drawing—within a secure, validated execution environment.

## ✨ Premium Features

Stellar includes advanced capabilities often found only in enterprise-grade software:

### 👻 Ghost Protocol (Privacy Shield)
Prevents side-channel traffic analysis by normalizing packet sizes.
- **Traffic Padding**: All encrypted messages are padded to a constant bit rate (`2048 bytes`), making it impossible for network sniffers to distinguish between short "Hello" messages and longer tactical commands based on packet size.
- **Visual Feedback**: A "Ghost Protocol" badge appears in the chat when active, assuring users of enhanced privacy.

### 🏷️ Smart Badging System
A comprehensive visual status system that keeps users informed at a glance:
- **Security Badges**: Dynamic indicators (Green/Yellow/Red) showing real-time encryption status (Secured/Negotiating/Error).
- **Notification Badges**: Real-time counters for friend requests and unread messages.
- **Status Indicators**: Live "Online/Offline" presence detection.

### ⏳ Disappearing Messages (Ephemeral Chat)
For sensitive conversations, users can enable auto-deletion timers.
- **Flexible Timers**: Configurable lifetimes ranging from 1 minute to 24 hours.
- **Synchronized State**: A persistent banner alerts all participants when ephemeral mode is active.
- **Auto-Purge**: Messages are automatically removed from the UI and backend once the timer expires.

### 🎙️ Crystal-Clear Voice Messaging
- **Integrated Recorder**: Built-in voice recorder with waveform visualization and pulse animations.
- **One-Click Send**: Seamlessly upload and send audio notes directly within the chat stream.

---

## System Architecture and Technology Stack

The application follows a modular architecture, separating concerns between a robust high-throughput backend and a responsive, client-side rendered frontend.

### Frontend Architecture
**Technology:** React 19, Vite, Tailwind CSS
- **React 19**: Chosen for its concurrent rendering capabilities and improved state management, ensuring smooth UI updates even during heavy real-time activity.
- **Vite**: Utilized as the build tool to provide sub-second hot module replacement (HMR) and optimized production enhancements (tree-shaking, code-splitting).
- **Zustand**: Implements a transient state management strategy (outside the React reconciliation cycle) for frequent high-velocity updates like cursor movements and whiteboard strokes, minimizing re-renders.

### Backend Architecture
**Technology:** Node.js, Express.js, MongoDB
- **Node.js**: The event-driven, non-blocking I/O model of Node.js is critical for handling thousands of concurrent open socket connections required for real-time features.
- **Express.js**: Provides a thin, unopinionated layer for routing and middleware execution, allowing for custom security implementations.
- **MongoDB**: A NoSQL document store was selected for its flexibility in handling variable data schemas (chat messages, user profiles) and its high write throughput.

### Real-Time Engine
- **Socket.io**: Powers the signaling server for establishing peer-to-peer connections and broadcasting low-latency events (cursor positions, whiteboard deltas).
- **Stream SDKs**: Dedicated edge networks are leveraged for chat persistence and video encoding/decoding, offloading heavy media processing from the core application server to ensure stability.

---

## Infrastructure and Deployment

### Docker and Containerization
The entire application stack is containerized using Docker to ensure environment consistency across development, testing, and production stages.

**Why Docker?**
1.  **Isolation**: Docker ensures that the backend and frontend services run in isolated environments with their accurate dependencies, eliminating "it works on my machine" issues.
2.  **Reproducibility**: The `Dockerfile` definitions allow any developer to spin up the exact production environment locally within minutes.
3.  **Network Segregation**: Docker Compose creates a private internal network (`stellar-network`), ensuring that backend services (like the database if localized) are not directly exposed to the public internet, accessible only by the API gateway or application service.

### Orchestration
`docker-compose` is used to orchestrate the multi-container application, defining service dependencies (e.g., frontend waits for backend health checks) and managing shared volumes and networks.

---

## 🛡️ Security Features Breakdown

Stellar utilizes a **Defense-in-Depth** strategy, implementing multiple layers of security controls to protect user data and application integrity.

| Feature | Type | Description |
| :--- | :--- | :--- |
| **Magic Byte Validation** | *Input Validation* | Prevents malicious file uploads (e.g., masking `.exe` as `.jpg`) by inspecting the file's binary signature (Magic Bytes) rather than trusting the file extension. |
| **Helmet.js** | *HTTP Hardening* | Secures HTTP headers by setting `Content-Security-Policy`, `X-Frame-Options`, and `X-Content-Type-Options` to mitigate XSS, Clickjacking, and MIME-sniffing attacks. |
| **Rate Limiting** | *Traffic Control* | Implements `express-rate-limit` on API and Auth routes to prevent Brute Force login attempts and Denial-of-Service (DoS) attacks from malicious IPs. |
| **HttpOnly Cookies** | *Session Security* | Stores session tokens in `HttpOnly` cookies, making them inaccessible to client-side JavaScript. This neutralizes Cross-Site Scripting (XSS) attacks trying to steal session credentials. |
| **Strict CORS Policy** | *Access Control* | Cross-Origin Resource Sharing is restrictively configured to allow requests *only* from trusted frontend domains, preventing unauthorized cross-origin API calls. |
| **Socket.io Origin Checks** | *Real-time Security* | The signaling server strictly validates the handshake origin, ensuring only clients from the approved dashboard can establish a WebSocket connection. |
| **OAuth 2.0 via Passport** | *Authentication* | Delegates credential handling to Google's robust OAuth provider, reducing the risk of password leaks or weak credential storage on the server side. |

---

## Installation and Setup Guidelines

### Prerequisites
- **Node.js**: Version 20.x or higher
- **Docker Engine**: Latest stable release
- **MongoDB**: Connection URI (Local or Atlas)

### Configuration
Create a `.env` file in the `backend/` directory with the following secure credentials:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET_KEY=your_secure_random_string
STREAM_API_KEY=your_stream_key
STREAM_API_SECRET=your_stream_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Deployment via Docker (Recommended)
Execute the following command in the project root to build and run the orchestration services:

```bash
docker-compose up --build
```
This command compiles the frontend assets, installs backend dependencies, and launches the services on their designated ports (Frontend: 80, Backend: 5001).

### Manual Development Setup

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## License
This project is licensed under the MIT License.
