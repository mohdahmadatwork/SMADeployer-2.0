const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const {S3Client,PutObjectCommand} = require("@aws-sdk/client-s3");
const AWS = require('aws-sdk');
const mime = require("mime-types");
const Redis = require('ioredis');
const s3Client = new S3Client({
    region: process.env.AWS_REGION ,
    Credential:{
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ,
    }
});
const publisher = new Redis(process.env.REDIS_SERVER);
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const PROJECT_ID = process.env.PROJECT_ID
async function init(){
    console.log("Executing script.js");
    publisLog('Build Started...');
    const outDirPath = path.join(__dirname,'output');
    console.log("outDirPath",outDirPath);
    const p = exec(`cd ${outDirPath} && npm install && npm run build`);
    p.stdout.on('data',function(data){
        console.log(data.toString());
    });
    p.stdout.on('Error',function(data){
        console.log("Error:",data.toString());
        publisLog(`Error: ${data.toString()}`);
    });
    p.on('close',async function(){
        console.log("build completed");
        const distFolderPath = path.join(__dirname,'output','dist');
        console.log("distFolderPath",distFolderPath);
        const distFolderContent = fs.readdirSync(distFolderPath,{recursive:true});
        publisLog('Starting to upload...');
        for (const file of distFolderContent) {
            const filePath = path.join(distFolderPath, file);
            console.log("filePath",filePath);
            if (fs.lstatSync(filePath).isDirectory()) continue;
            publisLog(`uploading ${file}`);
            const command = new PutObjectCommand({
              Bucket: 'smavercel',
              Key: `__outputs/${PROJECT_ID}/${file}`,
              Body: fs.createReadStream(filePath),
              ContentType: mime.lookup(filePath)
            })
            await s3Client.send(command)
            publisLog(`uploaded ${file}`);
            console.log('uploading ends', filePath)
        }
        publisLog("Done...");
    });
}
function publisLog(log){
  publisher.publish(`logs:${PROJECT_ID}`,JSON.stringify(log));
}
init(); 
  