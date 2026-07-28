// const { rejects } = require("node:assert");
const {spawn} = require("node:child_process");
// const { error } = require("node:console");
// const { resolve } = require("node:dns");
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

const extractAudio = (originalVideoPath, targetAudioPath) => {
    return new Promise((resolve, reject) => {
        const ffmpeg =  spawn("ffmpeg", [
           "-i", originalVideoPath,
            "-vn",           // Disable video recording
            "-c:a", "copy",  // Copy audio codec without re-encoding
            "-y",            // Overwrite destination file if it exists
            targetAudioPath
        ])
        
        ffmpeg.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(`FFmpeg exited with this code: ${code}`);
            }
        })

        ffmpeg.on("error", (error) => {
            reject(error);
        })
    })
}

const resize = (originalVideoPath, targetVideoPath, width, height) => {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
            "-i", originalVideoPath,
            "-vf", `scale=${width}:${height}`, // Use width:height format
            "-c:a", "copy",                     // Copy audio without re-encoding
            "-y",                               // Overwrite existing output
            targetVideoPath                     // Correct output path variable
        ]);

        ffmpeg.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(`FFmpeg exited with code: ${code}`);
            }
        });

        ffmpeg.on("error", (error) => {
            reject(error);
        });
    });
};
module.exports = {makeThumbnail, getDimensions, extractAudio, resize};