"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { logger } from '@/lib/logging/logger';

interface MicrophoneVisualizerProps {
  isRoomConnected?: boolean; // Kept optional, though not directly used for BarVisualizer logic
  barCount?: number;
  // barSpacing and barWidth are not direct props for BarVisualizer
  maxBarHeight?: number;
  minBarHeight?: number; // Not directly used by BarVisualizer
}

export function MicrophoneVisualizer({
  maxBarHeight = 30, // Keep this for overall height
}: MicrophoneVisualizerProps) {
  const { localParticipant } = useLocalParticipant();
  const { info: logInfo, error: logError } = logger;
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 scale for simplicity
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const micPublication = localParticipant?.getTrackPublication(Track.Source.Microphone);
    const mediaStreamTrack = micPublication?.track?.mediaStreamTrack;

    if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
      logInfo('CustomVisualizer: MediaStreamTrack is live. Setting up Web Audio.', { id: mediaStreamTrack.id });
      try {
        if (!audioContextRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) {
            logError('CustomVisualizer: Web Audio API not supported.');
            return;
          }
          audioContextRef.current = new AudioContextClass();
        }
        const audioContext = audioContextRef.current;

        if (!analyserRef.current) {
          analyserRef.current = audioContext.createAnalyser();
          analyserRef.current.fftSize = 256; // Smaller FFT size for faster processing
        }
        const analyser = analyserRef.current;
        
        if (sourceRef.current) { // Clean up previous source if any
            sourceRef.current.disconnect();
        }
        sourceRef.current = audioContext.createMediaStreamSource(new MediaStream([mediaStreamTrack]));
        sourceRef.current.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
          if (!analyserRef.current || !sourceRef.current) { // Check if refs are still valid
            setAudioLevel(0);
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            return;
          }
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setAudioLevel((average / 255) * 100); // Scale to 0-100
          animationFrameIdRef.current = requestAnimationFrame(draw);
        };
        draw();

      } catch (err) {
        logError('CustomVisualizer: Error setting up Web Audio.', { error: err });
        setAudioLevel(0);
      }
    } else {
      logInfo('CustomVisualizer: No live MediaStreamTrack found or track ended.', {
        hasTrack: !!micPublication?.track,
        readyState: mediaStreamTrack?.readyState
      });
      setAudioLevel(0);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      // Analyser and AudioContext can be reused or closed on full unmount
    }

    return () => {
      logInfo('CustomVisualizer: Cleaning up Web Audio resources.');
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        // analyserRef.current.disconnect(); // Analyser disconnects when source disconnects
        analyserRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        // Don't close the context here if tracks might be re-published,
        // but ensure sources are disconnected.
        // audioContextRef.current.close();
        // audioContextRef.current = null;
      }
       setAudioLevel(0); // Reset level on cleanup
    };
  }, [localParticipant, logInfo, logError]); // Re-run if localParticipant changes (e.g., track added/removed)

  const barHeight = (audioLevel / 100) * maxBarHeight;

  return (
    <div className="flex flex-col items-center my-2 w-full max-w-xs p-2 bg-black rounded-md">
      <div
        className="microphone-visualizer-container w-20 bg-gray-700 rounded" // Fixed width for simplicity
        style={{ height: `${maxBarHeight}px`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      >
        <div
          className="bg-green-500 transition-all duration-50 ease-linear"
          style={{ height: `${Math.max(2, barHeight)}px`, width: '100%' }} // Ensure min height
        />
      </div>
      <span className="text-xs text-gray-300 mt-1">
        Mic Activity (Custom: {audioLevel.toFixed(0)}%)
      </span>
    </div>
  );
}