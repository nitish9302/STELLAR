import "dotenv/config";
import { StreamChat } from "stream-chat";

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

console.log("🔑 Stream Config:");
console.log("API Key:", apiKey);
console.log("Secret length:", apiSecret ? apiSecret.length : "MISSING");

if (!apiKey || !apiSecret) {
  console.error("❌ Stream API key or Secret is missing");
}

export const streamClient = StreamChat.getInstance(apiKey, apiSecret);

export const upsertStreamUser = async (userData) => {
  try {
    console.log("📝 Upserting Stream user:", userData.id);
    await streamClient.upsertUsers([userData]);
    return userData;
  } catch (error) {
    console.error("❌ Error upserting Stream user:", error);
  }
};

export const generateStreamToken = (userId) => {
  try {
    const userIdStr = userId.toString();
    console.log("🎫 Generating token for user:", userIdStr);
    const token = streamClient.createToken(userIdStr);
    console.log("✅ Token generated successfully");
    return token;
  } catch (error) {
    console.error("❌ Error generating Stream token:", error);
    throw error;
  }
};
