var player;
var player1;
var player2;

window.onload = () => {
  'use strict';

  player = document.getElementById('audio');
  player.loop = false;
  player.load();

  player1 = document.getElementById('audio1');
  player1.load();

  player2 = document.getElementById('audio2');
  player2.load();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js');
  }
  camStart();
}


// Override the function with all the posibilities
navigator.getUserMedia ||
    (navigator.getUserMedia = navigator.mozGetUserMedia ||
        navigator.webkitGetUserMedia || navigator.msGetUserMedia);
window.AudioContext = window.AudioContext || window.webkitAudioContext;
var recIndex = 0;

var audioContext;
var audioInput = null,
    realAudioInput = null,
    inputPoint = null;
var rafID = null;
var smoothMax = 0;
var scaleMax = 0;
var XBoxVolume = 0.;
var gl;
var canvas;
var Param1 = 1.0; // volume
var Param2 = .0; // frication
var Param3 = 1.0;
var Param4 = 1.0;
var Sound1 = 1.0;
var Sound2 = 1.0;
var Sound3 = 1.0;
var Sound4 = 1.0;
var mouseX = 0.5;
var mouseY = 0.5;
var keyState1 = 0;
var keyState2 = 0;
var keyState3 = 0;
var keyState4 = 0;
var keyStatel = 0;
var keyStater = 0;
var firstTime = false;
var fricative = false;
var settings;
var panel;
var panelvisible = false;
var progress;
var vol1;
var vol2;
var inMenu = true;
var menuItem = 0;

function convertToMono(input) {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);

    input.connect(splitter);
    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 0, 1);
    return merger;
}

function cancelAnalyserUpdates() {
    window.cancelAnimationFrame(rafID);
    rafID = null;
}

var volumeList = [];
var count = 0;

function updateAnalysers(time) {
    var gotNoise = false;
    var noiseCount = 0;
    count++;

    var max = 0;
    var rX = 0;
    var rY = 0;
    var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

    // first get volume into max;
    var previous = 0;
    var changeCount = 0;
    analyserNode.getByteTimeDomainData(freqByteData);
    for (var i = 0; i < freqByteData.length / 2; ++i) {
        if (freqByteData[i] > max)
            max = freqByteData[i];
        if (freqByteData[i] < 127 && previous > 127)
            changeCount++;
        previous = freqByteData[i];
        // calculate if got noise here
    }
    if (changeCount > 6) { // randomise position for fricative
        if (count > 2)
            count = 1;
        fricative = true;
        Param2 = 1.;
    } else {
        fricative = false;
        Param2 = 0.;
    }
    max = max - 127;
    //  if (vol1.value < 50)
    //    vol2.value++;
    //  else
    //    vol1.value--;
    smoothMax = (max + 7 * smoothMax) / 8;
    //    var vol1 = 0;
    //    var vol2 = 100;
    scaleMax = Math.max((max - Math.min(vol1.value, vol2.value)) * 100 / Math.abs(vol2.value - vol1.value), 1);
    if (scaleMax > 100)
        scaleMax = 100;
    progress.value = smoothMax;
    smoothMax = (scaleMax + 7 * smoothMax) / 8;
    Param1 = Math.max(XBoxVolume, smoothMax / 100.);
    //console.log(max.toString());
    rafID = window.requestAnimationFrame(updateAnalysers);
}


function gotStream(stream) {

    inputPoint = audioContext.createGain();

    // Create an AudioNode from the stream.
    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);

    //    audioInput = convertToMono( input );

    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 1024; //2048;
    inputPoint.connect(analyserNode);

    //    audioRecorder = new Recorder( inputPoint );

    //    zeroGain = audioContext.createGain();
    //    zeroGain.gain.value = 0.0;
    //    inputPoint.connect( zeroGain );
    //    zeroGain.connect( audioContext.destination );
    updateAnalysers();
}

function initAudio() {
    if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!navigator.cancelAnimationFrame)
        navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
    if (!navigator.requestAnimationFrame)
        navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

    navigator.getUserMedia({
        audio: true
    }, gotStream, function (e) {
        alert('Error getting audio');
        console.log(e);
    });
}

