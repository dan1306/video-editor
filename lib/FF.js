const {spawn} = require("node:child_process");
// const { resolve } = require("node:dns");


const makeThumbnail = (fullPath, thumbnailPath) => {
    return new Promise((resolve, reject) => {
        // 1. Spawn process
        const ffmpeg = spawn("ffmpeg", [
            "-i", // Note: -i for input file!
            fullPath,
            "-ss",
            "5",
            "-vframes",
            "1",
            thumbnailPath
        ]);

        // 2. Attach listeners INSIDE the Promise block
        ffmpeg.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(`ffmpeg exited with this code ${code}`);
            }
        });

        ffmpeg.on("error", (err) => {
            reject(err);
        });
    }); // <-- Close the Promise block HERE
};

const getDimensions = (fullPath) => {
    // ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 video.mp4 
    return new Promise((resolve, reject) => {
        const ffprobe = spawn("ffprobe", [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
            fullPath
        ]);

        let dimensions = "";
        // console.log(dimensions)
        ffprobe.stdout.on("data", (data) => {
            dimensions += data.toString("utf8");
        })

        ffprobe.on("close", (code) => {
            if(code === 0) {
                dimensions = dimensions.replace(/\s/g,"").split(",");
                // console.log('dan');
                resolve({
                    width: Number(dimensions[0]),
                    length: Number(dimensions[1])
                });
            } else {
                reject(`FFprobe exited with this code: ${code}`);
            }
        })

        ffprobe.on("error", (err) => {
            reject(err);
        })
       
    })

}

module.exports = {makeThumbnail, getDimensions};