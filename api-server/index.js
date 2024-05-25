const express = require('express');
const http = require('http');
const app = express();
const port = 9000;
const {ECSClient,RunTaskCommand} = require('@aws-sdk/client-ecs');
const {createClient} = require('@clickhouse/client');
const {Server, Socket} = require('socket.io');
const { Kafka} = require('kafkajs');
const { v4: uuidv4} = require('uuid');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
app.use(express.json());
const client = new createClient({
    host:process.env.CLICK_HOUSE_URL,
    database:process.env.CLICK_HOUSE_DB,
    username:process.env.CLICK_HOUSE_USERNAME,
    password:process.env.CLICK_HOUSE_PASSWORD,
})
app.use(cors());

const httpApp = http.createServer(app);
const io = new Server(httpApp,{cors:'*',methods: ['GET', 'POST']});
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { table } = require('console');
const prisma = new PrismaClient({});
const kafka = new Kafka({
    clientId:`api-server`,
    brokers:[process.env.KAFKA_BROKER_URL],
    ssl:{
        ca:[process.env.KAFKA_CA_FILE_CONTENT]
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
    CLUSTER: process.env.ECS_CONTAINER_ARN,//'arn:aws:ecs:us-east-1:992382823091:cluster/build-server-cluster',
    TASK: process.env.ECS_CONTAINER_TASK_ARN,//'arn:aws:ecs:us-east-1:992382823091:task-definition/builder-task:8'
}
app.post('/project',async(req,res)=>{
    const schema = z.object({
        name:z.string(),
        gitUrl:z.string()
    });
    const safeParseResult = schema.safeParse(req.body);
    console.log(safeParseResult);
    if (safeParseResult.error) {
        return res.status(400).json({error:safeParseResult.error});
    }
    const {name,gitUrl} = safeParseResult.data;
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
    console.log("projectId ",projectId);
    try{

        const project = await prisma.project.findUnique({where:{id:projectId}});
        console.log("project",project.gitUrl);
        if(!project) return res.status(404).json({error:"Project not found"});
        const deployment = await prisma.deployment.create({
            data:{
                project:{connect:{id:projectId}},
                status:'QUEUED'
            }
        });
        const deploymentId = deployment.id;
        const projectSlug = generate();
        const command = new RunTaskCommand({
            cluster:config.CLUSTER,
            taskDefinition:config.TASK,
            count:1,
            launchType:'FARGATE',
            networkConfiguration:{
                awsvpcConfiguration:{
                    assignPublicIp: 'ENABLED',
                    subnets:[process.env.ECS_SUBNET_1,process.env.ECS_SUBNET_2,process.env.ECS_SUBNET_3], // can get from the network tab inside the task when we run manually 
                    securityGroups:[process.env.ECS_SECURITYGROUP_1], // can get from the same place
                }
            },
            "containerDefinitions": [
                {
                    "name": process.env.ECR_CONTAINER_NAME,//'builder-server'
                    "image": process.env.ECR_CONTAINER_IMAGE_URI,
                    "essential": true,
                    "portMappings": [
                        {
                            "containerPort": 80,
                            "hostPort": 80
                        },
                        {
                            "containerPort": 9092,
                            "hostPort": 9092
                        }
                    ]
                }
            ],
            overrides:{
                containerOverrides:[
                    {
                        name: process.env.ECR_CONTAINER_IMAGE_NAME,//'builder-image',image name
                        environment:[
                            {name:'PROJECT_ID',value:projectId},
                            {name:'DEPLOYMENT_ID',value:deployment.id},
                            {name:'GIT_REPOSITORY_URL',value:project.gitUrl},
                            {name:'AWS_REGION',value:process.env.AWS_REGION},
                            {name:'AWS_ACCESS_KEY_ID',value:process.env.AWS_ACCESS_KEY_ID},
                            {name:'AWS_SECRET_ACCESS_KEY',value:process.env.AWS_SECRET_ACCESS_KEY},
                            {name:'KAFKA_BROKER_USERNAME',value:process.env.KAFKA_BROKER_USERNAME},
                            {name:'KAFKA_BROKER_PASSWORD',value:process.env.KAFKA_BROKER_PASSWORD},
                            {name:'KAFKA_BROKER_MECHANISM',value:process.env.KAFKA_BROKER_MECHANISM},
                            {name:'KAFKA_BROKER_URL',value:process.env.KAFKA_BROKER_URL},
                            {name:'KAFKA_CA_FILE_CONTENT',value:process.env.KAFKA_CA_FILE_CONTENT},
                        ]
                    }
                ]
            }
        })
        console.log("Reached just before ecsClient.send(command);");
        const response = await ecsClient.send(command);
        console.log("Reached after ecsClient.send(command);");
        console.log(response);
        return res.json({status:'queued',data:{projectId,url:`http://${projectSlug}.localhost:${port}`},deploymentId});
    }catch (error) {
        console.error("Error in deploy endpoint:", error);
        return res.status(500).json({ error: "Failed to run task" });
    }
});
io.on('connection',socket=>{
    socket.on('subscribe',channel=>{
        socket.join(channel);
        socket.emit("message",`Joined ${channel}`)
    })
})

app.get('/logs/:id', async (req, res) => {
    const id = req.params.id;
    const logs = await client.query({
        query: `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
        query_params: {
            deployment_id: id
        },
        format: 'JSONEachRow'
    })

    const rawLogs = await logs.json()

    return res.json({ logs: rawLogs })
})

async function initiateKafkaConsumer(){
    await consumer.connect();
    await consumer.subscribe({topics:[process.env.KAFKA_TOPIC], fromBeginning: true });
    await consumer.run({
        autoCommit:false,
        eachBatch: async function({batch,heartbeat,commitOffsetsIfNecessary,resolveOffset}){
            const messages = batch.messages;
            console.log("Rec ",messages.length," messages");
            console.log("messages.length",messages);
            for (const message of messages){
                const stringMessage= message.value.toString();
                const {PROCESS_ID,DEPLOYMENT_ID,logs} = JSON.parse(stringMessage);
                console.log(logs);
                const {query_id} = await client.insert({
                    table:'log_events',
                    values: [{event_id: uuidv4(), deployment_id: DEPLOYMENT_ID,logs}]
                });
                const channel = 'logs:'+DEPLOYMENT_ID;
                io.to(channel).emit('message', stringMessage);
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
    for (let i = 0; i < process.env.PROCESS_ID_MAX_LENGTH; i++) {
        ans += subset[Math.floor(Math.random() * subset.length)];
    }
    return ans;
}

httpApp.listen(port,()=>{
    console.log("API server serving on port: ",port);
})
io.listen('9001',()=>{
    console.log("Socket io server running on port: 9001");
}).on('error', (err) => {
    console.error("Error starting Socket.IO server:", err);
});