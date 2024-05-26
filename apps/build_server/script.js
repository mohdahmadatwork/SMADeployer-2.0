const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const {S3Client,PutObjectCommand} = require("@aws-sdk/client-s3");
const AWS = require('aws-sdk');
const mime = require("mime-types");
const { Kafka} = require('kafkajs');
const s3Client = new S3Client({
    region: process.env.AWS_REGION ,
    Credential:{
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ,
    }
});
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const SUB_DOMAIN = process.env.SUB_DOMAIN;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;
const kafka = new Kafka({
    clientId:`docker-build-server-${DEPLOYMENT_ID}`,
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
const producer = kafka.producer(); 
async function init(){
    await producer.connect();
    console.log("Executing script.js");
    await publisLog('Build Started...');
    const outDirPath = path.join(__dirname,'output');
    console.log("outDirPath",outDirPath);
    const p = exec(`cd ${outDirPath} && npm install && npm run build`);
    p.stdout.on('data',async function(data){
        console.log(data.toString());
        console.log(p.stdout.on);
        await publisLog(data.toString());
    });
    p.stderr.on('Error',async function(data){
        console.log("Error:",data.toString());
        await publisLog(`Error: ${data.toString()}`);
    });
    p.on('close',async function(){
        console.log("build completed");
        await publisLog(`build completed`);
        let distFolderPath = path.join(__dirname, 'output', 'dist');
        if (!fs.existsSync(distFolderPath)) {
            distFolderPath = path.join(__dirname, 'output', 'build');
            if (!fs.existsSync(distFolderPath)) {
                await publisLog('Error: Build is not in dist or build folder');
                process.exit(0);
            }
        }
        console.log("distFolderPath",distFolderPath);
        const distFolderContent = fs.readdirSync(distFolderPath,{recursive:true});
        await publisLog('Starting to upload...');
        for (const file of distFolderContent) {
            const filePath = path.join(distFolderPath, file);
            console.log("filePath",filePath);
            if (fs.lstatSync(filePath).isDirectory()) continue;
            await publisLog(`uploading ${file}`);
            const command = new PutObjectCommand({
              Bucket: 'smavercel',
              Key: `__outputs/${SUB_DOMAIN}/${file}`,
              Body: fs.createReadStream(filePath),
              ContentType: mime.lookup(filePath)
            })
            await s3Client.send(command)
            await publisLog(`uploaded ${file}`);
            console.log('uploading ends', filePath)
        }
        console.log("Done..................");
        await publisLog("Done...");
        process.exit(0);
    });
}
async function publisLog(log){
  await producer.send({topic:`container-logs`,messages:[{key:'log',value:JSON.stringify({SUB_DOMAIN,DEPLOYMENT_ID,log})}]})
}
init(); 
  