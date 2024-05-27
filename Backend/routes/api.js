/**
 * api code file
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const item = require('../models/item.js');
const user = require('../models/user.js');
const secret = 'this is the secret secret secret 12356'; // same secret as in socket.js used here to sign the authentication token
//get the file with the socket api code
const socket = require('./socket.js');



/*
 * POST User sign in. User Sign in POST is treated here
 */
exports.Authenticate =  (req, res) =>  {
  console.log('Authenticate -> Received Authentication POST');
  user.findOne({$and:[{username: req.body.username}, {password: req.body.password}]})
    .then(User => {
      if (User != null) {
        // user exists
        user.updateOne({username: req.body.username}, {$set: {islogged: true, latitude: req.body.latitude, longitude: req.body.longitude}})
          .then(update_result => {
            if (update_result) {
              //  update successfull
              console.log('Authenticate -> user update : success');
              var token = jwt.sign(req.body, secret);
              res.json({username: req.body.username, token: token});
            } else {
              // update failed
              console.log('Authenticate -> user update : failed');
            }
          })
          .catch(err => {
            // error while updating user
            console.log('Authenticate -> error while updating user');
          });
      } else {
        // user does not exist
        console.log('Authenticate -> user does not exist');
        // send a 401 Unauthorized
        res.status(401).send('Wrong username or password. Please try again.');
      }
    })
    .catch(err => {
      // there was an error in the database
      console.log('Authenticate -> database error occurred');
      // send a 5*** status using res.status
      res.status(500).send('Internal server error : database error occurred');
    });
};



/*
 * POST User registration. User registration POST is treated here
 */
exports.NewUser =  (req, res) => {
  console.log("NewUser -> received form submission new user");
  console.log(req.body);

  // check if user already exists
  user.findOne({$or:[{username: req.body.username}, {email: req.body.email}]})
    .then(existingUser => {
      if (existingUser != null) {
        // user exists
        console.log('NewUser -> user already exists');
        // send a 409 Conflict
        res.status(409).send('Username or email already exists. Please try again.');
      } else {
        // user does not exist
        console.log('NewUser -> user does not exist');
        user.create({ name: req.body.name, email: req.body.email, username: req.body.username, password: req.body.password, islogged: false, latitude: 0, longitude: 0 })
          .then(newUser => {
            // user created
            console.log('NewUser -> user created');
            // create a JSON object with the user and send it to the client
            res.json({
              name: newUser.name,
              email: newUser.email,
              username: newUser.username,
              password: newUser.password,
              latitude: newUser.latitude,
              longitude: newUser.longitude
            });
          })
          .catch(err => {
            // error while creating user
            console.log('NewUser -> error while creating user');
            res.status(500).send('Internal server error : error while creating user');
          });
      }
    })
    .catch(err => {
      // there was an error in the database
      console.log('NewUser -> database error occurred');
      // send a 5*** status using res.status
      res.status(500).send('Internal server error : database error occurred');
    });
};



/*
 * POST Item creation. Item creation POST is treated here
 */
exports.NewItem =  (req, res) => {
  console.log("NewItem -> received form submission new item");
	console.log(req.body);
  // verify if the item already exists (same description and same owner)
  item.findOne({$and:[{description: req.body.description}, {owner: req.body.owner}]})
    .then(existingItem => {
      if (existingItem != null) {
        // item exists
        console.log('NewItem -> item already exists');
        // send a 409 Conflict
        res.status(409).send('Item already exists. Please try again.');
      } else {
        // item does not exist
        console.log('NewItem -> item does not exist');
        // create the item with the data from the request (description, currentbid, remainingtime, buynow, owner)
        item.create({description: req.body.description, currentbid: req.body.currentbid, remainingtime: req.body.remainingtime, buynow: req.body.buynow, wininguser: '', sold: false, owner: req.body.owner})
          .then(newItem => {
            // item created
            console.log('NewItem -> item created');
            // create a JSON object with the item and send it to the client
            res.json({
              description: newItem.description,
              currentbid: newItem.currentbid,
              remainingtime: newItem.remainingtime,
              buynow: newItem.buynow,
              wininguser: newItem.wininguser,
              sold: newItem.sold,
              owner: newItem.owner
            });
          })
          .catch(err => {
            // error while creating item
            console.log('NewItem -> error while creating item');
            res.status(500).send('Internal server error : error while creating item');
          });
      }
    }).catch(err => {
      // there was an error in the database
      console.log('NewItem -> database error occurred');
      // send a 5*** status using res.status
      res.status(500).send('Internal server error : database error occurred');
    });
};



/*
 * POST Item removal. Item removal POST is treated here
 */
exports.RemoveItem =  (req, res) => {
  console.log("RemoveItem -> received form submission remove item");
  console.log(req.body);

  // check if the item exists so it can be removed
  item.removeAllListeners({$and:[{description: req.body.description}, {owner: req.body.owner}]})
    .then(removedItem => {
      if (removedItem != null) {
        // item removed
        console.log('RemoveItem -> item removed');
        // send a 200 OK
        res.status(200).send('Item removed successfully.');
      } else {
        // item does not exist
        console.log('RemoveItem -> item does not exist');
        // send a 404 Not Found
        res.status(404).send('Item does not exist. Please try again.');
      }
    }).catch(err => {
      // there was an error in the database
      console.log('RemoveItem -> database error occurred');
      // send a 5*** status using res.status
      res.status(500).send('Internal server error : database error occurred');
    });
};



/*
GET to obtain all active items in the database
*/
exports.GetItems = (req, res) => {
  console.log('GetItems -> received get items call');

  /*
  // get all active items in the database
  item.find({sold: false})
    .then(Items => {
      // items found
      console.log('GetItems -> items retrieved');
      // send the items to the client
      res.json(Items);
    }).catch(err => {
      // there was an error in the database
      console.log('GetItems -> database error occurred');
      // send a 5*** status using res.status
      res.status(500).send('Internal server error : database error occurred');
    });
  */

  // Dummy items just for example you should send the items that exist in the database use find instead of findOne
  let item1 = new item({description:'Smartphone',currentbid:250, remainingtime:120, buynow:1000, wininguser:'dummyuser1'});
  let item2 = new item({description:'Tablet',currentbid:300, remainingtime:120, buynow:940, wininguser:'dummyuser2'});
  let item3 = new item({description:'Computer',currentbid:120, remainingtime:120, buynow:880, wininguser:'dummyuser3'});
  let Items = [item1,item2,item3];

  res.json(Items); //send array of existing active items in JSON notation
  console.log ("received get Items call responded with: ", Items);
}


/*
GET to obtain all active users in the database
*/
exports.GetUsers = (req, res) => {
  console.log('GetUsers -> received get users call');

  /*
  // get all active users in the database
  user.find({islogged: true})
    .then(Users => {
      // users found
      console.log('GetUsers -> users retrieved');
      // send the users to the client
      res.json(Users);
    }).catch(err => {
      // there was an error in the database
      console.log('GetUsers -> database error occurred');
      // send a 5*** status using res.status
      res.status(500).send('Internal server error : database error occurred');
    });
  */

  res.status(200).send('OK'); //for now it sends just a 200 Ok like if no users are logged in
}

