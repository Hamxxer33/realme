import type { EncryptedMessage } from '@realme/crypto';
import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { ApiError, api, type PublicUser } from './api';
import { notify } from './confirm';
import { realtime } from './realtime';
import { RTCPeerConnection, mediaDevices } from './webrtc';

/** Matches the server: an unanswered call stops ringing after this long. */
const RING_TIMEOUT_MS = 45_000;
const ENDED_SCREEN_MS = 1600;

export interface CallView {
  id: string;
  conversationId: string;
  kind: 'audio' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'ringing' | 'active' | 'answered' | 'missed' | 'declined' | 'cancelled' | 'failed';
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  peer: PublicUser;
}

// The browser and react-native-webrtc agree on the parts we use; keep the types small.
type Track = { enabled: boolean; kind: string; stop(): void; _switchCamera?: () => void };
export type Stream = { getTracks(): Track[]; getAudioTracks(): Track[]; getVideoTracks(): Track[] };
type Candidate = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };
type Signal = { kind: 'offer' | 'answer'; sdp: string } | { kind: 'candidate'; candidate: Candidate };
type Peer = {
  addTrack(track: Track, stream: Stream): void;
  addEventListener(type: string, fn: (e: any) => void): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  createOffer(): Promise<{ sdp?: string }>;
  createAnswer(): Promise<{ sdp?: string }>;
  setLocalDescription(d: { type: 'offer' | 'answer'; sdp?: string }): Promise<void>;
  setRemoteDescription(d: { type: 'offer' | 'answer'; sdp: string }): Promise<void>;
  addIceCandidate(c: Candidate): Promise<void>;
  connectionState: string;
  close(): void;
};

export type Phase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';
export interface CallState {
  phase: Phase;
  call: CallView | null;
  local: Stream | null;
  remote: Stream | null;
  muted: boolean;
  cameraOff: boolean;
  connectedAt: number | null;
  endedLabel: string | null;
}

/** Signaling is sealed for the other person's key, so the server can't swap media keys (DTLS fingerprints). */
export interface CallCrypto {
  myId: string;
  seal(callId: string, peer: PublicUser, signal: Signal): EncryptedMessage;
  open(callId: string, from: string, peerPublicKey: string, payload: EncryptedMessage): Signal;
}

const IDLE: CallState = { phase: 'idle', call: null, local: null, remote: null, muted: false, cameraOff: false, connectedAt: null, endedLabel: null };

function endedLabel(c: CallView) {
  const out = c.direction === 'outgoing';
  switch (c.status) {
    case 'declined': return out ? 'Call declined' : 'Declined';
    case 'missed': return out ? 'No answer' : 'Missed call';
    case 'cancelled': return out ? 'Call cancelled' : 'Missed call';
    case 'failed': return "Couldn't connect";
    default: return 'Call ended';
  }
}

class CallManager {
  private state: CallState = IDLE;
  private listeners = new Set<() => void>();
  private crypto: CallCrypto | null = null;
  private pc: Peer | null = null;
  private remoteReady = false;
  private queued: Candidate[] = [];
  private ringTimer: ReturnType<typeof setTimeout> | undefined;
  private resetTimer: ReturnType<typeof setTimeout> | undefined;
  private iceServers: unknown[] | null = null;

  constructor() {
    realtime.subscribe((evt) => {
      if (evt.type === 'call_ring') void this.onRing(evt.callId);
      else if (evt.type === 'call_update' && evt.callId === this.state.call?.id) void this.onUpdate();
      else if (evt.type === 'call_signal' && evt.callId === this.state.call?.id) void this.onSignal(evt.from, evt.payload);
    });
  }

  // ---- store ----
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  get = () => this.state;
  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  attach(crypto: CallCrypto | null) {
    this.crypto = crypto;
    if (!crypto && this.state.phase !== 'idle') void this.hangUp();
  }

  // ---- actions ----

  /** Call the other person in a 1:1 chat. Throws with a message to show if it can't start. */
  async start(conversationId: string, kind: 'audio' | 'video') {
    if (this.state.phase !== 'idle' && this.state.phase !== 'ended') throw new Error("You're already on a call");
    this.reset();
    const local = await this.media(kind);
    let call: CallView;
    try {
      call = (await api<{ call: CallView }>('POST', '/calls', { conversationId, kind })).call;
    } catch (e) {
      local.getTracks().forEach((t) => t.stop());
      throw e;
    }
    this.set({ ...IDLE, phase: 'outgoing', call, local });
    await this.connectPeer(local);
    this.ringTimer = setTimeout(() => {
      if (this.state.phase === 'outgoing') void this.hangUp('missed');
    }, RING_TIMEOUT_MS);
  }

  async accept() {
    const { call } = this.state;
    if (this.state.phase !== 'incoming' || !call) return;
    this.set({ phase: 'connecting' });
    try {
      const local = await this.media(call.kind);
      this.set({ local });
      await this.connectPeer(local);
      await api('POST', `/calls/${call.id}/answer`);
    } catch (e) {
      await this.hangUp('failed');
      throw e;
    }
  }

  /** Hang up, decline or cancel — the server records which. */
  async hangUp(reason?: 'failed' | 'missed') {
    const { call } = this.state;
    if (!call) return this.reset();
    this.teardown();
    try {
      const { call: ended } = await api<{ call: CallView }>('POST', `/calls/${call.id}/end`, reason ? { reason } : {});
      this.finish(ended);
    } catch {
      this.finish({ ...call, status: reason ?? 'answered' });
    }
  }

