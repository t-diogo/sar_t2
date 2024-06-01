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

  var IntervalId = setInterval(function () {
    
    // decrement remaining time for all items with remaining time greater than 0
    item.updateMany({ remainingtime: { $gt: 0 } }, { $inc: { remainingtime: -1 } });
    // broadcast to all clients the updated items
    if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
      for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the login:item event
        ioSocket.to(socketID).emit('update:items', item.find());
      }
    }

    
    // find all items with remaining time equal to 0 and not marked as sold
    item.find({ remainingtime: 0, sold: false })
      .then((unsold_items) => {
        if (unsold_items) {
          // for each item set sold = true
          unsold_items.forEach((item) => {
            item.updateOne({ id: item.id }, { $set: { sold: true } });
            // broadcast to all clients the item marked as sold
            this.SoldItemsBroadcast(item);
          });
        }
      });
    

  }, 1000); // 1000 milliseconds is the interval time

/*
broadcasts an event to to all logged clients with the new LoggedIn client
*/
exports.UpdateItemsBroadcast = function (updatedItems) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the login:item event
      ioSocket.to(socketID).emit('update:items', updatedItems);
    }
  }
}


/*
broadcasts an event to to all logged clients with the new LoggedIn client
 */
exports.SoldItemsBroadcast = function (soldItems) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the login:item event
      ioSocket.to(socketID).emit('sold:items', soldItems);
    }
  }
}

/*
broadcasts an event to to all logged clients with the new LoggedIn client
 */
exports.UnsoldItemsBroadcast = function (unsoldItems) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the login:item event
      ioSocket.to(socketID).emit('unsold:items', unsoldItems);
    }
  }
}

/*
broadcasts an event to to all logged clients with the new LoggedIn client
 */
exports.UserLoggedInBroadcast = function (loggedInUser) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the login:item event
      ioSocket.to(socketID).emit('login:user', loggedInUser);
    }
  }
}

/*
broadcasts an event to to all logged clients with the new LoggedOut client
*/
exports.UserLoggedOutBroadcast = function (loggedOutUser) {
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)
    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the logout:item event
      ioSocket.to(socketID).emit('logout:user', loggedOutUser);
    }
  }
}

/*
broadcasts an event to to all logged clients with the new item
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


    // definition and handling of events:

    //new user event sent by client serves as an example of websocket communication between server and client.
    //it is the only one that is being sent by the client in this initial project

    // event to receive new users and broadcast to all clients the new logged in user
    socket.on('userLogIn:username', data => {
      console.log("userLogIn:username -> User login event received: ", data);
      this.UserLoggedInBroadcast(data);
    });

    //event to receive logged out users and broadcast to all clients the new logged out user
    socket.on('userLogOut:username', data => {
      console.log("logOutUser:username -> User logout event received: ", data);
      // broadcast to all clients the logged out user
      this.UserLoggedOutBroadcast(data);
      // update database, set logged in = false
      user.updateOne({ username: username }, { $set: { islogged: false } });
    });

    //event to receive bids and update the item in the database if the bid received is higher than the current one
    socket.on('submit:bid', data => {
      console.log("submit:bid -> Received event submit:bid with data = ", data);
      //verify in the database if the data.bid is higher than the current one and if so update the object
      if (data.bid > data.item.currentbid) {
        // Find item by id and update the current bid
        item.updateOne({ id: data.item.id }, { $set: { currentbid: data.bid }})
          .then(() =>{
            item.find({id: data.item.id})
            .then(item =>{
              // broadcast the updated item to all active clients
              this.UpdateItemsBroadcast(item);
            });
          })
      }
    });

    //event to receive messages and relay to destination, server is not yet sending this event. 
    socket.on('send:message', chat => {
      console.log("send:message received with -> ", chat);
    });

    //Any other events that you wanto to add that are sent by the client to the server should be coded here you can use the Maps
    //to answer to all clients or the socket.emit method to reply to the same client that sent the received event.

    //when a user leaves this event is executed, cleanup what you need here, for example, update user database
    socket.on('disconnect', function () {
      console.log("User disconnected");
      let username = usernamebySocketID.get(socket.id); // get username from socketId in the Map
      // set isLogged = false
      user.updateOne({ username: username }, { $set: { islogged: false } });
    });

  });
}
