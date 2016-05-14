$(document).ready(function() {
  // Establish an audio context - need this to get audio output
  var audioCtx = new(window.AudioContext || window.webkitAudioContext)();

  // Make all the audio nodes we need
  // Connect to the <audio> element with the trumpet file in it
  var audioElement = document.getElementById('audioElement');
  var audioFile = audioCtx.createMediaElementSource(audioElement);

  // Analysis node
  var analyser = audioCtx.createAnalyser(); // this spelling annoys me, but let's be consistent with the API
  analyser.smoothingTimeConstant = 0.5;
  analyser.fftSize = 4096; // higher = better but more expensive

  var bufferLength = analyser.fftSize;
  var frequencyBinSize = audioCtx.sampleRate / analyser.fftSize;


  // create  gain node
  var initialGain = 2;

  var gainNode = audioCtx.createGain();
  gainNode.gain.value = initialGain;

  var oscillatorGain = audioCtx.createGain();
  oscillatorGain.gain.value = .05;

  /* Create a node graph like so:
                audioCtx.destination
                        |
                    analyser
                        |
                    gainNode
                   /        \
        oscillatorGain       audioFile
            /
    oscillator
  */
  // Apparently oscillator can't be paused/played again, so you have to create a new one every time
  // This is super annoying.
  // Anyway, oscillator creation (and connection up to this node graph) moved down to the play/pause logic

  audioFile.connect(gainNode);
  oscillatorGain.connect(gainNode);
  gainNode.connect(analyser);
  gainNode.connect(audioCtx.destination);

  // Precreate byte arrays for bytewise timeseries / waveform and frequency data
  // Didn't know these array types existed https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array
  var timeDomainData = new Uint8Array(bufferLength);
  var frequencyData = new Uint8Array(analyser.frequencyBinCount / 2.5);

  // Draw the waveform for the currently playing audio!

  // Get canvas context for drawing the sine wave
  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext("2d");
  var WIDTH = canvas.width;
  var HEIGHT = canvas.height;
  canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

  function drawWaveform() {
    //console.log('updating waveform bars');
    requestAnimationFrame(drawWaveform);

    // Accepts a Uint8Array of "the right length" which is analyser.frequencyBinCount
    // If the array is too short, all extra values are dropped on the floor
    analyser.getByteTimeDomainData(timeDomainData);

    // Base waveform styles
    canvasCtx.fillStyle = 'rgb(230, 230, 230)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    canvasCtx.lineWidth = 4;
    canvasCtx.strokeStyle = 'rgb(30, 30, 30)';

    // Start drawing
    canvasCtx.beginPath();

    // Copy-pasted from MDN example, need to grok this better
    var sliceWidth = WIDTH * 1.0 / bufferLength;
    var x = 0;

    for (var i = 0; i < bufferLength; i++) {

      var v = timeDomainData[i] / 128.0;
      var y = v * HEIGHT / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  };

  // Draw the frequency analysis for the currently playing audio!
  // Frequency chart settings
  var svgHeight = 285;
  var svgWidth = 1024;
  var barPadding = 0;

  var svg = d3.select('#graph')
    .append('svg')
    .attr('height', svgHeight)
    .attr('width', svgWidth);

  // Create our initial D3 chart.
  var frequencyRects = svg.selectAll('g')
    // this is initialized with zeroes, not an empty array,
    // so it actually does create rects now, even with no audio playing
    .data(frequencyData)
    .enter()
    .append('g')
    .append('rect')
    .attr('x', function(d, i) {
      return i * (svgWidth / frequencyData.length);
    })
    .attr('width', svgWidth / frequencyData.length - barPadding);

    svg.selectAll('g').append('text')
           .attr("x", function(d, i) {
             return i * (svgWidth / frequencyData.length);
           })
           .attr("y", 285)
           .attr("dy", "0")
           .attr("text-anchor","middle")
           .text(function(d,i) {
             if (i % 50 == 0) {
               return(Math.floor(i * frequencyBinSize));
             }
           });


  function drawFrequencyChart() {
    //console.log('updating frequency bars');
    requestAnimationFrame(drawFrequencyChart);

    // Update frequencyData array with live data.
    analyser.getByteFrequencyData(frequencyData);

    // Update d3 chart with new data
    frequencyRects
      .data(frequencyData)
      .attr('y', function(d) {
        return svgHeight - 15 - d;
      })
      .attr('height', function(d) {
        return d;
      })
      .attr('fill', function(d) {
        return '#666';
      });
  }

  // Run the loop
  drawWaveform();
  drawFrequencyChart();

  // State for what is currently playing
  var audioOn = 0;
  var oscillatorOn = 0;
  var oscillatorReady = 1;

  // Oscillator settings
  var initialOscillatorType = 'sine';

  var oscillatorGainMap = {
    'sine':.09,
    'square':.03,
    'triangle':.05
  };

  var oscillator;

  function play(audiotype) {
    stop();
    if (audiotype == 'trumpet') {
      $('#audioElement')[0].play();
      audioOn = 1;
    } else {
      var createOscillatorOrWait = function() {
        if (oscillatorReady == 0) {
          setTimeout(createOscillatorOrWait,25);
        } else {
          oscillator = audioCtx.createOscillator();
          oscillator.frequency.value = 466.13; // value in hertz
          oscillator.detune.value = 0; // value in cents
          oscillator.connect(oscillatorGain);
          oscillator.type = audiotype; // sine = simple wave, square = more real tone
          oscillatorGain.gain.value = oscillatorGainMap[audiotype];
          oscillator.start();
          oscillatorOn = 1;
        }
      };
      createOscillatorOrWait();
    }
    drawWaveform();
    drawFrequencyChart();
  }

  function stop() {
    // Stop any currently playing audio
    if (audioOn) {
      $('#audioElement')[0].pause();
      $('#audioElement')[0].currentTime = 0;
      audioOn = 0;
    }
    if (oscillatorOn) {
      oscillatorReady = 0;
      oscillator.onended = function() {
        oscillatorReady = 1;
      }
      oscillator.stop();
      oscillatorOn = 0;
    }
  }

  function louder() {
    gainNode.gain.value = gainNode.gain.value * 1.1;
  }

  function softer() {
    gainNode.gain.value = gainNode.gain.value * .9;
  }

  $('.play-audio').on('click',function(){
    play($(this).data('audio-type'));
  });
  $('.stop-audio').on('click',function(){
    stop();
  });
  $('.louder').on('click',function(){
    louder();
  });
  $('.softer').on('click',function(){
    softer();
  });
});
