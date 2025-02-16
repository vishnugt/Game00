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
            round: 0,

            // Game Status
            statusMessage: "Waiting for connection...",
            isHost: true,
            battleLogs: [], // ✅ Added battle logs
            turnMessage: "Waiting for your move...", // ✅ Turn indicator
            moveLock: false // ✅ Lock moves after selection
        };
    },
    computed: {
        gameLink() {
            return this.myId === "" ? null : `${window.location.origin}${window.location.pathname}?id=${this.myId}`;
        }
    },
    mounted() {
        this.peer = new Peer();

        this.peer.on("open", (id) => {
            this.myId = id;

            const urlParams = new URLSearchParams(window.location.search);
            const joinId = urlParams.get("id");

            if (joinId) {
                this.isHost = false;
                this.opponentId = joinId;
                this.connectToOpponent();
            }
        });

        this.peer.on("connection", (conn) => {
            if (this.connection) return;
            this.connection = conn;
            this.setupConnection();
        });
    },
    methods: {
        copyGameLink() {
            navigator.clipboard.writeText(this.gameLink).then(() => {
                alert("Game link copied to clipboard!");
            });
        },
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
                    this.myHealth = data.health;
                    this.opponentHealth = data.health;
                    this.maxHealth = data.health;
                    this.attacks = [...data.attacks];
                    this.blocks = [...data.blocks];
                    this.usedAttacks = new Array(data.attacks.length).fill(false);
                    this.usedBlocks = new Array(data.blocks.length).fill(false);
                    this.statusMessage = "Game started! Choose your move.";
                } else if (data.type === "attack" || data.type === "block") {
                    this.opponentMove = data;
                    this.checkMoves();
                } else if (data.type === "updateHealth") {
                    this.myHealth = data.opponentHealth;
                    this.opponentHealth = data.myHealth;
                    this.moveSent = false;
                    this.myMove = null;
                    this.opponentMove = null;
                    this.moveLock = false;
                    this.turnMessage = "Waiting for your move...";
                } else if (data.type === "battleLog") {
                    // ✅ Add log from opponent
                    this.battleLogs.unshift(data.log);
                }
            });
        },
        startGameSession() {
            let health = Math.floor(Math.random() * 6) + 10;
            let attacks = Array.from({length: 5}, () => Math.floor(Math.random() * 5) + 1);
            let blocks = Array.from({length: 5}, () => Math.floor(Math.random() * 5) + 1);

            let gameData = {type: "init", health, attacks, blocks};

            this.myHealth = this.opponentHealth = this.maxHealth = health;
            this.attacks = [...attacks];
            this.blocks = [...blocks];
            this.usedAttacks = new Array(attacks.length).fill(false);
            this.usedBlocks = new Array(blocks.length).fill(false);

            this.connection.send(gameData);
        },
        makeMove(type, index) {
            if (!this.connection || this.moveSent) return;

            let value = (type === "attack") ? this.attacks[index] : this.blocks[index];
            if (type === "attack") this.usedAttacks[index] = true;
            if (type === "block") this.usedBlocks[index] = true;

            this.connection.send({type: type, value, player: this.isHost ? "host" : "opponent"});

            this.myMove = {type, value};
            this.moveSent = true;
            this.moveLock = true;
            this.turnMessage = "Waiting for opponent's move...";

            this.checkMoves();
        },
        checkMoves() {
            if (this.myMove && this.opponentMove) {
                if (this.isHost) {
                    this.processMoves();
                }
            }
        },
        processMoves() {
            if (!this.isHost || !this.myMove || !this.opponentMove) return;


            let newMyHealth = this.myHealth;
            let newOpponentHealth = this.opponentHealth;

            if (this.myMove.type === "attack" && this.opponentMove.type === "attack") {
                newOpponentHealth -= this.myMove.value;
                newMyHealth -= this.opponentMove.value;
            } else if (this.myMove.type === "attack" && this.opponentMove.type === "block") {
                newOpponentHealth = newOpponentHealth - this.myMove.value + this.opponentMove.value;
            } else if (this.opponentMove.type === "attack" && this.myMove.type === "block") {
                newMyHealth = newMyHealth - this.opponentMove.value + this.myMove.value;
            }

            this.connection.send({type: "updateHealth", myHealth: newMyHealth, opponentHealth: newOpponentHealth});

            this.myHealth = newMyHealth;
            this.opponentHealth = newOpponentHealth;

            let log = "Round " + ++this.round + ": ";
            if(this.myHealth > this.opponentHealth) {
                log += "Player1 leading by " + (this.myHealth - this.opponentHealth);
            } else if (this.myHealth < this.opponentHealth) {
                log += "Player2 leading by " + (this.opponentHealth - this.myHealth);
            } else {
                log += "Score tied"
            }
            this.battleLogs.unshift(log);
            this.connection.send({type: "battleLog", log});

            this.myMove = null;
            this.opponentMove = null;
            this.moveSent = false;
            this.moveLock = false;
            this.turnMessage = "Waiting for your move...";
        }
    }
});

app.mount("#app");
