const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const {ipcRenderer} = require('electron')
const electron = require('electron')
const {shell} = require('electron')

const Store = require('./store.js') // for storing/retrieving json data
const store = new Store({
  configName: 'presets',
  defaults: {
    presets: {
      name: ['iOS', 'Android']
    },
    iOS: {
      x: [272, 640, 750, 1242, 1125, 1536, 1668, 2048],
      y: [340, 1136, 1334, 2208, 2436, 2048, 2224, 2732]
    },
    Android: {
      x: [5, 6],
      y: [7, 8]
    }
  }
});

const $ = require('jquery');

const acceptedFileTypes = ['.jpg', '.jpeg', '.png'] // TODO: more?
var all_files = [] // all pictures submitted

var all_sizes_x = []
var all_sizes_y = [] // TODO: consolodate to 1 array?

const scenes = ['s1', 's2', 's3']
var currScene = ''
var finished = false

// disable pinch to zoom
var webFrame = require('electron').webFrame
webFrame.setVisualZoomLevelLimits(1,1);
webFrame.setLayoutZoomLevelLimits(0,0);

window.eval = global.eval = function(){
  throw new Error('Eval not supported')
}
$(function() {
  console.log('ready')
  hideScenes(scenes)
  loadScene(scenes[0], '')

  attachListeners()
});

// SECTION init
function attachListeners(){
  $("#s1-text-xbtn").on('click', function(){
    all_files = []
    updateFileCount()
  });
  $("#s1-text-btn").on('click', function(){
    loadScene(scenes[1], scenes[0]) // load scene 2 (from previous scene 1)
  });

  $("#confirm-resize-btn").on('click', function(){
    saveAllSizes()
    loadScene(scenes[2], scenes[1])
    resizeAllImages()
    showConfirmButton(false)
  });

  // s3 button bar
  $("#restart-btn").on('click', function(){
    restart()
  });
  $("#github-btn").on('click', function(){
    openLink("https://github.com/Lasyin/...")
  });
  $("#info-btn").on('click', function(){
    openLink("https://codebryan.com/projects/batch-resizer-app")
  });
}

function restart(){
  finished = false
  all_files = [] // reset files array
  all_sizes_x = []
  all_sizes_y = []
  updateFileCount()
  loadScene(scenes[0], scenes[2])
}

// SECTION misc
function openLink(href){
  shell.openExternal(href) // TODO is this ok?
}

// SECTION Scene managment
function loadScene(newScene, previousScene){
  if(previousScene.length != ''){
    //$("."+previousScene).hide()
    $("."+previousScene).addClass('hide')
  }
  if(newScene.length != ''){
    //$("."+newScene).show()
    $("."+newScene).removeClass('hide')
    currScene = newScene
  }
}
function hideScenes(sceneArr){
  for(var i = 0; i < sceneArr.length; i++){
    //$("."+sceneArr[i]).hide()
    $("."+sceneArr[i]).addClass('hide')
  }
}

// SECTION File drag and drop
$('#drag').on("dragenter", function(event) {
  event.preventDefault()
});
$('#drag').on("dragover", function(event) {
  event.preventDefault()
  $('#symbol').find(".s1").css('color', 'white')
  $("#bg").css('background-color', "#303030")
});
$('#drag').on("mouseleave", function(event){
  $('#symbol').find(".s1").css('color', '#191C1F')
  $("#bg").css('background-color', "black")
  //$('#drag-interior').hide()
})
$('#drag').on("drop", function(event) {
  event.preventDefault()
  $('#drag-interior').hide()
  console.log('drop')
  //console.log(event.originalEvent.dataTransfer.files[0].path)
  submittedFiles(event.originalEvent.dataTransfer.files)
  //ipcRenderer.send('ondragstart', event.dataTransfer.files[0].path)
});

function submittedFiles(files){
//  all_files = [] // reset all_file global array
// TODO: check if file already in array before submitting? Or, allow duplicates?
  for(var i = 0; i < files.length; i++){
    var stats = fs.statSync(files[i].path)
    if(stats.isDirectory()){
      addDir(files[i].path)
    } else if(stats.isFile()){
      addFile(files[i].path)
    }
    //console.log('file: ' + files[i].path)
  /*  if(acceptedFileTypes.includes(path.extname(files[i].path))){
      console.log("Adding: " + path.extname(files[i].path))

    } else {
      // TODO: Check if folder was provided, go through contents in that case
      if(fs.statSync(files[i].path).isDirectory()){
        console.log("Directory found: " + files[i].path)
        addDir(files[i].path)

      } else {
        console.log("Not accepted: " + path.extname(files[i].path))
      }
    } */
  }
  console.log("All files added: " + all_files.length + " " + all_files)
}

