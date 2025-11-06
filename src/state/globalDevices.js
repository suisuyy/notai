const globalDevices = {
  mediaStream: null,
};

export function setMediaStream(stream) {
  globalDevices.mediaStream = stream;
}

export function clearMediaStream() {
  if (globalDevices.mediaStream && typeof globalDevices.mediaStream.getTracks === "function") {
    globalDevices.mediaStream.getTracks().forEach((track) => track.stop());
  }
  globalDevices.mediaStream = null;
}

export default globalDevices;

