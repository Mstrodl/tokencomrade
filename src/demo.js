const QRCode = require("qrcode-svg");

function create() {
  function setup(timeout, heartbeatInterval) {
    // Just in case
    lastAck = Date.now();
    interval = setInterval(() => {
      send({ op: "heartbeat" });

      if (lastAck) {
        lastAck = null;
      } else {
        console.log("Ack timeout..");
        ws.close();
      }
    }, heartbeatInterval);
  }

  let interval;
  let key;
  let lastAck = null;
  const ws = new WebSocket("wss://remote-auth-gateway.discord.gg/?v=1");
  ws.addEventListener("close", () => {
    clearInterval(interval);
    create();
  });
  ws.addEventListener("message", async frame => {
    const msg = JSON.parse(frame.data);

    // { timeout_ms: 120000, op: "hello", heartbeat_interval: 41250 }
    if (msg.op == "hello") {
      key = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256"
        },
        !0,
        ["decrypt"]
      );

      setup(msg.timeout_ms, msg.heartbeat_interval);

      const result = await window.crypto.subtle.exportKey(
        "spki",
        key.publicKey
      );
      const keyString = btoa(
        String.fromCharCode.apply(String, new Uint8Array(result))
      );
      send({ op: "init", encoded_public_key: keyString });
    } else if (msg.op == "nonce_proof") {
      const decrypted = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        key.privateKey,
        str2buf(msg.encrypted_nonce)
      );
      const digest = await crypto.subtle.digest("SHA-256", decrypted);
      send({ op: "nonce_proof", proof: buf2b64url(digest) });
    } else if (msg.op == "pending_remote_init") {
      const qr = new QRCode({
        content: "https://discordapp.com/ra/" + msg.fingerprint,
        container: "svg-viewbox",
        join: true
      });
      document.getElementById("code").innerHTML = qr.svg();
    } else if (msg.op == "pending_finish") {
      const decrypted = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        key.privateKey,
        str2buf(msg.encrypted_user_payload)
      );
      console.log(buf2str(decrypted));
      // 196769986071625728:1212:d0900b8fe361c755549ab0beadb35075:Mary
      const data = buf2str(decrypted).split(":");
      const [id, discriminator, avatarHash, username] = data;
      document.getElementById("username").innerText =
        username + "#" + discriminator;
      document.getElementById("avatar").src =
        "https://cdn.discordapp.com/avatars/" +
        id +
        "/" +
        avatarHash +
        ".png?size=2048";
    } else if (msg.op == "finish") {
      const decrypted = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        key.privateKey,
        str2buf(msg.encrypted_token)
      );
      document.getElementById("token").innerText = buf2str(decrypted);
    } else if (msg.op == "heartbeat_ack") {
      lastAck = Date.now();
    }
  });

  function send(data) {
    ws.send(JSON.stringify(data));
  }
}

const tokenElem = document.getElementById("token");
tokenElem.addEventListener("click", () => {
  navigator.clipboard.writeText(tokenElem.innerText);
});

function buf2b64url(n) {
  return btoa(String.fromCharCode.apply(String, new Uint8Array(n)))
    .replace(/\//g, "_")
    .replace(/\+/g, "-")
    .replace(/={1,2}$/, "");
}

function buf2str(n) {
  return new TextDecoder().decode(n);
}

function str2buf(e) {
  return Uint8Array.from(atob(e), function(e) {
    return e.charCodeAt(0);
  });
}

create();
