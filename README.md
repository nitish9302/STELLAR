# Stellar: Secure Collaborative Language Learning Platform

## Project Overview

Stellar is an advanced, real-time communication platform designed specifically for synchronous language learning and collaboration. It integrates persistent messaging, high-fidelity video conferencing, and a synchronized interactive whiteboard into a single, cohesive interface.

The project prioritizes security, scalability, and developer ergonomics, leveraging a modern stack to solve the latency and fragmentation issues often found in educational technologies.

## Problem Statement

Traditional language learning tools often suffer from fragmentation, forcing users to switch between disparate applications for video calls, messaging, and visual aids. This context switching disrupts the cognitive flow required for immersion. Furthermore, many educational platforms neglect rigorous security standards, leaving user data and session integrity vulnerable to common network attacks.

Stellar addresses these challenges by centrally orchestrating all communication modalities—audio, video, text, and drawing—within a secure, validated execution environment.

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

## Security Engineering

Security is not an add-on but a foundational component of the Stellar architecture.

### 1. Magic Byte Validation for File Uploads
Relying solely on file extensions for validation is insecure, as malicious executables can easily be renamed (e.g., `malware.exe` to `image.png`). Stellar implements "Magic Byte" inspection, reading the first few bytes of the file buffer to verify its widespread hexadecimal signature (e.g., `FF D8 FF` for JPEG), ensuring the file type is authentic before processing.

### 2. Network Hardening (Rate Limiting)
To mitigate Denial-of-Service (DoS) and Brute Force attacks, the application implements distinct rate limiters:
- **Authentication Limiter**: strict throttling on login endpoints (e.g., 5 attempts/15 mins) to prevent password guessing.
- **API Limiter**: General throttling on resource endpoints to maintain system stability under load.

### 3. Content Security Policy (CSP)
Using the `helmet` middleware, Stellar enforces a strict Content Security Policy. This prevents Cross-Site Scripting (XSS) by whitelisting trusted content sources (scripts, images, connection endpoints) and blocking inline scripts or unauthorized external resources.

### 4. Secure Authentication Flow
Authentication is managed via Passport.js (Google OAuth strategy), utilizing secure, HTTP-only, SameSite cookies to manage sessions. This prevents Client-Side script access to session tokens, neutralizing a wide class of XSS token theft vectors.

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
