import { supabase } from "./supabaseClient.js";

export async function registerUser({ name, email, password, role }) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role
      }
    }
  });

  if (authError) {
    throw authError;
  }

  if (!authData.user) {
    throw new Error("Не удалось создать пользователя");
  }

  // If email confirmation is disabled, session is available and we can create profile immediately.
  // If confirmation is enabled, profile will be created on first login by ensureProfileExists.
  if (authData.session && authData.user) {
    try {
      await ensureProfileExists(authData.user);
    } catch (error) {
      // Do not fail successful signup because profile can be created on first login.
      console.warn("Profile sync during sign up failed:", error.message);
    }
  }

  return {
    ...authData,
    needsEmailConfirmation: !authData.session
  };
}

export async function ensureProfileExists(user) {
  if (!user?.id || !user?.email) {
    throw new Error("Пользователь не найден");
  }

  const profilePayload = {
    id: user.id,
    name: user.user_metadata?.name || user.email.split("@")[0],
    email: user.email,
    password: "auth_managed",
    role: user.user_metadata?.role || "patient"
  };

  const { error } = await supabase.from("users").upsert(profilePayload, {
    onConflict: "id"
  });

  if (error) {
    throw error;
  }
}

export async function loginUser({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  return data;
}
