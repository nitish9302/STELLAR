import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CameraIcon,
  LoaderIcon,
  MapPinIcon,
  SaveIcon,
  ShuffleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { LANGUAGES } from "../constants";
import useAuthUser from "../hooks/useAuthUser";
import { updateUserProfile } from "../lib/api";

const ProfilePage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [formState, setFormState] = useState({
    fullName: "",
    bio: "",
    nativeLanguage: "",
    learningLanguage: "",
    location: "",
    profilePic: "",
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Update form when authUser loads
  useEffect(() => {
    if (authUser) {
      setFormState({
        fullName: authUser.fullName || "",
        bio: authUser.bio || "",
        nativeLanguage: authUser.nativeLanguage || "",
        learningLanguage: authUser.learningLanguage || "",
        location: authUser.location || "",
        profilePic: authUser.profilePic || "",
      });
    }
  }, [authUser]);

  const { mutate: updateProfileMutation, isPending } = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (data) => {
      console.log("✅ Profile updated:", data);
      toast.success("Profile updated successfully!");

      // Invalidate and refetch auth user
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      queryClient.refetchQueries({ queryKey: ["authUser"] });

      // Also invalidate friends list in case name/avatar changed
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });

      setHasChanges(false);
    },
    onError: (error) => {
      console.error("❌ Profile update error:", error);
      toast.error(error.response?.data?.message || "Failed to update profile");
    },
  });

  const handleInputChange = (field, value) => {
    setFormState({ ...formState, [field]: value });
    setHasChanges(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("📤 Submitting profile update:", formState);
    updateProfileMutation(formState);
  };

  const handleRandomAvatar = () => {
    const idx = Math.random().toString(36).substring(7);
    const randomAvatar = `https://api.dicebear.com/9.x/bottts/svg?seed=${idx}`;
    setFormState({ ...formState, profilePic: randomAvatar });
    setHasChanges(true);
    toast.success("Random profile picture generated!");
  };

  const handleCancel = () => {
    if (authUser) {
      setFormState({
        fullName: authUser.fullName || "",
        bio: authUser.bio || "",
        nativeLanguage: authUser.nativeLanguage || "",
        learningLanguage: authUser.learningLanguage || "",
        location: authUser.location || "",
        profilePic: authUser.profilePic || "",
      });
    }
    setHasChanges(false);
  };

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-3xl">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold">Edit Profile</h1>
              <button
                onClick={() => navigate(-1)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Picture Section */}
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="size-32 rounded-full bg-base-300 overflow-hidden ring-4 ring-primary/20">
                    {formState.profilePic ? (
                      <img
                        src={formState.profilePic}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <CameraIcon className="size-12 text-base-content opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2">
                    <button
                      type="button"
                      onClick={handleRandomAvatar}
                      className="btn btn-circle btn-sm btn-primary"
                      title="Generate random avatar"
                    >
                      <ShuffleIcon className="size-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRandomAvatar}
                  className="btn btn-outline btn-sm"
                >
                  <ShuffleIcon className="size-4 mr-2" />
                  Generate Random Avatar
                </button>
              </div>

              {/* Full Name */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Full Name</span>
                </label>
                <input
                  type="text"
                  value={formState.fullName}
                  onChange={(e) =>
                    handleInputChange("fullName", e.target.value)
                  }
                  className="input input-bordered w-full"
                  placeholder="Your full name"
                  required
                />
              </div>

              {/* Bio */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Bio</span>
                  <span className="label-text-alt">
                    {formState.bio.length}/500
                  </span>
                </label>
                <textarea
                  value={formState.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  className="textarea textarea-bordered h-24"
                  placeholder="Tell others about yourself and your language learning goals"
                  maxLength={500}
                />
              </div>

              {/* Languages */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Native Language */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Native Language
                    </span>
                  </label>
                  <select
                    value={formState.nativeLanguage}
                    onChange={(e) =>
                      handleInputChange("nativeLanguage", e.target.value)
                    }
                    className="select select-bordered w-full"
                    required
                  >
                    <option value="">Select your native language</option>
                    {LANGUAGES.map((lang) => (
                      <option key={`native-${lang}`} value={lang.toLowerCase()}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Learning Language */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Learning Language
                    </span>
                  </label>
                  <select
                    value={formState.learningLanguage}
                    onChange={(e) =>
                      handleInputChange("learningLanguage", e.target.value)
                    }
                    className="select select-bordered w-full"
                    required
                  >
                    <option value="">Select language you're learning</option>
                    {LANGUAGES.map((lang) => (
                      <option
                        key={`learning-${lang}`}
                        value={lang.toLowerCase()}
                      >
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Location</span>
                </label>
                <div className="relative">
                  <MapPinIcon className="absolute top-1/2 transform -translate-y-1/2 left-3 size-5 text-base-content opacity-70" />
                  <input
                    type="text"
                    value={formState.location}
                    onChange={(e) =>
                      handleInputChange("location", e.target.value)
                    }
                    className="input input-bordered w-full pl-10"
                    placeholder="City, Country"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn btn-ghost flex-1"
                  disabled={!hasChanges || isPending}
                >
                  Cancel Changes
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={!hasChanges || isPending}
                >
                  {isPending ? (
                    <>
                      <LoaderIcon className="animate-spin size-5 mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <SaveIcon className="size-5 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
