import { SignupSchema } from "../../../lib/signupZodSchema";
import prisma from "../../../db/prismaclient";
import { hash } from "bcrypt";
import { NextRequest, NextResponse } from "next/server";


export const POST = async (req:NextRequest) => {
    // try {
        const resp =await  req.json();
        const isValidated = SignupSchema.safeParse(resp);
        if(!isValidated.success){
            return NextResponse.json({status:400, data:isValidated});
        }
        const existingUser = await prisma.user.findUnique({
            where:{email:resp.email}
        });
        if (existingUser) {
            return NextResponse.json({status:400, data:{success:false,error:{issues:[{"path":["email"],"message":"email already exist"}]}}});
        }
        const saltRound = process.env.SALT_ROUND??10;
        const passwordHash = await hash(resp.password,10);
        const user = await prisma.user.create({
            data:{
                firstName:resp.firstname,
                lastName:resp.lastname,
                email:resp.email,
                password: passwordHash
            }
        });
        return NextResponse.json({status:200,data:{success:true,message:"Signup successfull!"}});
        
    // } catch (error) {
    //     return NextResponse.json({status:500,data:{success:false,message:"Something went wrong!"}});
    // }
}