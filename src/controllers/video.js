const path = require("node:path");
const fs = require("node:fs/promises");
const { createWriteStream } = require("node:fs");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const util = require("../../lib/util");
const DB = require("../DB");
const FF = require("../../lib/FF");
const { json } = require("node:stream/consumers");


// resize a video file (creates a new video file)
const resizeVideo = async (req, res, handleErr) => {
    const videoId = req.body.videoId;
    const width = Number(req.body.width);
    const height = Number(req.body.height);

    DB.update();
    const video = DB.videos.find((v) => v.videoId === videoId);

    // 1. Guard check for missing video
    if (!video) {
        return handleErr({ status: 404, message: "Video not found" });
    }

    // 2. Consistent relative disk paths
    const originalVideoPath = `./storage/${video.videoId}/original.${video.extension}`;
    const targetVideoPath = `./storage/${video.videoId}/${width}x${height}.${video.extension}`;

    try {
        // 3. Initialize resizes object if undefined
        video.resizes = video.resizes || {};
        video.resizes[`${width}x${height}`] = { processing: true };
        DB.save();

        await FF.resize(
            originalVideoPath,
            targetVideoPath,
            width,
            height
        );

        video.resizes[`${width}x${height}`].processing = false;
        DB.save();

        res.status(200).json({
            status: "success",
            message: "The video was resized successfully!"
        });
    } catch (e) {
        // Clean up object state and partial file on failure
        if (video?.resizes?.[`${width}x${height}`]) {
            delete video.resizes[`${width}x${height}`];
            DB.save();
        }

        await util.deleteFile(targetVideoPath);
        return handleErr(e);
    }
};

// return list of all videos that a logged in user has uploaded
const getVideos = (req, res, handleError) => {
    // const name = req.params.name; // Fixed: Standard object access

    // if (name) {
    //     return res.json({ message: `Your name is ${name}` });
    // } else {
    //     return handleError({ status: 400, message: "Please specify a name." });
    // }
    DB.update();

    const videos = DB.videos.filter((vid) => {
        return vid.userId === req.userId; 
    });

    res.status(200).json(videos)

};

const uploadVideo = async (req, res, handleError) => {
    const specificFileName = req.headers.filename;

    if (!specificFileName) {
        return handleError({ status: 400, message: "Missing 'filename' header." });
    }

    const extension = path.extname(specificFileName).substring(1).toLowerCase();
    const name = path.parse(specificFileName).name;
    const videoId = crypto.randomBytes(4).toString("hex");
    const storageDir = `./storage/${videoId}`;

    const FORMATS_SUPPORTED = ["mov", "mp4"];

    if(FORMATS_SUPPORTED.indexOf(extension) === -1) {
        return handleError({
            status: 400,
            message: "Only these formats are allowed: mov, mp4"
        })
    }

    try {
        await fs.mkdir(storageDir, { recursive: true });

        const fullPath = `${storageDir}/original.${extension}`;
        const thumbnailPath = `${storageDir}/thumbnail.jpg`;

        // Fixed: Use createWriteStream directly to avoid handle leaks
        const fileStream = createWriteStream(fullPath);
        await pipeline(req, fileStream);

        // Process media assets with FFmpeg/FFprobe
        await FF.makeThumbnail(fullPath, thumbnailPath);
        const dimensions = await FF.getDimensions(fullPath);
        
        // Save metadata to DB
        DB.update();
        DB.videos.unshift({
            id: DB.videos.length,
            videoId,
            name,
            extension,
            dimensions,
            userId: req.userId,
            extractedAudio: false,
            resizes: {}
        });
        DB.save();

        return res.status(201).json({ status: "success", message: "uploaded successfully" });

    } catch (e) {
        // Safely clean up partial storage folder on error
        try {
            await util.deleteFolder(storageDir);
        } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
        }

        if (e.code !== "ECONNRESET") {
            return handleError(e);
        }
    }
};

// Extract the audio for a video file (can only be done once per video)
const extractAudio = async (req, res, handleErr) => {

    const videoId = req.params.get("videoId");

    DB.update(); 
    const video = DB.videos.find((video) => video.videoId === videoId);

    if(video.extractedAudio) {
        return handleErr({
            status: 400,
            message: "The audio has already been extracted for this video."
        })
    }

    const originalVideoPath = `./storage/${videoId}/original.${video.extension}`;
    const targetAudioPath = `./storage/${videoId}/audio.aac`;
    try{
        
        await FF.extractAudio(originalVideoPath, targetAudioPath);

        video.extractedAudio = true;

        DB.save();

        res.status(200).json({
            status: "success",
            message: "The audio was extracted successfully"
        })
    } catch(e) {
        await util.deleteFile(targetAudioPath);
        return handleErr(e);
    }

}
// Return a video assets to client
const getVideoAssets = async (req, res, handleErr) => {
    console.log(req.params, " daniel")
    const videoId = req.params.get("videoId");

    const type  = req.params.get("type"); //thumbnail, original , audio, fileSize

    DB.update();
    const video = DB.videos.find((video) => video.videoId === videoId);

    if(!video){
        return handleErr({
            status: 404,
            message: "video not found",
        })
    }

    let file;
    let mimeType;
    let fileName; // final file name for the download including extension


    switch(type) {
        case "thumbnail":
            file = await fs.open(`./storage/${videoId}/thumbnail.jpg`, 'r');
            mimeType = "image/jpg"
            break;
            // audio
            case "audio":
                file = await fs.open(`./storage/${videoId}/audio.aac`, "r");
                mimeType =  "audio/aac";
                filename = `${video.name}-audio.aac`;
                break
            // resize
            case "resize": 
                const dimensions = req.params.get("dimensions");
                file = await fs.open(`./storage/${videoId}/${dimensions}.${video.extension}`, "r");
                mimeType = "video/mp4"; 
                filename = `${video.name}-${dimensions}.${video.extension}`;
                break;
            case "original":
            // original
                file = await fs.open(`./storage/${videoId}/original.${video.extension}`, "r");
                mimeType = "video/mp4";
                fileName = `${video.name}.${video.extension}`;
                break
            }

        try {
            // grab file size
            const stat = await file.stat();

            const fileStream = file.createReadStream();

            if (type !== "thumbnail") {
                // set a header to prompt for download
                res.setHeader("Content-Disposition", `attachment; filename =${fileName}`)
            }

            // set the content-type header based on the file type
            res.setHeader("Content-Type", mimeType);
            // set the content-length to the size of the file
            res.setHeader("Content-Length", stat.size);

            res.status(200);
            await pipeline(fileStream, res);

            file.close();
        } catch (e) {
            console.log(e);
        }
    }
const controller = {
    getVideos,
    uploadVideo,
    getVideoAssets,
    resizeVideo,
    extractAudio

};

module.exports = controller;