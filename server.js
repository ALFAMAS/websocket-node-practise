import mongoose from 'mongoose';
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { availableParallelism } from 'node:os';
import cluster from 'node:cluster';
import { createAdapter, setupPrimary } from '@socket.io/cluster-adapter';
import axios from 'axios';

if (cluster.isPrimary) {
  const numCPUs = availableParallelism();
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork({
      PORT: 3000 + i
    });
  }

  setupPrimary();
} else {
  mongoose.connect('mongodb://0.0.0.0:27017/chat', {});

  const messageSchema = new mongoose.Schema({
    client_offset: { type: String, unique: true },
    content: String
  });

  const Message = mongoose.model('Message', messageSchema);

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {},
    adapter: createAdapter()
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
  });

  const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NTMzODk3YmU2YjU0YzBmNzQwODBmYzIiLCJpYXQiOjE3MDEwOTM3MjIsImV4cCI6MTcwMTE4MDEyMn0.AFmlc91fBzWRVy0doR65ApIIc7_MNPCaWCJk__mpRBI";



  io.on('connection', async (socket) => {
    try {
      const request1 = await axios.post('http://localhost:1337/api/v3/search',
        {
          "filter": {
            "directFlightOnly": false,
            "cabinClass": "M",
            "airline": []
          },
          "routes": [
            {
              "origin": "DAC",
              "destination": "CGP",
              "departureDate": "12-12-2023"
            }
          ],
          "passenger": {
            "adult": 1,
            "child": 0,
            "infant": 0
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + TOKEN
          }
        });
      const request2 = await axios.post('http://localhost:1337/api/v4/search',
        {
          "filter": {
            "directFlightOnly": false,
            "cabinClass": "M",
            "airline": []
          },
          "routes": [
            {
              "origin": "DAC",
              "destination": "DXB",
              "departureDate": "12-12-2023"
            }
          ],
          "passenger": {
            "adult": 1,
            "child": 0,
            "infant": 0
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + TOKEN
          }
        }
      );

      const responses = [];

      Promise.race([request1, request2])
        .then(response => {
          responses.push(response.data);
          socket.emit('api data', { data: responses });
        })
        .catch(error => {
          socket.emit('error', 'Error fetching data from APIs');
        });

      Promise.all([request1, request2])
        .then(([response1, response2]) => {
          responses.push(response1.data, response2.data);
          socket.emit('api data', { data: responses });
        })
        .catch(error => {
          socket.emit('error', 'Error fetching data from APIs');
        });

    } catch (error) {
      socket.emit('error', 'Error fetching data from APIs');
    }
  });

  const port = process.env.PORT;

  console.log(port)

  server.listen(port, () => {
    console.log(`server running at http://localhost:${port}`);
  });
}