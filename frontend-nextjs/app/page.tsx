"use client";
import { getServerSession } from "next-auth";
import { redirect } from 'next/navigation'
import { authOptions } from "@/lib/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github } from "lucide-react";
import { Fira_Code } from "next/font/google";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";


const socket = io("http://localhost:9001");

const firaCode = Fira_Code({ subsets: ["latin"] });
export default function Page() {
  const {data:session,status} = useSession();
  const router = useRouter();
  console.log("session",session);
  setTimeout(() => {
    
    console.log("session inside",session);
  }, 10000);
  // if (session) {
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   redirect('api/signup');
    // }
    const [repoURL, setURL] = useState<string>("");
  
    const [logs, setLogs] = useState<string[]>([]);
  
    const [loading, setLoading] = useState(false);
  
    const [projectId, setProjectId] = useState<string | undefined>();
    const [deployPreviewURL, setDeployPreviewURL] = useState<
      string | undefined
    >();
  
    const logContainerRef = useRef<HTMLElement>(null);
  
    const isValidURL: [boolean, string | null] = useMemo(() => {
      if (!repoURL || repoURL.trim() === "") return [false, null];
      const regex = new RegExp(
        /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
      );
      return [regex.test(repoURL), "Enter valid Github Repository URL"];
    }, [repoURL]);
  
    const handleClickDeploy = useCallback(async () => {
      setLoading(true);
      let data:any = '';
      const token = session?.user?.token; // Assuming the token is stored here
  
      const headers = {
        Authorization: `Bearer ${token}`,
      };
      const resData = await axios.post(`http://localhost:9000/project`,{
        name: 'no name',
        gitUrl: repoURL,
      },{headers});
      data = resData.data;
      const { gitUrl, id } = data.data.project  ;
      let resData2:any = '';
      if (data && data.data) {
        setProjectId(id);
        resData2 = await axios.post(`http://localhost:9000/deploy`,{
          projectId:id
        },{headers});
      }
      data = resData2.data;
      console.log("resData2",resData2);
      console.log("data",data);
      if (data && data.data) {
        const {deploymentId} = data;
        const {projectId , url} = data.data;
        setDeployPreviewURL(url);
        console.log("url",url);
        console.log(`Subscribing to logs:${deploymentId}`);
        socket.emit("subscribe", {token:"",channel:`logs:${deploymentId}`});
      }
    }, [projectId, repoURL]);
  
    const handleSocketIncommingMessage = useCallback((message: string) => {
      console.log(`[Incomming Socket Message]:`, typeof message, message);
      // const { log } = JSON.parse(message);
      setLogs((prev) => [...prev, message]);
      logContainerRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);
  
    useEffect(() => {
      socket.on("message", handleSocketIncommingMessage);
  
      return () => {
        socket.off("message", handleSocketIncommingMessage);
      };
    }, [handleSocketIncommingMessage]);
    useEffect(() => {
      if (status === "unauthenticated") {
        router.push("/signup");
      }
    }, [status, router]);
  
    if (status === "loading") {
      return <div>Loading...</div>;
    }
  
    if (status === "authenticated") {
      return (
        <main className="flex justify-center items-center h-[100vh]">
          <div className="w-[600px]">
            <span className="flex justify-start items-center gap-2">
              <Github className="text-5xl" />
              <Input
                disabled={loading}
                value={repoURL}
                onChange={(e) => setURL(e.target.value)}
                type="url"
                placeholder="Github URL"
              />
            </span>
            <Button
              onClick={handleClickDeploy}
              disabled={!isValidURL[0] || loading}
              className="w-full mt-3"
            >
              {loading ? "In Progress" : "Deploy"}
            </Button>
            {deployPreviewURL && (
              <div className="mt-2 bg-slate-900 py-4 px-2 rounded-lg">
                <p>
                  Preview URL{" "}
                  <a
                    target="_blank"
                    className="text-sky-400 bg-sky-950 px-3 py-2 rounded-lg"
                    href={deployPreviewURL}
                  >
                    {deployPreviewURL}
                  </a>
                </p>
              </div>
            )}
            {logs.length > 0 && (
              <div
                className={`${firaCode.className} text-sm text-green-500 logs-container mt-5 border-green-500 border-2 rounded-lg p-4 h-[300px] overflow-y-auto`}
              >
                <pre className="flex flex-col gap-1">
                  {logs.map((log, i) => (
                    <code
                      ref={logs.length - 1 === i ? logContainerRef : undefined}
                      key={i}
                    >{`> ${log}`}</code>
                  ))}
                </pre>
              </div>
            )}
          </div>
        </main>
      );
    }
  // } else {
  //   redirect('/signup')
  // }
  
}