  toggleMute() {
    const muted = !this.state.muted;
    this.state.local?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.set({ muted });
  }

  toggleCamera() {
    const cameraOff = !this.state.cameraOff;
    this.state.local?.getVideoTracks().forEach((t) => (t.enabled = !cameraOff));
    this.set({ cameraOff });
  }

  /** Front/back camera (phones only). */
  flipCamera() {
    this.state.local?.getVideoTracks().forEach((t) => t._switchCamera?.());
  }

  // ---- events ----

  private async onRing(callId: string) {
    if (this.state.phase !== 'idle' && this.state.phase !== 'ended') return; // the server marks us busy anyway
    const { call } = await api<{ call: CallView }>('GET', `/calls/${callId}`);
    if (call.status !== 'ringing') return;
    this.reset();
    this.set({ ...IDLE, phase: 'incoming', call });
  }

  private async onUpdate() {
    const current = this.state.call;
    if (!current) return;
    const { call } = await api<{ call: CallView }>('GET', `/calls/${current.id}`);
    if (call.endedAt) {
      this.teardown();
      return this.finish(call);
    }
    this.set({ call });
    // They picked up: the caller makes the offer.
    if (call.status === 'active' && call.direction === 'outgoing' && this.state.phase === 'outgoing') {
      clearTimeout(this.ringTimer);
      this.set({ phase: 'connecting' });
      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription({ type: 'offer', sdp: offer.sdp });
      this.send({ kind: 'offer', sdp: offer.sdp ?? '' });
    }
  }

  private async onSignal(from: string, payload: EncryptedMessage) {
    const { call } = this.state;
    if (!call || !this.crypto || !this.pc || from !== call.peer.id) return;
    let signal: Signal;
    try {
      signal = this.crypto.open(call.id, from, call.peer.publicKey, payload);
    } catch {
      return; // not sealed by them: ignore
    }
    const pc = this.pc;
    if (signal.kind === 'offer' && call.direction === 'incoming') {
      await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      await this.flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription({ type: 'answer', sdp: answer.sdp });
      this.send({ kind: 'answer', sdp: answer.sdp ?? '' });
    } else if (signal.kind === 'answer' && call.direction === 'outgoing') {
      await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      await this.flushCandidates();
    } else if (signal.kind === 'candidate') {
      if (this.remoteReady) await pc.addIceCandidate(signal.candidate).catch(() => {});
      else this.queued.push(signal.candidate);
    }
  }

  // ---- plumbing ----

  private async media(kind: 'audio' | 'video'): Promise<Stream> {
    if (!mediaDevices) throw new Error("Calls aren't supported on this device");
    try {
      return (await mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      })) as unknown as Stream;
    } catch {
      throw new Error(kind === 'video' ? 'Allow camera and microphone access to make video calls.' : 'Allow microphone access to make calls.');
    }
  }

  private async connectPeer(local: Stream) {
    if (!this.iceServers) {
      this.iceServers = (await api<{ iceServers: unknown[] }>('GET', '/calls/ice').catch(() => ({ iceServers: [] }))).iceServers;
    }
    const pc = new (RTCPeerConnection as unknown as new (config: object) => Peer)({ iceServers: this.iceServers });
    this.pc = pc;
    this.remoteReady = false;
    this.queued = [];
    for (const track of local.getTracks()) pc.addTrack(track, local);
    pc.addEventListener('icecandidate', (e) => {
      if (!e.candidate) return;
      const c = e.candidate;
      this.send({ kind: 'candidate', candidate: { candidate: c.candidate, sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null } });
    });
    pc.addEventListener('track', (e) => {
      if (e.streams?.[0]) this.set({ remote: e.streams[0] as Stream });
    });
    pc.addEventListener('connectionstatechange', () => {
      if (this.pc !== pc) return;
      if (pc.connectionState === 'connected' && this.state.phase !== 'active') this.set({ phase: 'active', connectedAt: Date.now() });
      if (pc.connectionState === 'failed') void this.hangUp('failed');
    });
  }

  private async flushCandidates() {
    this.remoteReady = true;
    const queued = this.queued;
    this.queued = [];
    for (const c of queued) await this.pc?.addIceCandidate(c).catch(() => {});
  }

  private send(signal: Signal) {
    const { call } = this.state;
    if (!call || !this.crypto) return;
    realtime.send({ type: 'call_signal', callId: call.id, payload: this.crypto.seal(call.id, call.peer, signal) });
  }

  private teardown() {
    clearTimeout(this.ringTimer);
    this.state.local?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
  }

  private finish(call: CallView) {
    this.set({ phase: 'ended', call, local: null, remote: null, endedLabel: endedLabel(call) });
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      if (this.state.phase === 'ended') this.set(IDLE);
    }, ENDED_SCREEN_MS);
  }

  private reset() {
    clearTimeout(this.resetTimer);
    this.teardown();
    this.state = IDLE;
  }
}

export const calls = new CallManager();

export function useCall() {
  return useSyncExternalStore(calls.subscribe, calls.get, calls.get);
}

/** Start a call and open the call screen, or explain why it couldn't start. */
export async function startCall(conversationId: string, kind: 'audio' | 'video') {
  try {
    await calls.start(conversationId, kind);
    router.push('/call');
  } catch (e) {
    notify("Couldn't start the call", callErrorMessage(e));
  }
}

export const callErrorMessage = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Please try again.');

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
