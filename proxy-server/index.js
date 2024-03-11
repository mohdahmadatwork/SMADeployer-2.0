const express = require('express');
const httpProxy = require('http-proxy');
const port = 8000;
const app = express();
const proxy = httpProxy.createProxy();
const BASE_PATH = `https://smavercel.s3.ap-south-1.amazon.com/_outputs`
app.use((req,res)=>{
    const hostname = req.hostname;
    const subDomain = hostname.split('.')[0];
    const resolveTO = `${BASE_PATH}/${subDomain}`
    return proxy.web(req,res,{target:resolveTO,changeOrigin:true});
});
proxy.on('proxyReq',(proxyReq,req,res)=>{
    const url = req.url;
    if (url==='/') {
        proxyReq.path += 'index.html';
    }
})
app.listen(port,()=>{
    console.log("Proxy server is running on port: ",port);
})