import NextAuth, { User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@repo/db/client";
import {compare} from "bcrypt";
import jwt from "jsonwebtoken"
import { authOptions } from "@/lib/auth";
const handler = NextAuth(authOptions);
export const GET = handler;
export const POST = handler;
