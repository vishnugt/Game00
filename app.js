const app = Vue.createApp({
    data() {
        return {
            peer: null,
            myId: "",
            opponentId: "",
            connection: null,
            opponentMove: null,
            moveSent: false,
            gameStarted: false,

            // Health & Moves
            myHealth: 0,
            opponentHealth: 0,
            maxHealth: 0,
            attacks: [],
            blocks: [],
            usedAttacks: [],
            usedBlocks: [],

            // Game Status
            statusMessage: "Waiting for connection...",
            isHost: true
        };
    },
    computed: {
        gameLink() {
            return `${window.location.origin}${window.location.pathname}?id=${this.myId}`;
        }
    },
    mounted() {
        this.peer = new Peer();

        this.peer.on("open", (id) => {
            this.myId = id;
            this.statusMessage = `Your ID: ${id}`;

            const urlParams = new URLSearchParams(window.location.search);
            const joinId = urlParams.get("id");

            if (joinId) {
                this.isHost = false;
                this.opponentId = joinId;
                this.connectToOpponent();
            }
        });

        this.peer.on("connection", (conn) => {
            if (this.connection) return; // Prevent multiple connections
            this.connection = conn;
            this.setupConnection();
        });
    },
    methods: {
        connectToOpponent() {
            if (!this.opponentId) return;
            this.connection = this.peer.connect(this.opponentId);
            this.setupConnection();
        },
        setupConnection() {
            if (!this.connection) return;

            this.connection.on("open", () => {
                this.statusMessage = "Connected! Syncing game...";
                this.gameStarted = true;

                if (this.isHost) {
                    this.startGameSession();
                }
            });

            this.connection.on("data", (data) => {
                if (data.type === "init") {
                    // Both host and opponent process this
                    this.myHealth = data.health;
                    this.opponentHealth = data.health;
                    this.maxHealth = data.health;
                    this.attacks = [...data.attacks];
                    this.blocks = [...data.blocks];
                    this.usedAttacks = new Array(data.attacks.length).fill(false);
                    this.usedBlocks = new Array(data.blocks.length).fill(false);
                    this.statusMessage = "Game started! Choose your move.";
                } else if (data.type === "attack" || data.type === "block") {
                    this.opponentMove = data;  // ✅ Store opponent move
                    this.checkMoves();         // ✅ Check if both moves are made
                } else if (data.type === "updateHealth") {
                    this.myHealth = data.opponentHealth;  // ✅ Update local health
                    this.opponentHealth = data.myHealth;  // ✅ Sync opponent's health
                    this.moveSent = false;                // ✅ Reset move state
                    this.myMove = null;                   // ✅ Clear move data
                    this.opponentMove = null;
                }
            });
        }
        ,
        startGameSession() {
            let health = Math.floor(Math.random() * 6) + 10; // Random 10-15
            let attacks = Array.from({length: 5}, () => Math.floor(Math.random() * 5) + 1);
            let blocks = Array.from({length: 5}, () => Math.floor(Math.random() * 5) + 1);

            let gameData = {type: "init", health, attacks, blocks};

            // Host also updates its own UI
            this.myHealth = this.opponentHealth = this.maxHealth = health;
            this.attacks = [...attacks];
            this.blocks = [...blocks];
            this.usedAttacks = new Array(attacks.length).fill(false);
            this.usedBlocks = new Array(blocks.length).fill(false);

            this.connection.send(gameData);
        }
        ,

        makeMove(type, index) {
            if (!this.connection || this.moveSent) return;

            let value = (type === "attack") ? this.attacks[index] : this.blocks[index];

            if(type === "attack") {
                this.usedAttacks[index] = true;
            }
            if(type === "block") {
                this.usedBlocks[index] = true;
            }


            console.log("Sending move:", {type, value}); // 🔍 Debug log

            this.connection.send({type: type, value, player: this.isHost ? "host" : "opponent"});

            this.myMove = {type, value};
            this.moveSent = true;  // ✅ Player has sent a move

            this.checkMoves();  // ✅ Check if both moves are made
        }


        , checkMoves() {
            if (this.myMove && this.opponentMove) {
                console.log("Both players moved, processing moves..."); // 🔍 Debug log

                if (this.isHost) {  // ✅ Only the host processes moves
                    this.processMoves();
                }
            }
        }

        ,
        processMoves() {
            if (!this.isHost) return; // ✅ Only the host processes moves

            if (!this.myMove || !this.opponentMove) return; // Wait for both moves

            console.log("Received opponentMove:", JSON.stringify(this.opponentMove));
            console.log("My Move:", JSON.stringify(this.myMove));

            console.log("Before Processing:", this.myHealth, this.opponentHealth);


            let myAction = this.myMove.type;
            let myValue = this.myMove.value;
            let opponentAction = this.opponentMove.type;
            let opponentValue = this.opponentMove.value;
            console.log(`Processing Moves: My (${myAction}, ${myValue}) vs Opponent (${opponentAction}, ${opponentValue})`);

            let newMyHealth = this.myHealth;
            let newOpponentHealth = this.opponentHealth;

            if (myAction === "attack" && opponentAction === "attack") {
                newOpponentHealth -= myValue;
                newMyHealth -= opponentValue;
            } else if (myAction === "attack" && opponentAction === "block") {
                newOpponentHealth = newOpponentHealth - myValue + opponentValue;
            } else if (opponentAction === "attack" && myAction === "block") {
                newMyHealth = newMyHealth - opponentValue + myValue;
            }


            // ✅ Send new health to opponent
            this.connection.send({type: "updateHealth", myHealth: newMyHealth, opponentHealth: newOpponentHealth});

            // ✅ Update health locally
            this.myHealth = newMyHealth;
            this.opponentHealth = newOpponentHealth;

            this.myMove = null;
            this.opponentMove = null;
            this.moveSent = false;
            console.log("After Processing:", newMyHealth, newOpponentHealth);
        }
        ,
        copyLink() {
            navigator.clipboard.writeText(this.gameLink)
                .then(() => alert("Link copied!"))
                .catch(err => console.error("Copy failed:", err));
        }
    }
});

app.mount("#app");
