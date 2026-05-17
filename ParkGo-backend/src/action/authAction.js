import { findUserByEmail } from "../lib/supabaseUserApi.js";

const roleMap = {
  manager: "admin",
  attendant: "attendant",
  subscriber: "subscriber",
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const toSafeUser = (user) => {
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName,
    phoneNumber: user.phone_number,
    userType: user.user_type,
    role: roleMap[user.user_type] || "subscriber",
    avatar: (user.first_name || user.email || "U").charAt(0).toUpperCase(),
  };
};

export async function loginAction({ identifier, password }) {
  const email = normalizeEmail(identifier);
  const cleanPassword = String(password || "").trim();

  if (!email || !cleanPassword) {
    return {
      status: 400,
      body: {
        success: false,
        message: "Email and password are required.",
      },
    };
  }

  let user;
  try {
    user = await findUserByEmail(email);
  } catch (error) {
    console.error("Supabase lookup failed for login:", error);
    return {
      status: 500,
      body: {
        success: false,
        message: "Unable to verify credentials. Please check backend/Supabase configuration.",
      },
    };
  }

  if (!user || user.password !== cleanPassword) {
    return {
      status: 401,
      body: {
        success: false,
        message: "Invalid email or password.",
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: "Login succeeded.",
      data: {
        user: toSafeUser(user),
      },
    },
  };
}
