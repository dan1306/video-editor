const DB = require("../src/DB");
const FF = require("./FF");
const util = require("./util");

class JobQueue {
    constructor() {
        this.jobs = [];
        this.currentJob = null;

        DB.videos.forEach((video) => {
            // 1. Guard against undefined/null resizes object
            if (!video.resizes) return;

            // 2. Iterate through resolution keys (e.g., "640x360")
            for (const resKey of Object.keys(video.resizes)) {
                const resizeJob = video.resizes[resKey];

                // 3. Check the .processing property
                if (resizeJob && resizeJob.processing === true) {
            
                    // 4. Parse width and height from "640x360"
                    const [width, height] = resKey.split("x").map(Number);

                    this.enqueue({
                        type: "resize",
                        videoId: video.videoId,
                        width,
                        height,
                        video
                 });
               }
            }
        });
    }

    enqueue(jobs) {
        this.jobs.push(jobs);
        this.executeNxt();
    }

    dequeue() {
        return this.jobs.shift();
    }

    executeNxt() {
        if(this.currentJob) return;
        this.currentJob = this.dequeue();
        if(!this.currentJob) return;
        this.execute(this.currentJob);
    }

    async execute({ 
        type,
        videoId,
        width,
        height,
        video}) 
    {    if(type === 'resize'){
            // 2. Consistent relative disk paths
            
            console.log(video);
            const originalVideoPath = `./storage/${video.videoId}/original.${video.extension}`;
            const targetVideoPath = `./storage/${video.videoId}/${width}x${height}.${video.extension}`;
            
            try {
                await FF.resize(
                    originalVideoPath,
                    targetVideoPath,
                    width,
                    height
                );
                DB.update();
                const video = DB.videos.find((v) => v.videoId === videoId);
                video.resizes[`${width}x${height}`].processing = false;
                DB.save();
                console.log(`Done resizing! # Of jobs remaining: ${this.jobs.length}`);
            } catch(e) {
               
                // Clean up object state and partial file on failure
                if (video?.resizes?.[`${width}x${height}`]) {
                    delete video.resizes[`${width}x${height}`];
                    DB.save();
                }

                util.deleteFile(targetVideoPath);
                // return handleErr(e);
            }
            this.currentJob = null;
            this.executeNxt();
        }        
    }
}


module.exports = JobQueue;