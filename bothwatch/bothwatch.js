// Info about the one video.
CurrentTime = new Mongo.Collection("currentLocation");
VideoSrc = new Mongo.Collection("videoSrc");
var THE_ONLY_ONE = "the only one";

if (Meteor.isClient) {
  var hasSetLocationOnce = false;

  // Plan:
  //
  // - When a user shows up, sync the video to the CurrentTime but
  //   don't start playing.
  //
  // - When one user clicks Play (detected as a change to
  //   CurrentTime with status=playing) then start playing
  //   ourselves. Note that we will always be at least one server RTT
  //   behind. We could wait for an ACK, but getting that to sync
  //   correctly seems more trouble than it's worth.
  //
  // - When Alice pauses, she sets CurrentTime to be the current
  //   video time on her system (and set status=paused).
  //
  // - When Bob receives the pause event (seen as a change to
  //   CurrentTime and a CurrentTime.status==paused whereas
  //   the video is currently playing), see Bob's video time is less
  //   than the CurrentTime. If so, update CurrentTime
  //   accordingly. Also pause.
  var getMyLocation = function() {
    var video =  document.getElementsByTagName('video')[0];
    return (video && video.currentTime) || 'missing';
  }

  var setInitialLocation = function() {
    if (hasSetLocationOnce) {
      return;
    }

    var video = document.getElementsByTagName('video')[0];
    if (!video) {
      return;
    }

    var initialCurrentTime = CurrentTime.findOne({});
    if (!initialCurrentTime) {
      return;
    }

    video.currentTime = (1.0 * initialCurrentTime.location);
    hasSetLocationOnce = true;
    console.log("Initialized.");
  }

  var moveVideo = function() {
    setInitialLocation();

    var video = document.getElementsByTagName('video')[0];
    if (! video) {
      console.log("Eek, failed to find video.");
      return;
    }

    var nowCurrentTime = CurrentTime.findOne({});
    if (!nowCurrentTime) {
      return;
    }
    var videoIsPlaying = ! video.paused;

    if (nowCurrentTime.status === 'playing') {
      if (! videoIsPlaying) {
        // Other user has clicked play. Let's hope that currentTime
        // got synchronized! And we play.
        video.play();
      }
      return;
    }

    if (nowCurrentTime.status === 'paused') {
      if (videoIsPlaying) {
        // Other user has clicked pause! Let's update the consensus
        // location to be the minimum of our location and the consensus one.
        video.pause();
      }

      // If we got a pause event, and we are behind, then we should tell others
      // to rewind to where we are.
      if (nowCurrentTime.location > video.currentTime) {
        CurrentTime.update({_id: THE_ONLY_ONE},
                           {$set: {
                             location: video.currentTime}});
      } else {
        // If we are ahead, we should zoom back.
        video.currentTime = nowCurrentTime.location;
      }

      return;
    }
  }

  CurrentTime.find().observeChanges({
    added: moveVideo,
    changed: moveVideo,
    removed: moveVideo
  });

  Template.videoTag.helpers({
    consensusLocation: function() {
      var loc = CurrentTime.findOne({});
      if (loc && loc.location) {
        return loc.location;
      }
      return 0;
    },

    myLocation: function() {
      return getMyLocation();
    },
  });

  Template.videoTag.onRendered(function() {
    // Only when the video tag is on the page do we bother subscribing
    // to the serverCurrentTime. This way, there is always a video
    // element!
    Meteor.subscribe('serverCurrentTime', moveVideo);
  });

  Template.videoTag.onCreated(function() {
    Meteor.subscribe("serverVideoSrc");
  });

  Template.videoTag.helpers({
    'videoSrc': function() {
      var obj = VideoSrc.findOne({_id: THE_ONLY_ONE});
      return (obj && obj.src);
    }});

  Template.videoTag.events({
    'click button': function() {
      var url = document.getElementsByClassName('url')[0].value.trim();
      if (url) {
        VideoSrc.insert({_id: THE_ONLY_ONE, src: url});
      }
    },

    'play video': function() {
      // For some reason we're playing. So broadcast our new status of
      // playing.
      CurrentTime.update({_id: THE_ONLY_ONE},
                         {$set: {status: 'playing'}});
    },
    'pause video': function() {
      // For some reason we're paused. Maybe we clicked pause, or
      // maybe we are paused due to handling a reactive mongo update.
      var video = document.getElementsByTagName('video')[0];
      var nowCurrentTime = CurrentTime.findOne({_id: THE_ONLY_ONE});

      // Do a broadcast of our video time if one of:
      //
      // - We're the one who clicked the button, or
      //
      // - We're not the one who clicked the button, but we're behind.
      var shouldBroadcastOurTime = false;

      var weClicked = (nowCurrentTime.status === 'playing');
      var weAreBehind = (video.currentTime < nowCurrentTime.location);
      shouldBroadcastOurTime = (weClicked) || (weAreBehind && ! weClicked);
      if (shouldBroadcastOurTime) {
        CurrentTime.update({_id: THE_ONLY_ONE},
                           {$set: {location: video.currentTime,
                                   status: 'paused'}});
      }
    },
  });
}

if (Meteor.isServer) {

  Meteor.startup(function () {
    if (CurrentTime.find({}).count() === 0) {
      CurrentTime.insert({_id: THE_ONLY_ONE});
    }
  });

  Meteor.publish('serverCurrentTime', function() {
    return CurrentTime.find();
  });
  Meteor.publish('serverVideoSrc', function() {
    return VideoSrc.find();
  });
}
