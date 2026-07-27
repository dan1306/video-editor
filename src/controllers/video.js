const path = require("node:path");
const fs = require("node:fs/promises");
const { createWriteStream } = require("node:fs");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const util = require("../../lib/util");
const DB = require("../DB");
const FF = require("../../lib/FF");

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
        console.log(
        {
            id: DB.videos.length,
            videoId,
            name,
            extension,
            dimensions,
            userId: req.userId,
            extractedAudio: false,
            resizes: {}
        }
        )
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

const controller = {
    getVideos,
    uploadVideo
};

module.exports = controller;