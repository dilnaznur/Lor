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

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("Не удалось создать пользователя");
  }

  const { error: profileError } = await supabase.from("users").upsert({
    id: userId,
    name,
    email,
    password: "auth_managed",
    role
  });

  if (profileError) {
    throw profileError;
  }

  return authData;
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
