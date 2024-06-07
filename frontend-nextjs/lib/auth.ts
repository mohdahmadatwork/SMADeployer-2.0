import prisma from "../db/prismaclient";
import CredentialsProvider from "next-auth/providers/credentials";
import {compare, hash} from "bcrypt";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import LinkedInProvider from "next-auth/providers/linkedin";
import jwt from "jsonwebtoken";
export const authOptions = {
    providers:[
        CredentialsProvider({
            name:"Email",
            credentials:{
                email: {label:'Email',type:"text",placeholder:'Email'},
                password: {label:'Password',type:"password",placeholder:'Password'},
            },
            async authorize(credentials: any) {
                if (!credentials) {
                    return null;
                }
                const email = credentials.email; 
                const password = credentials.password; 
                const user = await prisma.user.findUnique({
                    where:{email:email}
                });
                if (user) {
                    const isUserValidated = await compare(password,user.password);
                    if (!isUserValidated) {
                        return null;
                    }else{
                        const userInfo = {
                            id:(user.id).toString(),
                            email:email
                        };
                        return userInfo;
                    }
                }else{
                    return null;
                }
            },
        }),
        GitHubProvider({
            clientId: process.env.GITHUB_ID??"",
            clientSecret: process.env.GITHUB_SECRET??""
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID??"",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET??""
        }),
        LinkedInProvider({
            clientId: process.env.LINKEDIN_CLIENT_ID??"",
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET??""
        })
    ],
    secret: process.env.JWT_SECRET || "secret",
    callbacks:{
        async jwt({token,user}:any){
            const id = token.sub;
            const email = token.email;
            console.log("user");
            console.log(user);
            console.log("token jwt");
            console.log(token);
            const authToken = await jwt.sign({email,id},process.env.JWT_SECRET || "secret",{expiresIn:'1h'});
            token.authToken = authToken;
            return token;
        },
        async session({token, session, user}: any){
            console.log("Mohd Ahmad")
            console.log(token);
            console.log(session);
            console.log(user);
            session.user.id = token.sub;
            session.user.token = token.authToken;
            return session;
        }
    }
}