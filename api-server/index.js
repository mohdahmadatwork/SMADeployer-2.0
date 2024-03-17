const express = require('express');
const app = express();
const port = 9000;
const {ECSClient,RunTaskCommand} = require('@aws-sdk/client-ecs');
const {createClient} = require('@clickhouse/client');
const {Server, Socket} = require('socket.io');
const { Kafka} = require('kafkajs');
const { v4: uuidv4} = require('uuid');
const {fs} = require('fs');
const {path} = require('path');
app.use(express.json());
const client = new createClient({
    host:process.env.CLICK_HOUSE_URL,
    database:process.env.CLICK_HOUSE_DB,
    username:process.env.CLICK_HOUSE_USERNAME,
    password:process.env.CLICK_HOUSE_PASSWORD,
})
const io = new Server({cors:'*'});
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { table } = require('console');
const prisma = new PrismaClient({});
const kafka = new Kafka({
    clientId:`api-server`,
    brokers:[process.env.KAFKA_BROKER_URL],
    ssl:{
        ca:[fs.readFileSync(path.join(__dirname,'kafka.pem'),'utf-8')]
    },
    sasl:{
        username:process.env.KAFKA_BROKER_USERNAME,
        password:process.env.KAFKA_BROKER_PASSWORD,
        mechanism:process.env.KAFKA_BROKER_MECHANISM
    }
});
const consumer = kafka.consumer({groupId:`api-server-logs-consumer`});
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
app.post('/project',async(req,res)=>{
    const schema = z.object({
        name:z.string(),
        gitUrl:z.string()
    });
    const safeParseResult = schema.safeParse(req.body);
    if (safeParseResult.error) {
        return res.status(400).json({error:safeParseResult.error});
    }
    const project = await prisma.project.create({
        data:{
            name,
            gitUrl,
            subDomain:generate()
        }
    });
    return res.json({status:"success",data:{project}});
})
app.post('/deploy',async (req,res)=>{
    const {projectId} = req.body;
    const project = prisma.project.findUnique({where:{id:projectId}});
    if(!project) return res.status(404).json({error:"Project nopt found"});
    const deployment = await prisma.deployment.create({
        data:{
            project:{connect:{id:projectId}},
            status:'QUEUED'
        }
    });
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
                        {name:'PROJECT_ID',value:projectId},
                        {name:'GIT_REPOSITORY_URL',value:project.gitUrl},
                        {name:'AWS_REGION',value:process.env.AWS_REGION},
                        {name:'AWS_ACCESS_KEY_ID',value:process.env.AWS_ACCESS_KEY_ID},
                        {name:'AWS_SECRET_ACCESS_KEY',value:process.env.AWS_SECRET_ACCESS_KEY},
                    ]
                }
            ]
        }
    })

    const response = await ecsClient.send(command);
    return res.status({status:'queued',data:{projectId,url:`http://${projectSlug}.localhost:${port}`}});
});
io.on('connection',socket=>{
    socket.on('subscribe',channel=>{
        socket.join(channel);
        socket.emit("message",`Joined ${channel}`)
    })
})

async function initiateKafkaConsumer(){
    await consumer.connect();
    await consumer.subscribe({topic:['container-logs']});
    await consumer.run({
        autoCommit:false,
        eachBatch: async function({batch,heartbeat,commitOffsetsIfNecessary,resolveOffset}){
            const messages = batch.messages;
            console.log("Rec ",messages.length," messages");
            for (const message of messages){
                const stringMessage= message.value.toString();
                const {PROCESS_ID,DEPLOYMENT_ID,logs} = JSON.parse(stringMessage);
                const {query_id} = await client.insert({
                    table:'log_events',
                    values: [{event_id: uuidv4(), deployment_id: DEPLOYMENT_ID,logs}]
                });
                resolveOffset(message.offset)
                await commitOffsetsIfNecessary(message.offset)
                await heartbeat()
            }
        }
    })
}
initiateKafkaConsumer();
function generate(){
    let ans = "";
    const subset = "0123456789qwertyuiopasdfghjklzxcvbnm";
    for (let i = 0; i < PROCESS_ID_MAX_LENGTH; i++) {
        ans += subset[Math.floor(Math.random() * subset.length)];
    }
    return ans;
}

app.listen(port,()=>{
    console.log("API server serving on port: ",port);
})
io.listen('9001',()=>{
    console.log("Socket io server running on port: 9001");
})