// backend/src/lib/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import { upsertStreamUser } from "./stream.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, displayName, emails, photos } = profile;
        const email = emails?.[0]?.value;
        const picture = photos?.[0]?.value;

        if (!email) {
          return done(new Error("Google account must have an email"), null);
        }

        let user = await User.findOne({ email });

        if (!user) {
          // Create new user (Google signup)
          const idx = Math.random().toString(36).substring(7);
          const randomAvatar = picture || `https://api.dicebear.com/9.x/bottts/svg?seed=${idx}`;

          user = await User.create({
            fullName: displayName || email.split("@")[0],
            email: email,
            password: "", // No password for OAuth
            profilePic: randomAvatar,
            isEmailVerified: true, // Google emails are verified
            isOnboarded: false, // Will onboard later
          });
        } else if (!user.isEmailVerified) {
          user.isEmailVerified = true;
          await user.save();
        }

        // Sync with Stream
        await upsertStreamUser({
          id: user._id.toString(),
          name: user.fullName,
          image: user.profilePic || "",
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select("-password");
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
