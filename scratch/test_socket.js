import { io } from 'socket.io-client';

console.log('Connecting to socket server at http://localhost:3001...');
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Socket successfully connected! ID:', socket.id);
  
  // Listen for order events
  socket.on('new_order', (data) => {
    console.log('Received new_order event:', data);
  });
  
  socket.on('kitchen_order', (data) => {
    console.log('Received kitchen_order event:', data);
  });

  socket.on('order_updated', (data) => {
    console.log('Received order_updated event:', data);
  });

  console.log('Waiting 5 seconds for any events, then closing...');
  setTimeout(() => {
    socket.disconnect();
    console.log('Socket disconnected.');
  }, 5000);
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err.message);
});
