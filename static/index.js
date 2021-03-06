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
      x: [640, 750, 1242, 1125, 1536, 1668, 2048],
      y: [1136, 1334, 2208, 2436, 2048, 2224, 2732]
    },
    Android: {
      x: [800, 1280, 1920],
      y: [480, 720, 1080]
    }
  }
});

const $ = require('jquery');

const acceptedFileTypes = ['.jpg', '.jpeg', '.png'] // TODO: more?
var all_files = [] // all pictures submitted

var all_sizes_x = []
var all_sizes_y = []

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
    deleteAllSizes() // clear all sizes from screen for potential reload
    var presetBtns = $("#presets").find('.preset')
    deactivatePresets(presetBtns) // deactivate preset buttons for potential reload
    loadScene(scenes[2], scenes[1])
    resizeAllImages()
    showConfirmButton(false)
  });

  // s3 button bar
  $("#restart-btn").on('click', function(){
    restart()
  });
  $("#github-btn").on('click', function(){
    openLink("https://github.com/Lasyin/Batch-Resizer-App")
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
  shell.openExternal(href)
}

// SECTION Scene managment
function loadScene(newScene, previousScene){
  if(previousScene.length != ''){
    $("."+previousScene).addClass('hide')
  }
  if(newScene.length != ''){
    $("."+newScene).removeClass('hide')
    currScene = newScene
  }
}
function hideScenes(sceneArr){
  for(var i = 0; i < sceneArr.length; i++){
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
});
$('#drag').on("drop", function(event) {
  event.preventDefault()
  $('#drag-interior').hide()
  submittedFiles(event.originalEvent.dataTransfer.files)
});

function submittedFiles(files){
// TODO: check if file already in array before submitting? Or, allow duplicates?
  for(var i = 0; i < files.length; i++){
    var stats = fs.statSync(files[i].path)
    if(stats.isDirectory()){
      addDir(files[i].path)
    } else if(stats.isFile()){
      addFile(files[i].path)
    }
  }
}

function addFile(file){
  if(acceptedFileTypes.includes(path.extname(file).toLowerCase())){
    all_files.push(file)
    updateFileCount()
  } else {
    addNotification("Filetype not accepted, skipping and continuing: " + String(file), 5000, 'warning')
  }
}

function addDir(dir){
  var fullPath = dir
  fs.readdir(dir, (err, files) => {
    files.forEach(file => {
      var newPath = path.join(fullPath, file)
      var stats = fs.statSync(newPath)
      if(stats.isDirectory()){
        addDir(newPath)
      } else if(stats.isFile()) {
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
  });
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
    var newSize = $("#size-template").clone()
    newSize.removeClass('hide')
    newSize.removeAttr('id')

    var newx = newSize.find('.x-display').text(x+"px")
    var newy = newSize.find('.y-display').text(y+"px")

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
addPresetButtonEnabled(false) // No preset to add
removePresetButtonEnabled(false) // No preset to remove
loadInitialPresets()
function initPresetBtns(){
  var presetBtns = $("#presets").find('.preset').each(function(){
    $(this).on('click', function(){
      deactivatePresets(presetBtns)
      activatePreset(this)
    })
  });
  $("#add-preset").on('click', function(){
    showPresetInput(true)
    showConfirmButton(false)
  });
  $("#remove-preset").on('click', function(){
    removeActivePreset()
  });
}

function loadInitialPresets(){
  var presets = store.get('presets').name
  for(var i = 0; i < presets.length; i++){
    addPresetBtn(presets[i])
  }
}

function activatePreset(preset){
  $(preset).removeClass('btn-outline-light')
  $(preset).addClass('btn-light')

  var presetName = $(preset).text()
  var presetObj = store.get(presetName)
  if(presetObj != undefined){
    loadPreset(presetObj)
    removePresetButtonEnabled(true) // Preset to remove
  } else {
    addNotification("Preset not found.", 5000, "error")
  }
}
function deactivatePresets(presetBtns){
  $(presetBtns).each(function(){
    $(this).removeClass('btn-light')
    $(this).addClass('btn-outline-light')
  });
  removePresetButtonEnabled(false) // No preset to remove
}
function addPresetBtn(name){
  var template = $("#preset-template").clone()
  var lastTemplate = $("#add-preset")
  template.removeAttr('id')

  template.removeClass('hide')
  template.text(name)
  template.insertBefore(lastTemplate)

  initPresetBtns() // attach listeners to buttons
}
function savePreset(preset){
  var allPresets = store.get('presets')
  // add preset name to list of preset names

  if(allPresets.name.indexOf(preset) == -1){
    allPresets.name.push(preset)
    addPresetBtn(preset)
  }

  var x = []
  var y = []

  var sizes = $("#sizes").find('.size').not('#new-size')
  sizes.each(function(){
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
      addNewSize(preset.x[i], preset.y[i])
    }
  } else {
    addNotification("Preset corrupted, data missing.", 5000, "error")
  }
  addPresetButtonEnabled(false)
}
function removeActivePreset(){
  var presets = $("#presets").find('.preset').each(function(){
    if($(this).hasClass('btn-light') && !$(this).hasClass('btn-outline-light')){
      var activePreset = $(this)
      if(activePreset != undefined){
        if(store.remove(activePreset.text())){
          var allPresetNames = store.get('presets').name
          if(allPresetNames.indexOf(activePreset.text() > -1)){
            allPresetNames.splice(allPresetNames.indexOf(activePreset.text()), 1) // remove deleted preset name from names list

            var allPresets = store.get('presets')
            allPresets.name = allPresetNames
            store.set('presets', allPresets)
          }
          activePreset.remove()
          addNotification('Successfully removed preset', 2500, 'success')
        } else {
          addNotification('Could not remove preset.', 2500, 'warning')
        }
      } else {
        addNotification("No active preset, can't delete.", 2500, 'warning')
      }
    }
  });

}
function addPresetButtonEnabled(val){
  if(val==true){
    $("#add-preset").show()
  } else {
    $("#add-preset").hide()
  }
}
function removePresetButtonEnabled(val){
  if(val == true){
    $("#remove-preset").show()
  } else {
    $("#remove-preset").hide()
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
  if(name != undefined && name.replace(/ /g,'') != ''){
    savePreset($("#preset-name-input").val())
  } else {
    addNotification("Preset name can't be empty.", 2500, 'info')
  }
})

// SECTION bottom input - confirmation button
function showConfirmButton(val){
  if(val == true){
    $("#confirm-resize-container").removeClass('hide')
    var sizes = $("#sizes").find('.size').not('#new-size')
    var btnText = "Resize x Photos y Times"
    btnText = btnText.replace('y', sizes.length)
    btnText = btnText.replace('x', all_files.length)
    $("#confirm-resize-btn").text(btnText)
    $("#confirm-resize-total").text("Total: " + String(sizes.length * all_files.length) + " Photos")
  } else {
    $("#confirm-resize-container").addClass('hide')
  }
}

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
        var j = all_files.indexOf(imgPath)
        if(j != -1){
          var progress = ((j+1)/all_files.length)*100

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