function startAudio() {
    if (audioContext == null) {
        audioContext = new AudioContext();
        initAudio();
    }
}

function initGL() {
    try {
        gl = canvas.getContext("experimental-webgl", {
            antialias: true
        });
        //            gl = canvas.getContext("experimental-webgl", {preserveDrawingBuffer: true});
    } catch (e) { }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
}

function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "f") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "v") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

var programsArray = new Array();
var current_program;
var index = 0;

function initShaders() {
    programsArray.push(createProgram("shader-vs", "shader-1-fs"));
    programsArray.push(createProgram("shader-vs", "shader-2-fs"));
    programsArray.push(createProgram("shader-vs", "shader-3-fs"));
    programsArray.push(createProgram("shader-vs", "shader-4-fs"));
    programsArray.push(createProgram("shader-vs", "shader-5-fs"));
    programsArray.push(createProgram("shader-vs", "shader-6-fs"));
    programsArray.push(createProgram("shader-vs", "shader-7-fs"));
    programsArray.push(createProgram("shader-vs", "shader-8-fs"));
    current_program = programsArray[0];
}

function createProgram(vertexShaderId, fragmentShaderId) {
    var shaderProgram;
    var fragmentShader = getShader(gl, fragmentShaderId);
    var vertexShader = getShader(gl, vertexShaderId);

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    //       gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    shaderProgram.resolutionUniform = gl.getUniformLocation(shaderProgram, "resolution");
    shaderProgram.mouse = gl.getUniformLocation(shaderProgram, "mouse");
    shaderProgram.time = gl.getUniformLocation(shaderProgram, "time");
    shaderProgram.Param1 = gl.getUniformLocation(shaderProgram, "Param1");
    shaderProgram.Param2 = gl.getUniformLocation(shaderProgram, "Param2"); // volume
    shaderProgram.Param3 = gl.getUniformLocation(shaderProgram, "Param3");
    shaderProgram.Param4 = gl.getUniformLocation(shaderProgram, "Param4");
    shaderProgram.Sound1 = gl.getUniformLocation(shaderProgram, "Sound1");
    shaderProgram.Sound2 = gl.getUniformLocation(shaderProgram, "Sound2");
    shaderProgram.Sound3 = gl.getUniformLocation(shaderProgram, "Sound3");
    shaderProgram.Sound4 = gl.getUniformLocation(shaderProgram, "Sound4");
    return shaderProgram;
}

var webcam;
var texture;

