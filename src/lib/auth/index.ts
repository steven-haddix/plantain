import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";

type GoogleProfile = {
  email?: string;
  given_name?: string;
  name?: string;
  picture?: string;
};

const fallbackNameFromEmail = (email: string) => {
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return "Traveler";

  const name = localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!name) return "Traveler";

  return name
    .split(" ")
    .map((segment) =>
      segment ? `${segment[0]?.toUpperCase()}${segment.slice(1)}` : segment,
    )
    .join(" ");
};

export const auth = betterAuth({
  appName: "Plantain",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    modelName: "users",
    fields: {
      image: "avatarUrl",
      emailVerified: "emailVerified",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
  session: {
    modelName: "sessions",
  },
  account: {
    modelName: "accounts",
    accountLinking: {
      enabled: true,
    },
  },
  verification: {
    modelName: "verifications",
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      prompt: "select_account",
      mapProfileToUser: (profile) => {
        const googleProfile = profile as GoogleProfile;
        const email = googleProfile.email?.trim().toLowerCase() ?? "";
        const name =
          googleProfile.name?.trim() ||
          googleProfile.given_name?.trim() ||
          fallbackNameFromEmail(email);

        return {
          name,
          image: googleProfile.picture,
        };
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];

export async function getServerAuthSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireServerAuthSession() {
  const session = await getServerAuthSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireServerAuthUser() {
  const session = await requireServerAuthSession();
  return session.user;
}

export async function getRequestAuthSession(request: Request | Headers) {
  const requestHeaders = request instanceof Headers ? request : request.headers;

  return auth.api.getSession({
    headers: requestHeaders,
  });
}
