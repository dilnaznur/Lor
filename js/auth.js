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

  return authData;
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
