const fetch = require("node-fetch");
const url = require("url");

function sleep(time) {
  return new Promise((res) => setTimeout(res, time));
}

function request(url, body) {
  return fetch(`https://discord.com/api/v8${url}`, {
    body: JSON.stringify(body),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "",
    },
  });
}

async function logInto(qr) {
  const pathname = url.parse(qr).pathname;
  if (!pathname.startsWith("/rp/")) {
    return console.error("This isn't a Discord QR code");
  }
  const fingerprint = pathname.substring(4);
  const handshake = await request("/users/@me/remote-auth", {
    fingerprint,
  }).then((res) => res.json());
  console.log("Got handshake", handshake);
  const handshakeToken = handshake.handshake_token;

  await sleep(10000);
  const response = await request("/users/@me/remote-auth/finish", {
    temporary_token: false,
    handshake_token: handshakeToken,
  });
  console.log("Got response", response);
  console.log("Got response", await response.text());
}

module.exports = {logInto};