function initTexture() {
    texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

var ix = 0.0;
var end;
var st = new Date().getTime();

function setUniforms() {
    end = new Date().getTime();
    gl.uniformMatrix4fv(current_program.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(current_program.mvMatrixUniform, false, mvMatrix);
    gl.uniform2f(current_program.resolutionUniform, canvas.width, canvas.height);
    gl.uniform2f(current_program.mouse, mouseX, mouseY);
    gl.uniform1f(current_program.time, ((end - st) % 1000000) / 1000.0);
    gl.uniform1f(current_program.Param1, Param1);
    gl.uniform1f(current_program.Param2, Param2);
    gl.uniform1f(current_program.Param3, Param3);
    gl.uniform1f(current_program.Param4, Param4);
}

var cubeVertexPositionBuffer;
var cubeVertexTextureCoordBuffer;
var cubeVertexIndexBuffer;

function initBuffers() {
    cubeVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    vertices = [-1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    cubeVertexPositionBuffer.itemSize = 2;
    cubeVertexPositionBuffer.numItems = 4;

    cubeVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    var textureCoords = [0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    cubeVertexTextureCoordBuffer.itemSize = 2;
    cubeVertexTextureCoordBuffer.numItems = 4;

    cubeVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    var cubeVertexIndices = [0, 1, 2, 0, 2, 3];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
    cubeVertexIndexBuffer.itemSize = 1;
    cubeVertexIndexBuffer.numItems = 6;
}

function drawScene() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.enable(gl.BLEND);

    mat4.ortho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0, pMatrix);

    gl.useProgram(current_program);
    mat4.identity(mvMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    gl.vertexAttribPointer(current_program.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    //        gl.vertexAttribPointer(current_program.textureCoordAttribute, cubeVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webcam);
    gl.uniform1i(current_program.samplerUniform, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    setUniforms();
    gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

    gl.bindTexture(gl.TEXTURE_2D, null);
}

function tick() {
    requestAnimFrame(tick);
    drawScene();
}

function webGLStart() {
    canvas = document.getElementById("webgl-canvas");
    if (screen.width > 1500 || screen.height > 1500) {
        canvas.width = 1024;
        canvas.height = 1024;
    } else {
        canvas.width = 512;
        canvas.height = 512;
    }
    //canvas.width = 2096;  for screen capture or use 4k resolution with old firefox, i.e. 3840x2160
    //canvas.height =2096;
    initGL();
    initShaders();
    initBuffers();
    initTexture();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    tick();
}

function PlaySound(i) {
    switch (i) {
        case 1:
            player.play();
            break;
        case 2:
            player1.play();
            break;
        case 3:
            player2.play();
            break;
    }
}

function Action(i) {
    switch (i) {
        /*       case 1: // Volume so not used here
                   Param1 = Param1 + 1;
                   if (Param1 > 4)
                       Param1 = 1;
                   PlaySound(2);
                   break;
               case 2: // frication so not used here
                   Param2 = Param2 + 1;
                   if (Param2 > 4)
                       Param2 = 1;
                   PlaySound(1);
                   break; */
        case 3: // colour
            Param3 = Param3 + 1;
            if (Param3 > 7)
                Param3 = 1;
            PlaySound(1);
            break;
        case 4: // background
            Param4 = Param4 + 1;
            if (Param4 > 6)
                Param4 = 1;
            PlaySound(3);
            break;
        case 5: // left
            index = index - 1;
            if (index < 0) index = 7;
            current_program = programsArray[index];
            break;
        case 6: // right
            index = index + 1;
            if (index > 7) index = 0;
            current_program = programsArray[index];
            break;
    }
}

function toggleButtons() {
    ibutton.hidden = !ibutton.hidden;
    ibutton1.hidden = !ibutton1.hidden;
    ibuttonl.hidden = !ibuttonl.hidden;
    ibuttonr.hidden = !ibuttonr.hidden;
}

function MonitorKeyDown(e) { // stop autorepeat of keys with KeyState1-4 flags
    if (!e) e = window.event;
    if (e.keyCode == 32 || e.keyCode == 49) {
        if (keyState1 == 0)
            Action(4);
    } else if (e.keyCode == 50) {
        if (keyState2 == 0)
            Action(3);
        keyState2 = 1;
    } else if (e.keyCode == 51 || e.keyCode == 13) {
        if (keyState3 == 0)
            Action(1);
        keyState3 = 1;
    } else if (e.keyCode == 52) {
        if (keyState4 == 0)
            Action(2);
        keyState4 = 1;
    } else if (e.keyCode == 53) {
        toggleButtons();
    } else if (e.keyCode == 189) { // +
        if (keyStatel == 0)
            Action(5); //buttonl
    } else if (e.keyCode == 187) { // -
        if (keyStater == 0)
            Action(6);
        else if (e.keycode == 27) {
            showMenu();
        }
    }
    return false;
}

function MonitorKeyUp(e) {
    if (!e) e = window.event;
    if (e.keyCode == 32 || e.keyCode == 49) {
        keyState1 = 0;
    } else if (e.keyCode == 50) {
        keyState2 = 0;
    } else if (e.keyCode == 51 || e.keyCode == 13) {
        keyState3 = 0;
    } else if (e.keyCode == 52) {
        keyStatel = 0;
    } else if (e.keyCode == 189) {
        keyState4 = 0;
    } else if (e.keyCode == 187) {
        keyStater = 0;
    }
    return false;
}

var mouseState = 0;

function MonitorMouseDown(e) {
    if (!e) e = window.event;
    if (e.button == 0) {
        mouseState = 1;
        mouseX = e.clientX / canvas.scrollWidth;
        mouseY = 1.0 - e.clientY / canvas.scrollHeight;
    }
    var c = document.getElementById("container");
    c.style.filter = "sepia(1) hue-rotate(230deg) saturate(2)";
    toggleButtons();
    return false;
}

function MonitorMouseUp(e) {
    if (!e) e = window.event;
    if (e.button == 0) {
        mouseState = 0;
    }
    var c = document.getElementById("container");
    c.style.filter = "grayscale(0)";
    return false;
}

var splash;
var button;
var button1;
var button2;
var button3;
var button4;
var button5;
var button6;
var button7;
var ibutton;
var ibutton1;
var ibuttonl;
var ibuttonr;

function hideMenu() {
    splash.hidden = true;
    button.hidden = true;
    button1.hidden = true;
    button2.hidden = true;
    button3.hidden = true;
    button4.hidden = true;
    button5.hidden = true;
    button6.hidden = true;
    button6.hidden = true;
    button7.hidden = true;
    settings.hidden = true;
    panel.hidden = true;
    ibutton.hidden = false;
    ibutton1.hidden = false;
    ibuttonl.hidden = false;
    ibuttonr.hidden = false;
    inMenu = false;
}

function showMenu() {
    splash.hidden = false;
    button.hidden = false;
    button1.hidden = false;
    button2.hidden = false;
    button3.hidden = false;
    button4.hidden = false;
    button5.hidden = false;
    button6.hidden = false;
    button6.hidden = false;
    button7.hidden = false;
    settings.hidden = false;
    panel.hidden = false;
    ibutton.hidden = true;
    ibutton1.hidden = true;
    ibuttonl.hidden = true;
    ibuttonr.hidden = true;
    inMenu = true;
}

function Go(i) {
    index = i;
    current_program = programsArray[i];
    if (firstTime) {
        firstTime = false;
        if (document.body.requestFullscreen) {
            document.body.requestFullscreen();
        } else if (document.body.msRequestFullscreen) {
            document.body.msRequestFullscreen();
        } else if (document.body.mozRequestFullScreen) {
            document.body.mozRequestFullScreen();
        } else if (document.body.webkitRequestFullscreen) {
            document.body.webkitRequestFullscreen();
        }
    }
    startAudio();
    hideMenu();
}


function slideTo(el, left) {
    var steps = 10;
    var timer = 25;
    var elLeft = parseInt(el.style.left) || 0;
    var diff = left - elLeft;
    var stepSize = diff / steps;
    console.log(stepSize, ", ", steps);

    function step() {
        elLeft += stepSize;
        el.style.left = elLeft + "vw";
        if (--steps) {
            setTimeout(step, timer);
        }
    }
    step();
}


StoreValue = function (key, value) {
    if (window.localStorage) {
        window.localStorage.setItem(key, value);
    }
};

RetrieveValue = function (key, defaultValue) {
    var got;
    try {
        if (window.localStorage) {
            got = window.localStorage.getItem(key);
            if (got == 0) {
                return got;
            }
            if (got == "") {
                return got;
            }
            if (got) {
                return got;
            }
            return defaultValue;
        }
        return defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

var c = document.getElementById("body");

function camStart() {
    panel = document.querySelector('panel');
    settings = document.querySelector('settings');
    splash = document.querySelector('splash');
    button = document.querySelector('button');
    button1 = document.querySelector('button1');
    button2 = document.querySelector('button2');
    button3 = document.querySelector('button3');
    button4 = document.querySelector('button4');
    button5 = document.querySelector('button5');
    button6 = document.querySelector('button6');
    button7 = document.querySelector('button7');
    ibutton = document.querySelector('ibutton');
    ibutton1 = document.querySelector('ibutton1');
    ibuttonl = document.querySelector('ibuttonl');
    ibuttonr = document.querySelector('ibuttonr');
    button = document.querySelector('button');
    button1 = document.querySelector('button1');
    button2 = document.querySelector('button2');
    button3 = document.querySelector('button3');
    button4 = document.querySelector('button4');
    button5 = document.querySelector('button5');
    button6 = document.querySelector('button6');
    button7 = document.querySelector('button7');
    webcam = document.createElement('canvas'); //getElementById('webcam');
    keyState1 = 0;
    keyState2 = 0;
    keyState3 = 0;
    keyState4 = 0;

    progress = document.getElementById('progress');
    panel.style.left = "130vw";
    slideTo(panel, 130);
    settings.style.left = "92vw";
    var chromeOS = false; // this checks for Chrome Operating system /(CrOS)/.test(navigator.userAgent);

    progress.style.position = "absolute";
    progress.style.height = "1vh";
    progress.style.width = "12vw";
    progress.style.left = "6.5vw";
    progress.style.top = "18vh";

    vol1 = document.createElement("INPUT");
    vol1.setAttribute("type", "range");
    vol1.style.position = "absolute";
    vol1.style.height = "8vh";
    vol1.style.width = "12vw";
    vol1.style.left = "6.5vw";
    vol1.style.top = "10vh";
    vol1.value = 25;
    vol1.min = 1;

    vol2 = document.createElement("INPUT");
    vol2.setAttribute("type", "range");
    vol2.style.position = "absolute";
    vol2.style.height = "8vh";
    vol2.style.width = "12vw";
    vol2.style.left = "6.5vw";
    vol2.style.top = "19vh";
    vol2.value = 75;
    vol2.min = 1;

    // colPick.value ="#FF8040";
    // colPick.style.position = "absolute";
    // colPick.style.height = "3vh";
    // colPick.style.width = "3vw";
    // colPick.style.left = "11vw";
    // colPick.style.top = "33vh";

    panel.appendChild(vol1);
    panel.appendChild(vol2);
    //  panel.appendChild(colPick);
    panel.appendChild(progress);
    //  panel.appendChild(foreground);
    //  panel.appendChild(rainbow);
    //  panel.appendChild(bground);
    //  panel.appendChild(fcol);
    //  panel.appendChild(bcol);

    if (chromeOS) {
        chrome.storage.local.get(null, function (result) { // recover stored value
            if (result.vol1 == undefined) { // initial set up after first loaded
                vol1.value = 1;
                vol2.value = 50;
                bcol.style.backgroundColor = '#000000';
                fcol.style.backgroundColor = '#00FFFF';
                fcol.style.backgroundImage = "url(images/rainbow.png)";
            } else {
                vol1.value = Math.abs(result.vol1);
                // if (result.vol1 < 0) {
                //   fcol.style.backgroundImage="url(images/rainbow.png)";
                // }
                // else
                //   doingRainbow = "0";
                vol2.value = result.vol2;
                // fcol.style.backgroundColor = result.foreground;
                // bcol.style.backgroundColor = result.background;
            }
        });
    } else {
        vol1.value = RetrieveValue("vol1", 0);
        vol2.value = RetrieveValue("vol2", 50);
        // doingRainbow = RetrieveValue("doingRainbow", "1");
        // bcol.style.backgroundColor = RetrieveValue("back", 0);
        // fcol.style.backgroundColor = RetrieveValue("fore", "rgb(255,255,0)");
        // if (doingRainbow == "1")
        //     fcol.style.backgroundImage="url(images/rainbow.png)";
        // else
        //     fcol.style.backgroundImage=null;
    }

    settings.onclick = function (e) {
        startAudio();
        if (panelvisible) { // save stored values
            slideTo(panel, 130);
            slideTo(settings, 92);
            if (chromeOS) {
                if (vol1.value < 1)
                    vol1 = 1;
                // if (doingRainbow == "1")
                //   chrome.storage.local.set({'vol1': -vol1.value});
                // else
                chrome.storage.local.set({
                    'vol1': vol1.value
                });
                chrome.storage.local.set({
                    'vol2': vol2.value
                });
                // chrome.storage.local.set({'foreground': fcol.style.backgroundColor});
                // chrome.storage.local.set({'background': bcol.style.backgroundColor});
            } else {
                // document.cookie="vol1="+vol1.value;
                // checkCookie();
                StoreValue("vol1", vol1.value);
                StoreValue("vol2", vol2.value);
                // StoreValue("doingRainbow", doingRainbow);
                // StoreValue("back", bcol.style.backgroundColor);
                // StoreValue("fore", fcol.style.backgroundColor);
            }

        } else {
            slideTo(panel, 75);
            slideTo(settings, 78);
        }
        // colPick.color.hidePicker();
        panelvisible = !panelvisible;

    }

    /*splash.onclick = function (e) {
        if (document.body.requestFullscreen) {
            document.body.requestFullscreen();
        } else if (document.body.msRequestFullscreen) {
            document.body.msRequestFullscreen();
        } else if (document.body.mozRequestFullScreen) {
            document.body.mozRequestFullScreen();
        } else if (document.body.webkitRequestFullscreen) {
            document.body.webkitRequestFullscreen();
        }
        startAudio();
        hideMenu();
    }*/
    /*       window.setTimeout(function() {
           if (document.body.requestFullscreen) {
             document.body.requestFullscreen();
           } else if (document.body.msRequestFullscreen) {
             document.body.msRequestFullscreen();
           } else if (document.body.mozRequestFullScreen) {
             document.body.mozRequestFullScreen();
           } else if (document.body.webkitRequestFullscreen) {
             document.body.webkitRequestFullscreen();
           }
        
            splash.hidden = true;
        }, 5000); // hide Splash screen after 2.5 seconds
*/
    webGLStart();

    document.onkeydown = MonitorKeyDown;
    document.onkeyup = MonitorKeyUp;

    canvas.onmousedown = MonitorMouseDown;
    canvas.onmouseup = MonitorMouseUp;
    canvas.onmousemove = function (e) {
        e = e || window.event;
        if (mouseState == 1) {
            mouseX = (mouseX + 7.0 * e.clientX / canvas.scrollWidth) / 8.0;
            mouseY = (mouseY + 7.0 * (1.0 - e.clientY / canvas.scrollHeight)) / 8.0;
        }
    }
    canvas.ontouchstart = function (e) {
        e.preventDefault();
        toggleButtons();
        var touchs = e.changedTouches;
        mouseX = touchs[0].clientX / canvas.scrollWidth;
        mouseY = 1.0 - touchs[0].clientY / canvas.scrollHeight;
        c.style.filter = "sepia(1) hue-rotate(230deg) saturate(2)";
    };
    canvas.ontouchend = function (e) {

        e.preventDefault();
        c.style.filter = "grayscale(0)";
    };
    canvas.ontouchmove = function (e) {
        e.preventDefault();
        var touches = e.changedTouches;
        mouseX = touches[0].clientX / canvas.scrollWidth; //] (mouseX + 7.0*touches/canvas.scrollWidth)/8.0;
        mouseY = 1.0 - touches[0].clientY / canvas.scrollHeight; //(mouseY + 7.0*(1.0 - e.clientY/canvas.scrollHeight))/8.0;
    };
    ibutton.onmousedown = function (e) {
        Action(4);
    }

    ibutton1.onmousedown = function (e) {
        Action(3);
    }
    ibuttonl.onmousedown = function (e) {
        showMenu(); //Action(5);
    }
    ibuttonr.onmousedown = function (e) {
        Action(6);
    }

    button.onmousedown = function (e) {
        Go(0);
    }
    button1.onmousedown = function (e) {
        Go(1);
    }
    button2.onmousedown = function (e) {
        Go(2);
    }
    button3.onmousedown = function (e) {
        Go(3);
    }
    button4.onmousedown = function (e) {
        Go(4);
    }
    button5.onmousedown = function (e) {
        Go(5);
    }
    button6.onmousedown = function (e) {
        Go(6);
    }
    button7.onmousedown = function (e) {
        Go(7);
    }

    ibutton.ontouchstart = function (e) {
        e.preventDefault();
        Action(4);
    }

    ibutton1.ontouchstart = function (e) {
        e.preventDefault();
        Action(3);
    }
    ibuttonl.ontouchstart = function (e) {
        showMenu();
        //e.preventDefault();
        //Action(5);
    }
    ibuttonr.ontouchstart = function (e) {
        e.preventDefault();
        Action(6);
    }

    button.ontouchstart = function (e) {
        Go(0);
    }
    button1.ontouchstart = function (e) {
        Go(1);
    }
    button2.ontouchstart = function (e) {
        Go(2);
    }
    button3.ontouchstart = function (e) {
        Go(3);
    }
    button4.ontouchstart = function (e) {
        Go(4);
    }
    button5.ontouchstart = function (e) {
        Go(5);
    }
    button6.ontouchstart = function (e) {
        Go(6);
    }
    button7.ontouchstart = function (e) {
        Go(7);
    }


    gamepads.addEventListener('connect', e => {
        console.log('Gamepad connected:');
        console.log(e.gamepad);
        e.gamepad.addEventListener('buttonpress', e => showPressedButton(e.index));
        e.gamepad.addEventListener('buttonrelease', e => removePressedButton(e.index));
        e.gamepad.addEventListener('joystickmove', e => moveJoystick(e.values, true),
            StandardMapping.Axis.JOYSTICK_LEFT);
        e.gamepad.addEventListener('joystickmove', e => moveJoystick(e.values, false),
            StandardMapping.Axis.JOYSTICK_RIGHT);
    });

    gamepads.addEventListener('disconnect', e => {
        console.log('Gamepad disconnected:');
        console.log(e.gamepad);
    });

    gamepads.start();

    function Highlight() {
        button.style.opacity = .7;
        button1.style.opacity = .7;
        button2.style.opacity = .7;
        button3.style.opacity = .7;
        button4.style.opacity = .7;
        button5.style.opacity = .7;
        button6.style.opacity = .7;
        button7.style.opacity = .7;
        switch (menuItem) {
            case 0:
                button.style.opacity = 1.;
                break;
            case 1:
                button1.style.opacity = 1.;
                break;
            case 2:
                button2.style.opacity = 1.;
                break;
            case 3:
                button3.style.opacity = 1.;
                break;
            case 4:
                button4.style.opacity = 1.;
                break;
            case 5:
                button5.style.opacity = 1.;
                break;
            case 6:
                button6.style.opacity = 1.;
                break;
            case 7:
                button7.style.opacity = 1.;
                break;
        }
    }

    function showPressedButton(index) {
        console.log("Press: ", index);
        if (inMenu) {
            switch (index) {
                case 0: // A
                case 1: // B
                case 2: // X
                case 3: // Y
                    Go(menuItem);
                    break;
                case 12: // dup
                    if (menuItem > 3)
                        menuItem -= 4;
                    Highlight();
                    break;
                case 13: // ddown
                    if (menuItem < 4)
                        menuItem += 4;
                    Highlight();
                    break;
                case 14: // dleft
                    if (menuItem > 0)
                        menuItem--;
                    Highlight();
                    break;
                case 15: // dright
                    if (menuItem < 7)
                        menuItem++;
                    Highlight();
                    break;
            }
            console.log("Menu: ", menuItem);
        } else switch (index) {
            case 0: // A
            //case 12: // dup
            case 6://Left Trig
            case 11:
                Action(3);
                break;
            case 3: // Y    
            case 7:// Right Trig
                //case 13: // ddown
                Action(4);
                break;
            case 2: // X
            case 4: // LT
                //case 14: // dleft
                Action(5);
                break;
            case 1: // B
            case 5: // RT
                //case 15: // dright
                Action(6);
                break;
            case 10: // LThumbPress
            case 9://List
            case 16://Xbox
                showMenu();
                break;
            case 8: // View Button new 20/6/20
                toggleButtons(); // new 20/6/20
                break; // new 20/6/20
            default:
        }
    }

    function removePressedButton(index) {
        console.log("Releasd: ", index);
    }

    function moveJoystick(values, isLeft) {
        console.log("Joystick: ", values[0], values[1]);
        if (values[1] >= 0 || values[1] >= 0) {
            XBoxVolume = Math.max(values[1], values[0]);
        }

    }

}
//© 2020 Sensory App House Ltd www.sensoryapphouse.com