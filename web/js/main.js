var subdir = window.location.pathname.endsWith("/") ? window.location.pathname : window.location.pathname + "/";

subdir = getUrlParam("subdir", subdir);
var socketDomain = getUrlParam("socketdomain", false);
var socket;
if (socketDomain) {
  socket = io(socketDomain, { "path": subdir + "socket.io" })
} else {
  socket = subdir == "/" ? io() : io("", { "path": subdir + "/socket.io" }); //Connect to socketIo even on subpaths
}


var username = getUrlParam("username", "NA")
var webRTCConfig = {};

var allUserStreams = {};
var pcs = {}; //Peer connections to all remotes
var socketConnected = false;
var micMuted = false;
var camActive = false;

socket.on("connect", function () {
  socketConnected = true;
  socket.on("signaling", function (data) {
    var signalingData = data.signalingData;
    var fromSocketId = data.fromSocketId;
    if (!pcs[fromSocketId]) {
      createRemoteSocket(false, fromSocketId)
    }
    pcs[fromSocketId].signaling(signalingData);
  })

  socket.on("userJoined", function (userSocketId) {
    createRemoteSocket(true, userSocketId)
  })

  socket.on("userDiscconected", function (userSocketId) {
    delete allUserStreams[userSocketId];
    $('audio' + userSocketId).remove();
    updateUserLayout();
  })

  socket.on("currentIceServers", function (newIceServers) {
    console.log("got newIceServers", newIceServers)
    webRTCConfig["iceServers"] = newIceServers;
  })

  navigator.getUserMedia({
    video: false, // { 'facingMode': "user" }
    audio: { 'echoCancellation': true, 'noiseSuppression': true }
  }, function (stream) { //OnSuccess
    webRTCConfig["stream"] = stream;
    console.log('getUserMedia success! Stream: ', stream);

    var audioTracks = stream.getAudioTracks();

    if (audioTracks.length >= 1) {
      allUserStreams[socket.id] = {
        audiostream: stream
      }
    }

    if (audioTracks.length > 0) {
      console.log('Using audio device: ' + audioTracks[0].label);
    }

    joinRoom();
    updateUserLayout();
  }, function (error) { //OnError
    alert("Could not get your Camera / Mic!")
    console.log('getUserMedia error! Got this error: ', error);
  });

});

$(window).on("beforeunload", function () {
  if (socketConnected) {
    socket.emit('closeConnection', null);
  }
})

$(document).ready(function () {
  $("#muteUnmuteMicBtn").click(function () {
    if (!micMuted) {
      $("#muteUnmuteMicBtn").html('<i class="fas fa-microphone-alt-slash"></i>');
      if (allUserStreams[socket.id] && allUserStreams[socket.id]["audiostream"]) {
        allUserStreams[socket.id]["audiostream"].getAudioTracks()[0].enabled = false;
      }
    } else {
      $("#muteUnmuteMicBtn").html('<i class="fas fa-microphone-alt"></i>');
      if (allUserStreams[socket.id] && allUserStreams[socket.id]["audiostream"]) {
        allUserStreams[socket.id]["audiostream"].getAudioTracks()[0].enabled = true;
      }
    }
    micMuted = !micMuted;
  })

  $("#addRemoveCameraBtn").click(function () {
    if (!camActive) {
      $("#addRemoveCameraBtn").css({ color: "#030356" });
      navigator.getUserMedia({
        video: { 'facingMode': "user" },
        audio: false
      }, function (stream) { //OnSuccess
        for (var i in pcs) { //Add stream to all peers
          pcs[i].addStream(stream);
        }

        console.log('getUserMedia success! Stream: ', stream);
        console.log('LocalStream', stream.getVideoTracks());

        var videoTracks = stream.getVideoTracks();

        if (videoTracks.length >= 1) {
          allUserStreams[socket.id]["videostream"] = stream;
        }

        if (videoTracks.length > 0) {
          console.log('Using video device: ' + videoTracks[0].label);
        }

        updateUserLayout();
        camActive = true;
      }, function (error) { //OnError
        alert("Could not get your Camera!")
        console.log('getUserMedia error! Got this error: ', error);
        $("#addRemoveCameraBtn").css({ color: "black" });
      });
    } else {
      $("#addRemoveCameraBtn").css({ color: "black" });
      for (var i in pcs) { //remove stream from all peers
        pcs[i].removeStream(allUserStreams[socket.id]["videostream"]);
      }
      delete allUserStreams[socket.id]["videostream"];
      socket.emit('removeCamera', true)
      updateUserLayout();
      camActive = false;
    }
  });

  $("#cancelCallBtn").click(function () {
    location.href = "ended.html"
  })
})

