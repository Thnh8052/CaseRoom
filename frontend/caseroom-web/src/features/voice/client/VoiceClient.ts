import * as signalR from "@microsoft/signalr";

type VoicePeer = {
  id: string;
  name: string;
  currentRoomId: string;
};

type VoiceClientOptions = {
  apiBaseUrl: string;
  sessionId: string;
  playerId: string;
  onPeersChanged?: (peers: VoicePeer[]) => void;
  onTalkingChanged?: (playerId: string, isTalking: boolean) => void;
  onStatus?: (message: string) => void;
};

/**
 * Lớp chịu trách nhiệm quản lý kết nối WebRTC P2P (Peer-to-Peer).
 * Quản lý danh sách Peer, tạo SDP Offer/Answer, trao đổi ICE Candidate thông qua SignalR (VoiceHub).
 */
export class VoiceClient {
  private connection?: signalR.HubConnection;
  private localStream?: MediaStream;
  private peers = new Map<string, RTCPeerConnection>();
  private remoteAudios = new Map<string, HTMLAudioElement>();
  private readonly options: VoiceClientOptions;
  private isPttActive = false;

  constructor(options: VoiceClientOptions) {
    this.options = options;
  }

  /**
   * Khởi tạo luồng Microphone và kết nối tới SignalR VoiceHub.
   * Lắng nghe các sự kiện SDP/ICE Candidate từ những người cùng phòng.
   */
  async start() {
    this.options.onStatus?.("Requesting microphone permission...");
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    this.setLocalMicEnabled(false);

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.options.apiBaseUrl}/hubs/voice`)
      .withAutomaticReconnect()
      .build();

    this.connection.on("VoicePeersChanged", async (peers: VoicePeer[]) => {
      this.options.onPeersChanged?.(peers);
      await this.rebuildPeers(peers);
    });

    this.connection.on("ReceiveOffer", async (payload: { fromPlayerId: string; offer: RTCSessionDescriptionInit }) => {
      if (!payload.fromPlayerId) return;
      const pc = this.getOrCreatePeer(payload.fromPlayerId);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.connection?.invoke("SendAnswer", payload.fromPlayerId, answer);
    });

    this.connection.on("ReceiveAnswer", async (payload: { fromPlayerId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = this.peers.get(payload.fromPlayerId);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
    });

    this.connection.on("ReceiveIceCandidate", async (payload: { fromPlayerId: string; candidate: RTCIceCandidateInit }) => {
      const pc = this.peers.get(payload.fromPlayerId);
      if (!pc || !payload.candidate) return;
      await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });

    this.connection.on("VoicePeerDisconnected", (playerId: string) => {
      this.closePeer(playerId);
    });

    this.connection.on("PlayerStartedTalking", (playerId: string) => {
      this.options.onTalkingChanged?.(playerId, true);
    });

    this.connection.on("PlayerStoppedTalking", (playerId: string) => {
      this.options.onTalkingChanged?.(playerId, false);
    });

    this.connection.on("VoiceError", (message: string) => this.options.onStatus?.(`Voice error: ${message}`));

    await this.connection.start();
    await this.connection.invoke("RegisterVoice", this.options.sessionId, this.options.playerId);
    this.options.onStatus?.("Voice connected. Hold V or the mic button to talk.");
  }

  /**
   * Đóng toàn bộ kết nối P2P cũ và báo cho Server để nhận danh sách Peer mới cho phòng hiện tại.
   */
  async refreshRoom() {
    this.closeAllPeers();
    await this.connection?.invoke("RefreshVoiceRoom", this.options.sessionId, this.options.playerId);
  }

  /**
   * Bật/Tắt Microphone cục bộ và gửi lệnh StartTalking/StopTalking lên Server để hiện UI "Đang nói".
   */
  async setPushToTalk(active: boolean) {
    if (!this.connection || !this.localStream || this.isPttActive === active) return;

    this.isPttActive = active;
    this.setLocalMicEnabled(active);

    if (active) {
      await this.connection.invoke("StartTalking");
    } else {
      await this.connection.invoke("StopTalking");
    }
  }

  async stop() {
    await this.setPushToTalk(false);
    this.closeAllPeers();
    this.localStream?.getTracks().forEach(track => track.stop());
    await this.connection?.stop();
  }

  /**
   * Dựng lại danh sách PeerConnection khi danh sách người trong phòng thay đổi.
   * Logic bắt cặp WebRTC: Người có chuỗi ID nhỏ hơn (theo alphabe) sẽ đóng vai trò Caller (Tạo Offer).
   */
  private async rebuildPeers(peers: VoicePeer[]) {
    const remotePeers = peers.filter(p => p.id !== this.options.playerId);
    const remoteIds = new Set(remotePeers.map(p => p.id));

    for (const peerId of Array.from(this.peers.keys())) {
      if (!remoteIds.has(peerId)) {
        this.closePeer(peerId);
      }
    }

    for (const peer of remotePeers) {
      if (this.peers.has(peer.id)) continue;

      const shouldOffer = this.options.playerId.localeCompare(peer.id) < 0;
      const pc = this.getOrCreatePeer(peer.id);

      if (shouldOffer) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.connection?.invoke("SendOffer", peer.id, offer);
      }
    }
  }

  /**
   * Lấy RTCPeerConnection có sẵn, hoặc tạo mới nếu chưa tồn tại.
   * Khởi tạo ICE Servers (STUN), nạp luồng âm thanh Mic vào, và bắt luồng Remote Audio gắn vào thẻ <audio>.
   */
  private getOrCreatePeer(peerId: string) {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    this.localStream?.getTracks().forEach(track => {
      this.localStream && pc.addTrack(track, this.localStream);
    });

    pc.onicecandidate = async event => {
      if (event.candidate) {
        await this.connection?.invoke("SendIceCandidate", peerId, event.candidate);
      }
    };

    pc.ontrack = event => {
      const [stream] = event.streams;
      let audio = this.remoteAudios.get(peerId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.dataset.peerId = peerId;
        document.body.appendChild(audio);
        this.remoteAudios.set(peerId, audio);
      }
      audio.srcObject = stream;
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private closePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    pc?.close();
    this.peers.delete(peerId);

    const audio = this.remoteAudios.get(peerId);
    audio?.remove();
    this.remoteAudios.delete(peerId);
  }

  private closeAllPeers() {
    for (const peerId of Array.from(this.peers.keys())) {
      this.closePeer(peerId);
    }
  }

  private setLocalMicEnabled(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
  }
}
