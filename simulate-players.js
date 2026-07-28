const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:3000';
const SESSION_ID = 2;
const NUM_BOTS = 3;

/** Simula un jugador virtual que envía tracking de posición VR en tiempo real. */
class VirtualPlayer {
  constructor(id) {
    this.id = id;
    this.ws = null;
    this.intervalId = null;
    const centerX = -9.74944;
    const centerY = 0.88;
    const centerZ = -8.76468;
    this.x = centerX + (Math.random() * 4 - 2);
    this.y = centerY;
    this.z = centerZ + (Math.random() * 4 - 2);
    this.angle = Math.random() * Math.PI * 2;
  }

  connect() {
    this.ws = new WebSocket(SERVER_URL);

    this.ws.on('open', () => {
      console.log(`[${this.id}] Conectado al servidor WebSocket. Enviando LOGIN_PLAYER...`);
      
      // Send LOGIN_PLAYER
      this.send('LOGIN_PLAYER', {
        studentId: this.id,
        sessionId: SESSION_ID
      });

      // Start movement simulation
      this.startSimulation();
    });

    this.ws.on('message', (messageStr) => {
      try {
        const message = JSON.parse(messageStr);
        if (message.event === 'REMOTE_PLAYER_UPDATE') {
          const { playerId, x, y, z } = message.data;
          // Throttled logging of remote players' movements (1% chance to print to keep log readable)
          if (Math.random() < 0.01) {
            console.log(`[${this.id}] Recibió REMOTE_PLAYER_UPDATE de ${playerId}: x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)}`);
          }
        }
      } catch (err) {
        // Ignore unparseable messages or other types
      }
    });

    this.ws.on('close', () => {
      console.log(`[${this.id}] Conexión cerrada.`);
      this.stopSimulation();
    });

    this.ws.on('error', (error) => {
      console.error(`[${this.id}] Error de conexión:`, error.message);
    });
  }

  send(event, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  startSimulation() {
    const centerX = -9.74944;
    const centerY = 0.02395;
    const centerZ = -8.76468;
    // 16ms = ~60 FPS/Hz
    this.intervalId = setInterval(() => {
      // Move in a circular path around the center with slight random noise
      this.angle += 0.03;
      this.x = centerX + 3 * Math.cos(this.angle) + (Math.random() * 0.05 - 0.025);
      this.y = centerY + Math.sin(this.angle * 2) * 0.1; // slight bobbing around base Y
      this.z = centerZ + 3 * Math.sin(this.angle) + (Math.random() * 0.05 - 0.025);

      const trackingPayload = JSON.stringify({
        event: "TRACKING_DATA",
        data: {
          playerId: this.id,
          sessionId: SESSION_ID,
          x: this.x,
          y: this.y,
          z: this.z
        }
      });
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(trackingPayload);
      }
    }, 16);
  }

  stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  disconnect() {
    this.stopSimulation();
    if (this.ws) {
      this.ws.close();
    }
  }
}

console.log(`Iniciando simulación de ${NUM_BOTS} jugadores virtuales en la sesión ${SESSION_ID}...`);
const bots = [];
for (let i = 1; i <= NUM_BOTS; i++) {
  const botId = `BOT-0${i}`;
  const player = new VirtualPlayer(botId);
  player.connect();
  bots.push(player);
}

// Handle exit signals to close sockets gracefully
const handleExit = () => {
  console.log('\nCerrando simulación de jugadores...');
  bots.forEach((bot) => bot.disconnect());
  process.exit();
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
