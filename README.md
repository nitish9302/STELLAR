# Stellar: Secure Collaborative Language Learning Platform

## Project Overview

Stellar is an advanced, real-time communication platform designed specifically for synchronous language learning and collaboration. It integrates persistent messaging, high-fidelity video conferencing, and a synchronized interactive whiteboard into a single, cohesive interface.

The project prioritizes security, scalability, and developer ergonomics, leveraging a modern stack to solve the latency and fragmentation issues often found in educational technologies.

## Problem Statement

Traditional language learning tools often suffer from fragmentation, forcing users to switch between disparate applications for video calls, messaging, and visual aids. This context switching disrupts the cognitive flow required for immersion. Furthermore, many educational platforms neglect rigorous security standards, leaving user data and session integrity vulnerable to common network attacks.

Stellar addresses these challenges by centrally orchestrating all communication modalities—audio, video, text, and drawing—within a secure, validated execution environment.

## Comprehensive Feature Suite

### Frontend Features
- **Concurrent Rendering**: Powered by React 19, enabling seamless UI transitions even during heavy data synchronization.
- **Client-Side Optimization**: Built with Vite for optimized asset bundling, tree-shaking, and lazy loading of heavy components (e.g., Whiteboard, Video SDK).
- **Responsive Design System**: Implemented using Tailwind CSS and DaisyUI, ensuring full accessibility and responsiveness across all device viewports.
- **Transient State Management**: Utilizes Zustand for high-velocity state updates (cursor tracking, drawing deltas) to bypass React's reconciliation cycle for performance.
- **Form Management**: Robust form validation and error handling for authentication and user profiles.

### Backend Features
- **Event-Driven Architecture**: Built on Node.js to handle thousands of concurrent WebSocket connections efficiently.
- **Unopinionated Routing**: Express.js middleware chain allows for modular route handlers and custom security injection.
- **Data Persistence**: MongoDB with Mongoose ORM provides a flexible schema for user data, chat history, and whiteboards.
- **Secure Session Management**: Passport.js integration with Google OAuth 2.0 and HttpOnly/SameSite cookie policies.
- **Automated Maintenance**: Scheduled scripts for syncing user data with external services (Stream Chat).

### Premium Capabilities
- **Ghost Protocol (Privacy Shield)**: Mitigates traffic analysis by padding all encrypted messages to a constant bit rate (2048 bytes).
- **Smart Badging System**: Dynamic visual indicators for security status, real-time notifications, and online presence.
- **Disappearing Messages**: Ephemeral chat functionality with synchronization across all clients and auto-purge mechanisms.
- **Voice Messaging**: Integrated audio recorder with waveform visualization and secure blob storage.

## Collaborative Learning Mechanics

Stellar is engineered to facilitate deep, synchronous collaboration, mimicking a physical classroom environment.

### 1. Synchronized Visual Context
The interactive whiteboard (powered by Tldraw) is fully synchronized across all connected clients.
- **Use Case**: A teacher can draw a diagram explaining grammar rules, and the student sees the strokes in real-time.
- **Multi-User Editing**: Both parties can annotate, erase, and point (using the Laser tool) simultaneously without conflict.

### 2. Dual-Channel Communication
By integrating Video/Audio calls directly alongside the Chat and Whiteboard:
- **Use Case**: Users can practice pronunciation (Video) while typing out spelling corrections (Chat) and visualizing sentence structures (Whiteboard) all in the same window.
- **Context Preservation**: No need to "tab-switch" means the learning context is never lost.

### 3. Persistent History
unlike standard video call apps, Stellar maintains chat history.
- **Use Case**: Resources, links, or corrections sent during a session remain accessible after the call ends, allowing for asynchronous review.

## Usage Guide for Collaborative Learning

### Starting a Session
1.  **Log In**: Authenticate securely using your Google account.
2.  **Add Friends**: Navigate to the Friends tab and search for your peer or tutor.
3.  **Initiate Call**: Click the Video Call icon to start a secure, encrypted media session.

### Using the Collaboration Tools
- **Whiteboard**: Click the "Board" icon during a chat or call.
    - *Laser Pointer*: Use this to highlight areas of interest without making permanent marks.
    - *Image Upload*: Drag and drop images (e.g., homework sheets) to annotate them together.
- **Ghost Protocol**: Toggle this in Chat Settings if you require maximum privacy for your text exchange.
- **Voice Notes**: Hold the Mic icon to record pronunciation samples for your peer to review.

## Infrastructure and Deployment

### Docker and Containerization
The entire application stack is containerized using Docker to ensure environment consistency across development, testing, and production stages.

**Why Docker?**
1.  **Isolation**: Docker ensures that the backend and frontend services run in isolated environments with their accurate dependencies, eliminating "it works on my machine" issues.
2.  **Reproducibility**: The `Dockerfile` definitions allow any developer to spin up the exact production environment locally within minutes.
3.  **Network Segregation**: Docker Compose creates a private internal network (`stellar-network`), ensuring that backend services (like the database if localized) are not directly exposed to the public internet, accessible only by the API gateway or application service.

### Orchestration
`docker-compose` is used to orchestrate the multi-container application, defining service dependencies (e.g., frontend waits for backend health checks) and managing shared volumes and networks.

## Security Features Breakdown

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

## License
This project is licensed under the MIT License.
