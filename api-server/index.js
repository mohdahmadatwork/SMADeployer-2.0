const express = require('express');
const app = express();
const port = 9000;
const {ECSClient,RunTaskCommand} = require('@aws-sdk/client-ecs');
const Redis = require('ioredis');
const {Server, Socket} = require('socket.io');
app.use(express.json());
const subscriber = new Redis(process.env.REDIS_SERVER);
const io = new Server({cors:'*'});
const ecsClient = new ECSClient({
    region: process.env.AWS_REGION,
    credentials:{
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
})
const config = {
    CLUSTER: 'cluster arn',
    TASK:'task arn'
}
app.post('/project',async (req,res)=>{
    const {gitUrl} = req.body;
    const projectSlug = generate();
    const command = new RunTaskCommand({
        cluster:config.CLUSTER,
        taskDefinition:config.TASK,
        count:1,
        launchType:'FARGATE',
        networkConfiguration:{
            awsvpcConfiguration:{
                subnets:['subset-0ajsnjkvsjn','subset-kn77knc2d30s','subset-234knc2dsfds3'], // can get from the network tab inside the task when we run manually 
                securityGroups:['sg-hjbsdjv23b43js5df'], // can get from the same place
            }
        },
        overrides:{
            containerOverrides:[
                {
                    name:'builder-image',//image name
                    environment:[
                        {name:'PROJECT_ID',value:projectSlug},
                        {name:'GIT_REPOSITORY_URL',value:process.env.GIT_REPOSITORY_URL},
                        {name:'AWS_REGION',value:process.env.AWS_REGION},
                        {name:'AWS_ACCESS_KEY_ID',value:process.env.AWS_ACCESS_KEY_ID},
                        {name:'AWS_SECRET_ACCESS_KEY',value:process.env.AWS_SECRET_ACCESS_KEY},
                    ]
                }
            ]
        }
    })

    const response = await ecsClient.send(command);
    return res.status({status:'queued',data:{projectSlug,url:`http://${projectSlug}.localhost:${port}`}});
});
io.on('connection',socket=>{
    socket.on('subscribe',channel=>{
        socket.join(channel);
        socket.emit("message",`Joined ${channel}`)
    })
})
async function initRedisSubscribe(){
    console.log("Subscribed to logs...");
    subscriber.psubscribe('logs:*');
    subscriber.on('pmessage',(pattern,channel,message)=>{
        io.to(channel).emit('message',message);
    });
}
function generate(){
    let ans = "";
    const subset = "0123456789qwertyuiopasdfghjklzxcvbnm";
    for (let i = 0; i < PROCESS_ID_MAX_LENGTH; i++) {
        ans += subset[Math.floor(Math.random() * subset.length)];
    }
    return ans;
}
initRedisSubscribe();
app.listen(port,()=>{
    console.log("API server serving on port: ",port);
})
io.listen('9001',()=>{
    console.log("Socket io server running on port: 9001");
})