function addFile(file){
//  console.log("Trying to add file: " + file)
  if(acceptedFileTypes.includes(path.extname(file).toLowerCase())){
    console.log("Adding: " + file)
    all_files.push(file)
    updateFileCount()
  } else {
//    console.log("Filetype not accepted: " + file)
    addNotification("Filetype not accepted, skipping and continuing: " + String(file), 5000, 'warning')
  }
}

function addDir(dir){
  var fullPath = dir
//  console.log("add dir: " + dir)
  fs.readdir(dir, (err, files) => {
    files.forEach(file => {
  //    console.log("file " + file)
      var newPath = path.join(fullPath, file)
  //    console.log("full path " + newPath)
      var stats = fs.statSync(newPath)
      if(stats.isDirectory()){
        // recursive dir
        // TODO: Limit nested dirs ?
    //    console.log("is dir")
        addDir(newPath)
      } else if(stats.isFile()) {
  //      console.log("is file")
        addFile(newPath)
      }
    });
  })
}

function updateFileCount(){
  var count = all_files.length
  if(count > 1){
    $("#s1-text-display").text(count + " Images added")
  } else if(count > 0) {
    $("#s1-text-display").text(count + " Image added")
  } else {
    $("#s1-text-display").text("Drop Images")
    $("#s1-text-xbtn").addClass('hide')
    $("#s1-text-btn").addClass('hide')
  }
  if(count > 0){
    $("#s1-text-xbtn").removeClass('hide')
    $("#s1-text-btn").removeClass('hide')
  }
}

// Misc. delete text in editable spans when clicked on
$("#newx").on('focus', function(){
  $("#newx").text('')
})
$("#newy").on('focus', function(){
  $("#newy").text('')
})

// SECTION Size window
// new size button pressed
initSizes()
$("#new-size-btn").on('click', function(){
  addNewSize($("#newx").text(), $("#newy").text())
  $("#newx").text('x')
  $("#newy").text('y')
})
function initSizes(){
  $(".size-xbtn").on('click', function(){
    removeSize(this)
  })
}
function removeSize(size){
  if($(size).parent().hasClass('size')){
    $(size).parent().remove()
    addPresetButtonEnabled(true)
  }
  if($("#sizes").find('.size').not('#new-size-btn').length == 0){
    showConfirmButton(false)
  }
}
// add a new size to the window
function addNewSize(x, y){
  x = parseInt(x)
  y = parseInt(y)

  if(isNaN(x) || isNaN(y)){
    if(isNaN(x)){
      addNotification("Width must be a number!", 5000, 'error')
    }
    if(isNaN(y)){
      addNotification("Height must be a number!", 5000, 'error')
    }
  } else {
    var container = $("#sizes")
    //var newSize = $(container.find(".size")[0]).clone()
  /*  var newSizeContainer = $('<div/>', {
      class: "size"
    })
    var newSizeSpan = $('<span/>') */
    var newSize = $("#size-template").clone()
    newSize.removeClass('hide')
    newSize.removeAttr('id')

    var newx = newSize.find('.x-display').text(x+"px")
    var newy = newSize.find('.y-display').text(y+"px")
    //console.log(newx)
    $(newSize).prependTo(container)
    initSizes()
    addPresetButtonEnabled(true)
    showConfirmButton(true)
  }
}
// delete all sizes in window, called when a preset button is hit
function deleteAllSizes(){
  var container = $("#sizes")
  $(container.find(".size")).each(function(){
    if(this.id != 'new-size'){
      $(this).remove()
    }
  })
  showConfirmButton(false)
}
function saveAllSizes(){
  all_sizes_x = [] // reset both x and y arrays
  all_sizes_y = []

  var sizes = $("#sizes").find('.size').not('#new-size')
  sizes.each(function(){
    var currX = $(this).find('.x-display').text().replace('px','')
    var currY = $(this).find('.y-display').text().replace('px','')
    if(currX != NaN && currY != NaN){
      all_sizes_x.push(currX)
      all_sizes_y.push(currY)
    } else {
      addNotification("Non-Number found in sizes. Can't continue.", 5000, 'error')
    }
  })
  if(all_sizes_x.length === all_sizes_y.length){
    // continue
    return
  } else {
    addNotification("Number of widths and number of heights not equal, can not continue.", 5000, 'error')
  }
}

