"use strict"

const fsp = require("fs").promises
const config = require("./config")

// Removes only the generated build output (dist/). Source files are untouched.
async function clean() {
  await fsp.rm(config.dist.root, { recursive: true, force: true })
}

module.exports = { clean }
