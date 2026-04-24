import jwt from "jsonwebtoken";
import { generateOTP, sendOTPEmail } from "../lib/emailService.js";
import { upsertStreamUser } from "../lib/stream.js";
import Otp from "../models/Otp.js";
import TrustedDevice from "../models/TrustedDevice.js";
import User from "../models/User.js";

// STEP 1: Initial signup - creates user and sends OTP
export async function signup(req, res) {
  const { email, password, fullName } = req.body;

  try {
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email already exists, please use a different one" });
    }

    const idx = Math.random().toString(36).substring(7);
    const randomAvatar = `https://api.dicebear.com/9.x/bottts/svg?seed=${idx}`;

    // Create user but don't verify email yet
    const newUser = await User.create({
      email,
      fullName,
      password,
      profilePic: randomAvatar,
      isEmailVerified: false,
    });

    // Generate and save OTP
    const otp = generateOTP();
    await Otp.create({
      email,
      otp,
      type: "email_verification",
    });

    // Send OTP email
    await sendOTPEmail(email, otp, "email_verification");

    res.status(201).json({
      success: true,
      message:
        "Signup successful! Please verify your email with the OTP sent to your email.",
      userId: newUser._id,
      email: newUser.email,
    });
  } catch (error) {
    console.log("Error in signup controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// STEP 2: Verify email OTP
export async function verifyEmail(req, res) {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Find valid OTP
    const otpRecord = await Otp.findOne({
      email,
      otp,
      type: "email_verification",
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Update user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isEmailVerified = true;
    await user.save();

    // Create Stream user
    try {
      await upsertStreamUser({
        id: user._id.toString(),
        name: user.fullName,
        image: user.profilePic || "",
      });
      console.log(`Stream user created for ${user.fullName}`);
    } catch (error) {
      console.log("Error creating Stream user:", error);
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "7d",
    });

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      user,
    });
  } catch (error) {
    console.log("Error in verifyEmail controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Resend OTP
export async function resendOTP(req, res) {
  const { email, type = "email_verification" } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete old OTPs for this email and type
    await Otp.deleteMany({ email, type });

    // Generate new OTP
    const otp = generateOTP();
    await Otp.create({
      email,
      otp,
      type,
    });

    // Send OTP email
    await sendOTPEmail(email, otp, type);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully!",
    });
  } catch (error) {
    console.log("Error in resendOTP controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// STEP 1: Login - Check device and send OTP if needed
export async function login(req, res) {
  try {
    const {
      email,
      password,
      deviceFingerprint,
      rememberDevice = false,
    } = req.body;

    if (!email || !password || !deviceFingerprint) {
      return res
        .status(400)
        .json({ message: "Email, password, and device info are required" });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({
        message: "Please verify your email first",
        requiresEmailVerification: true,
      });
    }

    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect)
      return res.status(401).json({ message: "Invalid email or password" });

    // Check if device is trusted
    const trustedDevice = await TrustedDevice.findOne({
      userId: user._id,
      deviceFingerprint,
    });

    if (trustedDevice) {
      // Device is trusted - login directly
      trustedDevice.lastUsed = new Date();
      await trustedDevice.save();

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, {
        expiresIn: "7d",
      });

      res.cookie("jwt", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      });

      return res.status(200).json({ success: true, user });
    } else {
      // Unknown device - send OTP
      const otp = generateOTP();
      await Otp.create({
        email,
        otp,
        type: "device_verification",
      });

      await sendOTPEmail(email, otp, "device_verification");

      return res.status(200).json({
        success: true,
        requiresDeviceVerification: true,
        message: "OTP sent to your email for device verification",
        email,
      });
    }
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// STEP 2: Verify device OTP and complete login
export async function verifyDeviceOTP(req, res) {
  try {
    const {
      email,
      otp,
      deviceFingerprint,
      deviceInfo,
      rememberDevice = false,
    } = req.body;

    if (!email || !otp || !deviceFingerprint) {
      return res
        .status(400)
        .json({ message: "Email, OTP, and device info are required" });
    }

    // Verify OTP
    const otpRecord = await Otp.findOne({
      email,
      otp,
      type: "device_verification",
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Get user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add device to trusted devices if rememberDevice is true
    if (rememberDevice) {
      await TrustedDevice.create({
        userId: user._id,
        deviceFingerprint,
        deviceInfo: deviceInfo || {},
      });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "7d",
    });

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.log("Error in verifyDeviceOTP controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export function logout(req, res) {
  res.clearCookie("jwt");
  res.status(200).json({ success: true, message: "Logout successful" });
}

export async function onboard(req, res) {
  try {
    const userId = req.user._id;

    const { fullName, bio, nativeLanguage, learningLanguage, location } =
      req.body;

    if (
      !fullName ||
      !bio ||
      !nativeLanguage ||
      !learningLanguage ||
      !location
    ) {
      return res.status(400).json({
        message: "All fields are required",
        missingFields: [
          !fullName && "fullName",
          !bio && "bio",
          !nativeLanguage && "nativeLanguage",
          !learningLanguage && "learningLanguage",
          !location && "location",
        ].filter(Boolean),
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...req.body,
        isOnboarded: true,
      },
      { new: true }
    );

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    try {
      await upsertStreamUser({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: updatedUser.profilePic || "",
      });
      console.log(
        `Stream user updated after onboarding for ${updatedUser.fullName}`
      );
    } catch (streamError) {
      console.log(
        "Error updating Stream user during onboarding:",
        streamError.message
      );
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
