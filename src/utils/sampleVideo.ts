/**
 * Generates an in-memory sample video with an audio track
 * so users can test trimming and MP3 conversion immediately without needing a local video file.
 */
export async function createSampleVideo(targetSeconds: number = 20): Promise<File> {
  // Try fetching the pre-generated, standard high-quality MP4 file first
  try {
    const res = await fetch('/sample.mp4');
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 1000) {
        return new File([blob], 'sample_video.mp4', { type: 'video/mp4' });
      }
    }
  } catch (err) {
    console.warn('Could not fetch static sample.mp4, falling back to dynamic generator', err);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const dest = audioCtx.createMediaStreamDestination();

  // Create musical melody
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.connect(gain);
  gain.connect(dest);

  // Musical notes for 15 seconds
  const notes = [
    261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25,
    587.33, 523.25, 493.88, 440.0, 392.0, 349.23, 329.63
  ];
  const now = audioCtx.currentTime;
  notes.forEach((freq, i) => {
    osc.frequency.setValueAtTime(freq, now + i * 1.0);
    gain.gain.setValueAtTime(0.3, now + i * 1.0);
    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 1.0 + 0.95);
  });

  osc.start(now);
  osc.stop(now + targetSeconds);

  const canvasStream = canvas.captureStream(30);
  const audioTracks = dest.stream.getAudioTracks();
  if (audioTracks.length > 0) {
    canvasStream.addTrack(audioTracks[0]);
  }

  // Draw animated frames
  const startPerfTime = performance.now();
  let animId: number;

  const draw = () => {
    const elapsed = (performance.now() - startPerfTime) / 1000;
    
    // Dark Neon Background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, 640, 360);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < 640; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 360);
      ctx.stroke();
    }
    for (let y = 0; y < 360; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(640, y);
      ctx.stroke();
    }

    // Glowing circle in center (Neon Cyan + Neon Magenta)
    const pulse = Math.sin(elapsed * 4) * 15;
    ctx.beginPath();
    ctx.arc(320, 150, 45 + pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Neon Magenta inner dot
    ctx.beginPath();
    ctx.arc(320, 150, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#ec4899';
    ctx.fill();

    // Waveform simulation
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 40; x < 600; x += 6) {
      const y = 265 + Math.sin(x * 0.05 + elapsed * 6) * 35;
      if (x === 40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Text labels
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sample Video for MP3 Converter', 320, 50);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`Duration: 00:${targetSeconds.toString().padStart(2, '0')} | Time: 00:${Math.floor(elapsed).toString().padStart(2, '0')}.${Math.floor((elapsed % 1) * 10)}`, 320, 85);

    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#ec4899';
    ctx.fillText('Test Audio & Video Trimming', 320, 335);

    animId = requestAnimationFrame(draw);
  };

  draw();

  const mimeTypes = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4',
  ];
  const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  const recorder = new MediaRecorder(canvasStream, { mimeType: selectedMime });
  const chunks: Blob[] = [];

  return new Promise<File>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      cancelAnimationFrame(animId);
      audioCtx.close().catch(() => {});
      const videoBlob = new Blob(chunks, { type: selectedMime });
      const file = new File([videoBlob], 'sample_video.webm', { type: selectedMime });
      resolve(file);
    };

    recorder.onerror = (e) => {
      cancelAnimationFrame(animId);
      audioCtx.close().catch(() => {});
      reject(e);
    };

    recorder.start();

    // Record for target duration (15 seconds)
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, targetSeconds * 1000);
  });
}
