$(document).ready(function () {
  // Establish an audio context
  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var audioElement = document.getElementById('audioElement');
  var audioSrc = audioCtx.createMediaElementSource(audioElement);
  var analyser = audioCtx.createAnalyser();
      analyser.smoothingTimeConstant = 0.5;
  // Bind our analyser to the media element source.
  audioSrc.connect(analyser);
  audioSrc.connect(audioCtx.destination);

  // create Oscillator and gain node
  var oscillator = audioCtx.createOscillator();
  var gainNode = audioCtx.createGain();


  // connect oscillator to gain node to speakers
  oscillator.connect(gainNode);
  //gainNode.connect(analyser);
  //gainNode.connect(audioCtx.destination);

  // set options for the oscillator
  oscillator.type = 'triangle'; // sine = simple wave, square = more real tone
  oscillator.frequency.value = 1028; // value in hertz
  oscillator.detune.value = 0; // value in cents
  oscillator.start(0);
  oscillator.onended = function() {console.log('Your tone has now stopped playing!');}
  gainNode.gain.value = 0.2;

  // gather float data timeseries / waveform data
  analyser.fftSize = 2048; // higher = better but more expensive
  var bufferLength = analyser.fftSize;
  var timeDomainData = new Uint8Array(bufferLength);

  // Get canvas context for drawing the sine wave
  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext("2d");

  var WIDTH = canvas.width;
  var HEIGHT = canvas.height;

  canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

  function draw() {
    //console.log('updating sine waves bars');
    drawVisual = requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(timeDomainData);

    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    var sliceWidth = WIDTH * 1.0 / bufferLength;
    var x = 0;

    for(var i = 0; i < bufferLength; i++) {

      var v = timeDomainData[i] / 128.0;
      var y = v * HEIGHT/2;

      if(i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height/2);
    canvasCtx.stroke();
  };

  draw();

  console.log(analyser.fftSize);
  console.log(analyser.frequencyBinCount);
  console.log(analyser.smoothingTimeConstant);
  var frequencyData = new Uint8Array(200);
  var svgHeight = 200;
  var svgWidth = 1200;
  var barPadding = 1;

  function createSvg(parent, height, width) {
    return d3.select(parent)
         .append('svg')
         .attr('height', height)
         .attr('width', width);
  }

  var svg = createSvg('body', svgHeight, svgWidth);

  // Create our initial D3 chart.
  svg.selectAll('rect')
     .data(frequencyData)
     .enter()
     .append('rect')
     .attr('x', function (d, i) {
        return i * (svgWidth / frequencyData.length);
     })
     .attr('width', svgWidth / frequencyData.length - barPadding);

   // Continuously loop and update chart with frequency data.
   function renderChart() {
      //console.log('updating frequency bars');
      requestAnimationFrame(renderChart);

      // Copy frequency data to frequencyData array.
      analyser.getByteFrequencyData(frequencyData);

      // Update d3 chart with new data.
      svg.selectAll('rect')
         .data(frequencyData)
         .attr('y', function(d) {
            return svgHeight - d;
         })
         .attr('height', function(d) {
            return d;
         })
         .attr('fill', function(d) {
            return '#666';
         });
   }

   // Run the loop
   renderChart();

});
