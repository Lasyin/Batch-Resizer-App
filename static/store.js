const electron = require('electron')
const path = require('path')
const fs = require('fs')

class Store {
  constructor(ops){
    const userDataPath = (electron.app || electron.remote.app).getPath('userData')
    this.path = path.join(userDataPath, ops.configName + ".json")

    this.data = parseDataFile(this.path, ops.defaults)
  }
  get(key) {
    return(this.data[key])
  }
  set(key, val) {
    this.data[key] = val
    fs.writeFileSync(this.path, JSON.stringify(this.data))
  }
  remove(key) {
    if(delete this.data[key]){
      fs.writeFileSync(this.path, JSON.stringify(this.data))
      return true
    } else {
      return false
    }
  }
}

function parseDataFile(filePath, defaults) {
  try {
    return JSON.parse(fs.readFileSync(filePath))
  } catch(error) {
    return defaults
  }
}

module.exports = Store;