// SECTION presets
addPresetButtonEnabled(false)
loadInitialPresets()
function initPresetBtns(){
  var presetBtns = $("#presets").find('.preset').each(function(){
    $(this).on('click', function(){
      deactivatePresets(presetBtns)
      activatePreset(this)
    })
  })
  $("#add-preset").on('click', function(){
    //console.log("add preset")
    showPresetInput(true)
    showConfirmButton(false)
  })
}

function loadInitialPresets(){
  var presets = store.get('presets').name
  console.log(presets)
  for(var i = 0; i < presets.length; i++){
    addPresetBtn(presets[i])
  }
}

function activatePreset(preset){
  // TODO: Check if preset already active? Maybe not necessary...
  $(preset).removeClass('btn-outline-light')
  $(preset).addClass('btn-light')
  //console.log($(preset).text() + " preset clicked")
  var presetName = $(preset).text()
  var presetObj = store.get(presetName)
  if(presetObj != undefined){
    loadPreset(presetObj)
  } else {
    addNotification("Preset not found.", 5000, "error")
    // TODO: should maybe delete the preset button if preset was not found?
  }
}
function deactivatePresets(presetBtns){
  $(presetBtns).each(function(){
    $(this).removeClass('btn-light')
    $(this).addClass('btn-outline-light')
  })
}
function addPresetBtn(name){
  var template = $("#preset-template").clone()
  var lastTemplate = $("#add-preset")
  template.removeAttr('id')
  // TODO: remove id's from other templates in this file
  template.removeClass('hide')
  template.text(name)
  template.insertBefore(lastTemplate)
  // TODO: save templates in store
  initPresetBtns() // attach listeners to buttons
}
function savePreset(preset){
  console.log("saving... " + preset)
  var allPresets = store.get('presets')
  console.log(allPresets)
  // add preset name to list of preset names
  // TODO: ask for confirmation if preset already exists?
  if(allPresets.name.indexOf(preset) == -1){
    console.log("DOESNT EXIST YET, ADD")
    allPresets.name.push(preset)
    addPresetBtn(preset)
  }

  var x = []
  var y = []

  var sizes = $("#sizes").find('.size').not('#new-size')
  console.log(sizes.length)
  sizes.each(function(){
    console.log("SIZES:")
    var currX = $(this).find('.x-display').text().replace('px','')
    var currY = $(this).find('.y-display').text().replace('px','')
    if(currX != NaN && currY != NaN){
      x.push(currX)
      y.push(currY)
    } else {
      addNotification("Non-Number found in sizes. Can't save.", 5000, 'error')
    }
  })
  if(x.length === y.length){
    // save preset into json file with widths and heights
    store.set(preset, {x, y})

    console.log(allPresets)
    store.set('presets', allPresets)
  } else {
    addNotification("Number of widths and number of heights not equal, can not save.", 5000, 'error')
  }

  showPresetInput(false)
  addPresetButtonEnabled(false)
}
function loadPreset(preset){
  // preset is an obj from JSON file
  if(preset.x.length === preset.y.length){
    deleteAllSizes()
    for(var i = 0; i < preset.x.length; i++){
      //console.log(preset.x[i])
      addNewSize(preset.x[i], preset.y[i])
    }
  } else {
    addNotification("Preset corrupted, data missing.", 5000, "error")
    // TODO: Delete preset button since preset isn't valid?
  }
  addPresetButtonEnabled(false)
}
function deletePreset(preset){
  // TODO: Allow to delete presets
}
function addPresetButtonEnabled(val){
  if(val==true){
    $("#add-preset").show()
  } else {
    $("#add-preset").hide()
  }
}
// SECTION bottom input - preset input
function showPresetInput(val){
  if(val==true){
    $("#preset-name-input").parent().removeClass('hide')
  } else{
    $("#preset-name-input").parent().addClass('hide')
  }
}
$("#preset-name-btn").on('click', function(){
  var name = $("#preset-name-input").val()
  //console.log(name)
  if(name != undefined && name.replace(/ /g,'') != ''){
    savePreset($("#preset-name-input").val())
    // TODO: remove unnecessary whitespace from preset names like '       preset    1    ' should equal 'preset 1'
  } else {
    addNotification("Preset name can't be empty.", 2500, 'info')
  }
})

