require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// ----------------------
// In-memory Host Details
// ----------------------

let currentHost = {
    socketId: null,
    peerId: null,
    streamCode: null,
    live: false,
};

// ----------------------
// REST APIs
// ----------------------

app.get("/", (req, res) => {
    res.send("Peer Video Streaming Backend");
});

app.get("/status", (req, res) => {
    res.json({
        live: currentHost.live,
    });
});

app.get("/host/:code", (req, res) => {
    const code = req.params.code;

    if (currentHost.live && currentHost.streamCode === code) {
        return res.json({
            peerId: currentHost.peerId,
        });
    }

    res.status(404).json({
        message: "Stream not found",
    });
});

// ----------------------
// PeerJS
// ----------------------

const peerServer = ExpressPeerServer(server, {
    path: "/",
});

app.use("/peerjs", peerServer);

// ----------------------
// Socket.IO
// ----------------------
function generateStreamCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on("connection", (socket) => {
    console.log("Connected :", socket.id);

    socket.on("host-start", (peerId, callback) => {
        const streamCode = generateStreamCode();

        currentHost = {
            socketId: socket.id,

            peerId,

            streamCode,

            live: true,
        };

        console.log(currentHost);

        io.emit("stream-live");

        callback(streamCode);
    });

    socket.on("host-stop", () => {
        if (socket.id === currentHost.socketId) {
            currentHost = {
                socketId: null,
                peerId: null,
                live: false,
            };

            console.log("Host Stopped");

            io.emit("stream-ended");
        }
    });

    socket.on("disconnect", () => {
        console.log("Disconnected :", socket.id);

        if (socket.id === currentHost.socketId) {
            currentHost = {
                socketId: null,
                peerId: null,
                live: false,
            };

            console.log("Host Disconnected");

            io.emit("stream-ended");
        }
    });
});

// ----------------------
// Start Server
// ----------------------

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server Running on ${PORT}`);
});
