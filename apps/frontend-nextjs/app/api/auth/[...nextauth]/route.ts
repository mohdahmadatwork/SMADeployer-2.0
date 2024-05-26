import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@repo/db";
import {compare} from "bcrypt";
import jwt from "jsonwebtoken"
const handler = NextAuth({
    providers:[
        CredentialsProvider({
            name:"Email",
            credentials:{
                email: {label:'Email',type:"text",placeholder:'Email'},
                password: {label:'Password',type:"password",placeholder:'Password'},
            },
            async authorize(credentials: any) {
                const email = credentials.email; 
                const password = credentials.password; 
                const user = await prisma.User.findOne({
                    where: {email:email}
                });
                if (user) {
                    const isUserValidated = compare(password,user.password);
                    if (!isUserValidated) {
                        return null;
                    }else{
                        const user = {
                            email:email,
                            jwt: await jwt.sign({email},process.env.JWT_SECRET,{expiresIn:'1h'})
                        };
                        return user;
                    }
                }else{
                    return null;
                }
                return null;
            },
        })
    ]
});
export const GET = handler;
export const POST = handler;
