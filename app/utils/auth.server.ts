import { redirect, json, createCookieSessionStorage } from "@remix-run/node";
import { prisma } from "./prisma.server";
import type { RegisterForm, LoginForm } from "./types.server";
import { createUser } from "./user.server";
import bcrypt from "bcryptjs";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("Secret not specified, it must be set");

const storage = createCookieSessionStorage({
  cookie: {
    name: "remix-mongo-auth",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

export const registerUser = async (form: RegisterForm) => {
  const userExist = await prisma.user.count({
    where: {
      email: form.email
    }
  });

  if (userExist) {
    return json({ error: `User already exists` }, { status: 400 });
  }

  const newUser = await createUser(form);
  if (!newUser) {
    return json(
      {
        error: `User cannot be created.`,
        fields: { email: form.email, password: form.password },
      },
      { status: 400 }
    );
  }
  //redirect to homepage if user already exists
  return createUserSession(newUser.id, '/');
}

export const loginUser = async ({ email, password }: LoginForm) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await bcrypt.compare(password, user.password)))
    return json({ error: `Incorrect login` }, { status: 400 });

  //redirect to homepage if user already exists
  return createUserSession(user.id, '/');
}

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}