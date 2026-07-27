const util = {};
const fs = require("node:fs/promises");

// delete a file if exists, if not the function will not throw an err
util.deleteFile = async (path) => {
    try {
        await fs.unlink(path);
    } catch(e) {

    }
}

// delete a folder if exist if not will not throw err
util.deleteFolder = async (path) => {
    try {
        await fs.rm(path, {recursive: true});
    } catch (e) {

    }
}

module.exports = util;