// SECTION bottom input - confirmation button
function showConfirmButton(val){
  // TODO: update the button text when photos are dropped during scene 2 (or, disable drag and drop in scene 2)
  if(val == true){
    $("#confirm-resize-container").removeClass('hide')
    var sizes = $("#sizes").find('.size').not('#new-size')
    var btnText = "Resize x Photos y Times"
    btnText = btnText.replace('y', sizes.length)
    btnText = btnText.replace('x', all_files.length)
    console.log(btnText)
    $("#confirm-resize-btn").text(btnText)
    $("#confirm-resize-total").text("Total: " + String(sizes.length * all_files.length) + " Photos")
  } else {
    $("#confirm-resize-container").addClass('hide')
  }
}


/*$("#ios-preset").on('click', function(){
  var btn = $("#ios-preset")
  btn.removeClass('btn-outline-light')
  btn.addClass('btn-light')
}) */

// SECTION s3
// resizing
function resizeAllImages(){
  // TODO: create a subfolder for each image for its sizes
  //var folderPath = app.getPath('downloads')
  var folderPath = (electron.app || electron.remote.app).getPath('downloads')
  var folderName = 'BatchResizeImages' + (new Date())
  if(!fs.existsSync(path.join(folderPath, folderName))){
    fs.mkdirSync(path.join(folderPath, folderName))
    folderPath = path.join(folderPath, folderName)
  } // TODO: Any chance of this failing?

  for(var i = 0; i < all_files.length; i++){
    console.log("resizing: " + all_files[i])
    resizeImage(all_files[i], folderPath)
  }
}
function resizeImage(imgPath, folderPath){
  for(var i = 0; i < all_sizes_x.length; i++){
    var new_x = all_sizes_x[i]
    var new_y = all_sizes_y[i]
    var fileType = path.extname(imgPath)
    var imgName = path.basename(imgPath, path.extname(imgPath)) // get old image name
    var fileName = imgName + "_" + String(new_x)+"x"+String(new_y) + fileType

    showProgressBar(true)
    updateProgressBar(0)

    sharp(imgPath).resize(parseInt(new_x), parseInt(new_y)).ignoreAspectRatio().toFile(path.join(folderPath, fileName), function(err){
      if(err){
        console.log(err)
      } else {
        console.log("successfully saved! ")
        var j = all_files.indexOf(imgPath)
        if(j != -1){
          var progress = ((j+1)/all_files.length)*100
          console.log(progress)
          updateProgressBar(progress)
          if(progress < 100){
            if(!finished) {
              showProgressBar(true)
            }
          } else {
            // all done !
            // TODO: this is firing before completley done
            if(!$("#resize-progress-bar-outside").hasClass('hide')){
              shell.openItem(folderPath)
              showProgressBar(false)
              $("#s3-button-bar-container").removeClass('hide')
              finished = true
              addNotification('Resized ' + i + ' Photos!', 5000, 'success')
            }
          }
        }
      }
    });
  }
}
function showProgressBar(val){
  if(val) {
    $("#resize-progress-bar-outside").removeClass('hide')
  } else {
    $("#resize-progress-bar-outside").addClass('hide')
  }
}
// progress bar
function updateProgressBar(amnt){
  $("#resize-progress-bar").css("width", String(amnt)+"%")
  console.log(amnt)
}

// SECTION notifications
function addNotification(contents, timeout, type){
  var container = $("#notifications")
  var classes = ''
  switch(type) {
    case 'error':
      classes = "alert alert-danger"
      break
    case 'warning':
      classes = "alert alert-warning"
      break
    case 'info':
      classes = "alert alert-light"
      break
    case 'success':
      classes = "alert alert-success"
      break
    default:
      classes = "alert alert-light"
  }
  $('<div/>', {
    class: classes,
    text: contents
  }).prependTo(container).fadeOut(timeout, function(){
    $(this).remove()
  })
}
