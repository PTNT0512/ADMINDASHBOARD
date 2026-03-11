import Utils from "../common/Utils";
import NetworkListener from "./Network.NetworkListener";

export default class NetworkClient {
    ws: WebSocket = null;
    host: string = "";
    port: number = 0;
    isForceClose = false;
    isUseWSS: boolean = false;
    isAutoReconnect: boolean = true;
    retryCount = 0;

    _onOpenes: Array<NetworkListener> = [];
    _onCloses: Array<NetworkListener> = [];

    private isLocalHost(host: string): boolean {
        if (!host) return true;
        const lower = host.toLowerCase();
        if (lower === "localhost" || lower === "127.0.0.1" || lower === "0.0.0.0" || lower === "::1") {
            return true;
        }
        if (lower.indexOf("192.168.") === 0 || lower.indexOf("10.") === 0 || lower.indexOf("172.") === 0) {
            return true;
        }
        return false;
    }

    private shouldUseWss(host: string): boolean {
        if (!this.isUseWSS) return false;
        if (this.isLocalHost(host)) return false;
        return true;
    }

    private buildSocketUrl(host: string, port: number): string {
        const protocol = this.shouldUseWss(host) ? "wss" : "ws";
        return protocol + "://" + host + ":" + port + "/websocket";
    }

    connect(host: string, port: number) {
        //  //Utils.Log("start connect: " + host + ":" + port + " =>" + cc.url.raw("resources/raw/cacert.pem"));
        this.isForceClose = false;
        this.host = host;
        this.port = port;
        if (this.ws == null) {
            const socketUrl = this.buildSocketUrl(host, port);
            cc.log("[NetworkClient] connecting:", socketUrl);

            if (cc.sys.isBrowser) {
                this.ws = new WebSocket(socketUrl);
            } else {
                if (cc.sys.isNative && cc.sys.os == cc.sys.OS_ANDROID) {
                    if (this.shouldUseWss(host)) {
                        this.ws = new WebSocket(socketUrl, [], cc.url.raw("resources/raw/cacert.pem"));
                    } else {
                        this.ws = new WebSocket(socketUrl);
                    }
                    this.ws.binaryType = "arraybuffer";
                } else {
                    this.ws = new WebSocket(socketUrl);
                }
            }
            this.ws.binaryType = "arraybuffer";
            this.ws.onopen = this.onOpen.bind(this);
            this.ws.onmessage = this.onMessage.bind(this);
            this.ws.onerror = this.onError.bind(this);
            this.ws.onclose = this.onClose.bind(this);

        } else {
            if (this.ws.readyState !== WebSocket.OPEN) {
                this.ws.close();
                this.ws = null;
                this.connect(host, port);
            }
        }
    }

    protected onOpen(ev: Event) {
        cc.log("[NetworkClient] connected:", this.buildSocketUrl(this.host, this.port));
        this.retryCount = 0;
        for (var i = 0; i < this._onOpenes.length; i++) {
            var listener = this._onOpenes[i];
            if (listener.target && listener.target instanceof Object && listener.target.node) {
                listener.callback(null);
            } else {
                this._onOpenes.splice(i, 1);
                i--;
            }
        }
    }

    protected onMessage(ev: MessageEvent) {
        //  //Utils.Log("onmessage: " + ev.data);
    }

    protected onError(ev: Event) {
        cc.log("[NetworkClient] error:", this.host + ":" + this.port);
    }

    protected onClose(ev: Event) {
        cc.log("[NetworkClient] closed:", this.host + ":" + this.port);
        for (var i = 0; i < this._onCloses.length; i++) {
            var listener = this._onCloses[i];
            if (listener.target && listener.target instanceof Object && listener.target.node) {
                listener.callback(null);
            } else {
                this._onCloses.splice(i, 1);
                i--;
            }
        }
        if (this.isAutoReconnect && !this.isForceClose) {
            setTimeout(() => {
                if (!this.isForceClose) this.connect(this.host, this.port);
            }, 2000);
        }
    }

    addOnOpen(callback: () => void, target: cc.Component) {
        this._onOpenes.push(new NetworkListener(target, callback));
    }

    addOnClose(callback: () => void, target: cc.Component) {
        this._onCloses.push(new NetworkListener(target, callback));
    }

    close() {
        this.isForceClose = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected() {
        if (this.ws) {
            return this.ws.readyState == WebSocket.OPEN;
        }
        return false;
    }
}