//This is where the WEBRTC Magic happens!!!
function createRemoteSocket(initiator, socketId) {
  pcs[socketId] = new initEzWebRTC(initiator, webRTCConfig); //initiator
  pcs[socketId].on("signaling", function (data) {
    socket.emit("signaling", { destSocketId: socketId, signalingData: data })
  })
  pcs[socketId].on("stream", function (stream) {
    gotRemoteStream(stream, socketId)
  });
  pcs[socketId].on("streamremoved", function (stream, kind) {
    console.log("STREAMREMOVED!")

    if (kind == "video") {
      delete allUserStreams[socketId]["videostream"];
      updateUserLayout();
    }

  });
  pcs[socketId].on("closed", function (stream) {
    delete allUserStreams[socketId];
    $('audio' + socketId).remove();
    updateUserLayout();
    console.log("disconnected!");
  });
}

function gotRemoteStream(stream, socketId) {
  var videoTracks = stream.getVideoTracks();
  var audioTracks = stream.getAudioTracks();

  console.log("videoTracks", videoTracks)
  console.log("audioTracks", audioTracks)

  $("#" + socketId).remove();
  allUserStreams[socketId] = allUserStreams[socketId] ? allUserStreams[socketId] : {};
  if (videoTracks.length >= 1) { //Videosteam
    allUserStreams[socketId]["videostream"] = stream;
  } else {
    allUserStreams[socketId]["audiostream"] = stream;
  }

  updateUserLayout();
};

function updateUserLayout() {
  var streamCnt = 0;
  var allUserDivs = {};
  for (var i in allUserStreams) {
    var userStream = allUserStreams[i];
    streamCnt++;
    var uDisplay = username == "NA" ? i.substr(0, 2).toUpperCase() : username.substr(0, 2).toUpperCase();
    var userDiv = $('<div class="videoplaceholder" style="background:rgb(71, 71, 71); position:relative;" id="' + i + '">' +
      '<div class="userPlaceholder">' + uDisplay + '</div>' +
      '</div>')

    if (userStream["audiostream"] && i !== socket.id) {
      if ($("#audioStreams").find('audio' + i).length == 0) {
        let audioDiv = $('<div id="audio' + i + '" style="display:none;"><audio autoplay></audio></div>');
        audioDiv.find("audio")[0].srcObject = userStream["audiostream"];
        $("#audioStreams").append(audioDiv);
      }
    }

    if (userStream["videostream"]) {
      userDiv.append('<div id="video' + i + '" style="position: absolute; top: 0px; width: 100%;"><video autoplay muted></video></div>');
      userDiv.find("video")[0].srcObject = userStream["videostream"];
    }

    allUserDivs[i] = userDiv;
  }

  $("#mediaDiv").empty();

  if (streamCnt == 2) { //Display 2 users side by side
    for (var i in allUserDivs) {
      allUserDivs[i].css({ width: '50%', height: '100%', float: 'left' });
      $("#mediaDiv").append(allUserDivs[i])
    }
  } else {
    var lineCnt = Math.ceil(Math.sqrt(streamCnt));
    for (var i = 1; i < lineCnt + 1; i++) {
      $("#mediaDiv").append('<div id="line' + i + '"></div>')
    }
    let userPerLine = streamCnt <= 2 ? 1 : Math.ceil(streamCnt / lineCnt);
    let cucnt = 1;
    for (var i in allUserDivs) {
      var cLineNr = Math.ceil(userPerLine / cucnt);
      allUserDivs[i].css({ width: 100 / userPerLine + '%', height: 100 / lineCnt + '%', float: 'left' });
      $("#line" + cLineNr).append(allUserDivs[i])
      cucnt++;
    }
  }
}

function joinRoom() {
  //Only join the room if local media is active!
  var roomname = getUrlParam("roomname", "unknown");
  socket.emit("joinRoom", roomname, function () {
    console.log("joined room", roomname)
  });
}