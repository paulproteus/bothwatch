/* Asheesh stuff begins here */
var remoteTime = 0; /* stores the minimum of our time and any published times */

/* Create a new custom event handler that listens for broadcasts of current
   minimum times, and sets our local minTime accordingly. */
$(document.body).peerbind('update_min_time', {
    'peer': function(e) {
	console.debug(e.peerData);
	console.log("Got new remoteTime. Old value: " + remoteTime);
	remoteTime = e.peerData;
	console.log("Now set to: " + remoteTime);
    },
    'local': function(e) { console.log("Not a remote thing."); /* do nothing */ },
});

$(document.body).peerbind('start_playing', function(e) {
    var my_vid = $("#video")[0];
    var ourTime = my_vid.currentTime;
    if (remoteTime < ourTime) {
	console.log("Adjusting time down: " + remoteTime);
	// seek the video to the remoteTime
	my_vid.currentTime = remoteTime;
    }
    console.log("Starting playing at whatever time we are at, which is: " + my_vid.currentTime);
    my_vid.play()
});

$(document.body).peerbind('pause_now', {
    'peer': function(e) {
	console.log("Got a remote pause... First, pausing.");
	/* First, pause! */
	var my_vid = $("#video")[0];
	my_vid.pause();

	/* Then, broadcast a note with the current time so the peer is up-to-date. */
	console.log("Now, sending a broadcast with our time: " + my_vid.currentTime);
	$(document.body).peertrigger('update_min_time', my_vid.currentTime);
    },
    'local': function(e) { console.log("Received a pause-broadcast from ourselves. Doing nothing."); /* do nothing */ },
});

var play_at_min_handler = function(e) {
    e.preventDefault();
    $(document.body).peertrigger('start_playing')
}
$("#play_at_min").bind('click', play_at_min_handler);

var pause_handler = function(e) {
    e.preventDefault();
    var my_vid = $("#video")[0];
    my_vid.pause();

    console.log("Sending update message to set remote time to: " + my_vid.currentTime);
    $(document.body).peertrigger('update_min_time', my_vid.currentTime);
    $(document.body).peertrigger('pause_now');
}
$("#pause").bind('click', pause_handler);
