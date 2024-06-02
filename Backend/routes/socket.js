/**
 * socket code file - websocket communication between server and client
 */

const jwt = require('jsonwebtoken'); //to deal with authentication based in tokens 
const user = require('../models/user.js'); //database use model
const item = require('../models/item.js');
const secret = 'this is the secret secret secret 12356'; // same secret as in api.js used here to verify the authentication token

var socketIDbyUsername = new Map(); // map to store clients the client object with username has key
var usernamebySocketID = new Map(); // map to store clients the client object with socketid has key
var ioSocket = null; // global store object for websocket

var IntervalId = setInterval(async function () {
    
  // decrement remaining time for all items with remaining time greater than 0
  await item.updateMany(
    { remainingtime: { $gt: 0 } },
    { $inc: { remainingtime: -1 } },
    { multi: true }
  );

  // find the new sold items (remaining time less than 0 and not marked as sold) OR (current bid is equal to buy now price and not marked as sold)
  const newSoldItems = await item.find({ $or: [{ remainingtime: 0 }, { $expr: { $gte: ["$currentbid", "$buynow"] } }], sold: false });

  // mark the new sold items as sold
  await item.updateMany(
    { $or: [{ remainingtime: 0 }, { $expr: { $gte: ["$currentbid", "$buynow"] } }], sold: false },
    { $set: { sold: true } },
    { multi: true }
  );

  // find all unsold items
  const unsoldItems = await item.find({ sold: false });

  // broadcast the unsold and new sold items to all active clients
  exports.UpdateItemsBroadcast(unsoldItems);
  exports.SoldItemsBroadcast(newSoldItems);

}, 1000); // 1000 milliseconds is the interval time



/*
broadcasts an event to to all logged clients with the new updated items (all items that remain unsold)
*/
exports.UpdateItemsBroadcast = function (updatedItems) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the login:item event
      ioSocket.to(socketID).emit('update:items', updatedItems);
    }
  }
}

/*
broadcasts an event to to all logged clients with the new sold items ()
 */
exports.SoldItemsBroadcast = function (soldItems) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the login:item event
      ioSocket.to(socketID).emit('sold:items', soldItems);
    }
  }
}



/*
broadcasts an event to to all logged clients with the new created item
*/
exports.NewItemBroadcast = function (newItem) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the new:item event
      ioSocket.to(socketID).emit('new:item', newItem);
    }
  }
}

/*
broadcasts an event to to all logged clients with the new removed item
*/
exports.RemoveItemBroadcast = function (removedItem) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the remove:item event
      ioSocket.to(socketID).emit('remove:item', removedItem);
    }
  }
}



/*
broadcasts an event to to all logged clients with the new logged in client
 */
exports.UserLoggedInBroadcast = function (loggedInUser) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the login:item event
      ioSocket.to(socketID).emit('login:user', loggedInUser);
    }
  }
}

/*
broadcasts an event to to all logged clients with the new logged out client
*/
exports.UserLoggedOutBroadcast = function (loggedOutUser) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the logout:item event
      ioSocket.to(socketID).emit('logout:user', loggedOutUser);
    }
  }
}



/*
export function for listening to the socket
*/
exports.StartSocket = (io) => {

  ioSocket = io; // store socket object for use in interval (timer) function

  //set up jwt authentication in the socket
  io.use((socket, next) => {
    if (socket.handshake.query && socket.handshake.query.token) {
      jwt.verify(socket.handshake.query.token, secret, function (err, decoded) {
        if (err) return next(new Error('Authentication error'));
        socket.decoded_token = decoded;
        next();
      });
    } else {
      next(new Error('Authentication error'));
    }
  });

  console.log('Socket Started!');

  io.on('connection', (socket) => {  // first time it is called is when the client connects sucessfully

    console.log(socket.decoded_token.username, 'user connected'); // shows username in the valid token sent by client

    socketIDbyUsername.set(socket.decoded_token.username, socket.id); // store socket id in the Map
    usernamebySocketID.set(socket.id, socket.decoded_token.username); // store username in the Map

    /*
     * Event Handlers:
     * - userLogIn:username: Handles user login events. Broadcasts the new logged-in user to all clients.
     * - userLogOut:username: Handles user logout events. Broadcasts the logged-out user to all clients.
     * - submit:bid: Handles bid submission events. Updates the bid for an item in the database and broadcasts the updated item to all clients if the new bid is higher than the current bid.
     * - send:message: Handles message sending events. Relays the message to the destination user if online.
     * - disconnect: Handles disconnection events. Cleans up resources and updates the user database.
     */


    //event to receive logged out users and broadcast to all clients the new logged out user
    socket.on('userLogOut:user', data => {
      console.log("logOutUser:user-> User logout event received: ", data);
      // broadcast to all clients the logged out user and update the user database
      UserLoggedOutBroadcast(data);
      user.updateOne({ username: username }, { $set: { islogged: false } });
    });

    // Event to receive bids and update the item with the new bid if it is higher than the current bid
    socket.on('submit:bid', async data => {
      console.log("submit:bid -> Received event submit:bid with data = ", data);
      try {
        // update the item with the new bid if it is higher than the current bid
        const updated_item = await item.findOneAndUpdate(
          { description: data.item.description, owner: data.item.owner, currentbid: { $lt: data.bid } },
          { $set: { currentbid: data.bid, wininguser: usernamebySocketID.get(socket.id) } },
          { new: true }
        );
        // log the updated item
        if (updated_item) {
          console.log("submit:bid -> Item updated: ", updated_item);
        }

      } catch (error) {
        console.log("submit:bid -> Error updating item: ", error);
      }
    });
    

    // Event to receive messages and relay to destination, server is not yet sending this event
    socket.on('send:message', chat => {
      console.log("send:message -> Received event send:message with data =", chat);

      // Check if the destination user is logged in and connected to the socket
      const destinationSocketID = socketIDbyUsername.get(chat.destination);

      if (destinationSocketID) {
        // Destination user found, send the message
        console.log("send:message -> User found, sending message");
        io.to(destinationSocketID).emit('receive:message', { sender: usernamebySocketID.get(socket.id) , message: chat.message, receiver: chat.destination });

      } else {
        // Destination user not found or not connected, handle the error
        console.log("send:message -> User not found or not connected, message not sent");
        // You may choose to send a response back to the sender indicating that the message couldn't be delivered
        // For example: io.to(socket.id).emit('message:notDelivered', { error: 'User not found or not connected' });
      }
    });

    //when a user leaves this event is executed, cleanup what you need here, for example, update user database
    socket.on('disconnect', function () {
      console.log("User disconnected");
      const username = usernamebySocketID.get(socket.id); // get username from socketId in the Map

      // remove entries for the disconnected user from the Maps
      socketIDbyUsername.delete(username); // delete the user from the Map
      usernamebySocketID.delete(socket.id); // delete the user from the Map

      // set isLogged = false in the user database
      user.findOneAndUpdate(
        { username: username },
        { $set: { islogged: false } },
        { new: true}
        
      ).then( (updatedUser) => {
        if (updatedUser) {

          console.log("User logged out: ", updatedUser);
          // broadcast the logged out user to all clients
          exports.UserLoggedOutBroadcast(updatedUser);

        } else {
          console.log("User not found in the database");
        }
      });
    });

  });
}
