const cluster = require("node:cluster");
const jobQueue = require("../lib/JobQueue.js");
const { sign } = require("node:crypto");

if(cluster.isPrimary){
    const jobs = new jobQueue();



    const coreCount = require("node:os").availableParallelism();
    for(let i = 0; i < coreCount; i++){
        cluster.fork(); 
    }
    cluster.on("message", (worker, message) => {
        if(message.messageType === "new-resize") {
            const {videoId, height, width, video} = message.data;
            jobs.enqueue({
                type: "resize",
                videoId,
                width,
                height,
                video
            })
        }
    })

    cluster.on("exit", (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died (${signal} | ${code}). Restarting...`);
        cluster.fork();
    })
} else {
    require("./index.js");
}